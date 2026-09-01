<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Document status:** Historical design record. Preserved for implementation history; current behavior is defined by [docs/ARCHITECTURE.md](https://github.com/ger1e/para11ax/blob/main/docs/ARCHITECTURE.md) and the current README.

# Analyst Mission Pack v1 — Implementation Plan

> **Execution rule:** implement each production behavior through RED → GREEN → repository-wide verification. Do not add runtime dependencies.

**Goal:** Add a deterministic analyst workflow from explicit client context to relevance, hunt package, KQL quality state, imported results, and ServiceNow-ready output while preserving PARA11AX Evidence v2 and no-LLM core boundaries.

**Architecture:** Small pure modules under `src/core/mission/` with no network/filesystem side effects. A renderer under `src/report/` projects the resulting object. Existing report and shell surfaces remain backward compatible. Integration into shell is a later train if the core patch becomes too broad.

**Tech stack:** Node.js 24 ESM, built-in `node:test`, built-in `node:assert/strict`, no dependencies.

---

## Task 1: Client profile normalization and relevance assessment

**Files:**
- Create: `test/mission-relevance-v10.test.js`
- Create: `src/core/mission/client-profile.js`
- Create: `src/core/mission/relevance.js`

**RED**
1. Test normalization: trims, deduplicates, sorts and freezes profile lists.
2. Test invalid/oversized profile rejection.
3. Test relevance factor contributions and deterministic 0–100 score.
4. Test unknown factors contribute zero and surface gaps.
5. Test relevance label boundaries.

**GREEN**
Implement only the bounded normalization and explicit weighted factor engine required by the tests.

**Verify**
- Feature test passes.
- Full `npm test` / `npm run check` passes via CI.

## Task 2: Hunt package construction

**Files:**
- Create: `test/mission-hunt-package-v10.test.js`
- Create: `src/core/mission/hunt-package.js`

**RED**
1. Stable content-derived package ID.
2. READY only when hypothesis, provenance, required telemetry and KQL validation are sufficient.
3. TELEMETRY_GAP when required telemetry is unavailable.
4. SCHEMA_UNVERIFIED when included KQL fails schema validation.
5. INSUFFICIENT_EVIDENCE when provenance is missing.
6. Inputs are bounded, normalized and returned object is immutable.

**GREEN**
Implement deterministic package construction. Do not generate unsupported claims or fabricate KQL.

## Task 3: KQL conservative validator

**Files:**
- Create: `test/mission-kql-validator-v10.test.js`
- Create: `src/core/mission/kql-schema.js`
- Create: `src/core/mission/kql-validator.js`

**RED**
1. Known table/column query returns VALID.
2. Unknown table returns SCHEMA_UNVERIFIED.
3. Extractable unknown column returns SCHEMA_UNVERIFIED.
4. Wildcard union / `search *` returns warnings or failure as defined.
5. Query-management/destructive/control forms are rejected.
6. Empty/oversized queries are rejected.

**GREEN**
Implement an intentionally small Microsoft schema snapshot for PARA11AX-supported hunt templates. Unknown remains unknown.

## Task 4: Bounded result import and analysis

**Files:**
- Create: `test/mission-result-analysis-v10.test.js`
- Create: `src/core/mission/result-analysis.js`

**RED**
1. JSON row arrays import deterministically.
2. CSV imports quoted fields and bounded rows/columns.
3. Malformed/oversized input rejects cleanly.
4. Zero rows returns NO_RESULTS, not a benign verdict.
5. Non-empty rows return RESULTS_PRESENT with deterministic summary.
6. Spreadsheet-like strings remain inert data.

**GREEN**
Implement a small bounded parser without dependencies or execution side effects.

## Task 5: ServiceNow-ready projection

**Files:**
- Create: `test/mission-servicenow-v10.test.js`
- Create: `src/report/render-servicenow.js`

**RED**
1. Projection includes title, suggested severity, hypothesis, result state, ATT&CK, telemetry gaps, evidence/source references, KQL state, limitations and next actions.
2. Output is deterministic.
3. Unsafe line/control characters are normalized.
4. No send/network behavior exists.

**GREEN**
Implement JSON and text projections only.

## Task 6: Public API surface and documentation

**Files:**
- Create: `src/core/mission/index.js`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/API.md` only if the mission core is exposed through HTTP in this train.
- Modify: `README.md` with a concise Analyst Mission Pack capability statement.

**Tests:**
- Add contract test proving the mission index exports only the supported pure functions.
- Add dependency-policy assertion only if needed; no dependency changes are expected.

## Task 7: Shell integration (separate train if necessary)

**Files:**
- Modify: `app/shell-core/catalog.js`
- Modify: `app/shell-browser-executor.js`
- Modify: `src/control/shell-node-executor.js`
- Add browser/node parity tests.

Commands:
- `mission profile validate`
- `mission relevance`
- `mission hunt build`
- `mission kql validate`
- `mission result analyze`
- `mission servicenow`

If this materially expands the first PR or weakens reviewability, ship it in a follow-on PR after the pure core is green.

## Final verification

Run/confirm through repository CI:

- `npm ci --ignore-scripts`
- `npm audit --omit=dev`
- `npm run check`
- Maltego unittest suite
- Python compile
- shellcheck
- PowerShell syntax checks

Then inspect the PR diff for:

- no new egress;
- no secret reads;
- no LLM path;
- no dependency changes;
- no silent semantic promotion;
- no score described as maliciousness/probability;
- fail-closed `SCHEMA_UNVERIFIED`, `TELEMETRY_GAP`, `INSUFFICIENT_EVIDENCE` states.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
