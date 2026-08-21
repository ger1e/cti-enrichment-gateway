# Cross-platform Maltego Installer Design

## Goal
Make Maltego local-transform installation a one-command, secure, self-repairing workflow on Windows, macOS, and Linux, including zsh and bash support.

## Architecture
Native launchers remain deliberately thin: `maltego/install.ps1` for Windows and `maltego/install.sh` for macOS/Linux. Shared installation policy lives in `maltego/bootstrap.py`, which owns interpreter validation, venv lifecycle, dependency installation, tests, MTZ generation, diagnostics, and lifecycle commands. OS-native credential storage remains in `credential_store.py` behind one interface.

## Supported environments
- Windows: PowerShell 5.1+, x64/ARM64 where Python is available; winget bootstrap when required.
- macOS: Apple Silicon and Intel; zsh and bash; Homebrew bootstrap path when a compatible Python is absent.
- Linux: x64/ARM64; bash and zsh. Existing Python >=3.10 is preferred. Package-manager guidance is explicit when automatic installation cannot be safely guaranteed.
- Python hard floor: 3.10. Preferred/tested bootstrap interpreter: 3.12. A stale, corrupt, wrong-version, or incompatible `.venv` is rebuilt automatically when safe.

## Credential model
Resolution order remains explicit `CTI_GATEWAY_TOKEN` environment variable first, then OS-native user credential storage. Windows uses DPAPI. macOS uses Keychain through `/usr/bin/security`. Linux uses Secret Service through `secret-tool` when available; if no secure backend exists, installation requires the ephemeral environment variable and never writes plaintext credentials to disk. Vendor credentials remain server-side only. Tokens must not appear in repository files, MTZ output, shell history, diagnostics, exceptions, or CI logs.

`credential_store.py` exposes `save`, `check`, `delete`, and `backend` commands and a platform-neutral `load_token()` API.

## Bootstrap behavior
`bootstrap.py` provides install, `--check`, `--repair`, `--update`, `--uninstall`, `--non-interactive`, `--gateway-url`, and `--verbose`. It detects OS/architecture/shell/interpreters, validates Python before venv creation, verifies venv Python independently, installs pinned requirements, runs Maltego tests, performs safe public gateway-contract checks, generates the MTZ, verifies package structure and transform manifest, scans generated output for credential material, and prints a concise readiness report.

Normal installation is idempotent. Security requirements are never weakened to make setup succeed. Uninstall removes generated/local integration artifacts and requires a separate explicit decision before deleting the OS credential.

## Native launchers
`install.ps1` ensures a compatible Windows Python exists, using winget when necessary, then delegates to `bootstrap.py`. `install.sh` is POSIX-oriented and intentionally compatible with both zsh and bash. On macOS it discovers Homebrew at standard Intel/Apple-Silicon locations without requiring permanent shell-profile edits. On Linux it discovers compatible Python first and otherwise emits exact package-manager guidance for apt/dnf/yum/zypper/pacman/apk/Homebrew as applicable.

## Maltego UX
Transforms remain grouped as CTI Gateway local transforms and preserve semantic distinctions between reputation, knowledge context, provider failure, not-applicable, negative evidence, rate limiting, and timeout. Graph expansion remains bounded and deduplicated. Evidence-v2 provenance, corroboration, contradictions, freshness, huntability, parser/integrity metadata, and separate KEV/EPSS/CVSS axes remain graphable without exposing upstream secrets.

## Verification and CI
CI validates Windows PowerShell syntax, shell syntax, ShellCheck, zsh/bash compatibility invariants, bootstrap unit tests, credential-backend tests with mocked native facilities, Python-version rejection/recovery, stale-venv repair, MTZ structural verification, secret scanning, existing Maltego tests, and existing gateway/MAXX invariants. Fresh-install and existing-install simulations must be covered without modifying developer machines.

## User experience
After cloning the repository:

Windows: `./install.ps1` from PowerShell.

macOS/Linux: `./install.sh` from zsh or bash.

The user enters the gateway token once through a non-echoing prompt when a secure native backend is available, receives a tested `cti-enrichment-gateway-local.mtz`, imports it into Maltego Graph Desktop, and does not manually manage Python, pip, or venvs during normal operation.
