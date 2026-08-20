# MAX CTI Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first production-safe core of the personal CTI enrichment gateway with strict validation/authentication, provider registry, quota-aware orchestration, normalization, partial failure handling, evidence integrity, and initial IP/CVE workflows.

**Architecture:** Node.js ES modules on Vercel. Provider behavior is hidden behind small injectable adapters so orchestration can be tested without live APIs. The router validates and authenticates first, checks a bounded TTL cache, executes allowed provider adapters with hard timeouts, normalizes their evidence, records structured failures, hashes raw provider responses for reproducibility, and returns a stable response envelope.

**Tech Stack:** Node.js 24.x on Vercel, built-in `node:test`, built-in `fetch`, built-in `crypto`, zero runtime dependencies for the core.

**Spec:** `docs/specs/max-cti-core.md`

## Global Constraints

- Personal research and lab use only.
- Secrets remain server-side in Vercel environment variables and are never returned to callers.
- Read-only enrichment is the default.
- No arbitrary HTTP proxy, arbitrary headers, shell execution, secret retrieval, automatic urlscan submission, automatic malware submission, automatic sample download, or automatic detonation.
- Provider failure returns partial results rather than failing an entire enrichment.
- Preserve source provenance, timestamps, raw-response hashes, parser version and gateway version for reproducibility.
- Zero runtime dependencies for core v1.

---

### Task 1: Validation, authentication and response security

**Files:**
- Create: `src/core/validate.js`
- Create: `src/core/auth.js`
- Create: `src/core/http.js`
- Test: `test/core-security.test.js`

**Interfaces:**
- Produces: `classifyIndicator(value)`, `requireGatewayAuth(request, secret)`, `securityHeaders()`.

- [ ] **Step 1: Write failing tests** covering IP/CVE classification, invalid input rejection, bearer-token authentication, and security headers.
- [ ] **Step 2: Run** `npm test -- test/core-security.test.js`; expected FAIL because the modules do not exist.
- [ ] **Step 3: Implement** strict parsers, constant-time token comparison, and safe response headers.
- [ ] **Step 4: Run** `npm test -- test/core-security.test.js`; expected PASS.
- [ ] **Step 5: Commit** `test/core-security.test.js` and the three core modules.

### Task 2: Cache, provider registry and execution controls

**Files:**
- Create: `src/core/cache.js`
- Create: `src/core/provider-registry.js`
- Create: `src/core/provider-runner.js`
- Test: `test/provider-runtime.test.js`

**Interfaces:**
- Produces: `TtlCache`, `createProviderRegistry(adapters)`, `runProvider(adapter, input, options)`.
- `runProvider` returns `{ ok, provider, data?, failure?, retrievedAt, rawHash? }` and never exposes credentials.

- [ ] **Step 1: Write failing tests** for bounded TTL behavior, provider metadata, timeout, HTTP-like 429 normalization and SHA-256 raw-response hashing.
- [ ] **Step 2: Run** the test file and verify expected failures.
- [ ] **Step 3: Implement** bounded TTL cache, provider declarations and abortable runner.
- [ ] **Step 4: Run** tests; expected PASS.
- [ ] **Step 5: Commit.**

### Task 3: Normalization and partial-result orchestrator

**Files:**
- Create: `src/core/normalize.js`
- Create: `src/core/orchestrator.js`
- Test: `test/orchestrator.test.js`

**Interfaces:**
- Produces: `normalizeEvidence(provider, indicator, type, data, meta)` and `enrich({ indicator, type, providerNames, registry, cache, requestId, now })`.
- `enrich` returns the canonical response envelope from the specification.

- [ ] **Step 1: Write failing tests** proving successful evidence normalization, cache hits, one-provider failure producing `status: partial`, and all-provider failure producing `status: error` without throwing.
- [ ] **Step 2: Run** and verify RED.
- [ ] **Step 3: Implement** minimal normalization and orchestration.
- [ ] **Step 4: Run** and verify GREEN.
- [ ] **Step 5: Commit.**

### Task 4: Initial no-key IP and CVE adapters plus workflow manifests

**Files:**
- Create: `src/providers/rdap.js`
- Create: `src/providers/epss.js`
- Create: `src/providers/cisa-kev.js`
- Create: `src/workflows.js`
- Test: `test/workflows.test.js`

**Interfaces:**
- Each adapter exposes `{ name, types, cacheTtlMs, negativeCacheTtlMs, costClass, run(input, ctx) }`.
- Produces `WORKFLOWS.ip` and `WORKFLOWS.cve` ordered provider arrays.

- [ ] **Step 1: Write failing tests** for adapter metadata, endpoint construction without arbitrary-host input, and exact workflow order.
- [ ] **Step 2: Run** and verify RED.
- [ ] **Step 3: Implement** RDAP, FIRST EPSS and CISA KEV read-only adapters with fixed official hosts.
- [ ] **Step 4: Run** and verify GREEN.
- [ ] **Step 5: Commit.**

### Task 5: Vercel API routes and safe health surface

**Files:**
- Create: `api/health.js`
- Create: `api/enrich.js`
- Create: `src/app.js`
- Test: `test/app.test.js`
- Modify: `package.json`

**Interfaces:**
- `createApp({ env, fetchImpl, now, cache })` returns route handlers used by Vercel wrappers and tests.
- `GET /api/health`-equivalent handler returns gateway version plus provider `configured: boolean` only.
- Enrichment handler requires `Authorization: Bearer <CTI_GATEWAY_TOKEN>` and accepts a bounded JSON body `{ indicator, type? }`.

- [ ] **Step 1: Write failing tests** proving secrets cannot appear in health output, unauthorized requests are rejected, IP/CVE requests call their workflow, unsupported methods fail safely, and oversized/invalid bodies are rejected.
- [ ] **Step 2: Run** and verify RED.
- [ ] **Step 3: Implement** app factory and Vercel wrappers.
- [ ] **Step 4: Run** complete `npm test`; expected all PASS with no warnings.
- [ ] **Step 5: Commit.**

### Task 6: Documentation and deployment verification

**Files:**
- Modify: `README.md`
- Modify: `scripts/bootstrap-vercel.ps1`

**Interfaces:**
- Add `CTI_GATEWAY_TOKEN` and `MALPEDIA_API_TOKEN` to documented/bootstrap secret names while preserving all existing provider secret names.

- [ ] **Step 1: Update docs** with routes, authentication, provider roadmap, read-only boundaries and local test command.
- [ ] **Step 2: Update bootstrap script** secret-name list only; never add values.
- [ ] **Step 3: Run** `npm test` again.
- [ ] **Step 4: Deploy the feature branch/merged result through Vercel after review and inspect build/runtime errors.
- [ ] **Step 5: Verify** `/api/health` returns configured booleans only and no credential material.

## Self-review

Spec coverage: validation/auth, cache/quota controls, provider registry, partial failures, evidence hashing, provider manifests, IP/CVE workflows, safe health route, enrichment route and deployment verification are represented. Durable Redis/KV state, temporal graph persistence, STIX export, Maltego transforms, IOC lifecycle persistence, provider-specific authenticated adapters and hunt feedback loops remain follow-on increments after core v1 establishes stable interfaces.

Placeholder scan: no implementation placeholders are permitted inside production code; unsupported providers must be absent from active workflow execution until implemented.

Type consistency: all adapters use the same metadata/run shape; all orchestration returns one canonical response envelope.
