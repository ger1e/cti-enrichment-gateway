# Cross-platform Maltego Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver secure one-command Maltego installation, repair, update, checking, and uninstall workflows on Windows, macOS, and Linux with bash/zsh support.

**Architecture:** Keep PowerShell and shell launchers thin and centralize platform-neutral installation policy in `maltego/bootstrap.py`. Extend `credential_store.py` to select DPAPI, macOS Keychain, or Linux Secret Service without plaintext fallback, then make CI exercise bootstrap, credential, shell, packaging, and existing transform behavior.

**Tech Stack:** Python >=3.10 (preferred 3.12), maltego-trx 1.7.0, PowerShell 5.1+, POSIX shell, zsh, bash, macOS `security`, Linux `secret-tool`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-21-cross-platform-maltego-installer-design.md`

## Global Constraints
- Python hard floor is 3.10; preferred/tested bootstrap version is 3.12.
- Windows uses DPAPI, macOS uses Keychain, Linux uses Secret Service when available.
- No plaintext credential-file fallback.
- Explicit `PARA11AX_TOKEN` remains the ephemeral highest-precedence override.
- Vendor credentials never enter Maltego, MTZ, local repository files, or installer logs.
- macOS/Linux installer must work from zsh and bash without requiring permanent profile edits.
- Installation must be idempotent and must rebuild stale/incompatible `.venv` safely.
- Existing gateway and Maltego security limits remain unchanged.

---

### Task 1: Platform-neutral credential backends

**Files:**
- Modify: `maltego/credential_store.py`
- Modify: `maltego/tests/test_credential_store.py`

**Interfaces:**
- Produces: `backend_name() -> str`, `save_token(token: str)`, `load_token() -> str`, `delete_token() -> None`; CLI `save|check|delete|backend`.

- [ ] Write failing tests that mock Windows DPAPI, `/usr/bin/security`, and `secret-tool`, asserting environment override precedence, native backend selection, save/load/delete behavior, no plaintext fallback, and actionable failure when Linux has no secure store.
- [ ] Run `python -m unittest maltego.tests.test_credential_store -v`; expect new backend tests to fail.
- [ ] Implement platform dispatch while preserving existing DPAPI behavior. Invoke macOS Keychain and Linux Secret Service with argument arrays and stdin, never shell interpolation; use a stable service/account identifier.
- [ ] Add CLI `delete` and `backend`; ensure error strings never contain token material.
- [ ] Run credential tests and existing Maltego tests; expect PASS.
- [ ] Commit `feat(maltego): add native cross-platform credential stores`.

### Task 2: Shared bootstrap and venv recovery

**Files:**
- Create: `maltego/bootstrap.py`
- Create: `maltego/tests/test_bootstrap.py`
- Modify: `maltego/gateway_client.py`

**Interfaces:**
- Produces: interpreter discovery/version validation, venv health/rebuild, dependency/test/MTZ pipeline, readiness diagnostics, and CLI modes `--check|--repair|--update|--uninstall|--non-interactive|--gateway-url|--verbose`.
- Consumes: credential API from Task 1.

- [ ] Write failing tests for Python 3.9 rejection, 3.10+ acceptance, preference for 3.12, stale-venv rebuild decision, corrupt-venv recovery, idempotent healthy-venv behavior, gateway URL validation, and uninstall credential-preservation default.
- [ ] Run `python -m unittest maltego.tests.test_bootstrap -v`; expect FAIL because bootstrap does not exist.
- [ ] Implement pure discovery/decision helpers first so tests do not mutate the host.
- [ ] Implement subprocess execution with argument arrays, bounded captured diagnostics, explicit exit checking, and secret redaction.
- [ ] Implement venv creation/rebuild, requirements installation, test execution, MTZ generation/listing, and structural verification.
- [ ] Implement `--check`, `--repair`, `--update`, and `--uninstall`; uninstall must require an explicit credential-delete flag before invoking `delete_token()`.
- [ ] Update gateway-client credential guidance to reference the platform installer rather than Windows only.
- [ ] Run bootstrap, credential, and full Maltego tests; expect PASS.
- [ ] Commit `feat(maltego): add self-repairing shared bootstrap`.

### Task 3: macOS/Linux zsh/bash launcher

**Files:**
- Create: `maltego/install.sh`
- Create: `maltego/tests/test_install_shell.py`

**Interfaces:**
- Produces: one-command macOS/Linux launcher that resolves or bootstraps Python >=3.10 and delegates remaining arguments to `bootstrap.py`.

- [ ] Write static/invariant tests asserting no token appears on a command line, no `.zshrc`/`.zprofile`/`.bashrc` mutation, standard Homebrew paths are considered, Python version is checked before venv creation, and launcher delegates lifecycle flags.
- [ ] Run the new tests; expect FAIL because `install.sh` does not exist.
- [ ] Implement portable shell launcher with `set -eu`, safe quoting, current-process Homebrew discovery, macOS Homebrew Python bootstrap, Linux compatible-Python discovery, and exact package-manager guidance when no safe automatic path exists.
- [ ] Validate with `bash -n maltego/install.sh`, `zsh -n maltego/install.sh`, and ShellCheck.
- [ ] Run shell tests and full Maltego tests; expect PASS.
- [ ] Commit `feat(maltego): add macOS and Linux installer`.

### Task 4: Harden Windows launcher

**Files:**
- Modify: `maltego/install.ps1`
- Create: `maltego/tests/test_install_powershell.py`

**Interfaces:**
- Produces: Windows bootstrap that refuses Python <3.10, installs a supported Python with winget when necessary, and delegates lifecycle operations to `bootstrap.py`.

- [ ] Write invariant tests for explicit version validation, stale venv delegation, no token in command arguments/logs, winget fallback, and bootstrap delegation.
- [ ] Run tests; expect FAIL against current installer.
- [ ] Refactor `install.ps1` to discover compatible interpreters, install Python 3.12/3.13 only when required, verify it after installation, and invoke shared bootstrap.
- [ ] Validate PowerShell AST/parser syntax and run Windows installer invariants.
- [ ] Run full Maltego tests; expect PASS.
- [ ] Commit `refactor(maltego): harden Windows installer`.

### Task 5: MTZ integrity and release-safety verification

**Files:**
- Modify: `maltego/bootstrap.py`
- Create: `maltego/tests/test_mtz_integrity.py`
- Modify: `maltego/project.py` only if deterministic manifest access requires it.

**Interfaces:**
- Produces: `verify_mtz(path)` enforcing expected transform inventory, production-safe gateway configuration, bounded package contents, and secret-pattern absence.

- [ ] Write failing tests using synthetic good/bad MTZ archives for missing transforms, unexpected localhost/dev URLs, credential names/material, duplicate definitions, and oversized/unexpected files.
- [ ] Run integrity tests; expect FAIL.
- [ ] Implement bounded ZIP inspection without extracting untrusted paths to disk; compare transform identifiers against the project transform manifest.
- [ ] Run integrity tests and generate a real MTZ, then verify it; expect PASS.
- [ ] Commit `test(maltego): verify generated MTZ integrity`.

### Task 6: CI platform matrix and installer regression gates

**Files:**
- Modify: `.github/workflows/tooling-smoke.yml`

**Interfaces:**
- Consumes all tests and launchers from Tasks 1-5.

- [ ] Add CI assertions for `bash -n`, `zsh -n` where available, ShellCheck, PowerShell syntax, credential/backend tests, bootstrap tests, installer invariant tests, MTZ integrity tests, and existing Maltego suite.
- [ ] Add matrix jobs for Ubuntu, macOS, and Windows while keeping the existing repository/MAXX gate authoritative.
- [ ] Ensure native credential tests are mocked/non-destructive and CI never prompts for or stores a real gateway token.
- [ ] Run/inspect workflow validation and local static checks; expect PASS.
- [ ] Commit `ci: validate cross-platform Maltego installation`.

### Task 7: One-command documentation and lifecycle UX

**Files:**
- Modify: `maltego/README.md`
- Modify: root `README.md` if it links installation instructions.

**Interfaces:**
- Documents final supported commands and troubleshooting contract.

- [ ] Replace the Windows-only front door with Windows `./install.ps1` and macOS/Linux `./install.sh` quick starts.
- [ ] Document zsh/bash support, secure backend names, `--check`, `--repair`, `--update`, `--uninstall`, token precedence, supported Python floor, and exact MTZ import result.
- [ ] Keep manual developer commands below the one-command path rather than making users manage venv/pip themselves.
- [ ] Run documentation/invariant scans for obsolete Windows-only claims and Python-3.9-compatible implications; expect none.
- [ ] Commit `docs: document one-command Maltego setup`.

### Task 8: Full regression, security review, and PR

**Files:**
- Review all changed files.

**Interfaces:**
- Produces a merge-ready PR with reproducible evidence.

- [ ] Run the repository's complete Tooling smoke-equivalent suite, existing Node/MAXX tests, all Maltego tests, Python compilation, ShellCheck, bash/zsh syntax, PowerShell syntax, MTZ generation/integrity verification, and secret scans.
- [ ] Review diffs specifically for shell injection, subprocess interpolation, credential leakage, unsafe filesystem deletion, symlink/path traversal, insecure Linux fallback, and architecture/version-selection errors.
- [ ] Verify generated MTZ contains no gateway/vendor secret and the normal install path requires only one interactive token entry when a secure backend exists.
- [ ] Open PR with platform matrix, security properties, test evidence, and migration behavior.
- [ ] Wait for exact PR-head CI; fix any reproduced failure rather than bypassing it.
- [ ] Merge only after the authoritative Tooling smoke succeeds; separately report Vercel status because installer-only changes need not justify unsafe deployment workarounds.
