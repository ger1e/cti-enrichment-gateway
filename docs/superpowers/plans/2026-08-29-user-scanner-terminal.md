# User Scanner Terminal Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bounded `user-scanner` terminal command that runs email or username OSINT through an isolated User Scanner worker from both local/self-hosted and hosted PARA11AX deployments.

**Architecture:** The browser terminal parses a fixed command grammar and calls one same-origin authenticated PARA11AX endpoint. The gateway validates the request, then forwards only a bounded worker payload to a server-configured worker URL; callers cannot choose the worker URL, arbitrary destinations, concurrency, proxy settings, or loud modules. The worker is isolated from the passive Evidence v2 enrichment core and returns a compact structured result envelope.

**Tech Stack:** Node.js 24, browser ES modules, Vercel Node API functions, Python 3.10+ worker, `user-scanner==1.5.1`, Node test runner.

**Spec:** `docs/ARCHITECTURE.md` plus the command contract in this plan.

## Global Constraints

- Preserve the existing passive Evidence v2 enrichment trust boundary; User Scanner is a separate active OSINT surface.
- Command name: `user-scanner`; aliases: `osint`, `identity`.
- Usage: `user-scanner <email|username> <target> [--category <name>|--module <name>] [--cross-scan] [--include-nsfw]`.
- Authentication is mandatory.
- `category` and `module` are mutually exclusive.
- Cross-scan is opt-in and fixed to depth 1; no caller-selected depth, concurrency, proxy, timeout, or arbitrary module path.
- Loud modules remain disabled.
- NSFW modules are excluded by default and require explicit `--include-nsfw`.
- Gateway worker destination comes only from `PARA11AX_USER_SCANNER_URL`; optional worker bearer comes only from `PARA11AX_USER_SCANNER_TOKEN`.
- Worker requests are POST-only JSON and capped by gateway validation.
- Terminal results remain separate from `currentResult` Evidence v2 state; `stix`, evidence views, and enrichment correlation do not reinterpret OSINT enumeration as CTI evidence.

---

### Task 1: Lock the terminal command contract

**Files:**
- Create: `test/user-scanner-terminal.test.mjs`
- Modify: `app/shell.js`

**Interfaces:**
- Consumes: `interpretCommand(input, context)` and `completeCommand(input)`.
- Produces: action `{ action: 'user-scanner', scanType, target, category, module, crossScan, noNsfw }`.

- [ ] Write failing tests for auth, grammar, mutual exclusion, safe defaults, aliases, and completion.
- [ ] Run `node --test test/user-scanner-terminal.test.mjs` and verify failure because the command is absent.
- [ ] Add the smallest parser/registry implementation.
- [ ] Re-run the focused test and verify pass.

### Task 2: Add the browser API client contract

**Files:**
- Modify: `test/user-scanner-terminal.test.mjs`
- Modify: `app/api-client.js`

**Interfaces:**
- Produces: `client.userScanner(request, signal)` -> validated User Scanner envelope.

- [ ] Add a failing test asserting same-origin bearer POST to `/api/para11ax/user-scanner` and exact body fields.
- [ ] Verify RED.
- [ ] Implement payload and response validation.
- [ ] Verify GREEN.

### Task 3: Add a bounded gateway worker proxy

**Files:**
- Modify: `test/user-scanner-terminal.test.mjs`
- Modify: `src/app.js`
- Create: `api/para11ax/user-scanner.js`

**Interfaces:**
- Produces: `app.handleUserScanner(request)`.
- Worker POST body: `{ scan_type, target, category, module, cross_scan, no_nsfw }`.
- Worker response: `{ scanId, scanType, target, summary, results, erroredSites, durationMs, source }`.

- [ ] Add failing tests for auth, request validation, unconfigured worker, fixed worker destination, bearer forwarding, timeout/failure mapping, and response bounding.
- [ ] Verify RED.
- [ ] Implement the gateway handler and Vercel route.
- [ ] Verify GREEN.

### Task 4: Execute and render from the terminal

**Files:**
- Modify: `app/shell-ui.js`
- Modify: `test/user-scanner-terminal.test.mjs`

**Interfaces:**
- Consumes: parsed `user-scanner` action and `client.userScanner`.
- Produces: terminal summary plus bounded hit rows without modifying Evidence v2 `currentResult`.

- [ ] Add a failing surface test proving the shell dispatches the action separately from enrichment state.
- [ ] Verify RED.
- [ ] Add terminal execution, status line, and compact result renderer.
- [ ] Verify GREEN.

### Task 5: Ship the isolated Python worker reference

**Files:**
- Create: `workers/user-scanner/requirements.txt`
- Create: `workers/user-scanner/server.py`
- Create: `workers/user-scanner/README.md`

**Interfaces:**
- POST `/scan` with optional bearer authentication.
- Calls User Scanner orchestrators with loud modules disabled, bounded target/category/module inputs, optional cross-scan depth 1, and NSFW excluded by default.

- [ ] Implement a dependency-pinned reference worker using `user-scanner==1.5.1`.
- [ ] Document local launch and hosted worker environment variables.
- [ ] Do not add worker credentials to the repository.

### Task 6: Verification and documentation

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `.env.example`
- Modify: `docs/API.md`

- [ ] Document that User Scanner is an isolated active OSINT capability and not part of passive Evidence v2 provider correlation.
- [ ] Document `PARA11AX_USER_SCANNER_URL` and `PARA11AX_USER_SCANNER_TOKEN`.
- [ ] Run `npm test` and repository verification through CI.
- [ ] Confirm no secret values, arbitrary destination parameters, proxy controls, or loud-module toggles entered the browser/API contract.
