<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Document status:** Historical design record. Preserved for implementation history; current behavior is defined by [docs/ARCHITECTURE.md](https://github.com/ger1e/para11ax/blob/main/docs/ARCHITECTURE.md) and the current README.

# PARA11AX vNext Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the ultimate bounded personal PARA11AX gateway: deterministic, read-only, fixed-egress, provenance-rich, resilient, batch/STIX capable, Maltego-compatible, fully tested and independently release-verifiable.

**Architecture:** Preserve the existing adapter/registry/orchestrator design and zero-runtime-dependency posture. Add focused modules for provider metadata, egress control, bounded scheduling, evidence v2, correlation, telemetry, STIX export and release metadata; keep all active network destinations fixed in code and all state ephemeral/bounded.

**Tech Stack:** Node.js 24.x ES modules and standard library only at runtime; Vercel Functions; Python 3 + `maltego-trx==1.7.0` for local Maltego transforms; PowerShell bootstrap/finalizer; GitHub Actions with SHA-pinned actions.

**Spec:** `docs/superpowers/specs/2026-08-21-cti-gateway-vnext-design.md`

## Global Constraints

- Personal, read-only CTI enrichment only: no scan initiation, submission, detonation, takedown, containment or autonomous blocking.
- No caller-controlled outbound host, method or authentication material.
- No provider or gateway secret may appear in output, references, logs, artifacts or Git history.
- No vendor-vote/master maliciousness score; evidence semantics remain separate.
- Malformed/redirected/oversized source data fails closed and never becomes negative intelligence.
- Request/provider/cache/batch/relationship/output limits are finite and statically testable.
- Runtime remains Node.js 24.x and adds no npm runtime dependency.
- Existing `/api/para11ax/enrich` required fields remain backward compatible; vNext fields are additive.
- Every runtime task follows RED → minimal GREEN → full `npm run check` → merge-tree `Tooling smoke` → squash merge → exact-main verification.
- Production acceptance is separate from repository acceptance.

---

### Task 1: Version, provider manifest and evidence-v2 foundation

**Files:**
- Create: `src/core/version.js`
- Create: `src/core/provider-manifest.js`
- Modify: `src/core/provider-registry.js`
- Modify: `src/core/normalize.js`
- Modify: `src/core/orchestrator.js`
- Modify: `src/app.js`
- Modify: provider modules under `src/providers/*.js` only to add missing static metadata
- Test: `test/provider-manifest.test.js`
- Test: `test/evidence-v2.test.js`

**Interfaces:**
- Produces `GATEWAY_VERSION`, `EVIDENCE_SCHEMA_VERSION`, `manifestForRegistry(registry)`, and additive v2 response fields.
- Each active adapter must expose: `name`, `types`, `observationTypes`, `costClass`, `tier`, `timeoutMs`, `cacheTtlMs`, `negativeCacheTtlMs`, `maxResponseBytes`, `fixedHosts`, `parserVersion`, `sourceUrl`, plus `requiredEnv`/`optionalEnv` when applicable.

- [ ] **Step 1: Write RED manifest and evidence tests.** Assert registration rejects missing bounds/hosts/metadata, manifest contains every active adapter exactly once, no secret values are serialized, and enrich responses include `schemaVersion`, `gatewayVersion`, `profile`, `durationMs`, `budget`, `providerSummary`; evidence includes `cacheState`, `durationMs`, parser version and `integrity.fingerprint` while preserving existing fields.

```js
assert.equal(result.schemaVersion, '2.0');
assert.equal(result.gatewayVersion, '2.0.0');
assert.deepEqual(Object.keys(result.providerSummary).sort(), ['cached','failed','ok','skipped']);
assert.match(result.evidence[0].integrity.fingerprint, /^[a-f0-9]{64}$/);
```

- [ ] **Step 2: Run RED.** `node --test test/provider-manifest.test.js test/evidence-v2.test.js`; expected failures are missing vNext modules/fields.
- [ ] **Step 3: Implement minimal foundation.** `version.js` exports frozen constants. `provider-manifest.js` derives only static adapter metadata; registry validates required metadata. Normalize evidence computes SHA-256 over canonical normalized data + indicator + provider/parser version, explicitly not raw wire bytes. Orchestrator adds additive v2 envelope and provider summary.
- [ ] **Step 4: Run focused GREEN and full gate.** `node --test test/provider-manifest.test.js test/evidence-v2.test.js && npm run check`.
- [ ] **Step 5: Open PR `vnext/01-foundation`, verify merge-tree `Tooling smoke`, squash merge and verify exact `main`.**

### Task 2: Central egress policy and unified bounded cache

**Files:**
- Create: `src/core/egress.js`
- Modify: `src/core/fetch-json.js`
- Modify: `src/providers/public-feed.js`
- Modify: `src/core/cache.js`
- Modify: `src/core/provider-runner.js`
- Test: `test/egress-policy.test.js`
- Test: `test/cache-v2.test.js`

**Interfaces:**
- Produces `safeFetch(url, policy, options)` and `BoundedCache` with `get`, `set`, `getOrLoad`, `delete`, `clear`, `stats`.
- Provider policy supplies exact `fixedHosts`, method set, body ceiling and redirect=`error`.

- [ ] **Step 1: RED tests.** Prove off-manifest host, protocol drift, redirect, oversized Content-Length/post-read body and undeclared method are refused; credential-bearing URL material is never copied to failure text. Prove cache max entries, TTL, namespace separation, in-flight dedupe, opt-out and stats.

```js
await assert.rejects(() => safeFetch('https://evil.example/x', policy), /egress_host_not_allowed/);
assert.equal(await Promise.all([cache.getOrLoad('p:k', load), cache.getOrLoad('p:k', load)]).then(() => calls), 1);
```

- [ ] **Step 2: Run RED.** `node --test test/egress-policy.test.js test/cache-v2.test.js`.
- [ ] **Step 3: Implement.** Route JSON and text network reads through the egress boundary; retain fixed adapter URL construction as first line of defense. Keep MISP event-body loads explicitly `cache:false`. Add deterministic bounded eviction and count-only stats.
- [ ] **Step 4: Run GREEN + all checks.**
- [ ] **Step 5: PR `vnext/02-egress-cache`; merge only on exact merge-tree success and verify main.**

### Task 3: Bounded scheduler, profiles, deadlines and circuit breaker

**Files:**
- Create: `src/core/scheduler.js`
- Create: `src/core/circuit-breaker.js`
- Create: `src/profiles.js`
- Modify: `src/core/orchestrator.js`
- Modify: `src/workflows.js`
- Modify: `src/app.js`
- Test: `test/scheduler.test.js`
- Test: `test/profiles.test.js`
- Test: `test/circuit-breaker.test.js`

**Interfaces:**
- `selectProviders({type, profile, workflow, registry})` accepts only `fast|standard|full`.
- `runScheduledProviders()` enforces concurrency 4, request budget 20s, static per-workflow call ceiling.
- Circuit opens after 3 consecutive retryable failures for 60s by default; successful call resets it; status never becomes threat evidence.

- [ ] **Step 1: RED tests.** Assert deterministic tier ordering, max four simultaneous provider executions, `fast` excludes scarce providers, `full` cannot add providers outside the type workflow, deadline exhaustion produces structured `skipped`, and open circuits skip calls without a negative verdict.
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Implement scheduler/profile/circuit modules with injected clock for deterministic tests.** Allow at most one retry for retryable transport/5xx/429 cases and only within remaining request budget; do not retry semantic 4xx.
- [ ] **Step 4: GREEN + `npm run check`.**
- [ ] **Step 5: PR `vnext/03-scheduler`; merge-tree and main verification.**

### Task 4: Typed correlation, freshness and huntability

**Files:**
- Create: `src/core/correlate.js`
- Modify: `src/core/orchestrator.js`
- Test: `test/correlation.test.js`

**Interfaces:**
- `correlateEvidence({indicator,type,evidence,relationships,now})` returns `{corroboration, contradictions, freshness, huntability, riskAxes?}` without a numeric master score.

- [ ] **Step 1: RED tests.** Same semantic observation from independent sources corroborates; opposite same-class observations are contradictions; Tor/scanner context cannot corroborate malware verdicts; CVE KEV/EPSS/CVSS remain separate axes; stale timestamps classify freshness; ATT&CK knowledge never contributes to reputation.
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Implement pure deterministic correlation and capped relationship dedupe.** Huntability mapping is explicit by indicator/observation class; actor attribution is omitted unless evidence contains an explicit actor relationship.
- [ ] **Step 4: GREEN/full gate.**
- [ ] **Step 5: PR `vnext/04-correlation`; verify/merge.**

### Task 5: MISP and TAXII semantic hardening

**Files:**
- Modify: `src/providers/misp-osint.js`
- Modify: `src/providers/attack-taxii.js`
- Test: `test/misp-semantics.test.js`
- Test: `test/attack-taxii-relationships.test.js`

**Interfaces:**
- MISP matches deleted=false exact attributes and selected composite types only.
- ATT&CK relationship expansion is implemented only when server-side TAXII filtering can keep each request bounded; otherwise the existing bounded object lookup remains authoritative and the test records relationship expansion as intentionally omitted.

- [ ] **Step 1: RED MISP tests.** Cover deleted attributes, event publication/threat/date/tags, `to_ids`, exact component extraction for `domain|ip`, `hostname|port`, `ip-src|port`, `ip-dst|port`, `filename|md5|sha1|sha256`, and reject non-corresponding component matches.
- [ ] **Step 2: RED TAXII tests.** Prove fixed MITRE root/collection IDs and no collection-wide unbounded relationship fetch.
- [ ] **Step 3: Implement minimal safe semantics.** Keep max five MISP event fetches/feed/query and request-local event bodies.
- [ ] **Step 4: GREEN/full gate.**
- [ ] **Step 5: PR `vnext/05-misp-taxii`; verify/merge.**

### Task 6: Gated ASN and CIDR indicator support

**Files:**
- Modify: `src/core/validate.js`
- Modify: `src/workflows.js`
- Modify: relevant fixed public adapters (`src/providers/ripestat.js`, `src/providers/rdap.js`, `src/providers/spamhaus-drop.js`) only where their official lookup supports the new type
- Modify: `src/providers/index.js`
- Test: `test/network-indicators.test.js`

**Interfaces:**
- Strict ASN canonical form `AS<number>`; reject zero/out-of-range/non-decimal variants.
- Strict CIDR canonical form for IPv4/IPv6 network prefixes; reject host-only strings from the CIDR classifier.

- [ ] **Step 1: RED classification and routing tests.** Include boundary values and malformed inputs.
- [ ] **Step 2: Validate current upstream support from official endpoints before adapter code.** If an adapter cannot support a bounded fixed lookup, omit it and document the gap rather than simulate support.
- [ ] **Step 3: Implement classifiers and only defensible workflows.** No TLS/JA3 class is added unless a current non-deprecated fixed official source satisfies the spec.
- [ ] **Step 4: GREEN/full gate.**
- [ ] **Step 5: PR `vnext/06-network-types`; verify/merge.**

### Task 7: Authenticated bounded batch enrichment

**Files:**
- Create: `api/batch.js`
- Create: `src/core/batch.js`
- Modify: `src/app.js`
- Test: `test/batch-api.test.js`

**Interfaces:**
- `POST /api/para11ax/batch` body `{indicators:string[1..20], profile?:'fast'|'standard'|'full'}`.
- Max 20 inputs, max 200 provider calls globally, max 3 indicators active, one request deadline, canonical duplicates collapsed before work and re-associated in output.

- [ ] **Step 1: RED tests.** Unauthorized/method/media/body limits; 21 inputs rejected; duplicates perform provider work once; invalid individual indicator is represented independently; no provider override accepted; batch deadline/call-budget exhaustion is explicit.
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Implement `runBatch()` using the same classifier/profile/scheduler as `/api/para11ax/enrich`.** Do not duplicate provider routing logic.
- [ ] **Step 4: GREEN/full gate.**
- [ ] **Step 5: PR `vnext/07-batch`; verify/merge.**

### Task 8: Dependency-free STIX 2.1 export

**Files:**
- Create: `src/export/stix.js`
- Create: `api/stix.js`
- Modify: `src/app.js`
- Test: `test/stix-export.test.js`

**Interfaces:**
- `toStixBundle(enrichment,{maxObjects=100,now,uuid})` emits STIX 2.1 Bundle only from gateway-generated enrichment.
- Preserve MITRE source STIX IDs; otherwise generate valid random IDs via `crypto.randomUUID()`; do not invent deterministic namespaces.

- [ ] **Step 1: RED tests.** Valid patterns for IPv4/IPv6/domain/url/file hashes/CVE where defensible; escaping; ATT&CK STIX ID preservation; malware/actor objects only from supported relationships; external references sanitized; no fabricated confidence; object cap enforced.
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Implement pure mapper and authenticated `POST /api/para11ax/stix` that performs normal enrichment first.**
- [ ] **Step 4: GREEN/full gate.**
- [ ] **Step 5: PR `vnext/08-stix`; verify/merge.**

### Task 9: Meta/status APIs and privacy-preserving telemetry

**Files:**
- Create: `api/meta.js`
- Create: `api/status.js`
- Create: `src/core/telemetry.js`
- Modify: `src/app.js`
- Modify: `src/core/orchestrator.js`
- Modify: `src/core/provider-runner.js`
- Test: `test/meta-status.test.js`
- Test: `test/telemetry.test.js`

**Interfaces:**
- Public `GET /api/para11ax/meta`: versions, types, profiles, static provider capabilities and hard limits only.
- Bearer `GET /api/para11ax/status`: configuration booleans, parser versions, circuit/cache count-only stats, uptime/counters; no raw prior indicators or secrets.
- `telemetry.emit(event)` is no-op by default and never receives provider credential values.

- [ ] **Step 1: RED tests for information boundaries and `Cache-Control: no-store` on authenticated status.**
- [ ] **Step 2: RED telemetry tests proving default events contain request ID/type/provider/status/duration but not raw indicators unless an explicitly injected local debug sink is enabled.**
- [ ] **Step 3: Implement and wire events for request/provider/cache/circuit/budget lifecycle.** Keep Sentry auth token observability-only; do not send CTI evidence to Sentry.
- [ ] **Step 4: GREEN/full gate.**
- [ ] **Step 5: PR `vnext/09-observability`; verify/merge.**

### Task 10: Maltego vNext parity

**Files:**
- Modify: `maltego/mapper.py`
- Modify: `maltego/project.py`
- Modify: `maltego/transforms/__init__.py`
- Create/modify Phrase transforms for ASN/CIDR only if Task 6 shipped those types
- Modify: `maltego/README.md`
- Test: `maltego/tests/test_mapper.py`
- Test: `maltego/tests/test_transform_parity.py`

**Interfaces:**
- One gateway bearer only; DPAPI resolution order unchanged.
- New v2 correlation/provenance fields map to bounded Phrase/relationship nodes; max entities remains 1..250 and default 50.

- [ ] **Step 1: RED tests.** Verify v2 evidence/correlation renders without dropping existing graph nodes; every supported transform type is discoverable; no vendor secret names or values are written into MTZ/project output.
- [ ] **Step 2: Run Python RED.** `cd maltego && python3 -m unittest discover -s tests -v`.
- [ ] **Step 3: Implement mapper/transform parity.** Prefer Phrase for ASN/CIDR unless an existing stable Maltego entity is already used by the installed SDK.
- [ ] **Step 4: Python GREEN + root `npm run check` + `python3 -m compileall -q maltego`.**
- [ ] **Step 5: PR `vnext/10-maltego`; verify/merge.**

### Task 11: Deterministic fuzz, chaos and executable CI invariants

**Files:**
- Create: `test/fuzz-deterministic.test.js`
- Create: `test/chaos-provider.test.js`
- Create: `test/manifest-invariants.test.js`
- Modify: `scripts/verify-repo.sh`
- Modify: `.github/workflows/tooling-smoke.yml` only if a distinct step adds diagnostic value; no new third-party action

**Interfaces:**
- Fixed-seed standard-library PRNG; bounded iterations so CI runtime remains predictable.

- [ ] **Step 1: Add RED invariants that detect an off-manifest fetch host, active deprecated provider, missing provider metadata, missing workflow adapter, malformed parser false-negative behavior, transform/type drift and schema/version drift.**
- [ ] **Step 2: Add deterministic malformed corpora for IDNA/domain, URL, hash, CVE, ATT&CK, ASN/CIDR, CSV/text and MISP index parsing.**
- [ ] **Step 3: Add chaos fixtures for timeout, abort, 429 Retry-After, 5xx, HTML, oversized body with/without Content-Length, redirect, partial outage, cache poisoning and deadline exhaustion.**
- [ ] **Step 4: `npm run check` must include all of the above and stay deterministic.**
- [ ] **Step 5: PR `vnext/11-qa`; verify/merge.**

### Task 12: Executable docs, threat model and release manifest

**Files:**
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/EVIDENCE-SCHEMA.md`
- Create: `docs/PROVIDERS.md`
- Create: `docs/API.md`
- Create: `docs/THREAT-MODEL.md`
- Create: `docs/OPERATIONS.md`
- Create: `scripts/generate-release-manifest.mjs`
- Create/generated: `release-manifest.json`
- Modify: `README.md`
- Modify: `scripts/verify-repo.sh`
- Test: `test/release-manifest.test.js`

**Interfaces:**
- Release manifest contains gateway/schema version, source commit where available, and every provider/parser version; never environment values.

- [ ] **Step 1: RED test requires manifest/provider/schema parity and docs links.**
- [ ] **Step 2: Implement manifest generator using registry metadata only.** Ensure output ordering is deterministic except the source SHA field supplied at generation.
- [ ] **Step 3: Write focused docs that explicitly separate implemented/configured/production-verified/gap states.** Threat model maps leaked bearer, provider secret compromise, malicious upstream, redirects, SSRF, quota/latency amplification, cache poisoning, provenance confusion, stale negatives, malicious MISP content, log leakage and Actions supply-chain risks to controls/tests.
- [ ] **Step 4: GREEN/full gate and public-release audit.**
- [ ] **Step 5: PR `vnext/12-release-docs`; verify/merge.**

### Task 13: Final QA, repository hygiene and production acceptance

**Files:**
- Modify only defects discovered by verification; every defect gets a reproducing test first.
- Potentially update: `scripts/finalize.ps1`, `scripts/bootstrap-vercel.ps1`, `docs/OPERATIONS.md` only when evidence shows drift.

**Interfaces:**
- Exact `main` SHA is the release identity; production must be shown to correspond to that exact source.

- [ ] **Step 1: Invoke `superpowers:verification-before-completion`. Run exact-main repository gate:** `npm run check`; Maltego unittest; Python compile; PowerShell parse; ShellCheck; public-release audit; combined `Tooling smoke` status.
- [ ] **Step 2: Inspect open PRs/issues/branches and close only obsolete temporary work after QA. Do not delete evidence needed for audit.**
- [ ] **Step 3: Verify branch protection/finalizer contract.** If connector cannot mutate protection, rely on the already-shipping authenticated local finalizer and state the remaining user-side prerequisite rather than claiming success.
- [ ] **Step 4: Verify Vercel deployment metadata against exact current `main`.** If stale, production is not accepted. The authorized local command remains:

```powershell
git checkout main
git pull --ff-only
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\finalize.ps1
```

- [ ] **Step 5: Production smoke acceptance after deployment.** Authenticated protected `/api/para11ax/health`; public `/api/para11ax/meta`; bearer `/api/para11ax/status`; one bounded public-source enrichment; one configured credentialed-source enrichment; confirm no secret reflection in responses/log surfaces.
- [ ] **Step 6: Final report must separate repository-complete, production-complete, and any gated/omitted source class. No completion claim without fresh evidence.**

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
