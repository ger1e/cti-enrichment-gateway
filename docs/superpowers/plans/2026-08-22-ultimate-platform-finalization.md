# Ultimate Platform Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining high-value platform gaps with enforced governance, deterministic dependencies, a canonical provider manifest, a small operator CLI, a frozen-snapshot report compiler with quality gates and diffing, plus the approved custom error surface.

**Architecture:** Keep the existing bounded gateway as the only enrichment runtime. Add static configuration and offline compilation layers around it rather than introducing stateful infrastructure. Every new operator/reporting path consumes existing normalized evidence and static provider metadata; no renderer or CLI command gets a bypass around the gateway security boundary.

**Tech Stack:** Node.js 24 ESM + standard library, JSON, GitHub Actions, Vercel Functions, PowerShell 5.1+, POSIX shell/zsh, existing Python Maltego tooling.

**Spec:** `docs/superpowers/specs/2026-08-22-ultimate-platform-finalization-design.md`

## Global Constraints

- Preserve evidence schema v2, provider order, scheduler ceilings, fixed-host egress, gateway bearer boundary, and current Maltego transform surface.
- Do not add a database, queue, Kubernetes, dashboard, microservice split, universal risk score, or new analytical framework.
- Vendor secrets remain server-side only; local clients retain only `CTI_GATEWAY_TOKEN` through existing native credential stores.
- Reports compile from frozen evidence only and never invoke provider/network calls.
- All outputs and collections are bounded and deterministic for identical input + supplied generation timestamp.
- Windows PowerShell, macOS bash/zsh, and Linux bash/zsh remain first-class.

---

### Task 1: Hardened custom HTTP error surface

**Files:**
- Create: `src/core/error-surface.js`
- Create: `api/[...path].js`
- Modify: `src/app.js`
- Test: `test/error-surface.test.js`
- Test: `test/api-catchall.test.js`

**Interfaces:**
- Produces: `renderHttpError(request, status, code, options)` and controlled `/api/*` catch-all behavior.
- Preserves: JSON error semantics for API/CLI/Maltego and raw HTML only for explicit browser `Accept: text/html`.

- [x] **Step 1: Write failing negotiation tests**
- [x] **Step 2: Verify RED because `renderHttpError` does not exist**
- [x] **Step 3: Implement bounded renderer and app integration**
- [x] **Step 4: Verify renderer tests GREEN**
- [x] **Step 5: Write failing catch-all route tests**
- [x] **Step 6: Verify RED because `api/[...path].js` does not exist**
- [x] **Step 7: Implement catch-all 404**
- [ ] **Step 8: Add a regression proving optional headers cannot override security/content headers**
- [ ] **Step 9: Run full exact-head CI and Vercel preview route acceptance**

### Task 2: Deterministic npm lock and dependency audit gate

**Files:**
- Create: `package-lock.json`
- Modify: `package.json`
- Modify: `.github/workflows/tooling-smoke.yml`
- Modify: `scripts/verify-repo.sh`
- Test: `test/finalize.test.js` or new `test/dependency-policy.test.js`

**Interfaces:**
- Produces: deterministic npm install metadata with no new runtime package dependency.
- CI contract: `npm ci --ignore-scripts` succeeds and `npm audit --omit=dev` is executed against the committed lockfile.

- [ ] **Step 1: Write a failing repository test requiring lockfile parity, lockfile version 3, zero package dependencies, and audit command presence in CI**
- [ ] **Step 2: Run exact-head CI and verify RED only on the new dependency-policy assertions**
- [ ] **Step 3: Commit the minimal npm v11 lockfile for the dependency-free package and add `verify:deps` script**
- [ ] **Step 4: Update CI to run `npm ci --ignore-scripts` before checks and `npm audit --omit=dev` as an explicit validation step**
- [ ] **Step 5: Update repository invariants so missing/stale lockfile fails rather than prints audit skipped**
- [ ] **Step 6: Run full CI and verify lock/audit GREEN**

### Task 3: Canonical provider manifest

**Files:**
- Create: `config/providers.json`
- Create: `src/providers/manifest.js`
- Modify: `src/providers/metadata.js`
- Modify: `src/core/provider-registry.js`
- Modify: `scripts/verify-repo.sh`
- Modify: `scripts/bootstrap-vercel.ps1`
- Modify: `.env.example`
- Test: `test/provider-manifest.test.js`
- Test: `test/invariants.test.js`

**Interfaces:**
- Produces: `PROVIDER_MANIFEST`, `providerPolicy(name)`, and `providerSecretNames()` from static JSON.
- `withProviderMetadata(adapter)` consumes manifest policy and merges only behavior-specific adapter fields.

- [ ] **Step 1: Write failing tests asserting every active adapter has exactly one manifest entry and every manifest entry has bounded transport/security fields**
- [ ] **Step 2: Add failing parity tests for `.env.example`, bootstrap secret inventory, release manifest, and runtime metadata**
- [ ] **Step 3: Run CI and confirm RED on manifest absence/parity**
- [ ] **Step 4: Generate `config/providers.json` from the current reviewed metadata with explicit credential/auth/distribution fields**
- [ ] **Step 5: Add JSON loader/validator and switch `metadata.js` to consume the manifest instead of duplicating policy literals**
- [ ] **Step 6: Derive/check environment template and bootstrap secret names against manifest credentials while keeping `CTI_GATEWAY_TOKEN` and observability-only secrets explicit**
- [ ] **Step 7: Make repository verification reject drift in any derived surface**
- [ ] **Step 8: Run full CI and verify manifest parity GREEN**

### Task 4: Unified operator CLI

**Files:**
- Create: `bin/cti.mjs`
- Create: `src/control/doctor.js`
- Create: `src/control/commands.js`
- Modify: `package.json`
- Modify: `README.md`
- Test: `test/cli.test.js`

**Interfaces:**
- Commands: `doctor`, `providers list`, `providers env-template`, `maltego check`, `release verify`, `setup`, `repair`, `report compile`, `report diff`.
- Read-only commands return nonzero on hard failure and never print secret values.

- [ ] **Step 1: Write failing command-dispatch tests for deterministic help, unknown command rejection, manifest-backed provider list, and secret-free doctor output**
- [ ] **Step 2: Verify RED with missing CLI**
- [ ] **Step 3: Implement dependency-free argument parser and provider/doctor/release commands**
- [ ] **Step 4: Implement setup/repair/maltego thin delegation without duplicating credential storage**
- [ ] **Step 5: Wire report command stubs only after Tasks 5–7 provide their interfaces**
- [ ] **Step 6: Run CLI tests and full CI GREEN**

### Task 5: Canonical ReportModel and fail-closed quality gate

**Files:**
- Create: `src/report/model.js`
- Create: `src/report/quality.js`
- Create: `src/report/version.js`
- Test: `test/report-model.test.js`
- Test: `test/report-quality.test.js`
- Fixture: `test/fixtures/report/enrichment.json`

**Interfaces:**
- Produces: `buildReportModel(snapshot, options)` and `assertReportQuality(model, options)`.
- Input is one frozen evidence-v2 enrichment/case snapshot; no fetch/network dependency is accepted.

- [ ] **Step 1: Write a minimal valid frozen-snapshot fixture with provider/evidence provenance, relationships, ATT&CK mapping, limitations, and one observed behavior**
- [ ] **Step 2: Write failing tests for deterministic identity/subject/evidence indexes and the three behavior states**
- [ ] **Step 3: Write failing quality tests for orphan claims, missing provenance, malformed ATT&CK IDs, contextual-as-observed, duplicate observables, impossible timestamps, unsafe references, secret identifiers, unsupported attribution, and stale-without-warning**
- [ ] **Step 4: Verify RED with missing model/quality modules**
- [ ] **Step 5: Implement bounded model normalization and claim/evidence indexing**
- [ ] **Step 6: Implement fail-closed quality validation with structured error codes and bounded warnings**
- [ ] **Step 7: Run report model/quality tests and full CI GREEN**

### Task 6: Deterministic report renderers and integrity bundle

**Files:**
- Create: `src/report/render-html.js`
- Create: `src/report/render-text.js`
- Create: `src/report/render-csv.js`
- Create: `src/report/render-kql.js`
- Create: `src/report/render-navigator.js`
- Create: `src/report/render-pdf.js`
- Create: `src/report/compiler.js`
- Modify: `src/export/stix.js` only if a bounded public helper is required
- Test: `test/report-compiler.test.js`
- Test: `test/report-renderers.test.js`

**Interfaces:**
- Produces: `compileReportBundle(snapshot, { outDir, preset, generatedAt, sourceSha, profile })`.
- Required artifact names follow the spec; `manifest.json` contains SHA-256 for every emitted artifact except itself.

- [ ] **Step 1: Write failing determinism tests: same snapshot/options produce byte-identical HTML/TXT/JSON/CSV/KQL/Navigator/PDF/STIX**
- [ ] **Step 2: Write failing bundle tests for presets, artifact ceilings, offline rendering, manifest hashes, and public-safe redaction**
- [ ] **Step 3: Verify RED with missing compiler/renderers**
- [ ] **Step 4: Implement HTML/TXT/evidence JSON/CSV using only escaped bounded model fields**
- [ ] **Step 5: Implement KQL conditional emission and ATT&CK Navigator export**
- [ ] **Step 6: Reuse strict STIX generation for applicable observables without inventing report-only STIX concepts**
- [ ] **Step 7: Implement a minimal deterministic archival PDF with Node standard-library primitives and no external assets**
- [ ] **Step 8: Implement artifact hashing/manifest and preset selection**
- [ ] **Step 9: Run renderer/compiler tests and full CI GREEN**

### Task 7: Snapshot/case diff

**Files:**
- Create: `src/report/diff.js`
- Modify: `bin/cti.mjs`
- Test: `test/report-diff.test.js`

**Interfaces:**
- Produces: `diffReportSnapshots(before, after)` with deterministic `added`, `removed`, and `changed` domains.

- [ ] **Step 1: Write failing tests covering evidence IDs, observables, provider outcomes, threat assessment, contradictions, relationships, ATT&CK mappings, and limitations**
- [ ] **Step 2: Verify RED with missing diff implementation**
- [ ] **Step 3: Implement canonical set/object comparison with stable sorting and no significance scoring**
- [ ] **Step 4: Wire `cti report diff` and `cti report compile` to final interfaces**
- [ ] **Step 5: Run diff/CLI tests and full CI GREEN**

### Task 8: Governance verification, docs, final security review, merge and production acceptance

**Files:**
- Create: `scripts/verify-github-governance.mjs`
- Modify: `scripts/finalize.ps1`
- Modify: `README.md`
- Modify: `SECURITY.md`
- Modify: `CHANGELOG.md`
- Modify: `.github/workflows/tooling-smoke.yml`
- Test: `test/finalize.test.js`

**Interfaces:**
- `verify-github-governance.mjs` is read-only and exits nonzero unless the expected protection policy is observed when credentials/API access are supplied.
- `finalize.ps1` keeps the authoritative admin write/read-back path and refuses deployment if protection is absent or drifts.

- [ ] **Step 1: Write failing governance tests for required strict status, PR-only policy, stale review dismissal, admin enforcement, linear history, conversation resolution, and force/delete denial**
- [ ] **Step 2: Implement read-only verifier and strengthen finalizer read-back checks**
- [ ] **Step 3: Add CI fixture-level governance contract checks without requiring admin credentials in PR CI**
- [ ] **Step 4: Update docs for one-command/operator/report workflows and error negotiation**
- [ ] **Step 5: Run exact-head full Tooling smoke; inspect job logs, not only summary status**
- [ ] **Step 6: Verify Vercel preview `/api/meta`, JSON 401, HTML 401 unit contract, and unknown `/api/*` 404 routing**
- [ ] **Step 7: Run final changed-file security diff review; reject any new secret/egress/dependency/network/reporting bypass**
- [ ] **Step 8: Merge only the exact verified PR head SHA**
- [ ] **Step 9: Verify new exact `main` CI, exact-SHA production Vercel `READY`, live endpoint acceptance, and zero new runtime error clusters**
- [ ] **Step 10: Read back branch protection. If the connector cannot mutate it, report that single external admin action explicitly and do not claim it is enabled until `protected=true` is observed.**
