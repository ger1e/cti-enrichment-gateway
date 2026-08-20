# Final MAXX CTI Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port and harden the complete read-only CTI gateway and Maltego Desktop client onto the current Node.js 24 MAXX repository baseline, verify it end-to-end, and merge/deploy only when every applicable gate is green.

**Architecture:** Start from `final/maxx-cti`, which was cut from the hardened `main`, and clean-port only the tested gateway core, provider adapters, workflows, API wrappers, tests, and Maltego files from `feature/max-cti-core`. Preserve the current Node 24/runtime/tooling/CI baseline, then add final hardening for registry-derived health metadata, secret-safe failures, explicit no-provider failures, JSON media-type validation, generated-MTZ exclusion, and authoritative documentation. Use GitHub PR CI for executable verification; use Vercel preview and controlled live smoke checks before squash-merging to `main`.

**Tech Stack:** Node.js 24.x ES modules, Vercel Functions, built-in `fetch`/`crypto`/`node:test`, Bash and PowerShell repository guardrails, Python standard-library tests, Maltego TRX 1.7.0 for the Windows Desktop local-transform/MTZ boundary.

**Spec:** `docs/superpowers/specs/2026-08-20-final-maxx-cti-design.md`

## Global Constraints

- Personal research and lab use only.
- Runtime parity is Node.js 24.x across Vercel, CI, Codespaces, and bootstrap flows.
- Keep zero runtime npm dependencies; do not port the stale feature-branch `package-lock.json` whose engine was `>=20`.
- Read-only enrichment only: no scan submission, takedown, rescan, artifact download, sample retrieval, detonation, arbitrary HTTP proxy, arbitrary outbound-header surface, shell execution, or secret-read/list endpoint.
- Never return or log provider secrets, the gateway bearer, or credential-bearing request URLs.
- Preserve provider semantics; never implement vendor-vote maliciousness scoring.
- Preserve SHA-pinned GitHub Actions and Vercel CLI `58.4.4` unless a separately verified upgrade is intentionally approved.
- Missing provider credentials skip only that provider. `NVD_API_KEY` remains optional.
- Do not auto-provision a paid/durable storage resource. The shipping cache may remain bounded in-memory and must be documented as non-durable.
- Production merge/deployment is allowed only after Node tests, Maltego tests/compile, repository invariants, PR CI, Vercel preview checks, and available live smoke checks are green.

---

### Task 1: Establish the RED contract on the clean branch

**Files:**
- Create: `test/app.test.js`
- Create: `test/app-max.test.js`
- Create: `test/core-security.test.js`
- Create: `test/orchestrator.test.js`
- Create: `test/provider-adapters.test.js`
- Create: `test/provider-http.test.js`
- Create: `test/provider-runtime.test.js`
- Create: `test/validate-indicators.test.js`
- Create: `test/workflows.test.js`
- Do not create: `test/.note`, `test/.gitkeep`

**Interfaces:**
- Consumes: the approved gateway contract from the spec.
- Produces: executable Node tests for `classifyIndicator`, `requireGatewayAuth`, `securityHeaders`, `TtlCache`, `createProviderRegistry`, `runProvider`, `normalizeEvidence`, `enrich`, provider adapters, `WORKFLOWS`, and `createApp`.

- [ ] **Step 1: Port the feature-branch tests without production source files**

Use the exact tests from `feature/max-cti-core` for the nine files listed above. Do not port stale Node 22 verification notes.

- [ ] **Step 2: Add final hardening tests before implementation**

Append tests equivalent to:

```js
test('provider runner never reflects provider exception text', async () => {
  const adapter = { name: 'secret-url', run: async () => { throw new Error('request failed https://x.test/?key=TOPSECRET'); } };
  const result = await runProvider(adapter, { value: '8.8.8.8', type: 'ip' }, { timeoutMs: 100 });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes('TOPSECRET'), false);
  assert.equal('message' in result.failure, false);
});
```

```js
test('empty provider selection returns explicit gateway failure', async () => {
  const result = await enrich({
    indicator: 'https://example.com/',
    type: 'url',
    providerNames: [],
    registry: createProviderRegistry([]),
    cache: new TtlCache(),
    requestId: 'r',
    now: () => '2026-08-20T12:00:00Z',
  });
  assert.equal(result.status, 'error');
  assert.deepEqual(result.failures, [{ provider: 'gateway', reason: 'no_configured_providers' }]);
});
```

In `app.test.js`, add a JSON-content-type test and registry-derived health coverage:

```js
test('explicit non-JSON content type is rejected before enrichment', async () => {
  const app = createApp({ env });
  const response = await app.handleEnrich(req({
    body: { indicator: '8.8.8.8' },
    headers: { 'content-type': 'text/plain' },
  }));
  assert.equal(response.status, 415);
  assert.equal(response.body.error, 'unsupported_media_type');
});
```

```js
test('health lists actual registered providers rather than a drifting secret map', async () => {
  const app = createApp({ env });
  const response = await app.handleHealth(req({ method: 'GET', auth: false }));
  for (const name of ['threatfox', 'urlhaus', 'malwarebazaar', 'rdap', 'nvd']) {
    assert.ok(response.body.providers[name], `${name} missing from health`);
  }
  assert.equal(response.body.providers.nvd.auth, 'optional');
  assert.equal(response.body.operations.sentry.configured, false);
});
```

- [ ] **Step 3: Open a draft PR to `main` so GitHub Actions executes the RED state**

Title: `Final MAXX CTI gateway`.

The PR is intentionally draft and intentionally red at this point because the clean branch does not yet contain `src/`, `api/`, or Maltego implementation files.

- [ ] **Step 4: Verify RED from GitHub Actions**

Expected: `Tooling smoke` fails in `npm test` with module-not-found/test failures caused by the absent gateway implementation. Record the run ID/status; do not treat unrelated infrastructure failure as valid RED evidence.

- [ ] **Step 5: Commit boundary**

Commit message: `test: establish final CTI gateway contracts`.

---

### Task 2: Port the core, providers, workflows and API surface; make Node tests GREEN

**Files:**
- Create: `api/enrich.js`
- Create: `api/health.js`
- Create: `src/app.js`
- Create: `src/workflows.js`
- Create: `src/core/auth.js`
- Create: `src/core/cache.js`
- Create: `src/core/fetch-json.js`
- Create: `src/core/http.js`
- Create: `src/core/normalize.js`
- Create: `src/core/orchestrator.js`
- Create: `src/core/provider-registry.js`
- Create: `src/core/provider-runner.js`
- Create: `src/core/validate.js`
- Create: `src/providers/helpers.js`
- Create: `src/providers/index.js`
- Create: all provider adapter files named in the approved spec.

**Interfaces:**
- `classifyIndicator(input: string) -> { value: string, type: 'ip'|'domain'|'url'|'hash'|'cve' }`
- `requireGatewayAuth(request, secret) -> boolean`
- `TtlCache#get(key)` / `set(key, value, ttlMs)`
- `fetchJson(url, {method, headers, body, fetchImpl, signal, maxBytes, redirect}) -> object|null`
- `runProvider(adapter, input, options) -> {ok, provider, data?, failure?, retrievedAt, rawHash?}`
- `enrich(...) -> canonical response envelope`
- `createApp({env, fetchImpl, now, cache, gatewayVersion, adapters}) -> {handleHealth, handleEnrich}`

- [ ] **Step 1: Port the tested core/provider implementation from `feature/max-cti-core`**

Keep the feature implementation semantics for strict indicator canonicalization, constant-time bearer comparison, bounded TTL cache, fixed provider endpoints, response limits, read-only provider operations, evidence normalization, and workflow order.

- [ ] **Step 2: Harden provider failures so secrets cannot be reflected**

In `src/core/provider-runner.js`, use:

```js
function normalizeFailure(error, timedOut) {
  if (timedOut || error?.name === 'AbortError') return { reason: 'timeout' };
  if (error?.status === 429) return { reason: 'rate_limited', status: 429, retryAfter: error.retryAfter ?? null };
  if (Number.isInteger(error?.status)) return { reason: 'http_error', status: error.status };
  return { reason: 'provider_error' };
}
```

Do not expose arbitrary provider exception messages.

- [ ] **Step 3: Make zero-provider workflows explicit**

At the beginning of `enrich`, before iterating providers:

```js
if (!Array.isArray(providerNames) || providerNames.length === 0) {
  return {
    requestId,
    indicator,
    type,
    queriedAt: now(),
    status: 'error',
    evidence: [],
    relationships: [],
    failures: [{ provider: 'gateway', reason: 'no_configured_providers' }],
    huntContext: {
      indicator,
      type,
      firstSeen: null,
      lastSeen: null,
      families: [],
      actors: [],
      sourceReferences: [],
    },
    meta: { gatewayVersion, cache: {}, providerHealth: {} },
  };
}
```

- [ ] **Step 4: Derive health provider state from the registry**

Replace the hard-coded provider-name health map with adapter metadata:

```js
function providerStatus(adapter, env) {
  if (adapter.requiredEnv) return { configured: Boolean(env[adapter.requiredEnv]), auth: 'secret' };
  if (adapter.optionalEnv) return { configured: true, auth: 'optional', optionalCredentialConfigured: Boolean(env[adapter.optionalEnv]) };
  return { configured: true, auth: 'none' };
}
```

`handleHealth` builds `providers` from `registry.names()` and exposes Sentry separately:

```js
const providers = Object.fromEntries(registry.names().map(name => {
  const adapter = registry.get(name);
  return [name, providerStatus(adapter, env)];
}));

return response(200, {
  status: 'ok',
  version: gatewayVersion,
  gatewayAuthConfigured: Boolean(env.CTI_GATEWAY_TOKEN),
  providers,
  operations: { sentry: { configured: Boolean(env.SENTRY_AUTH_TOKEN), role: 'observability_only' } },
  activeWorkflows: WORKFLOWS,
});
```

No environment-variable value is serialized.

- [ ] **Step 5: Enforce JSON when a caller explicitly sends a content type**

Before parsing the enrichment body:

```js
const contentType = headerValue(request.headers, 'content-type');
if (contentType && !String(contentType).toLowerCase().includes('application/json')) {
  return response(415, { error: 'unsupported_media_type' });
}
```

This keeps direct unit fixtures without a header compatible while rejecting explicit non-JSON API requests.

- [ ] **Step 6: Run the full PR CI**

Expected `npm test`: all Node tests pass with zero failures. Expected `npm run check`: repository invariants and shell checks pass after Task 4 configuration reconciliation; until then, only the Node test result is used as the Task 2 GREEN gate.

- [ ] **Step 7: Commit boundary**

Commit message: `feat: add final read-only CTI gateway core`.

---

### Task 3: Port and verify the Maltego Desktop integration

**Files:**
- Create: `maltego/credential_store.py`
- Create: `maltego/gateway_client.py`
- Create: `maltego/mapper.py`
- Create: `maltego/extensions.py`
- Create: `maltego/project.py`
- Create: `maltego/install.ps1`
- Create: `maltego/requirements.txt`
- Create: `maltego/README.md`
- Create: `maltego/README-compatibility.md`
- Create: `maltego/tests/test_gateway_client.py`
- Create: `maltego/tests/test_mapper.py`
- Create: `maltego/transforms/__init__.py`
- Create: `maltego/transforms/common.py`
- Create: `maltego/transforms/EnrichIPv4.py`
- Create: `maltego/transforms/EnrichIPv6.py`
- Create: `maltego/transforms/EnrichDomain.py`
- Create: `maltego/transforms/EnrichDNSName.py`
- Create: `maltego/transforms/EnrichURL.py`
- Create: `maltego/transforms/EnrichHash.py`
- Create: `maltego/transforms/EnrichCVE.py`

**Interfaces:**
- `GatewayClient.enrich(indicator, indicator_type) -> dict`
- `load_token()` resolves `CTI_GATEWAY_TOKEN` env first, then current-user Windows DPAPI store.
- `map_enrichment(result, max_entities=50, include_provider_nodes=False) -> list[EntitySpec]`
- Local transforms call only `/api/enrich` with the single gateway bearer.

- [ ] **Step 1: Port the feature-branch Maltego files exactly**

Keep remote HTTPS enforcement, localhost-only HTTP development allowance, redirect refusal, 2 MB response cap, current-user DPAPI token storage, and bounded/deduplicated mapper behavior.

- [ ] **Step 2: Run Python unit tests in CI without installing TRX**

Run from repository root:

```bash
cd maltego
python3 -m unittest discover -s tests -v
```

Expected: all stdlib gateway-client and mapper tests pass.

- [ ] **Step 3: Compile all Python files**

```bash
python3 -m compileall -q maltego
```

Expected: exit 0.

- [ ] **Step 4: Keep TRX only as the Windows local-transform runtime dependency**

`maltego/requirements.txt` remains:

```text
maltego-trx==1.7.0
```

CI does not need to install it merely to run the isolated client/mapper tests. Windows `install.ps1` installs it when generating the MTZ.

- [ ] **Step 5: Commit boundary**

Commit message: `feat: add hardened Maltego local transforms`.

---

### Task 4: Reconcile configuration, guardrails, CI and authoritative documentation

**Files:**
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `.github/workflows/tooling-smoke.yml`
- Modify: `scripts/bootstrap-vercel.ps1`
- Modify: `scripts/verify-repo.sh`
- Modify: `README.md`
- Create: `SECURITY.md`
- Keep unchanged: `package.json`, `.nvmrc`, `.npmrc`, `.devcontainer/devcontainer.json`, `.gitattributes`, `.editorconfig`, `.github/dependabot.yml`

**Interfaces:**
- One canonical secret-name list in docs/bootstrap/template.
- One pinned CI workflow remains authoritative.
- No feature-branch `ci.yml`, `README-MAX.md`, placeholder docs, stale roadmap/status files or Node 22 verification notes are ported.

- [ ] **Step 1: Replace the environment template with the final secret names**

Use exactly:

```text
CTI_GATEWAY_TOKEN=
ABUSECH_API_KEY=
ABUSEIPDB_API_KEY=
GREYNOISE_API_KEY=
VIRUSTOTAL_API_KEY=
HYBRID_ANALYSIS_API_KEY=
URLSCAN_API_KEY=
WEBAMON_API_KEY=
SENTRY_AUTH_TOKEN=
OTX_API_KEY=
SHODAN_API_KEY=
CENSYS_PAT=
PULSEDIVE_API_KEY=
IPINFO_TOKEN=
MALPEDIA_API_TOKEN=
NVD_API_KEY=
CLOUDFLARE_RADAR_TOKEN=
```

Remove `SECURITYTRAILS_API_KEY`.

- [ ] **Step 2: Update only the secret array in the hardened Vercel bootstrap**

Preserve `$RequiredNodeMajor = 24`, `$PinnedVercelCliVersion = '58.4.4'`, installation checks, project IDs and Vercel CLI behavior. Replace the secret-name array with the same list as `.env.example`.

- [ ] **Step 3: Exclude generated Maltego packages**

Add to `.gitignore`:

```text
*.mtz
```

- [ ] **Step 4: Extend repository invariants**

Add:

```bash
gateway_secret_contract_ok() {
  grep -Fq 'CTI_GATEWAY_TOKEN' .env.example &&
    grep -Fq 'MALPEDIA_API_TOKEN' .env.example &&
    grep -Fq "'CTI_GATEWAY_TOKEN'" scripts/bootstrap-vercel.ps1 &&
    grep -Fq "'MALPEDIA_API_TOKEN'" scripts/bootstrap-vercel.ps1 &&
    ! grep -Fq 'SECURITYTRAILS_API_KEY' .env.example &&
    ! grep -Fq 'SECURITYTRAILS_API_KEY' scripts/bootstrap-vercel.ps1
}

maltego_artifact_ignore_ok() {
  grep -Fxq '*.mtz' .gitignore
}
```

Register both with `check` in `verify-repo.sh`.

- [ ] **Step 5: Extend the existing SHA-pinned Tooling smoke workflow**

Do not add the old feature `ci.yml`. After `Validate MAXX invariants`, add:

```yaml
      - name: Test Maltego adapter
        run: |
          cd maltego
          python3 -m unittest discover -s tests -v
          cd ..
          python3 -m compileall -q maltego
```

Keep the existing immutable action SHAs and least-privilege permissions.

- [ ] **Step 6: Write the authoritative root README**

The README must document:
- personal/read-only scope;
- Node.js 24.x parity and existing MAXX tooling commands;
- `/api/health` and authenticated `/api/enrich`;
- the five exact active workflow orders;
- provider credential list with NVD optional and Sentry operations-only;
- explicit prohibited action surfaces;
- normalized evidence semantics and partial failures;
- non-durable in-memory cache limitation;
- Maltego Windows installation and one-gateway-token model;
- no SecurityTrails default.

- [ ] **Step 7: Add a concise SECURITY.md**

It must require no committed secrets/artifacts, read-only provider actions, immutable Action pins, Node 24 parity, secret-safe errors/logs/references, and `npm run check` before merge.

- [ ] **Step 8: Run repository verification**

```bash
npm run check
```

Expected: Bash syntax, shellcheck, repository invariants, and full Node test suite all pass.

- [ ] **Step 9: Commit boundary**

Commit message: `chore: finalize MAXX CTI guardrails and docs`.

---

### Task 5: Review the final diff and verify hosted CI

**Files:**
- Review all files changed between `main` and `final/maxx-cti`.

**Interfaces:**
- Produces a merge-ready clean PR with no unintended feature-history baggage.

- [ ] **Step 1: Compare `main...final/maxx-cti`**

Expected change families only:
- design/implementation plan docs;
- `api/` and `src/` gateway implementation;
- `test/` Node tests;
- `maltego/` integration;
- environment/bootstrap/README/SECURITY/ignore/repo-verifier/tooling-smoke updates.

No stale `README-MAX.md`, old `.github/workflows/ci.yml`, `test/.note`, feature `package-lock.json`, sample binaries, captures, credentials or secret values.

- [ ] **Step 2: Search the PR patch for forbidden action surfaces**

Provider implementations must not expose paths/actions matching submission/download/detonation/takedown behavior. Tests and documentation may mention those strings only to assert/prohibit them.

- [ ] **Step 3: Read the latest `Tooling smoke` PR run**

Expected: successful conclusion; `npm run check`, PowerShell parse, Maltego tests and Python compile all green.

- [ ] **Step 4: Mark the PR ready only after the hosted checks are green**

Do not merge while the PR is draft/red/unknown.

---

### Task 6: Vercel preview and controlled runtime verification

**Files:**
- No source change unless preview evidence identifies a defect; any defect returns to its owning task with a regression test first.

**Interfaces:**
- Preview deployment of the final PR.
- Public safe health and authenticated enrichment endpoints.

- [ ] **Step 1: Inspect the Vercel preview deployment**

Confirm build state is `READY` and the deployment corresponds to the final PR/head SHA.

- [ ] **Step 2: Smoke-test unauthenticated/public-safe behavior**

Verify:

```text
GET /api/health -> 200, no secret values
POST /api/enrich without Authorization -> 401
POST /api/enrich with explicit text/plain -> 415 when authenticated execution is available
invalid indicator -> 400 without provider execution when authenticated execution is available
```

- [ ] **Step 3: Run one controlled live lookup per configured provider family when the available tooling can supply the app-level gateway bearer without exposing it**

Use representative benign/public indicators:

```text
IP: 8.8.8.8
Domain: example.com
URL: https://example.com/
Hash: a known harmless/public test hash chosen at execution time from a non-secret fixture or omit live hash if no defensible public sample is available
CVE: a current public CVE chosen at execution time
```

Do not retrieve the Vercel secret value merely to perform the smoke test. If the connector cannot make an authenticated app request, record that limitation explicitly and require the existing local Maltego/gateway client to perform the bearer-authenticated smoke before claiming that gate.

- [ ] **Step 4: Inspect provider/runtime failures**

Any provider schema/auth drift must become a failing contract test, then an adapter fix, then a rerun of Tasks 5-6. A provider 401/403/429 must remain a structured partial failure rather than crash the request.

- [ ] **Step 5: Verify logs do not contain credential material**

Inspect available Vercel runtime logs for exceptions/URLs and confirm no provider key/bearer values are present.

---

### Task 7: Squash merge, production verification and obsolete-branch cleanup

**Files:**
- No new feature code unless a production-only regression is discovered; regressions require a test-first fix via the final branch/PR.

**Interfaces:**
- `main` becomes the single authoritative MAXX CTI implementation.

- [ ] **Step 1: Re-check PR head SHA and mergeability**

The exact verified head SHA must match the SHA being merged.

- [ ] **Step 2: Squash-merge `final/maxx-cti` to `main`**

Commit title: `feat: finalize MAXX CTI enrichment gateway`.

- [ ] **Step 3: Verify `main` hosted CI**

Read the `Tooling smoke` result for the resulting main commit. Expected: success.

- [ ] **Step 4: Verify production Vercel deployment**

Confirm production deployment is `READY` and tied to the merged main commit. Re-run safe `/api/health` and unauthenticated `401` smoke checks; perform authenticated live/Maltego smoke if the bearer can be used without disclosure.

- [ ] **Step 5: Close obsolete PR #1 only after production is confirmed**

Leave the old feature branch intact unless deletion is specifically required; closing the obsolete PR is sufficient to remove it from the active path while retaining recovery history.

- [ ] **Step 6: Final completion gate**

Only claim completion if the fresh evidence shows:
- final Node tests green;
- Maltego unit tests and Python compile green;
- `npm run check`/repository invariants green;
- PR CI green;
- preview build/runtime green;
- merge completed at the verified head;
- main CI green;
- production Vercel `READY` and safe smoke checks green;
- no secret disclosure found.

## Self-review

**Spec coverage:** Tasks 1-2 cover validation/authentication, provider registry, all read-only adapters, fixed endpoints, cache/timeout/429 controls, evidence integrity, partial failures, health and five workflows. Task 3 covers DPAPI-protected Maltego integration and graph budgets. Task 4 preserves Node 24/tooling/supply-chain hardening and consolidates configuration/docs. Tasks 5-7 cover diff review, hosted CI, preview, live/runtime limitations, squash merge and post-merge production verification. Durable storage is intentionally not provisioned because the spec makes it optional and requires explicit safe provisioning.

**Placeholder scan:** The plan contains no TBD/TODO/implement-later instructions. Runtime-selected public smoke indicators are explicitly bounded to non-secret public fixtures because exact live provider availability is execution-time state, not an implementation placeholder.

**Type consistency:** `classifyIndicator`, `runProvider`, `enrich`, `createApp`, `GatewayClient.enrich`, `map_enrichment`, provider metadata fields and the canonical response envelope use the same names/signatures throughout the plan and approved spec.
