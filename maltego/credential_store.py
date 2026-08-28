from __future__ import annotations

import base64
import ctypes
import os
import shutil
import subprocess
import sys
from pathlib import Path

APP_DIR = Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'PARA11AX'
TOKEN_FILE = APP_DIR / 'gateway-token.dpapi'
KEYCHAIN_SERVICE = 'para11ax'
KEYCHAIN_ACCOUNT = 'gateway-token'
SECRET_LABEL = 'PARA11AX token'
COMMAND_TIMEOUT_SECONDS = 10


class CredentialStoreError(RuntimeError):
    pass


def _require_windows() -> None:
    if os.name != 'nt':
        raise CredentialStoreError('DPAPI credential storage is available on Windows only')


def _protect(data: bytes) -> bytes:
    _require_windows()
    from ctypes import wintypes

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [('cbData', wintypes.DWORD), ('pbData', ctypes.POINTER(ctypes.c_ubyte))]

    buffer = ctypes.create_string_buffer(data)
    in_blob = DATA_BLOB(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    out_blob = DATA_BLOB()
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    crypt32.CryptProtectData.argtypes = [
        ctypes.POINTER(DATA_BLOB), ctypes.c_wchar_p, ctypes.POINTER(DATA_BLOB), ctypes.c_void_p,
        ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DATA_BLOB)
    ]
    crypt32.CryptProtectData.restype = wintypes.BOOL
    if not crypt32.CryptProtectData(ctypes.byref(in_blob), None, None, None, None, 0x1, ctypes.byref(out_blob)):
        raise CredentialStoreError('Windows DPAPI failed to protect the gateway token')
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        kernel32.LocalFree(out_blob.pbData)


def _unprotect(data: bytes) -> bytes:
    _require_windows()
    from ctypes import wintypes

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [('cbData', wintypes.DWORD), ('pbData', ctypes.POINTER(ctypes.c_ubyte))]

    buffer = ctypes.create_string_buffer(data)
    in_blob = DATA_BLOB(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte))
    )
    out_blob = DATA_BLOB()
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    crypt32.CryptUnprotectData.argtypes = [
        ctypes.POINTER(DATA_BLOB), ctypes.POINTER(ctypes.c_wchar_p), ctypes.POINTER(DATA_BLOB),
        ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DATA_BLOB)
    ]
    crypt32.CryptUnprotectData.restype = wintypes.BOOL
    if not crypt32.CryptUnprotectData(ctypes.byref(in_blob), None, None, None, None, 0x1, ctypes.byref(out_blob)):
        raise CredentialStoreError('Windows DPAPI failed to decrypt the gateway token')
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        kernel32.LocalFree(out_blob.pbData)


def _native_backend_name() -> str:
    if os.name == 'nt':
        return 'windows-dpapi'
    if sys.platform == 'darwin':
        if not Path('/usr/bin/security').exists():
            raise CredentialStoreError('macOS Keychain utility /usr/bin/security is unavailable')
        return 'macos-keychain'
    if sys.platform.startswith('linux'):
        if shutil.which('secret-tool'):
            return 'linux-secret-service'
        raise CredentialStoreError(
            'no secure Linux credential backend is available; install libsecret/secret-tool '
            'or set PARA11AX_TOKEN for the current process'
        )
    raise CredentialStoreError(f'no supported secure credential backend for platform {sys.platform!r}')


def backend_name() -> str:
    if os.environ.get('PARA11AX_TOKEN', '').strip():
        return 'environment'
    return _native_backend_name()


def _run_native(args: list[str], *, input_text: str | None = None, not_found_ok: bool = False) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(
            args,
            input=input_text,
            text=True,
            capture_output=True,
            timeout=COMMAND_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise CredentialStoreError('native credential backend command failed') from exc

    if result.returncode == 0:
        return result

    message = f'{result.stdout}\n{result.stderr}'.lower()
    if not_found_ok and ('not found' in message or 'could not be found' in message or 'no matching' in message):
        return result
    raise CredentialStoreError('native credential backend command failed')


def _run_interactive_native(args: list[str]) -> None:
    """Run a trusted native credential prompt attached directly to the user's terminal."""
    try:
        result = subprocess.run(args, check=False)
    except OSError as exc:
        raise CredentialStoreError('native credential backend command failed') from exc
    if result.returncode != 0:
        raise CredentialStoreError('native credential backend command failed')


def _save_windows(token: str, path: Path) -> Path:
    protected = _protect(token.encode('utf-8'))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(base64.b64encode(protected).decode('ascii'), encoding='ascii')
    return path


def _load_windows(path: Path) -> str:
    if not path.exists():
        raise CredentialStoreError('gateway token is not configured; run the platform installer or set PARA11AX_TOKEN')
    try:
        protected = base64.b64decode(path.read_text(encoding='ascii'), validate=True)
        token = _unprotect(protected).decode('utf-8').strip()
    except CredentialStoreError:
        raise
    except Exception as exc:
        raise CredentialStoreError('stored gateway token could not be read') from exc
    if not token:
        raise CredentialStoreError('stored gateway token is empty')
    return token


def _delete_windows(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:
        raise CredentialStoreError('stored gateway token could not be deleted') from exc


def _configure_macos_interactively() -> None:
    # `security ... -w` with -w last prompts through the terminal. Deliberately do not
    # pass a password argument or pipe one through stdin: the secret is entered directly
    # into Apple's Keychain tool and never enters our argv/log/captured-output path.
    _run_interactive_native([
        '/usr/bin/security', 'add-generic-password',
        '-a', KEYCHAIN_ACCOUNT,
        '-s', KEYCHAIN_SERVICE,
        '-U', '-w',
    ])
    # Verify the resulting item is actually readable before setup continues.
    _load_macos()


def _load_macos() -> str:
    result = _run_native([
        '/usr/bin/security', 'find-generic-password',
        '-a', KEYCHAIN_ACCOUNT,
        '-s', KEYCHAIN_SERVICE,
        '-w',
    ])
    token = result.stdout.strip()
    if not token:
        raise CredentialStoreError('stored gateway token is empty')
    return token


def _delete_macos() -> None:
    _run_native([
        '/usr/bin/security', 'delete-generic-password',
        '-a', KEYCHAIN_ACCOUNT,
        '-s', KEYCHAIN_SERVICE,
    ], not_found_ok=True)


def _secret_tool() -> str:
    command = shutil.which('secret-tool')
    if not command:
        raise CredentialStoreError(
            'no secure Linux credential backend is available; install libsecret/secret-tool '
            'or set PARA11AX_TOKEN for the current process'
        )
    return command


def _save_linux(token: str) -> None:
    _run_native([
        _secret_tool(), 'store', f'--label={SECRET_LABEL}',
        'service', KEYCHAIN_SERVICE,
        'account', KEYCHAIN_ACCOUNT,
    ], input_text=token)


def _load_linux() -> str:
    result = _run_native([
        _secret_tool(), 'lookup',
        'service', KEYCHAIN_SERVICE,
        'account', KEYCHAIN_ACCOUNT,
    ])
    token = result.stdout.strip()
    if not token:
        raise CredentialStoreError('gateway token is not configured; run the platform installer or set PARA11AX_TOKEN')
    return token


def _delete_linux() -> None:
    _run_native([
        _secret_tool(), 'clear',
        'service', KEYCHAIN_SERVICE,
        'account', KEYCHAIN_ACCOUNT,
    ], not_found_ok=True)


def configure_token_interactively() -> None:
    backend = _native_backend_name()
    if backend != 'macos-keychain':
        raise CredentialStoreError('native interactive credential setup is available only for macOS Keychain')
    _configure_macos_interactively()


def save_token(token: str, path: Path = TOKEN_FILE) -> Path | None:
    token = token.strip()
    if not token:
        raise CredentialStoreError('gateway token is empty')
    backend = _native_backend_name()
    if backend == 'windows-dpapi':
        return _save_windows(token, path)
    if backend == 'macos-keychain':
        raise CredentialStoreError(
            'macOS Keychain token creation must use the interactive platform installer; '
            'the token is intentionally never passed as a process argument or piped input'
        )
    if backend == 'linux-secret-service':
        _save_linux(token)
        return None
    raise CredentialStoreError('unsupported credential backend')


def load_token(path: Path = TOKEN_FILE) -> str:
    env_token = os.environ.get('PARA11AX_TOKEN', '').strip()
    if env_token:
        return env_token
    backend = _native_backend_name()
    if backend == 'windows-dpapi':
        return _load_windows(path)
    if backend == 'macos-keychain':
        return _load_macos()
    if backend == 'linux-secret-service':
        return _load_linux()
    raise CredentialStoreError('unsupported credential backend')


def delete_token(path: Path = TOKEN_FILE) -> None:
    backend = _native_backend_name()
    if backend == 'windows-dpapi':
        _delete_windows(path)
        return
    if backend == 'macos-keychain':
        _delete_macos()
        return
    if backend == 'linux-secret-service':
        _delete_linux()
        return
    raise CredentialStoreError('unsupported credential backend')


def _main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] not in {'save', 'check', 'delete', 'backend'}:
        print('usage: credential_store.py save|check|delete|backend', file=sys.stderr)
        return 2
    command = argv[1]
    if command == 'save':
        if _native_backend_name() == 'macos-keychain':
            if not sys.stdin.isatty():
                print('macOS Keychain setup must be run interactively', file=sys.stderr)
                return 2
            configure_token_interactively()
        else:
            save_token(sys.stdin.read())
        print('saved')
        return 0
    if command == 'check':
        load_token()
        print('configured')
        return 0
    if command == 'delete':
        delete_token()
        print('deleted')
        return 0
    print(backend_name())
    return 0


if __name__ == '__main__':
    raise SystemExit(_main(sys.argv))
