# PARA11AX v8 Train 5 — Deterministic Guidance and Contextual Evidence Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand deterministic analyst guidance and harden the existing entity graph into an explicitly provenance-backed contextual evidence graph without introducing opaque scores, inferred attribution, or autonomous action.

**Architecture:** Extract graph construction from `decision-engine.js` into a focused pure core module that preserves the current 100-node/100-edge bounds and adds evidence fingerprints to supported edges. Add a separate deterministic guidance module for missing evidence, coverage/telemetry validation needs, explicit pivots, and hunt priorities. Browser-local prior-case references are merged in a pure app-side graph adapter; no case content reaches the server.

**Tech Stack:** Node.js 24.x ESM, built-in `node:test`, existing correlation/decision/hunt-plan structures, Train 3 semantic diffs, Train 4 local case index.

**Spec:** `docs/superpowers/specs/2026-08-28-para11ax-v8-full-maxx-design.md`

## Global Constraints

- Train 4 must be merged before execution.
- No universal maliciousness score or hidden weighting is added.
- Guidance may only use normalized evidence, explicit relationships, correlation, coverage, declared telemetry requirements, provider failure state, and semantic diffs.
- `environmentValidated: false` means telemetry must be validated; it never means the table is absent.
- Evidence graph max: 100 nodes, 100 edges.
- Suggested pivots max: 8; missing-evidence items max: 16; telemetry-validation items max: 16.
- Graph edges require an explicit provider relationship, normalized evidence context edge already supported by decision logic, ATT&CK mapping, or local exact case sighting.
- No recursive graph-triggered provider calls.

---

### Task 1: Extract and provenance-harden the evidence graph

**Files:**
- Create: `src/core/evidence-graph.js`
- Create: `test/evidence-graph-v8.test.js`
- Modify: `src/core/decision-engine.js`
- Modify: `test/decision-support.test.js`

**Interfaces:**

```js
export function buildEvidenceGraph({ indicator, type, evidence, relationships });
```

returns:

```js
{
  version: '1.0',
  nodes: Array<{ id, type, value, sources: string[] }>,
  edges: Array<{ type, source, target, provider, evidenceFingerprints: string[] }>
}
```

- [ ] **Step 1: Write failing graph tests**

Cover subject + explicit domain/IP relationship + provider-backed malware context. Assert every non-subject edge has either a provider or at least one evidence fingerprint. Assert 101 input relationships yield at most 100 edges/nodes.

- [ ] **Step 2: Run RED**

```bash
node --test test/evidence-graph-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Move graph logic into the new module**

Move `inferTargetType()` and `entityGraph()` behavior from `decision-engine.js` without changing supported existing target inference. Rename exported constructor to `buildEvidenceGraph()` and preserve deterministic insertion order.

For actor/malware context edges generated from evidence, attach the source evidence fingerprint:

```js
evidenceFingerprints: fingerprint ? [fingerprint] : []
```

For relationship edges, attach fingerprints from evidence items whose provider equals `rel.provider`; if no matching fingerprint exists, retain the explicit provider as provenance.

- [ ] **Step 4: Remove private graph duplication from `decision-engine.js`**

Import `buildEvidenceGraph` and replace:

```js
const graph = entityGraph(indicator, type, evidence, relationships);
```

with:

```js
const graph = buildEvidenceGraph({ indicator, type, evidence, relationships });
```

Keep `decision.entityGraph` as the existing external field for backward compatibility.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test test/evidence-graph-v8.test.js test/decision-support.test.js
git add src/core/evidence-graph.js src/core/decision-engine.js test/evidence-graph-v8.test.js test/decision-support.test.js
git commit -m "refactor: provenance-harden evidence graph"
```

---

### Task 2: Add deterministic analyst guidance

**Files:**
- Create: `src/core/analyst-guidance.js`
- Create: `test/analyst-guidance-v8.test.js`

**Interfaces:**

```js
export function buildAnalystGuidance({
  indicator,
  type,
  evidence,
  relationships,
  correlation,
  coverage,
  failures,
  telemetry,
  huntPlan,
  semanticDiff
});
```

returns:

```js
{
  version: '1.0',
  missingEvidence: [],
  telemetryValidation: [],
  suggestedPivots: [],
  prioritizedHunts: [],
  whyChanged: []
}
```

- [ ] **Step 1: Write failing guidance tests**

Assert:

```text
provider timeout -> missingEvidence item {kind:'provider_failure', provider, reason:'timeout'}
coverage.materialLoss -> missingEvidence item {kind:'material_coverage_loss'}
environmentValidated:false + DeviceNetworkEvents -> telemetryValidation state 'validation_required'
explicit domain relationship -> suggested pivot with provider/evidence provenance
hunt plan retains existing priority/order
semantic diff -> whyChanged comes from Train 3 explainSemanticDiff()
```

Assert an empty/insufficient result does not invent pivots or hunts.

- [ ] **Step 2: Run RED**

```bash
node --test test/analyst-guidance-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement missing-evidence rules**

Use only these rule sources:

```js
if (coverage?.materialLoss) add({ kind: 'material_coverage_loss' });
for (const failure of failures ?? []) add({ kind: 'provider_failure', provider: failure.provider, reason: failure.reason });
if ((evidence ?? []).length === 0) add({ kind: 'no_normalized_evidence' });
```

Sort provider failures by provider, deduplicate, cap at 16.

- [ ] **Step 4: Implement telemetry validation rules**

For each `telemetry.requiredTables` entry return:

```js
{ table, state: telemetry.environmentValidated ? 'validated' : 'validation_required' }
```

Never return `missing` unless a future caller supplies explicit environment validation evidence; this train supplies none.

- [ ] **Step 5: Implement explicit pivot selection**

Allow target types:

```js
new Set(['ip','domain','url','hash','cve','asn','cidr','certificate','attack'])
```

A pivot is:

```js
{
  type: rel.targetType,
  value: rel.target,
  relationship: rel.type,
  provider: rel.provider ?? null,
  evidenceFingerprints: sortedMatchingFingerprints
}
```

Require `targetType`, non-empty `target`, and either provider or evidence fingerprint. Sort by type/value/provider and cap at 8. Do not recursively enrich.

- [ ] **Step 6: Implement hunts and change explanation**

Project existing hunt items to:

```js
{ id, priority, hypothesis, telemetry, evidenceFingerprints }
```

preserving hunt-plan order. Use `explainSemanticDiff(semanticDiff)` when a diff is provided; otherwise return `[]`.

- [ ] **Step 7: Run GREEN and commit**

```bash
node --test test/analyst-guidance-v8.test.js
git add src/core/analyst-guidance.js test/analyst-guidance-v8.test.js
git commit -m "feat: add deterministic analyst guidance"
```

---

### Task 3: Add guidance to Decision Support v1 additively

**Files:**
- Modify: `src/core/decision-engine.js`
- Modify: `src/core/orchestrator.js`
- Modify: `test/decision-support.test.js`
- Modify: `test/evidence-v2.test.js`

**Interfaces:**
- Existing `decision.version === '1.0'` remains unchanged.
- New additive field: `decision.guidance`.

- [ ] **Step 1: Write failing additive decision assertion**

Use an existing decision fixture and assert:

```js
assert.equal(result.decision.version, '1.0');
assert.equal(result.decision.guidance.version, '1.0');
assert.equal(Array.isArray(result.decision.guidance.missingEvidence), true);
assert.equal(Array.isArray(result.decision.guidance.suggestedPivots), true);
```

- [ ] **Step 2: Run RED**

```bash
node --test test/decision-support.test.js test/evidence-v2.test.js
```

Expected: missing `guidance`.

- [ ] **Step 3: Extend `buildDecisionSupport()` input**

Add optional:

```js
failures = [],
semanticDiff = null
```

After computing telemetry/graph/hunts, call:

```js
const guidance = buildAnalystGuidance({
  indicator, type, evidence, relationships, correlation, coverage,
  failures, telemetry, huntPlan: hunts, semanticDiff
});
```

Return `guidance` additively.

- [ ] **Step 4: Pass failures from orchestrator**

In both decision-engine call sites in `src/core/orchestrator.js`, pass the current `failures` array; for the no-provider early return pass its gateway failure array explicitly. Do not pass a semantic diff from the server because server enrichments have no local prior snapshot.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test test/decision-support.test.js test/evidence-v2.test.js test/orchestrator.test.js
git add src/core/decision-engine.js src/core/orchestrator.js test/decision-support.test.js test/evidence-v2.test.js
git commit -m "feat: expose deterministic guidance in evidence v2"
```

---

### Task 4: Build browser-local contextual graph adapter with exact case references

**Files:**
- Create: `app/context-graph.js`
- Create: `test/context-graph-v8.test.js`

**Interfaces:**

```js
export function buildContextGraph({ entityGraph, caseSightings, subject });
```

- [ ] **Step 1: Write failing local-context graph tests**

Start from a server graph with subject `domain:example.com`. Add exact case sightings from Train 4. Assert a case node:

```js
{ id: 'case:case-1', type: 'case', value: 'Operation Fixture', sources: ['local_case_index'] }
```

and edge:

```js
{ type: 'seen_in_case', source: 'domain:example.com', target: 'case:case-1', provider: null, evidenceFingerprints: [] }
```

Assert fuzzy values and unrelated case sightings add no edges.

- [ ] **Step 2: Run RED**

```bash
node --test test/context-graph-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement merge without inference**

Clone base nodes/edges. Only add a case edge when a sighting key exactly matches an existing graph node's `{type,value}`. Use local case ID/title only; never embed notes or full snapshots. Preserve the 100-node/100-edge caps; if the server graph is already full, omit extra case references rather than evict evidence nodes.

- [ ] **Step 4: Freeze, sort and run GREEN**

Sort added case nodes by ID and edges by source/target. Return a frozen graph with `version: '1.0'`.

```bash
node --test test/context-graph-v8.test.js
git add app/context-graph.js test/context-graph-v8.test.js
git commit -m "feat: add local case context to evidence graph"
```

---

### Task 5: Add shell-native explain, hunt, and graph commands

**Files:**
- Modify: `app/shell.js`
- Modify: `app/shell-ui.js`
- Modify: `app/view-model.js`
- Modify: `app/renderers.js`
- Modify: `test/shell.test.js`
- Create: `test/guidance-rendering-v8.test.js`

- [ ] **Step 1: Write failing command tests**

Add commands:

```text
explain    -> result-guidance view 'explain'
hunt       -> result-guidance view 'hunt'
graph      -> result-guidance view 'graph'
```

All require authentication and a current result; no command directly performs a provider call.

- [ ] **Step 2: Run RED**

```bash
node --test test/shell.test.js test/guidance-rendering-v8.test.js
```

Expected: commands unknown / renderers missing.

- [ ] **Step 3: Add guidance view models**

`buildGuidance(result)` returns decision disposition/confidence plus guidance arrays. `buildHuntPlan(result)` returns existing `decision.huntPlan`. `buildGraphModel(result, localSightings)` calls `buildContextGraph()` using `decision.entityGraph`.

- [ ] **Step 4: Render terminal-native text fallback**

Add deterministic text renderers for explain/hunt/graph summaries. Graph textual rendering prints one line per node/edge and is usable before the visual overlay in Train 7. Do not render a dashboard or card grid.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test test/shell.test.js test/guidance-rendering-v8.test.js
git add app/shell.js app/shell-ui.js app/view-model.js app/renderers.js test/shell.test.js test/guidance-rendering-v8.test.js
git commit -m "feat: expose guidance and graph in shell"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run deterministic-core tests**

```bash
node --test test/evidence-graph-v8.test.js test/analyst-guidance-v8.test.js test/decision-support.test.js test/context-graph-v8.test.js test/guidance-rendering-v8.test.js
```

Expected: PASS.

- [ ] **Step 2: Run complete gates**

```bash
npm test
npm run verify:repo
npm run audit:public
npm run check
```

Expected: all PASS.

- [ ] **Step 3: Review scope**

```bash
git diff --stat main...HEAD
git diff main...HEAD -- src/core/evidence-graph.js src/core/analyst-guidance.js src/core/decision-engine.js src/core/orchestrator.js app/context-graph.js app/shell.js app/shell-ui.js app/view-model.js app/renderers.js
```

Acceptance conditions:

```text
- no opaque score or model call exists
- guidance is reproducible from Evidence v2 data
- telemetry unknown state is validation_required, never silently missing
- graph edges have explicit evidence/provider/local-case provenance
- graph is capped at 100 nodes and 100 edges
- graph traversal performs zero provider calls
- prior case context remains local only
```

Do not create an empty verification commit.