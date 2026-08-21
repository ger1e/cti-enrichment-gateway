from __future__ import annotations

import argparse
import getpass
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from credential_store import CredentialStoreError, backend_name, delete_token, load_token, save_token

ROOT = Path(__file__).resolve().parent
VENV = ROOT / '.venv'
REQUIREMENTS = ROOT / 'requirements.txt'
MTZ = ROOT / 'cti-enrichment-gateway-local.mtz'
MIN_PYTHON = (3, 10)
PREFERRED_PYTHON = (3, 12)
DEFAULT_GATEWAY_URL = 'https://cti-enrichment-gateway.vercel.app'
MAX_CAPTURE_CHARS = 12_000


class BootstrapError(RuntimeError):
    pass


@dataclass(frozen=True, order=True)
class PythonCandidate:
    version: tuple[int, int, int]
    executable: str


def supported_version(version: tuple[int, ...]) -> bool:
    return tuple(version[:2]) >= MIN_PYTHON


def choose_python(candidates: list[PythonCandidate]) -> PythonCandidate | None:
    supported = [item for item in candidates if supported_version(item.version)]
    if not supported:
        return None
    preferred = [item for item in supported if item.version[:2] == PREFERRED_PYTHON]
    if preferred:
        return max(preferred, key=lambda item: item.version)
    return max(supported, key=lambda item: item.version)


def _parse_python_version(value: str) -> tuple[int, int, int] | None:
    parts = value.strip().split('.')
    if len(parts) < 2:
        return None
    try:
        numbers = tuple(int(part) for part in parts[:3])
    except ValueError:
        return None
    return (numbers + (0, 0, 0))[:3]


def probe_python(executable: str) -> tuple[int, int, int] | None:
    try:
        result = subprocess.run(
            [executable, '-c', 'import sys; print(".".join(map(str, sys.version_info[:3])))'],
            text=True,
            capture_output=True,
            timeout=8,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return _parse_python_version(result.stdout)


def discover_python() -> list[PythonCandidate]:
    names = [
        sys.executable,
        'python3.12', 'python3.13', 'python3.11', 'python3.10', 'python3', 'python',
        '/opt/homebrew/bin/python3.12', '/usr/local/bin/python3.12',
    ]
    seen: set[str] = set()
    candidates: list[PythonCandidate] = []
    for name in names:
        resolved = name if os.path.isabs(name) else shutil.which(name)
        if not resolved:
            continue
        resolved = str(Path(resolved).resolve())
        if resolved in seen:
            continue
        seen.add(resolved)
        version = probe_python(resolved)
        if version:
            candidates.append(PythonCandidate(version, resolved))
    return candidates


def venv_python(venv: Path = VENV, *, windows: bool | None = None) -> Path:
    if windows is None:
        windows = os.name == 'nt'
    return venv / ('Scripts/python.exe' if windows else 'bin/python')


def venv_action(venv: Path = VENV) -> tuple[str, tuple[int, int, int] | None]:
    python = venv_python(venv)
    if not python.exists():
        return ('create' if not venv.exists() else 'rebuild', None)
    version = probe_python(str(python))
    if not version or not supported_version(version):
        return ('rebuild', version)
    return ('reuse', version)


def validate_gateway_url(value: str) -> str:
    value = (value or '').strip().rstrip('/')
    parsed = urlparse(value)
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise BootstrapError('invalid gateway URL')
    is_loopback = parsed.hostname in {'127.0.0.1', 'localhost', '::1'}
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and is_loopback):
        raise BootstrapError('gateway URL must use HTTPS (HTTP is allowed only for localhost)')
    if parsed.path not in {'', '/'}:
        raise BootstrapError('gateway URL must point to the gateway root')
    return value


def _safe_remove_tree(path: Path, *, root: Path = ROOT) -> None:
    root = root.resolve()
    candidate = path.resolve(strict=False)
    if candidate == root or root not in candidate.parents:
        raise BootstrapError('refusing to delete path outside Maltego root')
    if path.is_symlink():
        path.unlink(missing_ok=True)
        return
    if path.exists():
        shutil.rmtree(path)


def remove_local_artifacts(
    *,
    root: Path = ROOT,
    delete_credential: bool = False,
    credential_delete=delete_token,
) -> None:
    _safe_remove_tree(root / '.venv', root=root)
    (root / 'cti-enrichment-gateway-local.mtz').unlink(missing_ok=True)
    if delete_credential:
        credential_delete()


def _bounded_output(text: str) -> str:
    text = text or ''
    if len(text) <= MAX_CAPTURE_CHARS:
        return text
    return text[-MAX_CAPTURE_CHARS:]


def run_checked(args: list[str], *, cwd: Path = ROOT, env: dict[str, str] | None = None, verbose: bool = False) -> None:
    try:
        result = subprocess.run(
            args,
            cwd=str(cwd),
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )
    except OSError as exc:
        raise BootstrapError(f'failed to execute {Path(args[0]).name}') from exc
    if verbose:
        if result.stdout:
            print(_bounded_output(result.stdout), end='')
        if result.stderr:
            print(_bounded_output(result.stderr), file=sys.stderr, end='')
    if result.returncode != 0:
        raise BootstrapError(f'{Path(args[0]).name} failed with exit code {result.returncode}')


def _ensure_supported_bootstrap_python() -> PythonCandidate:
    candidates = discover_python()
    selected = choose_python(candidates)
    if not selected:
        found = ', '.join('.'.join(map(str, item.version)) for item in candidates) or 'none'
        raise BootstrapError(f'Python >=3.10 is required; compatible interpreter not found (detected: {found})')
    return selected


def _create_or_rebuild_venv(selected: PythonCandidate, *, verbose: bool) -> Path:
    action, _version = venv_action(VENV)
    if action == 'rebuild':
        _safe_remove_tree(VENV)
    if action in {'create', 'rebuild'}:
        run_checked([selected.executable, '-m', 'venv', str(VENV)], verbose=verbose)
    python = venv_python(VENV)
    version = probe_python(str(python))
    if not version or not supported_version(version):
        raise BootstrapError('virtual environment was created with an unsupported Python version')
    return python


def _install_requirements(python: Path, *, update: bool, verbose: bool) -> None:
    run_checked([str(python), '-m', 'pip', 'install', '--upgrade', 'pip'], verbose=verbose)
    args = [str(python), '-m', 'pip', 'install', '--prefer-binary']
    if update:
        args.append('--upgrade')
    args.extend(['-r', str(REQUIREMENTS)])
    run_checked(args, verbose=verbose)


def _run_validation(python: Path, *, verbose: bool) -> None:
    run_checked([str(python), '-m', 'unittest', 'discover', '-s', 'tests', '-v'], verbose=verbose)
    run_checked([str(python), '-m', 'compileall', '-q', '.'], verbose=verbose)


def _generate_mtz(python: Path, *, verbose: bool) -> None:
    run_checked([str(python), 'project.py', 'mtz'], verbose=verbose)
    if not MTZ.is_file() or MTZ.stat().st_size == 0:
        raise BootstrapError('Maltego MTZ generation did not produce a non-empty package')


def _credential_ready(*, non_interactive: bool) -> str:
    try:
        load_token()
        return backend_name()
    except CredentialStoreError as first_error:
        if non_interactive:
            raise BootstrapError(str(first_error)) from first_error
    try:
        backend = backend_name()
    except CredentialStoreError as backend_error:
        raise BootstrapError(str(backend_error)) from backend_error
    token = getpass.getpass(f'CTI_GATEWAY_TOKEN (stored via {backend}): ').strip()
    if not token:
        raise BootstrapError('gateway token cannot be empty')
    try:
        save_token(token)
        return backend
    finally:
        token = ''


def check_state(*, gateway_url: str) -> dict[str, str]:
    selected = _ensure_supported_bootstrap_python()
    action, version = venv_action(VENV)
    if action != 'reuse':
        raise BootstrapError(f'virtual environment requires {action}; run the installer or --repair')
    if not MTZ.is_file() or MTZ.stat().st_size == 0:
        raise BootstrapError('Maltego MTZ is missing; run the installer or --repair')
    try:
        credential = backend_name()
        load_token()
    except CredentialStoreError as exc:
        raise BootstrapError(str(exc)) from exc
    return {
        'platform': f'{sys.platform}/{os.uname().machine if hasattr(os, "uname") else os.name}',
        'python': '.'.join(map(str, selected.version)),
        'venv': '.'.join(map(str, version or (0, 0, 0))),
        'credential': credential,
        'gateway': validate_gateway_url(gateway_url),
        'mtz': str(MTZ),
    }


def print_ready(state: dict[str, str]) -> None:
    print('CTI Gateway / Maltego')
    print(f"Platform             {state['platform']}")
    print(f"Python               {state['python']} PASS")
    print(f"Virtual environment  {state['venv']} PASS")
    print(f"Credential backend   {state['credential']} PASS")
    print(f"Gateway              {state['gateway']} PASS")
    print(f"MTZ                   {state['mtz']} PASS")
    print('READY FOR MALTEGO')


def install(*, gateway_url: str, update: bool, non_interactive: bool, verbose: bool) -> dict[str, str]:
    gateway_url = validate_gateway_url(gateway_url)
    selected = _ensure_supported_bootstrap_python()
    python = _create_or_rebuild_venv(selected, verbose=verbose)
    _install_requirements(python, update=update, verbose=verbose)
    _run_validation(python, verbose=verbose)
    credential = _credential_ready(non_interactive=non_interactive)
    env = os.environ.copy()
    env['CTI_GATEWAY_URL'] = gateway_url
    _generate_mtz(python, verbose=verbose)
    version = probe_python(str(python)) or (0, 0, 0)
    return {
        'platform': f'{sys.platform}/{os.uname().machine if hasattr(os, "uname") else os.name}',
        'python': '.'.join(map(str, selected.version)),
        'venv': '.'.join(map(str, version)),
        'credential': credential,
        'gateway': gateway_url,
        'mtz': str(MTZ),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='CTI Gateway Maltego bootstrap')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='read-only readiness check')
    mode.add_argument('--repair', action='store_true', help='repair/rebuild local runtime when needed')
    mode.add_argument('--update', action='store_true', help='refresh pinned dependencies and regenerate package')
    mode.add_argument('--uninstall', action='store_true', help='remove local runtime and generated MTZ')
    parser.add_argument('--delete-credential', action='store_true', help='with --uninstall, also remove the OS credential')
    parser.add_argument('--non-interactive', action='store_true', help='never prompt for credentials')
    parser.add_argument('--gateway-url', default=os.environ.get('CTI_GATEWAY_URL', DEFAULT_GATEWAY_URL))
    parser.add_argument('--verbose', action='store_true')
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.delete_credential and not args.uninstall:
            raise BootstrapError('--delete-credential is valid only with --uninstall')
        if args.uninstall:
            remove_local_artifacts(delete_credential=args.delete_credential)
            print('Maltego local runtime removed.' + (' Credential removed.' if args.delete_credential else ' Credential preserved.'))
            return 0
        if args.check:
            state = check_state(gateway_url=args.gateway_url)
        else:
            state = install(
                gateway_url=args.gateway_url,
                update=args.update,
                non_interactive=args.non_interactive,
                verbose=args.verbose,
            )
        print_ready(state)
        return 0
    except (BootstrapError, CredentialStoreError) as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
