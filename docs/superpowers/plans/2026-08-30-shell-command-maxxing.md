<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Document status:** Historical design record. Preserved for implementation history; current behavior is defined by [docs/ARCHITECTURE.md](https://github.com/ger1e/para11ax/blob/main/docs/ARCHITECTURE.md) and the current README.

# PARA11AX Shell Command Maxxing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. TDD and verification gates remain mandatory.

**Goal:** Replace the split WebUI and Node command implementations with one shared, typed, fail-closed PARA11AX command fabric while preserving the existing command surface and adding absolute-max discovery, provider, evidence, report, and safe pipeline capabilities.

**Architecture:** Browser-safe command primitives live under `app/shell-core/` and are imported by both WebUI and Node CLI. The shared core owns descriptors, parsing, ASTs, type validation, help/completion, transforms, and pipeline execution. Browser and Node executors own surface-specific effects. Direct provider commands route through one authenticated gateway endpoint selecting one named registered provider through existing provider/orchestrator controls.

**Tech stack:** Node.js 24.x, ECMAScript modules, browser ES modules, `node:test`, Vercel serverless functions, existing PARA11AX provider/orchestrator/report/case modules.

**Approved design:** `docs/superpowers/specs/2026-08-30-shell-command-maxxing-design.md`.

## Non-negotiable constraints

- One grammar and one declarative command registry are shared by WebUI and Node CLI.
- Existing WebUI commands and aliases remain compatible unless demonstrably unsafe.
- Existing Node CLI commands remain available: `doctor`, `providers list`, `providers env-template`, `providers probe`, `maltego check`, `release verify`, `setup`, `repair`, `report compile`, and `report diff`.
- No arbitrary OS command execution, `eval`, `Function`, command substitution, shell chaining, host redirects, arbitrary URL fetching, or generic filesystem primitives.
- Backticks, `$()`, `&&`, `||`, semicolon chaining, and OS-shell redirects are invalid PARA11AX syntax.
- Provider commands inherit active state, supported types, fixed hosts, HTTPS-only policy, allowed methods, credential policy, cost class, admission/execution policy, timeout, response size, concurrency, retries, and distribution policy.
- Browser secrets remain memory-only and never enter history, output, errors, or command metadata.
- Browser provider execution never receives provider credentials; it calls same-origin authenticated PARA11AX endpoints only.
- Pipelines are sequential, typed, bounded, cancellable, and fail-fast.
- TDD is mandatory: failing contract test before behavior change.
- `npm test`, `npm run check`, and `npm run verify:tooling` must pass before the implementation PR is considered complete.

## Target structure

Shared core:
- `app/shell-core/errors.js`
- `app/shell-core/types.js`
- `app/shell-core/registry.js`
- `app/shell-core/parser.js`
- `app/shell-core/transforms.js`
- `app/shell-core/runtime.js`
- `app/shell-core/catalog.js`
- `app/shell-core/help.js`
- `app/shell-core/completion.js`

Browser integration:
- `app/shell-browser-executor.js`
- `app/shell.js` compatibility facade with no independent taxonomy
- `app/shell-ui.js` DOM/input/history/rendering/audio/cancellation only
- `app/case-shell-bridge.js` workspace adapter with no second submit path
- `app/api-client.js` bounded named-provider operation

Gateway integration:
- `src/app.js` named-provider handler using existing orchestrator
- `api/para11ax/provider.js` Vercel adapter

Node integration:
- `src/control/shell-node-executor.js`
- `bin/para11ax.mjs` thin argv adapter over shared parser/runtime

Test support:
- `test/helpers/shell-v9-fixtures.mjs` credential-free concrete fixtures

## Task record

### Task 1 — Shared errors, value types, registry, fixtures

Create the shared error model, value types and hard bounds, registry resolution/validation, and reusable shell-v9 fixtures. Registry must support longest-prefix canonical resolution, aliases, namespaces, surfaces, frozen descriptors, and duplicate rejection. Central pipeline limits are 12 stages, 1,000 records, 2,000,000 intermediate bytes, 512,000 rendered bytes, and 10,000 text lines.

Verification: registry tests plus legacy shell tests.

### Task 2 — Safe tokenizer and pipeline AST

Create deterministic tokenizer/parser with quotes/backslash escapes and native `|` stages. Reject empty/oversized pipelines, backticks, `$()`, `&&`, `||`, semicolon chaining, and redirects. Comparison tokens are accepted only in the registered `where` expression position. No shell libraries or dynamic evaluation.

Verification: parser-v9 plus legacy shell tests.

### Task 3 — Structured and text transforms

Implement typed bounded transforms: `where`, `select`, `fields`, `sort`, `unique`, `count`, `group`, `pluck`, `head`, `tail`, dotted-path `jsonpath`, `grep`, `wc`, `uniq`. Field paths are restricted to `/^[A-Za-z0-9_.-]{1,128}$/`; JSON path support is dotted keys/numeric indices only, not an evaluator.

Verification: transform type, malformed-expression, and output-limit tests.

### Task 4 — Shared pipeline runtime

Implement `executePipeline(ast, { registry, executor, context, signal, limits })`. Stage order: resolve alias → descriptor/args → surface → auth/capability → input type → execute → typed output assertion → bounds → next stage. Preserve `ShellCommandError`, normalize aborts to `OPERATION_ABORTED`, wrap unexpected executor failures as bounded/redacted `UPSTREAM_FAILED`.

Verification: pipeline-v9 and shell-runtime tests.

### Task 5 — Absolute-max catalog, discovery, help, completion

Create the single command taxonomy and derive help/manual/search/which/aliases/capabilities/limits/completion from it. Required namespaces: discovery, session, system, intel, provider, result, case, report, export, terminal, transform. Preserve legacy aliases. Register fixed provider front doors `vt`, `gn`, `otx`, `urlscan`, `threatfox`, `malwarebazaar`, `rdap`, `epss`, `kev`, `nvd`, `censys`, plus specialized Shodan. `provider run` remains policy-bound, never generic HTTP.

Verification: catalog-v9 plus legacy shell/Shodan/User Scanner regression tests.

### Task 6 — Browser executor and compatibility facade

Create `createBrowserShellExecutor(...)` for browser effects and session-local state. Implement existing browser commands first: login/auth, health/status/meta, enrichment/profile/batch, User Scanner, Shodan, result aliases, JSON/STIX/copy, sound/volume/theme/pwd/hostname/date/echo, reboot/disconnect. `app/shell.js` may retain compatibility exports during migration but must derive metadata/completion from the shared catalog and contain no second taxonomy.

Verification: browser-executor-v9 and existing WebUI regression suites.

### Task 7 — Named-provider gateway operation

Add authenticated `POST /api/para11ax/provider` accepting only `{ provider, indicator, type? }`. Expected failures: unknown `404 provider_not_found`, inactive `409 provider_inactive`, unsupported type `400 provider_type_unsupported`, missing required credential `409 provider_unconfigured`. Validate provider names with `/^[a-z0-9-]{1,64}$/`. Execute exactly one named registered provider through the existing orchestrator; never accept host, method, credential, timeout, parser, response-size, raw request, or arbitrary fetch options. Browser client sends only provider and indicator to same-origin route.

Verification: provider command API, shell API, provider contract, egress and execution-policy tests.

### Task 8 — Browser system/intel/provider families

Expose typed intel front doors, normalization/type/validation through the existing browser-safe classifier, provider metadata/status/coverage/run, and direct provider aliases. Direct provider execution updates `currentResult` like ordinary enrichment. `provider probe` stays unavailable on Web.

Verification: provider-terminal-v9, browser executor, Shodan and API regression tests.

### Task 9 — Pipeline-native result/evidence commands

Typed outputs include evidence, relationships, graph, guidance, record/records projections, and raw enrichment. `result graph` and `result guidance` must use the authoritative enrichment envelope without recomputation. Preserve direct result aliases. Record-like evidence/relationship/provider-list values must compose through safe record transforms.

Verification: result-v9 plus legacy shell/surface tests.

### Task 10 — Case workspace through shared executor

Keep IndexedDB repository/runtime creation, bundle import picker, download helper, and enrichment-capture observer in `app/case-shell-bridge.js`, but remove its submit/parser ownership. Route case lifecycle, pin/unpin/note/diff, and read-only pins/notes/timeline/graph through the shared catalog/browser executor. `app/shell-ui.js` is the only shell submit owner. Do not duplicate persistence. Disconnect/reboot reset runtime-only active case state at the shared execution/UI boundary.

Verification:
`node --test test/shell-case-v9.test.mjs test/case-shell-wiring-v8.test.mjs test/shell-case-grammar-v8.test.js test/shell-case-runtime-v8.test.js test/shell.test.mjs`

### Task 11 — WebUI executes the shared pipeline runtime

Files: `app/shell-ui.js`, `app/shell.js`, `test/unix-shell-surface.test.mjs`, `test/shell.test.mjs`.

Required RED structural contract before migration:
- `shell-ui.js` contains `parseShellLine`.
- `shell-ui.js` contains `executePipeline`.
- `shell-ui.js` contains `completeShellInput`.
- `shell-ui.js` does not call `interpretCommand(`.

Behavior contracts:
- `enrich 8.8.8.8 | result evidence | head 1` performs one enrichment call and returns exactly one evidence record.
- `echo x && health` fails `INVALID_SYNTAX` with zero health calls.

Implementation:
- Replace command-specific submit routing/`executeAction()`/`runGateway()` knowledge in `shell-ui.js` with `parseShellLine()` + `executePipeline()` + final typed-value rendering.
- Keep DOM, status, history, prompt, audio/glitch callbacks, downloads, and cancellation in UI.
- `Ctrl+C` aborts the active pipeline controller.
- Tab completion uses `completeShellInput()`.

Verification:
`node --test test/shell.test.mjs test/shell-api.test.mjs test/shell-runtime.test.mjs test/unix-shell-surface.test.mjs test/shodan-terminal.test.mjs test/user-scanner-terminal.test.mjs test/shell-case-v9.test.mjs test/shell-result-v9.test.mjs`

Target commit label: `refactor(shell): execute shared pipelines in WebUI`.

### Task 12 — Node executor and CLI migration

Create `src/control/shell-node-executor.js`; migrate `bin/para11ax.mjs` to shared argv parser/runtime; modify existing control helpers only when pure structured return variants are needed. Preserve legacy forms: doctor, provider list/env-template/probe, Maltego check, release verify, setup, repair, report compile/diff. Literal `|` in argv executes an internal PARA11AX pipeline; real host shells require quoting/escaping the pipe. Do not scrape stdout to recover structured data.

Verification:
`node --test test/node-cli-shell-v9.test.mjs test/cli.test.js test/provider-probe-all-types.test.js test/report-bundle.test.js test/report-diff.test.js test/report-quality.test.js`
then `npm run verify:tooling`.

Target commit label: `refactor(shell): unify Node CLI with shared command fabric`.

### Task 13 — Reports and exports with explicit surface gates

Web completion must not suggest CLI-only `report compile`; help/man must still mark it `[CLI ONLY]`. Direct Web execution must fail `SURFACE_UNAVAILABLE` before filesystem effects. Node report projections include text/html/pdf/csv/kql/navigator/stix/evidence/manifest using existing report model, quality gate, renderers and compiler. Filesystem writes remain only in descriptors declaring `sideEffect:'filesystem'`. Web exposes only safe in-memory result artifacts. Preserve JSON/STIX/copy/download behavior.

Verification:
`node --test test/shell-report-v9.test.mjs test/report-bundle.test.js test/report-diff.test.js test/report-model.test.js test/report-quality.test.js test/report-renderers.test.js test/report-release-security.test.js test/shell.test.mjs`

Target commit label: `feat(shell): add surface-gated report command family`.

### Task 14 — Security and compatibility hardening

Adversarial inputs must reject before executor/provider/fetch work:
- ``echo `id` ``
- `echo $(id)`
- `help && health`
- `help || health`
- `help; health`
- `echo x > /tmp/x`
- `echo x >> /tmp/x`
- `cat < /etc/passwd`
- provider run with `--host`, `--method`, or `--credential` overrides

Registry contains no generic `sudo`, `ssh`, `curl`, `wget`, `eval`, `exec`, or `source`. Every direct-provider descriptor has immutable provider identity and no host/method/credential flags. Login secrets must never appear in history, rendered errors, context, or JSON serialization. Stage/record/intermediate/rendered/text-line ceilings return `OUTPUT_LIMIT`. Duplicate canonical/alias metadata fails registry construction.

Focused security verification is followed by:
`npm test`
`npm run check`
`npm run verify:tooling`

Target commit label: `test(shell): harden command fabric security and compatibility`.

### Task 15 — Shell documentation and final acceptance

Create `docs/SHELL.md`; update `docs/SHODAN-SHELL.md`; update README only if public shell summary is stale. Documentation parity test verifies canonical public namespaces and direct provider shorthands from the live registry. `docs/SHELL.md` covers grammar/quoting, internal pipes, host-shell pipe caveat for CLI, discovery, namespaces, aliases, provider cost/surface visibility, report/export differences, hard security exclusions, and examples. Shodan remains the specialized bounded operator family inside the unified fabric.

Final verification:
`npm test`
`npm run check`
`npm run verify:tooling`
`git diff --check`
`git status --short`

Target commit label: `docs(shell): document unified command fabric`.

## Final acceptance checklist

- `COMMAND_REGISTRY` is the only command taxonomy source.
- WebUI and Node CLI both use the shared parser/runtime.
- Existing WebUI commands/aliases remain behaviorally compatible.
- Existing Node administrative/report commands remain available.
- Direct provider front doors and `provider run` cannot override provider policy.
- Named-provider gateway execution selects exactly one registered provider through the existing orchestrator.
- Evidence graph and guidance are read from the authoritative enrichment envelope.
- Case shell has no second submit/dispatch path.
- Typed and safe text pipelines are supported and bounded.
- Completion/help/man/apropos/which derive from the shared registry.
- Web/CLI surface restrictions are deterministic and visible.
- Backticks, `$()`, `&&`, `||`, semicolon chaining, and host redirects reject before execution.
- No provider secret value can appear in metadata, output, history, or errors.
- `npm test`, `npm run check`, and `npm run verify:tooling` pass.
- Implementation ships through a PR and required branch-protection checks; no protected-branch bypass.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
