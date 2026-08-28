# PARA11AX v8 Train 8 — Release Acceptance and Production Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the completed v8 implementation into a release that is reproducibly verified in CI, merged in staged deployable increments, deployed from the exact protected-main SHA, and truthfully classified as implemented/configured/production-verified across capabilities.

**Architecture:** Train 8 adds no intelligence feature. It adds a deterministic v8 acceptance verifier, extends existing Tooling Smoke/release-provenance gates to run it, then performs exact-SHA production verification against the public landing/API plus authenticated probes only when an authorized bearer is available. Every production claim is tied to observable evidence rather than inferred from deployment readiness.

**Tech Stack:** Node.js 24.x, existing npm/repository audit scripts, GitHub Actions (`tooling-smoke.yml`, `codeql.yml`, `release-provenance.yml`), Vercel production deployment, HTTP smoke verification.

**Spec:** `docs/superpowers/specs/2026-08-28-para11ax-v8-full-maxx-design.md`

## Global Constraints

- Trains 1–7 must be merged to `main` and individually green before Train 8 execution.
- Train 8 adds no provider, observable type, verdict rule, case feature, API capability, UI feature, or brand behavior.
- Expected catalog at release: 38 providers and 9 observable types, unless a previous approved train deliberately changed those counts and its merged spec/plan was updated; acceptance must derive counts from canonical registries rather than hard-code marketing copy.
- A Vercel deployment being `READY` proves deployment health only; it does not prove authenticated enrichment/provider capability.
- Production state vocabulary is exactly `implemented`, `configured`, `production_verified`.
- Missing production credentials produce `implemented` or `configured`, never fabricated `production_verified`.
- Production probes never print `PARA11AX_TOKEN` or provider secrets and never persist them in artifacts.
- Unauthenticated checks must verify protected endpoints reject access.
- Authenticated production checks run only when an authorized `PARA11AX_TOKEN` is available in the execution environment.
- Provider live probes remain read-only and use existing probe controls; no submission, scan, detonation, or remediation action is introduced.
- The exact GitHub `main` SHA must equal the Vercel production deployment's Git SHA before release acceptance is complete.

---

### Task 1: Add a deterministic v8 acceptance verifier

**Files:**
- Create: `scripts/verify-v8-acceptance.mjs`
- Create: `test/v8-acceptance.test.js`
- Modify: `package.json`

**Interfaces:**

```bash
node scripts/verify-v8-acceptance.mjs
npm run verify:v8
```

Exit 0 only when all local/repository invariants pass.

- [ ] **Step 1: Write the failing verifier tests**

Create `test/v8-acceptance.test.js` around exported pure `collectV8Acceptance()` / `assertV8Acceptance()` helpers. Assert the verifier checks:

```text
canonical observable count and names come from OBSERVABLE_MANIFEST
canonical provider count/names come from ALL_PROVIDERS/provider manifest
all canonical providers are admissionVersion v8.1 and HTTPS-only
capability registry exposes no credential env names
certificate type is explicit and active
cloudflare-dns exists and is GET-only
compare body limit is published
Evidence v2 schema version remains current v2 value
case storage source contains no bearer/localStorage/sessionStorage persistence
semantic diff max/category contract exists
entity graph hard limits remain 100/100
canonical brand regression contains only approved palette roles
CAPABILITIES.md passes generator --check
```

Do not assert a raw test-count number; test count can change legitimately.

- [ ] **Step 2: Run RED**

```bash
node --test test/v8-acceptance.test.js
```

Expected: verifier module missing.

- [ ] **Step 3: Implement verifier using code/registries, not README parsing**

Use canonical module imports for provider/observable/capability/evidence constants. Use `readFileSync` only for persistence/brand/generated-doc static gates where code cannot expose an invariant directly. Return a structured result:

```js
{
  version: 'v8',
  passed: boolean,
  checks: [{ id, passed, detail }]
}
```

On CLI invocation print one line per check followed by `V8 ACCEPTANCE: PASS|FAIL`; never print secret values.

- [ ] **Step 4: Add npm script**

In `package.json`:

```json
"verify:v8": "node scripts/verify-v8-acceptance.mjs"
```

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test test/v8-acceptance.test.js
npm run verify:v8
git add scripts/verify-v8-acceptance.mjs test/v8-acceptance.test.js package.json
git commit -m "test: add deterministic v8 acceptance gate"
```

---

### Task 2: Add v8 acceptance to CI and release provenance

**Files:**
- Modify: `.github/workflows/tooling-smoke.yml`
- Modify: `.github/workflows/release-provenance.yml`
- Modify: `scripts/verify-tooling.sh`
- Modify: `test/workflow-policy.test.js`

- [ ] **Step 1: Write failing workflow-policy assertions**

Extend workflow tests to require `npm run verify:v8` in Tooling Smoke and release provenance validation. Assert no workflow exposes environment values via `env`, `printenv`, `set -x`, or artifact upload of `.env`/credential files.

- [ ] **Step 2: Run RED**

```bash
node --test test/workflow-policy.test.js
```

Expected: v8 gate missing from workflow/tooling script.

- [ ] **Step 3: Insert v8 gate after normal repository tests**

Tooling Smoke sequence must include:

```text
npm ci --ignore-scripts
npm run check
npm run verify:v8
python -m unittest discover -s test
```

Keep existing CodeQL and governance behavior. Do not add production secrets to pull-request workflows.

- [ ] **Step 4: Add v8 gate to local tooling verifier**

`verify-tooling.sh` calls `npm run verify:v8` and propagates nonzero exit status.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test test/workflow-policy.test.js
bash scripts/verify-tooling.sh
git add .github/workflows/tooling-smoke.yml .github/workflows/release-provenance.yml scripts/verify-tooling.sh test/workflow-policy.test.js
git commit -m "ci: enforce v8 release acceptance"
```

---

### Task 3: Run the complete pre-merge release regression

**Files:** no production changes unless a failing test exposes a real regression. If a regression is found, stop and use systematic-debugging before changing code.

- [ ] **Step 1: Verify dependency/repository/public gates**

```bash
npm ci --ignore-scripts
npm audit --omit=dev
npm run verify:capabilities
npm run verify:v8
npm run verify:repo
npm run audit:public
npm run check
```

Expected: all PASS.

- [ ] **Step 2: Verify complete Maltego suite**

```bash
python -m unittest discover -s test
```

Expected: PASS.

- [ ] **Step 3: Run explicit high-risk regression subset**

```bash
node --test \
  test/core-security.test.js \
  test/egress-policy.test.js \
  test/provider-safety-regressions.test.js \
  test/provider-contract-v8.test.js \
  test/evidence-v2.test.js \
  test/semantic-diff-v8.test.js \
  test/case-bundle-v8.test.js \
  test/compare-api-v8.test.js \
  test/surface-parity-v8.test.js \
  test/v8-accessibility-mobile.test.js \
  test/brand-unification.test.js \
  test/v8-acceptance.test.js
```

Expected: PASS.

- [ ] **Step 4: Static secret/state/egress audit**

```bash
git grep -n -E 'PARA11AX_TOKEN|Authorization|localStorage|sessionStorage' -- app/case-*.js app/indexeddb-case-storage.js
git grep -n -Ei '#00e5ff|#f6c945|#39ff88|#ff1e2d|#ff4050' -- app landing-maxx.html landing-terminal-v7.js landing-terminal-v7.css landing-radar-motion.css 403.html 404.html 500.html
```

Expected: no matches.

- [ ] **Step 5: Review final v8 implementation delta**

```bash
git diff --stat <pre-v8-main-sha>...HEAD
git log --oneline --decorate <pre-v8-main-sha>..HEAD
```

Use the actual pre-v8 main SHA recorded in the approved design spec (`ecec52e0180f074f4762bb585c0a021944fc595b`) when this train is executed.

Acceptance review must confirm no active capability contradicts the read-only/fixed-egress design.

---

### Task 4: Merge the final release train only after required GitHub checks pass

**Files:** GitHub metadata only.

- [ ] **Step 1: Push/review final Train 8 PR**

PR body must state:

```text
Scope: release verification only; no new intelligence capability.
Required: Tooling Smoke, CodeQL, release/governance checks green.
Production deploy occurs only from protected main after merge.
```

- [ ] **Step 2: Verify PR head checks on the exact head SHA**

Use GitHub check/status data. Required checks must report success for the exact PR head. Do not rely on an earlier run from another SHA.

- [ ] **Step 3: Squash merge after checks pass**

Record the resulting `main` merge SHA as `V8_RELEASE_SHA` for every later production verification step.

- [ ] **Step 4: Verify protected `main` points to `V8_RELEASE_SHA`**

Read `refs/heads/main`; if it differs, stop. Do not verify/deploy a stale SHA.

---

### Task 5: Verify Vercel production deployment matches the exact release SHA

**Files:** no repository changes.

- [ ] **Step 1: Read the newest production deployment for project `para11ax`**

Use the connected Vercel project. Record deployment ID, deployment URL, state, target, and Git SHA.

Acceptance requires:

```text
state = READY
target = production
git SHA = V8_RELEASE_SHA
```

If any condition fails, release state is not production-verified.

- [ ] **Step 2: Verify canonical alias**

Confirm `https://para11ax.vercel.app/` resolves to the deployment corresponding to `V8_RELEASE_SHA` rather than an older deployment.

- [ ] **Step 3: Record deployment evidence without secrets**

Release notes may include deployment ID/URL/SHA and check-run IDs. Never include bearer/provider credentials.

---

### Task 6: Run unauthenticated live production acceptance

**Files:** no repository changes.

- [ ] **Step 1: Verify public surfaces**

Fetch and require HTTP 200 for:

```text
https://para11ax.vercel.app/
https://para11ax.vercel.app/app/
https://para11ax.vercel.app/favicon.svg
https://para11ax.vercel.app/favicon.ico
https://para11ax.vercel.app/api/para11ax/meta
```

Validate content types where applicable.

- [ ] **Step 2: Validate public `/meta` truth**

Require:

```text
gatewayVersion present
profiles = fast, standard, full
capabilities observable/provider arrays present
certificate observable present
cloudflare-dns provider present
compareBodyBytes = 1048576
no provider credential environment-variable names
```

Counts must match the canonical generated capability document from the release SHA.

- [ ] **Step 3: Verify protected endpoints fail closed without bearer**

Require HTTP 401 for unauthenticated:

```text
GET /api/para11ax/health
GET /api/para11ax/status
POST /api/para11ax/enrich
POST /api/para11ax/batch
POST /api/para11ax/stix
POST /api/para11ax/compare
```

Use syntactically valid content-type/body for POST requests so 401 is testing auth, not parser rejection.

- [ ] **Step 4: Verify public UI assets contain release invariants**

Landing must expose the canonical product copy and public capability status line. App must expose the canonical prompt and load root favicon/cursor/terminal assets successfully. Do not infer accessibility solely from live HTML; that remains test-verified unless browser instrumentation is available.

---

### Task 7: Run authorized production probes when a bearer is available

**Files:** no repository changes.

- [ ] **Step 1: Branch on authorized secret availability**

If `PARA11AX_TOKEN` is not available to the verifier, mark authenticated API capabilities `configured` at most and continue. Do not ask CI/logs to reveal it.

If available, keep it only in process memory/environment and proceed.

- [ ] **Step 2: Verify authenticated health/status**

Require HTTP 200 and valid JSON for `/health` and `/status`. Do not include response fields that could reveal provider credential configuration in public release notes.

- [ ] **Step 3: Verify one free-core enrichment**

Use a benign documentation/test observable suitable for the free core and standard profile. Acceptance is schema/transport/coverage correctness, not a malicious verdict. Require Evidence v2 envelope, at least one normalized evidence item, deterministic decision/guidance structures, and no secret material.

- [ ] **Step 4: Verify compare without provider calls**

Compare two local copies of the authorized enrichment with one controlled semantic field changed through `/compare`. Require a typed semantic diff. This verifies the authenticated route without generating an additional upstream provider call.

- [ ] **Step 5: Optional configured-provider probes**

Use existing read-only provider probe tooling only for providers that are explicitly configured and safe to query. Record state per provider:

```text
implemented -> adapter/contracts/tests exist
configured -> production credential/configuration is present
production_verified -> authorized live read-only probe succeeded on release SHA
```

Never downgrade an unconfigured optional provider to product failure.

---

### Task 8: Perform capability-truth and privacy acceptance

**Files:** documentation/release notes only if state labels need to be recorded.

- [ ] **Step 1: Compare all truth surfaces**

Compare release-SHA canonical registry against:

```text
/api/para11ax/meta
docs/CAPABILITIES.md
README capability claims
CLI help/capability output
Maltego supported indicator types/transforms
STIX observable posture
```

Any mismatch blocks release completion.

- [ ] **Step 2: Confirm privacy-minimal operational behavior**

Through code/tests and available platform logs/metadata, verify telemetry schemas contain request ID, route/status/timing/provider state only as designed. Do not intentionally send sensitive real indicators merely to inspect logs.

- [ ] **Step 3: Confirm local-storage boundary**

Production app may create IndexedDB database `para11ax-workspace-v1` only after local case use. Bearer remains volatile. No application path stores case data server-side.

- [ ] **Step 4: Confirm read-only boundary**

Final repository search and capability review must find no new submission, detonation, scan, remediation, block, delete, arbitrary proxy, or user-controlled provider URL execution path.

---

### Task 9: Final release evidence and completion claim

**Files:** optional release evidence document only if the repository already maintains one; do not invent an operational ledger solely for this train.

- [ ] **Step 1: Re-run verification immediately before completion claim**

```bash
npm run verify:v8
npm run check
python -m unittest discover -s test
```

Use fresh output from the final release SHA.

- [ ] **Step 2: Re-read GitHub main ref and Vercel production deployment**

They must still match `V8_RELEASE_SHA` and production must still be `READY`.

- [ ] **Step 3: Report capability states precisely**

Final release report contains:

```text
GitHub main SHA
Vercel production deployment ID/SHA/state
CI Tooling Smoke result
CodeQL result
public production smoke result
authenticated smoke result or explicit not-run reason
provider production-verified subset
implemented/configured-only subset
known limitations
```

Do not claim every provider is live merely because all adapters/tests pass.

## Train 8 Acceptance Contract

V8 is complete only when all conditions are true:

```text
1. Every implementation train is merged and all repository/CI gates are green on the exact final SHA.
2. Vercel production is READY and its Git SHA exactly equals protected-main V8_RELEASE_SHA.
3. Public landing/app/favicon/meta are live and truthful.
4. Protected endpoints reject unauthenticated access.
5. Authenticated capabilities are production-verified only when an authorized live probe actually succeeded.
6. Capability docs, /meta, CLI, Maltego and STIX posture agree with canonical registries.
7. No bearer/provider secret persistence or case server-storage path exists.
8. Fixed-egress/read-only boundaries remain intact.
9. Final completion claim is based on fresh verification, not earlier CI runs.
```

Do not create an empty verification commit.