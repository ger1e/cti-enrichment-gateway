from __future__ import annotations

import argparse
import getpass
import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

from credential_store import CredentialStoreError, backend_name, delete_token, load_token, save_token

ROOT = Path(__file__).resolve().parent
VENV = ROOT / '.venv'
REQUIREMENTS = ROOT / 'requirements.txt'
MTZ = ROOT / 'para11ax-local.mtz'
TRANSFORM_MANIFEST = ROOT / 'transform-manifest.json'
PROVIDER_MANIFEST = ROOT.parent / 'config' / 'providers.json'
MIN_PYTHON = (3, 10)
PREFERRED_PYTHON = (3, 12)
DEFAULT_GATEWAY_URL = 'https://para11ax.vercel.app'
MAX_CAPTURE_CHARS = 12_000
MAX_MTZ_BYTES = 10_000_000
MAX_MTZ_ENTRIES = 500
MAX_MTZ_ENTRY_BYTES = 2_000_000
MAX_MTZ_UNCOMPRESSED_BYTES = 20_000_000
FORBIDDEN_DEV_URLS = ('localhost', '127.0.0.1', '[::1]')


class BootstrapError(RuntimeError):
    pass


def _load_forbidden_mtz_tokens(path: Path = PROVIDER_MANIFEST) -> tuple[str, ...]:
    try:
        manifest = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        raise BootstrapError('provider manifest could not be read for MTZ verification') from exc
    if not isinstance(manifest, dict) or not manifest or len(manifest) > 64:
        raise BootstrapError('provider manifest is invalid for MTZ verification')
    tokens = {'PARA11AX_TOKEN', 'SENTRY_AUTH_TOKEN'}
    for name, policy in manifest.items():
        if not isinstance(name, str) or not isinstance(policy, dict):
            raise BootstrapError('provider manifest contains invalid entries')
        credential = policy.get('credentialEnv')
        if credential is None:
            continue
        if not isinstance(credential, str) or not credential or len(credential) > 80 or not credential.replace('_', '').isalnum() or credential.upper() != credential:
            raise BootstrapError('provider manifest contains an invalid credential identifier')
        tokens.add(credential)
    return tuple(sorted(tokens))


FORBIDDEN_MTZ_TOKENS = _load_forbidden_mtz_tokens()


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
    (root / 'para11ax-local.mtz').unlink(missing_ok=True)
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


def _load_transform_manifest(path: Path = TRANSFORM_MANIFEST) -> dict:
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        raise BootstrapError('transform manifest could not be read') from exc
    transforms = value.get('transforms') if isinstance(value, dict) else None
    if not isinstance(transforms, list) or not transforms:
        raise BootstrapError('transform manifest is invalid')
    classes = [item.get('class') for item in transforms if isinstance(item, dict)]
    if len(classes) != len(transforms) or not all(isinstance(name, str) and name for name in classes):
        raise BootstrapError('transform manifest contains invalid transform entries')
    if len(classes) != len(set(classes)):
        raise BootstrapError('transform manifest contains duplicate transform classes')
    return value


def _safe_zip_name(name: str) -> bool:
    path = PurePosixPath(name.replace('\\', '/'))
    return not path.is_absolute() and '..' not in path.parts and bool(path.parts)


def verify_mtz(path: Path = MTZ, *, manifest_path: Path = TRANSFORM_MANIFEST) -> str:
    if not path.is_file() or path.stat().st_size <= 0:
        raise BootstrapError('Maltego MTZ is missing or empty')
    if path.stat().st_size > MAX_MTZ_BYTES:
        raise BootstrapError('Maltego MTZ exceeds archive size limit')
    manifest = _load_transform_manifest(manifest_path)
    expected = [item['class'] for item in manifest['transforms']]
    try:
        with zipfile.ZipFile(path, 'r') as archive:
            infos = archive.infolist()
            if not infos or len(infos) > MAX_MTZ_ENTRIES:
                raise BootstrapError('Maltego MTZ contains an invalid number of entries')
            names = [info.filename for info in infos]
            if len(names) != len(set(names)):
                raise BootstrapError('Maltego MTZ contains duplicate archive entries')
            total_uncompressed = 0
            text_parts: list[str] = []
            for info in infos:
                if not _safe_zip_name(info.filename):
                    raise BootstrapError('Maltego MTZ contains an unsafe archive path')
                mode = info.external_attr >> 16
                if mode and stat.S_ISLNK(mode):
                    raise BootstrapError('Maltego MTZ contains a symbolic link entry')
                if info.file_size > MAX_MTZ_ENTRY_BYTES:
                    raise BootstrapError('Maltego MTZ contains an oversized entry')
                total_uncompressed += info.file_size
                if total_uncompressed > MAX_MTZ_UNCOMPRESSED_BYTES:
                    raise BootstrapError('Maltego MTZ exceeds uncompressed size limit')
                if info.is_dir() or info.file_size == 0:
                    continue
                data = archive.read(info)
                text_parts.append(data.decode('utf-8', errors='ignore'))
    except zipfile.BadZipFile as exc:
        raise BootstrapError('Maltego MTZ is not a valid ZIP archive') from exc

    combined = '\n'.join(text_parts)
    for token in FORBIDDEN_MTZ_TOKENS:
        if token in combined:
            raise BootstrapError(f'Maltego MTZ contains forbidden credential identifier {token}')
    lowered = combined.lower()
    for dev_host in FORBIDDEN_DEV_URLS:
        if dev_host.lower() in lowered:
            raise BootstrapError('Maltego MTZ contains a development/loopback gateway reference')
    missing = [name for name in expected if name not in combined]
    if missing:
        raise BootstrapError(f'Maltego MTZ is missing expected transforms: {", ".join(missing)}')
    return hashlib.sha256(path.read_bytes()).hexdigest()


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


def _generate_mtz(python: Path, *, verbose: bool) -> str:
    run_checked([str(python), 'project.py', 'mtz'], verbose=verbose)
    return verify_mtz(MTZ)


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
    token = getpass.getpass(f'PARA11AX_TOKEN (stored via {backend}): ').strip()
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
    mtz_sha256 = verify_mtz(MTZ)
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
        'mtzSha256': mtz_sha256,
    }


def print_ready(state: dict[str, str]) -> None:
    print('PARA11AX / Maltego')
    print(f"Platform             {state['platform']}")
    print(f"Python               {state['python']} PASS")
    print(f"Virtual environment  {state['venv']} PASS")
    print(f"Credential backend   {state['credential']} PASS")
    print(f"Gateway              {state['gateway']} PASS")
    print(f"MTZ                   {state['mtz']} PASS")
    print(f"MTZ SHA-256           {state['mtzSha256']}")
    print('READY FOR MALTEGO')


def install(*, gateway_url: str, update: bool, non_interactive: bool, verbose: bool) -> dict[str, str]:
    gateway_url = validate_gateway_url(gateway_url)
    selected = _ensure_supported_bootstrap_python()
    python = _create_or_rebuild_venv(selected, verbose=verbose)
    _install_requirements(python, update=update, verbose=verbose)
    _run_validation(python, verbose=verbose)
    credential = _credential_ready(non_interactive=non_interactive)
    mtz_sha256 = _generate_mtz(python, verbose=verbose)
    version = probe_python(str(python)) or (0, 0, 0)
    return {
        'platform': f'{sys.platform}/{os.uname().machine if hasattr(os, "uname") else os.name}',
        'python': '.'.join(map(str, selected.version)),
        'venv': '.'.join(map(str, version)),
        'credential': credential,
        'gateway': gateway_url,
        'mtz': str(MTZ),
        'mtzSha256': mtz_sha256,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='PARA11AX Maltego bootstrap')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='read-only readiness check')
    mode.add_argument('--repair', action='store_true', help='repair/rebuild local runtime when needed')
    mode.add_argument('--update', action='store_true', help='refresh pinned dependencies and regenerate package')
    mode.add_argument('--uninstall', action='store_true', help='remove local runtime and generated MTZ')
    parser.add_argument('--delete-credential', action='store_true', help='with --uninstall, also remove the OS credential')
    parser.add_argument('--non-interactive', action='store_true', help='never prompt for credentials')
    parser.add_argument('--gateway-url', default=os.environ.get('PARA11AX_URL', DEFAULT_GATEWAY_URL))
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
