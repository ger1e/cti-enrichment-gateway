# PARA11AX v8 Cross-Plan Self-Review and Execution Amendments

> **For agentic workers:** This document is normative for v8 execution. Read it together with the relevant Train 1–8 implementation plan and the approved design spec. Where this document conflicts with a train plan, this document wins. Before implementing any train, revalidate its file paths, interfaces, counts, and assumptions against the actual merged `main` produced by the preceding train.

**Goal:** Correct cross-train interface, coverage, resilience, and execution-order defects found during the final self-review without changing the approved v8 architecture.

**Architecture:** The eight train plans remain the staged implementation decomposition. This amendment supplies the canonical corrections that span more than one train: composite execution contracts, parser drift handling, semantic-diff identity, typed observable round-tripping, local-workspace failure isolation, graph provenance/depth, report-diff input typing, surface parity, and production-state language.

**Tech Stack:** Node.js 24.x ESM, browser ES modules/IndexedDB, Python Maltego TRX, Vercel/GitHub release verification, existing PARA11AX fixed-egress and Evidence v2 architecture.

**Spec:** `docs/superpowers/specs/2026-08-28-para11ax-v8-full-maxx-design.md`

## Global Execution Gate

The later train plans were pre-staged before their predecessors landed. Therefore, the phrase in Train 1 saying later plans should only be created after predecessor merge is superseded by this rule:

1. Plans may exist in advance.
2. **Execution** of Train N must start only after Train N-1 is merged and green on `main`.
3. Before the first RED test of Train N, compare the plan’s exact paths, signatures, constants, provider/type counts, and tests against current `main`.
4. If current `main` differs materially, update the train plan before production code is touched.
5. `main` must remain deployable after every train.

No v8 implementation may skip test-first RED -> GREEN -> full verification.

---

## Amendment 1 — Train 1: Make the execution contract machine-readable without duplicating global limits per provider

The approved design requires provider admission to cover timeout, retry, response-size, concurrency, and call-budget behavior. Per-provider timeout/response caps already live in `config/providers.json`; retries/concurrency/deadline are shared scheduler policy and call ceilings are workflow policy. Do not duplicate those global values into all provider entries.

### Required additional files/interfaces

**Create:** `src/core/execution-policy.js`

```js
export const EXECUTION_POLICY_VERSION = 'v8.1';
export const PROVIDER_CONCURRENCY_MAX = 4;
export const PROVIDER_MAX_ATTEMPTS = 2;
export const REQUEST_DEADLINE_MS = 20_000;

export const EXECUTION_POLICY = Object.freeze({
  version: EXECUTION_POLICY_VERSION,
  providerConcurrencyMax: PROVIDER_CONCURRENCY_MAX,
  providerMaxAttempts: PROVIDER_MAX_ATTEMPTS,
  requestDeadlineMs: REQUEST_DEADLINE_MS,
});
```

Train 1 must refactor `src/core/scheduler.js` and `src/app.js` to consume these constants without changing behavior. `src/workflows.js` remains the canonical type-specific call-budget source through `WORKFLOW_CALL_LIMITS`.

Each provider policy gains one pointer, not duplicated numeric limits:

```json
"executionPolicy":"v8.1"
```

`src/providers/manifest.js`, `src/providers/metadata.js`, `src/core/provider-contract.js`, and manifest parity tests must require `executionPolicy === EXECUTION_POLICY_VERSION`.

`buildCapabilityRegistry()` gains a secret-free top-level projection:

```js
execution: {
  version: 'v8.1',
  providerConcurrencyMax: 4,
  providerMaxAttempts: 2,
  requestDeadlineMs: 20000,
  workflowProviderCalls: { ...WORKFLOW_CALL_LIMITS }
}
```

Add focused tests proving scheduler/app defaults still equal the pre-v8 values and no call-budget/concurrency behavior changed.

---

## Amendment 2 — Train 2: Parser schema drift must be explicit, not converted to absence

The Train 2 provider plan needs malformed/partial/schema-drift fixtures for every new or extended parser.

### Censys certificate parser

HTTP 404 remains a valid `no_result`. A successful HTTP response must throw `Error('provider_schema_invalid')` when any of these are true:

- `result.resource`/equivalent certificate object is missing;
- a returned `fingerprint_sha256` exists but does not equal the requested canonical fingerprint;
- `parsed.names` exists but is not an array;
- the returned resource has neither the requested fingerprint nor any defensible certificate metadata.

### VirusTotal certificate parser

HTTP 404 remains a valid `no_result`. A successful HTTP response must throw `Error('provider_schema_invalid')` when:

- `data` is missing or not an object;
- `data.type` is present and is not `ssl_cert`;
- `data.id`/`thumbprint_sha256` is present and conflicts with the requested fingerprint;
- `attributes` is missing or not an object.

### Cloudflare DNS parser

A valid DNS JSON response requires integer `Status`. `Status === 0` with missing/empty `Answer` is valid `no_result`; NXDOMAIN/nonzero DNS status is also absence/context, not benign. If `Answer` exists it must be an array. Missing/invalid `Status` or non-array `Answer` is `provider_schema_invalid`.

Add tests for valid result, valid absence/404, partial schema, malformed schema, and response-cap enforcement through the existing bounded fetch layer. Provider schema errors must surface through the normal provider-runner failure path; they must never become `clean`, `benign`, or `no_result` unless the upstream response explicitly represents a valid absence state.

---

## Amendment 3 — Train 3: Semantic diff categories and evidence identity

The Train 3 draft omitted two categories required by the approved design and would classify an in-place claim change as remove+add because it keyed evidence only by integrity fingerprint.

### Canonical diff categories

Train 3 tests and implementation must cover:

```text
evidence_added
evidence_removed
semantic_claim_changed
provider_state_changed
provider_coverage_changed
relationship_added
relationship_removed
contradiction_changed
freshness_changed
attack_mapping_changed
decision_changed
huntability_changed
telemetry_changed
```

Explicit relationship changes satisfy the design’s contextual-mapping change requirement; ATT&CK mappings retain their own category.

### Evidence identity rule

Within one enrichment envelope the stable semantic claim identity is:

```js
`${provider}\u0000${observation.kind}`
```

For a claim identity present on both sides:

- unchanged semantic projection -> no record;
- changed semantic projection/fingerprint -> one `semantic_claim_changed` record with canonical before/after values, provider, and both evidence fingerprints.

Use `evidence_added`/`evidence_removed` only when the claim identity itself appears/disappears.

### Provider state rule

Compare the stable `meta.providerHealth` projection by provider. A state change such as `ok -> timeout`, `unconfigured -> ok`, or `ok -> circuit_open` produces `provider_state_changed`. Provider-state changes are coverage/failure context and are never negative reputation evidence.

### Category ordering

Use this fixed ordering before key sort and the existing 128-record cap:

```js
[
  'decision_changed',
  'contradiction_changed',
  'semantic_claim_changed',
  'evidence_added',
  'evidence_removed',
  'provider_state_changed',
  'provider_coverage_changed',
  'relationship_added',
  'relationship_removed',
  'attack_mapping_changed',
  'huntability_changed',
  'telemetry_changed',
  'freshness_changed'
]
```

`explainSemanticDiff()` must have deterministic phrases for both new categories. Add golden tests proving a verdict/attribute change is one `semantic_claim_changed`, not a synthetic remove+add pair.

---

## Amendment 4 — Train 4: Canonical browser observable transport

Certificate canonical values are stored without the `cert-sha256:` input prefix. Any browser path that replays a typed certificate must restore that prefix before calling `/enrich` or `/batch`; otherwise it becomes a file hash.

### Create `app/observable-input.js`

```js
export const SUPPORTED_OBSERVABLE_TYPES = Object.freeze([
  'asn', 'attack', 'certificate', 'cidr', 'cve', 'domain', 'hash', 'ip', 'url'
]);

export function toGatewayIndicator({ type, value }) {
  if (!SUPPORTED_OBSERVABLE_TYPES.includes(type)) throw new TypeError('unsupported observable type');
  if (typeof value !== 'string' || value.length === 0) throw new TypeError('observable value required');
  return type === 'certificate' ? `cert-sha256:${value}` : value;
}
```

Train 4 refresh uses `toGatewayIndicator(pin)` before assembling `client.batch()` input. Train 7 graph pivot uses the same helper before entering the normal enrich path. No browser code reimplements the server classifier.

### Shell case grammar correction

Do not accept an arbitrary untyped `pin <observable>` and then guess its class locally. Use deterministic typed/current-result operations:

```text
pin
  -> pin the current enrichment result using its canonical {type, indicator}

unpin <type> <value>
  -> remove one exact canonical pin

case find <type> <value>
  -> exact browser-local index lookup only
```

The parser validates `<type>` against `SUPPORTED_OBSERVABLE_TYPES`; it does not canonicalize arbitrary strings. This preserves the no-generic-routing rule and keeps server classification authoritative.

---

## Amendment 5 — Train 4: Bundle, migration, import collision, and workspace-failure semantics

### Correct bundle interface

Replace the draft signature with:

```js
export function serializeCaseBundle(caseValue, { now = () => new Date().toISOString() } = {});
export function parseCaseBundle(text, { supportedTypes = SUPPORTED_OBSERVABLE_TYPES } = {});
```

`parseCaseBundle()` must reject any pin/snapshot/diff subject type outside `supportedTypes` before mutation.

Version behavior for v8.1 is explicit:

- exact bundle version `1.0` -> accepted;
- older/future/unknown version -> reject with `case_bundle_version_unsupported`;
- no silent best-effort migration exists in v8.1.

Tests for rejected older/future versions are the v8.1 migration-compatibility tests required by the design.

### Import collision behavior

`case import` must not overwrite an existing local case with the same ID. After parsing, call `cases.get(imported.id)`; if it exists, reject with `case_import_conflict` before `save()`.

### Active case reset behavior

Train 4 runtime tests must additionally prove:

```text
disconnect clears activeCaseId
reboot/remount clears activeCaseId
page reload starts with activeCaseId null
```

### IndexedDB failure isolation

Workspace initialization must be soft-fail. `createIndexedDbCaseStorage()` may still throw `workspace_storage_failed`, but `app/boot.js` catches workspace initialization failure and mounts the normal transient analyst shell with workspace operations disabled.

Required behavior:

```text
enrichment/auth/meta/health/status still work when IndexedDB is unavailable
case commands return "workspace unavailable" or an equivalent stable local error
local storage failure never changes a server enrichment envelope/session result
```

Add a runtime test with missing/failing IndexedDB that successfully completes a normal enrichment.

---

## Amendment 6 — Train 4/5: Cross-case sighting identity and graph provenance

The Train 4 sighting object must carry the exact observable it refers to. Replace the earlier shape with:

```js
{
  type: string,
  value: string,
  caseId: string,
  caseTitle: string,
  source: 'pin' | 'snapshot' | 'relationship' | 'attack',
  snapshotId: string | null
}
```

`findCaseSightings(index, { type, value })` returns only exact matching entries including that same `type` and `value`.

The Train 5 graph edge shape gains local provenance:

```js
{
  type,
  source,
  target,
  provider: string | null,
  evidenceFingerprints: string[],
  localCaseIds: string[]
}
```

Server evidence edges use `localCaseIds: []`. A local `seen_in_case` edge uses `provider: null`, `evidenceFingerprints: []`, and `localCaseIds: [caseId]`.

Every non-subject edge must satisfy at least one provenance condition:

```text
provider is non-null
OR evidenceFingerprints.length > 0
OR localCaseIds.length > 0
```

No case title/note/snapshot payload is treated as evidence provenance.

---

## Amendment 7 — Train 5: Enforce an explicit graph depth bound

Node/edge bounds alone do not satisfy the approved graph depth contract.

Export and test:

```js
export const MAX_GRAPH_NODES = 100;
export const MAX_GRAPH_EDGES = 100;
export const MAX_GRAPH_DEPTH = 2;
```

`buildEvidenceGraph()` assigns the subject depth 0. Explicit direct evidence/provider relationships are depth 1. Deterministic context/case/ATT&CK references may reach depth 2. Any node/edge that would be unreachable from the subject or require depth >2 is omitted.

Use deterministic breadth-first depth assignment after candidate edge collection and before the final node/edge cap. Tests must include a synthetic three-hop chain and prove the depth-3 node/edge is absent. Graph rendering/traversal performs zero provider calls.

---

## Amendment 8 — Train 6: Report diff must compare raw Evidence v2 snapshots before ReportModel conversion

The draft Train 6 step was type-inconsistent: `diffEvidenceSnapshots()` accepts Evidence v2 envelopes, not `ReportModel` objects.

Use this interface:

```js
export function diffReportModels(beforeModel, afterModel, { semanticDiff = null } = {});
```

In `runReportDiff(args)`:

```js
const beforeSnapshot = readSnapshot(args[0]);
const afterSnapshot = readSnapshot(args[1]);
const semanticDiff = diffEvidenceSnapshots(beforeSnapshot, afterSnapshot);
const beforeModel = buildReportModel(beforeSnapshot, { generatedAt: deterministicGeneratedAt(beforeSnapshot), sourceSha: null });
const afterModel = buildReportModel(afterSnapshot, { generatedAt: deterministicGeneratedAt(afterSnapshot), sourceSha: null });
const diff = diffReportModels(beforeModel, afterModel, { semanticDiff });
```

`diffReportModels()` preserves existing compatibility fields and adds the supplied canonical `semanticDiff`; it must not attempt to feed report models back into the Evidence v2 diff core.

Add a regression where retrieval timestamps/cache state differ but semantic evidence does not; report diff’s semantic section must report `changed: false`.

---

## Amendment 9 — Train 6: CLI parity includes explicit relationships and capabilities

Extend the Train 6 operator CLI plan with:

```text
para11ax relationships snapshot.json
para11ax capabilities
```

`relationships snapshot.json` is local/file-only and prints canonical pretty JSON from `snapshot.relationships`; it performs zero provider calls.

`capabilities` calls public `/api/para11ax/meta` through `createOperatorGatewayClient().meta()` and prints only the secret-free `capabilities` object plus gateway/schema version. It does not require `PARA11AX_TOKEN`.

Tests must prove:

```text
relationships performs no fetch
capabilities sends no Authorization header
capabilities output contains no credential environment-variable names or configuration state
```

These commands close the remaining server-side parity/documentation gap without adding interface-specific intelligence logic.

---

## Amendment 10 — Train 7: Graph pivots must preserve typed certificate semantics

`renderEvidenceGraphView()` continues to emit `onPivot({ type, value })`. `shell-ui.js` must call:

```js
const indicator = toGatewayIndicator({ type, value });
```

before entering the existing normal enrich operation. For `certificate`, the outbound indicator therefore becomes `cert-sha256:<canonical sha256>`; for all other current types it remains the canonical value.

Add a UI/runtime regression proving a certificate graph node produces a certificate enrichment request, not a file-hash request.

The capability documentation generator should call the Train 1 canonical provider-set validator before rendering. Generated docs must never be produced from a provider set that fails admission.

Human docs should avoid manually duplicating `38`/`9` as durable capability truth where the generated table can supply the count; prose may describe the v8 release baseline but the generated registry output is authoritative.

---

## Amendment 11 — Train 8: Production capability state must not be promoted without evidence

Machine-readable release-state values are:

```text
implemented
configured
production_verified
```

Human-facing documentation renders the third state as **production-verified** to match the approved design language.

If an authorized production `PARA11AX_TOKEN` is unavailable:

- authenticated API behavior is **not** promoted beyond `implemented` by the verifier;
- provider configuration state is `unverified` in explanatory release text and does not become `configured` merely because an adapter exists;
- no provider is labelled `production_verified` without an authorized successful read-only probe against the exact release SHA.

If authenticated `/status` can be read, a provider may be promoted to `configured` only from explicit production configuration evidence. `production_verified` additionally requires a successful live read-only probe on the exact release SHA.

A Vercel `READY` state proves deployment readiness only.

---

## Amendment 12 — Final spec-coverage acceptance additions

Before Train 8 completion, the v8 acceptance verifier/tests must additionally prove:

```text
shared execution policy version/attempt/concurrency/deadline is machine-readable
workflow call ceilings remain machine-readable and bounded
new/extended provider parsers have schema-drift fixtures
semantic diff includes semantic_claim_changed and provider_state_changed
typed certificate refresh and graph pivot round-trip through cert-sha256 syntax
unsupported bundle observable types are rejected before IndexedDB mutation
unsupported bundle versions are rejected deterministically
case import cannot overwrite an existing case ID
IndexedDB failure leaves transient enrichment usable
disconnect/reboot clears active case state
cross-case sightings retain exact type/value identity
graph edge provenance includes provider/fingerprint/local-case source
graph depth never exceeds 2
report semantic diff operates on raw Evidence v2 inputs
CLI relationships/capabilities parity exists
production state promotion requires explicit evidence
```

These checks are additive to every security/privacy/egress/auth/mobile/accessibility/docs/release gate already defined in the eight train plans.

## Self-Review Result

The cross-plan review found no approved-architecture change requiring another design decision. The defects above are implementation-plan correctness fixes: missing required categories/tests, type/interface mismatches, and failure/provenance edge cases. The v8 architecture remains read-only, fixed-egress, local-case-only, deterministic, additive, and staged.