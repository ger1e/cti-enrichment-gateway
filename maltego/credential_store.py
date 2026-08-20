from __future__ import annotations

import base64
import ctypes
import os
import sys
from pathlib import Path

APP_DIR = Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'CTIEnrichmentGateway'
TOKEN_FILE = APP_DIR / 'gateway-token.dpapi'


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
    in_blob = DATA_BLOB(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
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


def save_token(token: str, path: Path = TOKEN_FILE) -> Path:
    token = token.strip()
    if not token:
        raise CredentialStoreError('gateway token is empty')
    protected = _protect(token.encode('utf-8'))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(base64.b64encode(protected).decode('ascii'), encoding='ascii')
    return path


def load_token(path: Path = TOKEN_FILE) -> str:
    env_token = os.environ.get('CTI_GATEWAY_TOKEN', '').strip()
    if env_token:
        return env_token
    if not path.exists():
        raise CredentialStoreError('gateway token is not configured; run install.ps1 or set CTI_GATEWAY_TOKEN')
    try:
        protected = base64.b64decode(path.read_text(encoding='ascii'), validate=True)
        return _unprotect(protected).decode('utf-8')
    except CredentialStoreError:
        raise
    except Exception as exc:
        raise CredentialStoreError('stored gateway token could not be read') from exc


def _main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] not in {'save', 'check'}:
        print('usage: credential_store.py save|check', file=sys.stderr)
        return 2
    if argv[1] == 'save':
        save_token(sys.stdin.read())
        print('saved')
        return 0
    load_token()
    print('configured')
    return 0


if __name__ == '__main__':
    raise SystemExit(_main(sys.argv))
