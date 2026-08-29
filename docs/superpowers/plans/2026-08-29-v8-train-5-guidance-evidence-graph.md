# PARA11AX v8 Train 5 — Guidance and Evidence Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic evidence-graph and analyst-guidance projections over existing Evidence v2, Train 3 semantic diffs, and Train 4 local cases without adding new enrichment, persistence, scoring, or egress.

**Architecture:** Keep `src/core/decision-engine.js` authoritative for disposition/confidence and add pure projection modules around it. `src/core/evidence-graph.js` builds a bounded, deeply frozen graph from explicit normalized facts; `src/core/guidance.js` projects explainable guidance and semantic-change attention; `app/case-evidence-graph.js` adapts local case snapshots/sightings into the same vocabulary. Gateway integration is additive only after all pure contracts pass.

**Tech Stack:** Node.js 24 ESM + standard library, browser ESM for case projection, existing Evidence v2/correlation/decision/semantic-diff/case modules, GitHub Actions, CodeQL.

**Spec:** `docs/superpowers/specs/2026-08-29-v8-train-5-guidance-evidence-graph-design.md`

## Global Constraints

- No new provider calls, outbound hosts, network paths, dependencies, credentials, database, graph service, cloud sync, scheduler, or server-side case persistence.
- No universal maliciousness/risk/confidence/vendor-vote numeric score.
- Preserve KEV/EPSS/CVSS/provider verdict/infrastructure/ATT&CK/sandbox semantic separation.
- Preserve existing disposition set exactly: `hunt_now`, `investigate`, `monitor`, `context_only`, `insufficient`.
- Infrastructure-only evidence cannot become a threat conclusion.
- Attribution only from explicit normalized evidence/relationships.
- No fuzzy matching, similarity matching, NLP extraction, name guessing, or inferred relationship expansion.
- Deterministic stable identities/order; fail closed on bounds; no silent semantic truncation.
- Train 4 local browser storage remains the only case persistence path.
- Evidence schema v2 and existing decision/report/shell/API/Maltego contracts remain compatible; certificate Maltego parity remains Train 6.

---

### Task 1: Canonical Evidence Graph

**Files:**
- Create: `src/core/evidence-graph.js`
- Test: `test/evidence-graph-v8.test.js`

**Interfaces:**
- Produces: `buildEvidenceGraph({ indicator, type, evidence, relationships, correlation, decision })`
- Produces: `EVIDENCE_GRAPH_SCHEMA_VERSION = '1.0'`
- Produces successful shape `{ schemaVersion, rootId, nodes, edges, counts, truncated:false }`.

- [ ] **Step 1: Write RED contract tests** covering stable IDs, deterministic ordering across reordered set-like inputs, evidence/provider provenance edges, ATT&CK/actor/malware explicit-only projection, exact relationship dedupe, no score field, deep freeze, and fail-closed limits.
- [ ] **Step 2: Run Tooling smoke on test-only head** and confirm failures are limited to missing `src/core/evidence-graph.js`/exports.
- [ ] **Step 3: Implement graph identity and freezing** with SHA-256 identities, exact node/edge types from the spec, canonical sort keys, and recursive freeze.
- [ ] **Step 4: Implement explicit fact projection** from subject, evidence fingerprint/provider, explicit ATT&CK IDs, explicit actor/malware fields, and normalized relationships only.
- [ ] **Step 5: Implement bounds**: nodes 256, edges 512, evidence 100, ATT&CK 64, actor 32, malware 32; throw stable `evidence_graph_*_limit` errors before returning an over-limit graph.
- [ ] **Step 6: Run focused and full CI GREEN** and inspect job logs.

### Task 2: Versioned Analyst Guidance

**Files:**
- Create: `src/core/guidance.js`
- Test: `test/guidance-v8.test.js`

**Interfaces:**
- Consumes: `buildEvidenceGraph(...)` output plus existing `decision`, `correlation`, optional Train 3 semantic diff.
- Produces: `buildGuidance({ decision, correlation, semanticDiff = null, evidenceGraph })`.
- Produces: `GUIDANCE_SCHEMA_VERSION = '1.0'`.

- [ ] **Step 1: Write RED tests** proving disposition/confidence inheritance, distinct contradiction/limitation/freshness/coverage/telemetry/ATT&CK/hunt fields, graph-resolved evidence fingerprints, infrastructure-only `context_only`, exact semantic-attention allowlist, and absence of weighted severity/score.
- [ ] **Step 2: Run Tooling smoke and confirm RED** on missing guidance module only.
- [ ] **Step 3: Implement guidance projection** without recomputing decision semantics.
- [ ] **Step 4: Implement evidence linkage validation**: every output fingerprint must resolve to an `evidence` graph node; unknown references fail with `guidance_evidence_reference_invalid`.
- [ ] **Step 5: Implement semantic change attention** using only `decision_changed`, `contradiction_changed`, `semantic_claim_changed`, `provider_state_changed`, `attack_mapping_changed`, `huntability_changed`, `telemetry_changed` as forcing categories; preserve all categories/explanations visibly.
- [ ] **Step 6: Run focused and full CI GREEN**.

### Task 3: Browser-Local Case Evidence Graph

**Files:**
- Create: `app/case-evidence-graph.js`
- Test: `test/case-evidence-graph-v8.test.js`
- Modify: `test/case-persistence-security-v8.test.mjs`

**Interfaces:**
- Consumes: one validated Train 4 case and optional exact typed sightings.
- Produces: `buildCaseEvidenceGraph(caseValue, { sightings = [] })`.

- [ ] **Step 1: Write RED tests** for case root, pin observables, snapshot nodes, merged snapshot Evidence v2 graphs, exact typed cross-case sightings, type mismatch rejection, deterministic rebuild, note non-parsing, and disappearance of omitted/deleted sightings on rebuild.
- [ ] **Step 2: Extend RED security guard** so `app/case-evidence-graph.js` cannot reference bearer/session/localStorage/sessionStorage/IndexedDB/fetch/XHR/WebSocket/sendBeacon/FileSystem/CacheStorage primitives.
- [ ] **Step 3: Run Tooling smoke and verify RED** on missing case graph implementation.
- [ ] **Step 4: Implement pure case projection** using case validation + `buildEvidenceGraph`; merge by exact node/edge IDs; add only `case_contains`, `case_snapshot`, `snapshot_subject`, `cross_case_sighting` case edges.
- [ ] **Step 5: Enforce exact typed sighting equality** on both type and value; never parse note text or semantic-diff prose.
- [ ] **Step 6: Run focused and full CI GREEN** including security guard.

### Task 4: Additive Gateway Integration

**Files:**
- Modify: `src/app.js`
- Test: `test/guidance-graph-integration-v8.test.js`

**Interfaces:**
- Consumes existing successful/partial normalized enrichment after correlation + decision.
- Adds top-level `evidenceGraph` and `guidance` to successful/partial responses only.

- [ ] **Step 1: Write RED integration tests** asserting `ok` and `partial` responses include both additive fields, error responses do not manufacture them, existing decision remains unchanged, and graph/guidance construction is performed after normalized correlation/decision.
- [ ] **Step 2: Run Tooling smoke and verify RED** only on missing integration.
- [ ] **Step 3: Wire `buildEvidenceGraph` then `buildGuidance`** into the existing response construction path using current decision/correlation/relationships/evidence.
- [ ] **Step 4: Fail through the existing sanitized internal-error path** on graph/guidance invariant errors; do not emit contradictory partial guidance.
- [ ] **Step 5: Run existing decision/correlation/report/API tests plus full Tooling smoke GREEN**.

### Task 5: Train 5 Compatibility and Security Acceptance

**Files:**
- Create: `test/train-5-compatibility-v8.test.mjs`
- Modify only if required by established manifest/release verification: generated/static verification artifacts already used by the repository.

**Interfaces:**
- Locks Train 5 as additive over Train 1–4 contracts.

- [ ] **Step 1: Write compatibility assertions**: Evidence v2 unchanged; disposition set unchanged; no graph/guidance score; no new network/persistence/dependency primitive; certificate Maltego gap still deferred; case schema remains `1.0`; graph/guidance versions each `1.0`.
- [ ] **Step 2: Run full Tooling smoke** and inspect every stage, not summary only.
- [ ] **Step 3: Run CodeQL on exact feature head**.
- [ ] **Step 4: Review changed-file diff** for secret reflection, environment access, egress, browser persistence, active operations, and unrelated UI changes.
- [ ] **Step 5: Synchronize with latest `main`** using a real history merge that preserves all concurrent main-only changes; verify `behind_by=0` and the exact Train 5 changed-file set.
- [ ] **Step 6: Re-run Tooling smoke and CodeQL on the synchronized exact PR head**.
- [ ] **Step 7: Merge only that verified head SHA** using the repository-allowed merge method.
- [ ] **Step 8: Verify fresh Tooling smoke and CodeQL on the resulting exact `main` commit** before declaring Train 5 complete.
