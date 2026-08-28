# PARA11AX v8 Train 3 — Evidence Semantics and Semantic Diffs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit evidence-role semantics and a deterministic normalized snapshot-diff engine without changing existing Evidence v2 integrity fingerprints or caller-required fields.

**Architecture:** Evidence records gain an additive `semantics` object derived from existing provider source-role metadata plus normalized semantic class. A separate pure `diffEvidenceSnapshots(previous, current)` module compares already-produced Evidence v2 envelopes, ignores transport/retrieval churn, and emits bounded typed changes suitable for local case history and later API/CLI/shell parity.

**Tech Stack:** Node.js 24.x ESM, built-in `node:test`, existing Evidence v2 normalizer/correlator/decision engine, Train 1 source-role metadata, Train 2 observable/provider extensions.

**Spec:** `docs/superpowers/specs/2026-08-28-para11ax-v8-full-maxx-design.md`

## Global Constraints

- Train 2 must be merged before execution.
- Existing `evidence[].integrity.fingerprint` calculation must not change in this train.
- Retrieval timestamps, request IDs, cache state, duration, provider ordering, JSON key ordering, and provider failure ordering do not count as semantic intelligence changes.
- Absence remains distinct from explicit negative evidence.
- Cross-provider disagreement is surfaced as contradiction state; it is not resolved by hidden weighting.
- Diff output is bounded to 128 change records and sorted deterministically.
- No provider calls occur during diffing.
- No case/browser persistence is introduced until Train 4.

---

### Task 1: Add deterministic evidence-role classification

**Files:**
- Create: `src/core/evidence-semantics.js`
- Create: `test/evidence-semantics-v8.test.js`
- Modify: `src/core/semantics.js`

**Interfaces:**
- Produces: `evidenceRole({ semanticClass, sourceRole }): 'observed_fact'|'provider_claim'|'contextual_intelligence'`.

- [ ] **Step 1: Write failing role tests**

Create `test/evidence-semantics-v8.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceRole } from '../src/core/evidence-semantics.js';

test('direct and authoritative factual context is observed fact', () => {
  assert.equal(evidenceRole({ semanticClass: 'network_context', sourceRole: 'first_party' }), 'observed_fact');
  assert.equal(evidenceRole({ semanticClass: 'vulnerability_metadata', sourceRole: 'authoritative' }), 'observed_fact');
  assert.equal(evidenceRole({ semanticClass: 'certificate_context', sourceRole: 'first_party' }), 'observed_fact');
});

test('probability and reputation remain provider claims', () => {
  assert.equal(evidenceRole({ semanticClass: 'exploit_probability', sourceRole: 'authoritative' }), 'provider_claim');
  assert.equal(evidenceRole({ semanticClass: 'reputation', sourceRole: 'aggregator' }), 'provider_claim');
  assert.equal(evidenceRole({ semanticClass: 'abuse_reports', sourceRole: 'first_party' }), 'provider_claim');
});

test('contextual feeds remain contextual intelligence', () => {
  assert.equal(evidenceRole({ semanticClass: 'threat_context', sourceRole: 'contextual' }), 'contextual_intelligence');
  assert.equal(evidenceRole({ semanticClass: 'malware_association', sourceRole: 'contextual' }), 'contextual_intelligence');
});
```

- [ ] **Step 2: Run RED**

```bash
node --test test/evidence-semantics-v8.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement exact classification rules**

Create `src/core/evidence-semantics.js`:

```js
const FACT_CLASSES = new Set([
  'network_context', 'certificate_context', 'vulnerability_metadata', 'attack_knowledge', 'exploitation'
]);
const CONTEXT_CLASSES = new Set(['threat_context', 'malware_association']);
const FACT_SOURCES = new Set(['authoritative', 'first_party']);

export function evidenceRole({ semanticClass, sourceRole } = {}) {
  if (sourceRole === 'contextual' || CONTEXT_CLASSES.has(semanticClass)) return 'contextual_intelligence';
  if (FACT_SOURCES.has(sourceRole) && FACT_CLASSES.has(semanticClass)) return 'observed_fact';
  return 'provider_claim';
}
```

- [ ] **Step 4: Ensure new Train 2 kinds have canonical semantic classes**

In `src/core/semantics.js`, keep `dns_resolution` under `network_context` and map `certificate_metadata` to `certificate_context`. Add direct assertions in the new test file using `semanticClass()`.

- [ ] **Step 5: Run GREEN**

```bash
node --test test/evidence-semantics-v8.test.js test/semantics.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/evidence-semantics.js src/core/semantics.js test/evidence-semantics-v8.test.js
git commit -m "feat: classify evidence semantics"
```

---

### Task 2: Add additive evidence semantics without changing integrity fingerprints

**Files:**
- Modify: `src/core/normalize.js`
- Modify: `src/core/orchestrator.js`
- Modify: `test/normalization-correlation.test.js`
- Modify: `test/evidence-v2.test.js`

**Interfaces:**
- `normalizeEvidence(..., meta)` consumes new `meta.sourceRole`.
- Each evidence record adds:

```js
semantics: {
  class: 'observed_fact' | 'provider_claim' | 'contextual_intelligence',
  semanticClass: string,
  sourceRole: string
}
```

- [ ] **Step 1: Write failing normalization assertions**

Add a fixture normalization assertion:

```js
assert.deepEqual(item.semantics, {
  class: 'observed_fact',
  semanticClass: 'network_context',
  sourceRole: 'first_party'
});
```

Capture the current `item.integrity.fingerprint` from the same deterministic fixture and assert that adding `sourceRole` metadata does not alter the fingerprint input contract.

- [ ] **Step 2: Run RED**

```bash
node --test test/normalization-correlation.test.js test/evidence-v2.test.js
```

Expected: FAIL on missing `semantics`.

- [ ] **Step 3: Add semantics outside the integrity payload**

In `src/core/normalize.js`, import `semanticClass` and `evidenceRole`. Compute:

```js
const semantic = semanticClass(observation.kind);
const semantics = Object.freeze({
  class: evidenceRole({ semanticClass: semantic, sourceRole: meta.sourceRole ?? 'community' }),
  semanticClass: semantic,
  sourceRole: meta.sourceRole ?? 'community'
});
```

Return `semantics` on the evidence item **after** the existing fingerprint has been computed. Do not add `semantics` to the object passed into the integrity hash function.

- [ ] **Step 4: Pass provider source role from the orchestrator**

In the existing `normalizeEvidence()` call in `src/core/orchestrator.js`, add:

```js
sourceRole: adapter?.sourceRole ?? 'community'
```

Do not change scheduling, cache, coverage, or failure handling.

- [ ] **Step 5: Run GREEN**

```bash
node --test test/normalization-correlation.test.js test/evidence-v2.test.js test/provider-runtime.test.js
```

Expected: PASS and historical fingerprint fixture remains unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/core/normalize.js src/core/orchestrator.js test/normalization-correlation.test.js test/evidence-v2.test.js
git commit -m "feat: add evidence semantic roles"
```

---

### Task 3: Create a stable snapshot semantic projection

**Files:**
- Create: `src/core/snapshot-semantics.js`
- Create: `test/snapshot-semantics-v8.test.js`

**Interfaces:**
- Produces `semanticSnapshot(enrichment)` — a deeply frozen deterministic projection containing only meaningful comparison fields.

- [ ] **Step 1: Write failing projection tests**

Use two Evidence v2 fixtures differing only in `requestId`, `queriedAt`, `durationMs`, `cacheState`, and evidence order. Assert:

```js
assert.deepEqual(semanticSnapshot(a), semanticSnapshot(b));
```

Then change an observation verdict and assert projections differ.

- [ ] **Step 2: Run RED**

```bash
node --test test/snapshot-semantics-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement canonical projection**

Create `src/core/snapshot-semantics.js` with these rules:

```text
subject: indicator + type
status: status only
provider state: meta.providerHealth sorted by provider
coverage: selected/executed/succeeded/failed/skipped/materialLoss
limitations: sorted unique strings
evidence: provider + integrity.fingerprint + semantics + observation.kind/verdict/firstSeen/lastSeen + normalized tags/attributes
relationships: type + target + targetType + provider, sorted and deduplicated
contradictions: correlation.contradictions normalized and sorted
freshness: correlation.freshness.overall
evidence quality: correlation.evidenceQuality.level
huntability: correlation.huntability.level
decision: disposition/confidence/reasons/telemetry/attackMappings/huntPlan identity fields
```

Exclude:

```text
requestId, queriedAt, durationMs, cache state, rawHash, provider timing, retrieval timestamp, budget consumption, source array order
```

Use a recursive `stableValue()` helper that sorts object keys and sorts arrays only where the field is semantically set-like. Preserve array order for hunt-plan priority.

- [ ] **Step 4: Bound projection size**

Cap projected evidence at 256 items, relationships at 256, contradictions at 64, ATT&CK mappings at 64, and hunt items at the existing maximum of 8. Throw `TypeError('invalid evidence snapshot')` if subject/type/evidence envelope shape is absent.

- [ ] **Step 5: Run GREEN**

```bash
node --test test/snapshot-semantics-v8.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/snapshot-semantics.js test/snapshot-semantics-v8.test.js
git commit -m "feat: add stable evidence snapshot projection"
```

---

### Task 4: Implement bounded semantic diffs

**Files:**
- Create: `src/core/semantic-diff.js`
- Create: `test/semantic-diff-v8.test.js`

**Interfaces:**

```js
export function diffEvidenceSnapshots(previous, current);
```

returns:

```js
{
  version: '1.0',
  indicator: string,
  type: string,
  changed: boolean,
  summary: { added: number, removed: number, changed: number, total: number },
  changes: Array<{
    category: string,
    key: string,
    before: unknown,
    after: unknown,
    providers: string[],
    evidenceFingerprints: string[]
  }>
}
```

- [ ] **Step 1: Write failing category tests**

Create tests covering exactly these categories:

```text
evidence_added
evidence_removed
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

Also assert no changes for timestamp/cache/order-only differences.

- [ ] **Step 2: Run RED**

```bash
node --test test/semantic-diff-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement subject safety and typed diffing**

At function entry:

```js
if (previous?.indicator !== current?.indicator || previous?.type !== current?.type) {
  throw new TypeError('semantic diff requires matching indicator and type');
}
```

Use `semanticSnapshot()` for both inputs. Compare evidence by `provider + integrity.fingerprint`; relationships by `type + targetType + target + provider`; ATT&CK mappings by stable JSON; telemetry by stable JSON; scalar states directly.

- [ ] **Step 4: Bound and sort output**

Sort changes by this fixed category priority:

```js
[
  'decision_changed', 'contradiction_changed', 'evidence_added', 'evidence_removed',
  'provider_coverage_changed', 'relationship_added', 'relationship_removed',
  'attack_mapping_changed', 'huntability_changed', 'telemetry_changed', 'freshness_changed'
]
```

then by `key`. Slice to 128 records. Freeze returned arrays and object.

- [ ] **Step 5: Run GREEN**

```bash
node --test test/semantic-diff-v8.test.js test/snapshot-semantics-v8.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/semantic-diff.js test/semantic-diff-v8.test.js
git commit -m "feat: add semantic evidence diffs"
```

---

### Task 5: Add explicit change explanation helpers

**Files:**
- Create: `src/core/change-explanation.js`
- Create: `test/change-explanation-v8.test.js`

**Interfaces:**

```js
export function explainSemanticDiff(diff);
```

returns at most 16 deterministic reason strings, with no generated prose from models.

- [ ] **Step 1: Write failing explanation tests**

For a diff containing `decision_changed`, `evidence_added`, and `provider_coverage_changed`, assert output exactly:

```js
[
  'decision support changed',
  'new normalized evidence was observed',
  'provider coverage changed'
]
```

Assert duplicate categories do not duplicate reason strings.

- [ ] **Step 2: Run RED**

```bash
node --test test/change-explanation-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement fixed mapping**

Use one immutable mapping from every Train 3 diff category to a concise phrase. Return unique phrases in diff order, capped at 16. Unknown categories map to `semantic evidence changed`.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test test/change-explanation-v8.test.js
git add src/core/change-explanation.js test/change-explanation-v8.test.js
git commit -m "feat: explain semantic evidence changes"
```

---

### Task 6: Backward-compatibility and full verification

**Files:** tests only if a missing gate is discovered.

- [ ] **Step 1: Verify Evidence v2 remains additive**

```bash
node --test test/evidence-v2.test.js test/normalization-correlation.test.js test/decision-support.test.js test/stix.test.js
```

Expected: PASS. Existing top-level fields and current integrity fingerprints remain valid; only additive `evidence[].semantics` is new.

- [ ] **Step 2: Verify diff purity**

```bash
node --test test/snapshot-semantics-v8.test.js test/semantic-diff-v8.test.js test/change-explanation-v8.test.js
```

Expected: PASS with no fetch/network mocks required by the diff modules.

- [ ] **Step 3: Run full gates**

```bash
npm test
npm run verify:repo
npm run audit:public
npm run check
```

Expected: all PASS.

- [ ] **Step 4: Review final scope**

```bash
git diff --stat main...HEAD
git diff main...HEAD -- src/core/evidence-semantics.js src/core/normalize.js src/core/orchestrator.js src/core/snapshot-semantics.js src/core/semantic-diff.js src/core/change-explanation.js
```

Acceptance conditions:

```text
- evidence semantics are deterministic and evidence-backed
- evidence integrity fingerprint algorithm is unchanged
- diffing performs zero provider/network calls
- transport/cache/timestamp/order noise produces zero semantic changes
- change output is deterministic and bounded to 128 records
- no opaque score, model output or autonomous action is added
```

Do not create an empty verification commit.