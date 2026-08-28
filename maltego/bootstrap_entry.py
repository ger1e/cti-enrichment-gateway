from __future__ import annotations

import os
import sys

import bootstrap
from credential_store import CredentialStoreError, configure_token_interactively, load_token


def _is_setup_mode(argv: list[str]) -> bool:
    return '--check' not in argv and '--uninstall' not in argv


def _is_non_interactive(argv: list[str]) -> bool:
    return '--non-interactive' in argv


def prepare_native_credential(argv: list[str]) -> None:
    """Prepare only the native credential flow that must own its terminal prompt.

    macOS Keychain's `security ... -w` prompt is intentionally attached directly to
    the user's terminal. Other platforms remain handled by bootstrap.py, and an
    explicit PARA11AX_TOKEN environment override is never persisted implicitly.
    """
    if sys.platform != 'darwin' or not _is_setup_mode(argv):
        return
    if os.environ.get('PARA11AX_TOKEN', '').strip():
        return
    try:
        load_token()
        return
    except CredentialStoreError:
        if _is_non_interactive(argv):
            return
    configure_token_interactively()


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    try:
        prepare_native_credential(args)
    except CredentialStoreError as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        return 1
    return bootstrap.main(args)


if __name__ == '__main__':
    raise SystemExit(main())
