<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Historical design record.** This implementation plan records the approved Investigation Workspace v2 delivery path; [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md) defines current deployed behavior.

# Investigation Workspace v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify PARA11AX cases, evidence capture, mission planning, KQL validation, imported results, analyst disposition, and report readiness in one deterministic browser-local investigation lifecycle.

**Architecture:** Add a pure `src/core/investigation/` domain with exact schema validation, migration, dependency fingerprints, stale-state rules, and an atomic reducer. Compose existing case and Mission Workspace engines through a repository/runtime adapter, then expose a shared `investigation` shell namespace with explicit Web/CLI capability boundaries and deterministic report projections.

**Tech Stack:** Node.js 24 ESM, built-in `node:test`, browser IndexedDB adapter, existing PARA11AX shell registry/runtime, pure JavaScript mission/report modules, Vercel static deployment.

**Spec:** `docs/superpowers/specs/2026-09-02-investigation-workspace-v2-design.md`

## Global Constraints

- Evidence v2 remains authoritative; derived, operator, imported-result, and analyst-judgment data never become Evidence v2.
- No new provider, host, network method, credential, runtime dependency, LLM, dynamic evaluation, server persistence, KQL execution, or ServiceNow submission.
- Bundle format is exactly `para11ax-investigation-v2.0`; maximum encoded bundle size is 4 MiB.
- Bounds: 64 observables, 128 evidence snapshots, 32 operator artifacts, 16 KQL validations, 256 timeline records, 128 notes, and 64 limitations.
- Each successful domain mutation increments `revision` exactly once and performs exactly one persistence write.
- Failed mutations are atomic and leave the current persisted value byte-identical.
- Current reports and ServiceNow projections must never consume stale required artifacts.
- Existing case v1.0/v8.1, Mission Workspace v1, enrichment, Shodan, User Scanner, report, mobile, and security contracts remain compatible.
- All implementation follows test-first red/green/refactor cycles and ends with fresh exact-head verification.

## File map

| Path | Responsibility |
|---|---|
| `src/core/investigation/constants.js` | Schema name, bounds, phases, dispositions, and stable error/reason codes |
| `src/core/investigation/canonical.js` | JSON-tree validation, canonical ordering, hashing, cloning, and freezing |
| `src/core/investigation/model.js` | Create, validate, import, and export Investigation v2 aggregates |
| `src/core/investigation/migrate.js` | Pure case v1.0 and Mission Workspace v1 migration/import |
| `src/core/investigation/dependencies.js` | Dependency fingerprints and stale-artifact invalidation graph |
| `src/core/investigation/status.js` | Deterministic phase, readiness, gaps, next actions, and export/report readiness |
| `src/core/investigation/reducer.js` | Atomic domain transitions and composition with existing mission functions |
| `src/core/investigation/index.js` | Frozen public Investigation v2 API |
| `app/investigation-repository.js` | Serialized browser persistence and one-write mutations |
| `app/investigation-runtime.js` | Active investigation lifecycle and current-result/operator capture |
| `app/investigation-shell-bridge.js` | Browser storage, picker/download callbacks, and shell adapter |
| `app/indexeddb-case-storage.js` | Versioned storage upgrade that accepts investigation records |
| `app/shell-core/catalog.js` | Canonical `investigation` / `inv` command descriptors |
| `app/shell-browser-executor.js` | Browser argument validation, adapter dispatch, output receipts, and artifact registration |
| `app/shell-runtime.js` | Shared shell state projection for active investigation identity/phase |
| `app/analyst-deck.js` | Compact active investigation indicator in the existing status line |
| `bin/para11ax.mjs` | Exact CLI file/stdin investigation transport and capability errors |
| `src/report/render-investigation.js` | Current investigation report and ServiceNow-ready presentation model |
| `docs/ANALYST-MISSION-PACK.md` | Mission v1 compatibility and Investigation v2 adoption path |
| `docs/ARCHITECTURE.md` | Deployed investigation boundary and data flow |
| `docs/SHELL.md` | Command reference and examples |
| `docs/SECURITY-CONTROLS.md` | Investigation persistence, promotion, and export controls |
| `README.md` | Concise analyst workflow and entry commands |

---

### Task 1: Canonical Investigation v2 model

**Files:**
- Create: `src/core/investigation/constants.js`
- Create: `src/core/investigation/canonical.js`
- Create: `src/core/investigation/model.js`
- Create: `src/core/investigation/index.js`
- Create: `test/investigation-model-v12.test.mjs`

**Interfaces:**
- Consumes: existing canonical observable types and Evidence v2 snapshot shape.
- Produces: `createInvestigation({ title, now, uuid })`, `validateInvestigation(value)`, `importInvestigation(input)`, `exportInvestigation(value)`, `INVESTIGATION_SCHEMA_VERSION`, and `INVESTIGATION_LIMITS`.

- [ ] **Step 1: Write failing schema, bounds, determinism, and secret-boundary tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INVESTIGATION_SCHEMA_VERSION,
  createInvestigation,
  exportInvestigation,
  importInvestigation,
} from '../src/core/investigation/index.js';

const fixed = { now: () => '2026-09-02T12:00:00.000Z', uuid: () => 'inv-001' };

test('creates the exact empty Investigation v2 aggregate', () => {
  const value = createInvestigation({ title: 'Fortinet access review', ...fixed });
  assert.equal(value.format, 'para11ax-investigation-v2.0');
  assert.equal(value.version, INVESTIGATION_SCHEMA_VERSION);
  assert.equal(value.id, 'inv-001');
  assert.equal(value.revision, 0);
  assert.deepEqual(value.observables, []);
  assert.deepEqual(value.workflow, {
    relevance: null, hunt: null, kqlValidations: [], result: null,
    disposition: null, serviceNow: null, report: null,
  });
  assert.equal(Object.isFrozen(value), true);
});

test('canonical export round-trips byte-for-byte', () => {
  const value = createInvestigation({ title: 'Case', ...fixed });
  const text = exportInvestigation(value);
  assert.equal(text.endsWith('\n'), true);
  assert.equal(exportInvestigation(importInvestigation(text)), text);
});

test('rejects secret-bearing structure and an oversized bundle', () => {
  const value = structuredClone(createInvestigation({ title: 'Case', ...fixed }));
  value.token = 'do-not-store';
  assert.throws(() => importInvestigation(value), /top-level keys|secret/i);
  assert.throws(() => importInvestigation(' '.repeat((4 * 1024 * 1024) + 1)), /too large/i);
});
```

- [ ] **Step 2: Run the model test and verify RED**

Run: `node --test test/investigation-model-v12.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/investigation/index.js`.

- [ ] **Step 3: Implement constants and canonical helpers**

```js
// src/core/investigation/constants.js
export const INVESTIGATION_SCHEMA_VERSION = '2.0';
export const INVESTIGATION_FORMAT = 'para11ax-investigation-v2.0';
export const INVESTIGATION_LIMITS = Object.freeze({
  bundleBytes: 4 * 1024 * 1024,
  title: 120,
  observables: 64,
  evidenceSnapshots: 128,
  operatorArtifacts: 32,
  kqlValidations: 16,
  timeline: 256,
  notes: 128,
  limitations: 64,
});
export const INVESTIGATION_PHASES = Object.freeze([
  'SCOPING', 'EVIDENCE', 'HUNT_DESIGN', 'EXECUTION_PENDING',
  'RESULTS', 'DISPOSITION', 'REPORT_READY',
]);
export const INVESTIGATION_DISPOSITIONS = Object.freeze([
  'CONFIRMED_MALICIOUS', 'SUSPICIOUS', 'BENIGN_EXPLAINED',
  'NO_EVIDENCE_IDENTIFIED', 'INCONCLUSIVE',
]);
```

```js
// src/core/investigation/canonical.js
export const clone = value => structuredClone(value);
export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}
export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}
export function canonicalJson(value) { return JSON.stringify(canonicalize(value)); }
export function encodedBytes(value) { return new TextEncoder().encode(value).byteLength; }
```

- [ ] **Step 4: Implement exact model creation/import/export**

```js
// src/core/investigation/model.js
import { INVESTIGATION_FORMAT, INVESTIGATION_LIMITS, INVESTIGATION_SCHEMA_VERSION } from './constants.js';
import { canonicalize, clone, deepFreeze, encodedBytes } from './canonical.js';

const TOP_LEVEL = ['format','version','id','title','createdAt','updatedAt','revision','scope','observables','evidenceSnapshots','operatorArtifacts','workflow','notes','timeline','freshness','status','limitations'];
const fail = reason => { throw new TypeError(`invalid investigation: ${reason}`); };

export function createInvestigation({ title, now = () => new Date().toISOString(), uuid = () => crypto.randomUUID() } = {}) {
  if (typeof title !== 'string' || !title.trim() || title.length > INVESTIGATION_LIMITS.title) fail('title');
  const at = now();
  return deepFreeze({
    format: INVESTIGATION_FORMAT, version: INVESTIGATION_SCHEMA_VERSION,
    id: uuid(), title: title.trim(), createdAt: at, updatedAt: at, revision: 0,
    scope: { profile: null, context: null }, observables: [], evidenceSnapshots: [],
    operatorArtifacts: [],
    workflow: { relevance: null, hunt: null, kqlValidations: [], result: null, disposition: null, serviceNow: null, report: null },
    notes: [], timeline: [], freshness: { dependencies: {}, stale: [] }, status: null, limitations: [],
  });
}

export function importInvestigation(input) {
  if (typeof input === 'string' && encodedBytes(input) > INVESTIGATION_LIMITS.bundleBytes) fail('input too large');
  let value = input;
  if (typeof input === 'string') { try { value = JSON.parse(input); } catch { fail('malformed JSON'); } }
  assertPlainJsonTree(value, '$');
  assertExactKeys(value, TOP_LEVEL, '$');
  if (value.format !== INVESTIGATION_FORMAT || value.version !== INVESTIGATION_SCHEMA_VERSION) fail('unsupported version');
  assertIdentifier(value.id, '$.id');
  assertText(value.title, 1, INVESTIGATION_LIMITS.title, '$.title');
  assertTimestamp(value.createdAt, '$.createdAt');
  assertTimestamp(value.updatedAt, '$.updatedAt');
  assertSafeInteger(value.revision, 0, Number.MAX_SAFE_INTEGER, '$.revision');
  validateScope(value.scope);
  validateObservables(value.observables);
  validateEvidenceSnapshots(value.evidenceSnapshots);
  validateOperatorArtifacts(value.operatorArtifacts);
  validateWorkflow(value.workflow);
  validateNotes(value.notes);
  validateTimeline(value.timeline);
  validateFreshness(value.freshness);
  validateStatus(value.status);
  validateLimitations(value.limitations);
  if (encodedBytes(JSON.stringify(value)) > INVESTIGATION_LIMITS.bundleBytes) fail('input too large');
  return deepFreeze(clone(value));
}

export function exportInvestigation(value) {
  return `${JSON.stringify(canonicalize(importInvestigation(value)), null, 2)}\n`;
}

export function validateInvestigation(value) {
  importInvestigation(value);
  return true;
}
```

Implement each named validator in `model.js` with these closed contracts: `scope` has exactly `profile/context`; observables use the existing canonical observable validator and are unique by `type + value`; each evidence snapshot has exactly `id/type/indicator/capturedAt/requestId/evidence/diffFromPrevious`, validates its nested Evidence v2 value unchanged, and permits `diffFromPrevious` to be `null` or the exact existing semantic-diff record targeting that snapshot; operator artifacts have exactly `id/kind/capturedAt/source/summary/references`; workflow has exactly the seven keys emitted by `createInvestigation`; notes have exactly `id/at/text`; timeline records have exactly `id/at/action/details`; freshness has exactly `dependencies/stale`; status is either `null` or the exact output of `deriveInvestigationStatus`; limitations are unique bounded strings. Every collection enforces its named limit, every timestamp must round-trip through `new Date(value).toISOString()`, every URL must be `https:`, every fingerprint must match `/^[a-f0-9]{64}$/`, accessors/sparse arrays/non-plain prototypes are rejected, and keys matching `/token|secret|password|authorization|cookie/i` are rejected at every depth. No permissive fallback or silent truncation is allowed.

- [ ] **Step 5: Run model tests and the existing case/bundle security suites**

Run: `node --test test/investigation-model-v12.test.mjs test/case-bundle-v8.test.js test/case-persistence-security-v8.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit the model slice**

```bash
git add src/core/investigation test/investigation-model-v12.test.mjs
git commit -m "feat: add Investigation v2 model"
```

### Task 2: Case and Mission migration

**Files:**
- Create: `src/core/investigation/migrate.js`
- Modify: `src/core/investigation/index.js`
- Create: `test/investigation-migration-v12.test.mjs`

**Interfaces:**
- Consumes: `importInvestigation`, case schema v1.0 objects, and `importMissionWorkspace(input)`.
- Produces: `migrateCaseToInvestigation(caseValue, { now })` and `adoptMissionWorkspace(investigation, missionInput, { now })`.

- [ ] **Step 1: Write failing lossless migration and conflict tests**

```js
test('migrates authoritative case content without synthesizing evidence', () => {
  const migrated = migrateCaseToInvestigation(caseFixture, { now: () => NOW });
  assert.equal(migrated.id, caseFixture.id);
  assert.deepEqual(migrated.observables.map(({ type, value }) => ({ type, value })), caseFixture.pins.map(({ type, value }) => ({ type, value })));
  assert.equal(migrated.evidenceSnapshots.length, caseFixture.snapshots.length);
  assert.deepEqual(migrated.evidenceSnapshots.at(-1).diffFromPrevious, caseFixture.diffs.at(-1));
  assert.deepEqual(migrated.notes.map(({ id, text, at }) => ({ id, text, at })), caseFixture.notes.map(({ id, text, addedAt }) => ({ id, text, at: addedAt })));
  assert.equal(migrated.operatorArtifacts.length, 0);
  assert.equal(migrated.workflow.hunt, null);
  assert.match(migrated.timeline.at(-1).action, /MIGRATED_CASE_V1/);
});

test('mission adoption reconstructs derived fields and rejects scope conflicts atomically', () => {
  const adopted = adoptMissionWorkspace(emptyInvestigation, missionBundle, { now: () => NOW });
  assert.deepEqual(adopted.scope.profile, missionBundle.profile);
  assert.notStrictEqual(adopted.workflow.relevance, missionBundle.relevance);
  assert.throws(() => adoptMissionWorkspace(scopedInvestigation, conflictingMission), /scope conflict/i);
  assert.equal(exportInvestigation(scopedInvestigation), before);
});
```

- [ ] **Step 2: Run migration tests and verify RED**

Run: `node --test test/investigation-migration-v12.test.mjs`

Expected: FAIL because both migration exports are missing.

- [ ] **Step 3: Implement migration with authoritative-field mapping**

```js
export function migrateCaseToInvestigation(caseValue, { now = () => new Date().toISOString() } = {}) {
  validateCaseValue(caseValue);
  if (caseValue.pins.length > INVESTIGATION_LIMITS.observables || caseValue.snapshots.length > INVESTIGATION_LIMITS.evidenceSnapshots || caseValue.notes.length > INVESTIGATION_LIMITS.notes || caseValue.diffs.length > INVESTIGATION_LIMITS.evidenceSnapshots) {
    throw new RangeError('legacy case exceeds investigation limits');
  }
  const base = createInvestigation({ title: caseValue.title, now: () => caseValue.createdAt, uuid: () => caseValue.id });
  return importInvestigation({
    ...base,
    updatedAt: now(),
    revision: 1,
    observables: caseValue.pins.map(({ type, value, addedAt }) => ({ type, value, addedAt })),
    evidenceSnapshots: caseValue.snapshots.map(snapshot => ({
      ...structuredClone(snapshot),
      diffFromPrevious: structuredClone(caseValue.diffs.find(diff => diff.toSnapshotId === snapshot.id) ?? null),
    })),
    notes: caseValue.notes.map(({ id, text, addedAt }) => ({ id, text, at: addedAt })),
    timeline: [{ id: `migration:${caseValue.id}`, at: now(), action: 'MIGRATED_CASE_V1', details: { sourceVersion: caseValue.schemaVersion } }],
  });
}
```

`adoptMissionWorkspace` must call `importMissionWorkspace`, compare canonical non-null scope inputs, copy only authoritative profile/context and KQL query text, and rebuild relevance/hunt/validation/result/ServiceNow through existing mission functions. Legacy cases exceeding any Investigation v2 collection bound fail with `legacy case exceeds investigation limits`; the repository keeps the original record byte-identical and does not truncate it.

- [ ] **Step 4: Run migration plus mission tamper suites**

Run: `node --test test/investigation-migration-v12.test.mjs test/mission-workspace-v11.test.js test/mission-workspace-security-v11.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit migration**

```bash
git add src/core/investigation/migrate.js src/core/investigation/index.js test/investigation-migration-v12.test.mjs
git commit -m "feat: migrate cases and missions into investigations"
```

### Task 3: Dependency fingerprints, stale-state rules, and status

**Files:**
- Create: `src/core/investigation/dependencies.js`
- Create: `src/core/investigation/status.js`
- Modify: `src/core/investigation/index.js`
- Create: `test/investigation-dependencies-v12.test.mjs`
- Create: `test/investigation-status-v12.test.mjs`

**Interfaces:**
- Produces: `fingerprintDependency(type, value)`, `invalidateInvestigation(current, changeType)`, and `deriveInvestigationStatus(current)`.
- Fingerprints are lowercase SHA-256 hex over `type + '\n' + canonicalJson(value)` using the existing browser-compatible `src/core/sha256.js` helper.

- [ ] **Step 1: Write the table-driven invalidation test**

```js
const cases = [
  ['SCOPE_CHANGED', ['relevance','hunt','result','disposition','report','serviceNow']],
  ['OBSERVABLES_CHANGED', ['hunt','disposition','report','serviceNow']],
  ['EVIDENCE_CHANGED', ['hunt','result','disposition','report','serviceNow']],
  ['HUNT_CHANGED', ['result','disposition','report','serviceNow']],
  ['RESULT_CHANGED', ['disposition','report','serviceNow']],
  ['DISPOSITION_CHANGED', ['report','serviceNow']],
];
for (const [change, expected] of cases) {
  test(`${change} invalidates the exact downstream set`, () => {
    assert.deepEqual(invalidateInvestigation(fullInvestigation, change).freshness.stale.map(item => item.artifact), expected);
  });
}
```

- [ ] **Step 2: Write phase/readiness tests**

```js
test('status advances only with current required artifacts', () => {
  assert.deepEqual(deriveInvestigationStatus(empty).phase, 'SCOPING');
  assert.deepEqual(deriveInvestigationStatus(withEvidence).phase, 'HUNT_DESIGN');
  assert.deepEqual(deriveInvestigationStatus(withValidatedHunt).phase, 'EXECUTION_PENDING');
  assert.deepEqual(deriveInvestigationStatus(withResults).phase, 'DISPOSITION');
  assert.deepEqual(deriveInvestigationStatus(withDispositionAndReport).phase, 'REPORT_READY');
});

test('no-results never becomes benign or report-ready without disposition', () => {
  const status = deriveInvestigationStatus(withNoResults);
  assert.equal(status.phase, 'DISPOSITION');
  assert.equal(status.reportReady, false);
  assert.ok(status.limitations.includes('no_results_is_not_benign_evidence'));
});
```

- [ ] **Step 3: Run both suites and verify RED**

Run: `node --test test/investigation-dependencies-v12.test.mjs test/investigation-status-v12.test.mjs`

Expected: FAIL because dependency and status modules do not exist.

- [ ] **Step 4: Implement the exact dependency graph and fixed status rules**

```js
const INVALIDATION = Object.freeze({
  SCOPE_CHANGED: ['relevance','hunt','result','disposition','report','serviceNow'],
  OBSERVABLES_CHANGED: ['hunt','disposition','report','serviceNow'],
  EVIDENCE_CHANGED: ['hunt','result','disposition','report','serviceNow'],
  HUNT_CHANGED: ['result','disposition','report','serviceNow'],
  KQL_CHANGED: ['result','disposition','report','serviceNow'],
  RESULT_CHANGED: ['disposition','report','serviceNow'],
  DISPOSITION_CHANGED: ['report','serviceNow'],
  NOTE_CHANGED: ['report'],
});
```

Status rules must be a fixed ordered catalog returning stable `gaps` and `nextActions`, never free-form inference. Stale artifacts cannot satisfy phase gates.

- [ ] **Step 5: Run dependency/status and deterministic fuzz tests**

Run: `node --test test/investigation-dependencies-v12.test.mjs test/investigation-status-v12.test.mjs test/adversarial-fuzz-v8.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit dependency/status slice**

```bash
git add src/core/investigation test/investigation-dependencies-v12.test.mjs test/investigation-status-v12.test.mjs
git commit -m "feat: add investigation dependency and status engine"
```

### Task 4: Atomic investigation reducer

**Files:**
- Create: `src/core/investigation/reducer.js`
- Modify: `src/core/investigation/index.js`
- Create: `test/investigation-reducer-v12.test.mjs`

**Interfaces:**
- Consumes: `importInvestigation`, invalidation/status functions, and Mission Workspace pure functions.
- Produces: `reduceInvestigation(current, action, { now, uuid })` where action is a frozen discriminated record and the return value is a validated frozen Investigation v2 aggregate.

- [ ] **Step 1: Write failing transition, revision, and atomicity tests**

```js
test('each successful transition advances one revision and recomputes status', () => {
  const next = reduceInvestigation(current, { type: 'SCOPE_SET', profile, context }, fixed);
  assert.equal(next.revision, current.revision + 1);
  assert.deepEqual(next.scope, { profile: normalizeClientProfile(profile), context: normalizedContext });
  assert.equal(next.status.phase, 'EVIDENCE');
});

test('failed transition leaves the input byte-identical', () => {
  const before = exportInvestigation(current);
  assert.throws(() => reduceInvestigation(current, { type: 'DISPOSITION_SET', value: benignWithoutRationale }, fixed), /disposition/i);
  assert.equal(exportInvestigation(current), before);
});
```

- [ ] **Step 2: Run reducer tests and verify RED**

Run: `node --test test/investigation-reducer-v12.test.mjs`

Expected: FAIL because `reduceInvestigation` is missing.

- [ ] **Step 3: Implement the closed transition catalog**

```js
const ACTIONS = new Set([
  'SCOPE_SET','OBSERVABLE_ADD','OBSERVABLE_REMOVE','EVIDENCE_CAPTURE',
  'OPERATOR_CAPTURE','RELEVANCE_BUILD','HUNT_BUILD','KQL_VALIDATE',
  'RESULT_SET','DISPOSITION_SET','REPORT_BUILD','SERVICENOW_BUILD','NOTE_ADD',
]);

export function reduceInvestigation(current, action, dependencies = {}) {
  const valid = importInvestigation(current);
  if (!action || !ACTIONS.has(action.type)) throw new TypeError('invalid investigation action');
  const candidate = applyAction(structuredClone(valid), action, dependencies);
  candidate.revision = valid.revision + 1;
  candidate.updatedAt = (dependencies.now ?? (() => new Date().toISOString()))();
  candidate.status = deriveInvestigationStatus(candidate);
  return importInvestigation(candidate);
}
```

`applyAction` must be an exhaustive `switch`; each branch performs one domain change, calls the exact invalidation reason, and validates semantic promotion rules before returning.

- [ ] **Step 4: Run reducer and mission-core suites**

Run: `node --test test/investigation-reducer-v12.test.mjs test/mission-public-api-v10.test.js test/mission-workspace-v11.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit reducer**

```bash
git add src/core/investigation/reducer.js src/core/investigation/index.js test/investigation-reducer-v12.test.mjs
git commit -m "feat: add atomic investigation reducer"
```

### Task 5: Browser repository, storage migration, and runtime

**Files:**
- Create: `app/investigation-repository.js`
- Create: `app/investigation-runtime.js`
- Modify: `app/indexeddb-case-storage.js`
- Create: `test/investigation-repository-v12.test.mjs`
- Create: `test/investigation-runtime-v12.test.mjs`
- Modify: `test/indexeddb-case-storage.test.mjs`

**Interfaces:**
- `createInvestigationRepository({ storage, now, uuid })` exposes `create/get/list/save/remove/mutate/migrateLegacy`.
- `createInvestigationRuntime({ investigations, gatewayClient, readImportText, readResultText, downloadText, now })` exposes `handle(action, context)`, `captureEvidence(result)`, `captureOperator(result)`, `reset()`, and `state()`.

- [ ] **Step 1: Write repository serialization and one-write tests**

```js
test('concurrent mutations serialize and each successful mutation writes once', async () => {
  const repo = createInvestigationRepository({ storage, ...fixed });
  const created = await repo.create('Concurrent');
  await Promise.all([
    repo.mutate(created.id, { type: 'NOTE_ADD', text: 'one' }),
    repo.mutate(created.id, { type: 'NOTE_ADD', text: 'two' }),
  ]);
  const saved = await repo.get(created.id);
  assert.deepEqual(saved.notes.map(note => note.text).sort(), ['one','two']);
  assert.equal(storage.putCalls, 3);
});

test('failed mutation performs no write', async () => {
  const before = storage.putCalls;
  await assert.rejects(repo.mutate(id, invalidAction), /invalid investigation/);
  assert.equal(storage.putCalls, before);
});
```

- [ ] **Step 2: Write runtime active-state and capture tests**

```js
test('captures only explicit compatible current outputs', async () => {
  await runtime.handle({ type: 'OPEN', id });
  await runtime.captureEvidence(enrichmentFixture);
  await runtime.captureOperator({ kind: 'shodan', result: shodanFixture });
  const value = await repo.get(id);
  assert.equal(value.evidenceSnapshots.length, 1);
  assert.equal(value.operatorArtifacts[0].kind, 'shodan');
  assert.equal(value.operatorArtifacts[0].promotedToEvidence, undefined);
});
```

- [ ] **Step 3: Run repository/runtime tests and verify RED**

Run: `node --test test/investigation-repository-v12.test.mjs test/investigation-runtime-v12.test.mjs`

Expected: FAIL because repository/runtime modules do not exist.

- [ ] **Step 4: Implement repository using the existing mutation-tail pattern**

```js
let mutationTail = Promise.resolve();
function serialize(operation) {
  const result = mutationTail.then(operation, operation);
  mutationTail = result.then(() => undefined, () => undefined);
  return result;
}
async function mutate(id, action) {
  return serialize(async () => {
    const current = await requireExisting(id);
    const next = reduceInvestigation(current, action, { now, uuid });
    await storage.put(structuredClone(next));
    return structuredClone(next);
  });
}
```

- [ ] **Step 5: Upgrade IndexedDB without destructive replacement**

Increment the database version once. Preserve the existing store name and keys. On read, detect legacy `schemaVersion === '1.0'`, migrate in memory, validate, then persist the migrated value in one readwrite transaction. A migration failure returns `investigation_storage_failed` and preserves the original record.

- [ ] **Step 6: Run storage, repository, runtime, and legacy case suites**

Run: `node --test test/indexeddb-case-storage.test.mjs test/investigation-repository-v12.test.mjs test/investigation-runtime-v12.test.mjs test/case-repository.test.js test/case-persistence-security-v8.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit persistence/runtime slice**

```bash
git add app/investigation-repository.js app/investigation-runtime.js app/indexeddb-case-storage.js test/investigation-*.test.mjs test/indexeddb-case-storage.test.mjs
git commit -m "feat: persist Investigation v2 atomically"
```

### Task 6: Shared shell command surface and browser bridge

**Files:**
- Create: `app/investigation-shell-bridge.js`
- Modify: `app/terminal-main.js`
- Modify: `app/shell-core/catalog.js`
- Modify: `app/shell-browser-executor.js`
- Modify: `app/shell-runtime.js`
- Modify: `app/analyst-deck.js`
- Modify: `app/analyst-deck.css`
- Modify: `bin/para11ax.mjs`
- Create: `test/investigation-shell-v12.test.mjs`
- Create: `test/investigation-shell-security-v12.test.mjs`
- Modify: `test/capability-registry-v8.test.js`

**Interfaces:**
- Browser adapter action names are `investigation-new/open/close/list/show/status/scope-set/observable-add/observable-remove/capture-evidence/capture-operator/relevance/hunt-build/kql-validate/result-import/disposition-set/report/servicenow/timeline/export/import/clear`.
- CLI supports pure bundle transforms through explicit `--file`/`--stdin`; browser persistence operations remain `WEB` only.

- [ ] **Step 1: Write registry, alias, surface, and parser tests**

```js
test('investigation namespace is discoverable and inv resolves identically', () => {
  assert.equal(registry.resolve(['investigation','status']).command.id, 'investigation.status');
  assert.equal(registry.resolve(['inv','status']).command.id, 'investigation.status');
  assert.match(help('investigation'), /investigation disposition set/);
});

test('browser-only persistence commands fail before executor dispatch on CLI', async () => {
  await assert.rejects(runCli('investigation open inv-001'), error => error.code === 'CAPABILITY_UNAVAILABLE');
  assert.equal(executorCalls, 0);
});
```

- [ ] **Step 2: Write secret/history and transport tests**

```js
test('investigation imports use only exact bounded transports', async () => {
  await assert.rejects(runCli('investigation import'), /--file|--stdin/);
  await assert.rejects(runCli('investigation import --stdin', 'x'.repeat((4 * 1024 * 1024) + 1)), /OUTPUT_LIMIT/);
});

test('bundle data and structural secret keys never enter history or error context', async () => {
  const secret = 'unique-secret-value';
  await assert.rejects(execute(`investigation import '{"token":"${secret}"}'`));
  assert.doesNotMatch(JSON.stringify(shell.history()), new RegExp(secret));
  assert.doesNotMatch(JSON.stringify(shell.lastError()), new RegExp(secret));
});
```

- [ ] **Step 3: Run shell tests and verify RED**

Run: `node --test test/investigation-shell-v12.test.mjs test/investigation-shell-security-v12.test.mjs`

Expected: FAIL because the namespace and adapter are absent.

- [ ] **Step 4: Register the closed command catalog**

Use `command()` descriptors matching the spec. Set `surfaces: WEB` for persistence, picker, and download actions; use `BOTH` only for pure status/show/import/export transformations that receive an explicit bundle. Assign `egressClass: 'none'` to every investigation command.

- [ ] **Step 5: Implement browser argument validation and receipts**

Receipts use this exact shape:

```js
return record({
  investigationId: outcome.investigation.id,
  revision: outcome.investigation.revision,
  action: outcome.action,
  invalidated: outcome.invalidated,
  phase: outcome.investigation.status.phase,
  readiness: outcome.investigation.status.readiness,
});
```

Reject extra arguments before adapter dispatch. JSON arguments pass through the existing bounded JSON parser and never through `eval` or `Function`.

- [ ] **Step 6: Wire the browser bridge and active status indicator**

Load `investigation-shell-bridge.js` after the existing terminal entry and before user input is enabled. Render `INV:<short-id> · <phase>` as a compact status-line segment only when an investigation is active. At `max-width:430px`, retain brand and clock priority and move the investigation segment into the existing second status row.

- [ ] **Step 7: Run the full shell/mobile compatibility group**

Run: `node --test test/investigation-shell-v12.test.mjs test/investigation-shell-security-v12.test.mjs test/capability-registry-v8.test.js test/shell-pipeline-v9.test.mjs test/shell-security-v9.test.mjs test/mobile-terminal-layout-regression.test.mjs test/terminal-interaction-polish.test.mjs`

Expected: all tests PASS.

- [ ] **Step 8: Commit shell integration**

```bash
git add app bin/para11ax.mjs test/investigation-shell-v12.test.mjs test/investigation-shell-security-v12.test.mjs test/capability-registry-v8.test.js
git commit -m "feat: expose Investigation v2 in the analyst shell"
```

### Task 7: Disposition, report, and ServiceNow projections

**Files:**
- Create: `src/report/render-investigation.js`
- Modify: `src/report/index.js`
- Modify: `src/core/investigation/reducer.js`
- Modify: `app/shell-browser-executor.js`
- Create: `test/investigation-report-v12.test.mjs`
- Modify: `test/servicenow-projection-v10.test.js`

**Interfaces:**
- Produces: `buildInvestigationReport(investigation)` and `renderInvestigationText(investigation)`.
- `DISPOSITION_SET` accepts `{ state, confidence, rationale, artifactIds, limitations }` with the fixed vocabulary from the spec.

- [ ] **Step 1: Write disposition semantic tests**

```js
test('NO_EVIDENCE_IDENTIFIED stays distinct from BENIGN_EXPLAINED', () => {
  const noEvidence = setDisposition(current, {
    state: 'NO_EVIDENCE_IDENTIFIED', confidence: 'MEDIUM',
    rationale: 'No related activity was identified in the reviewed telemetry.',
    artifactIds: [], limitations: ['telemetry_scope_limited'],
  });
  assert.notEqual(noEvidence.workflow.disposition.state, 'BENIGN_EXPLAINED');
});

test('BENIGN_EXPLAINED requires rationale and a linked current artifact or note', () => {
  assert.throws(() => setDisposition(current, {
    state: 'BENIGN_EXPLAINED', confidence: 'HIGH', rationale: 'Maintenance', artifactIds: [], limitations: [],
  }), /linked current artifact or note/i);
});
```

- [ ] **Step 2: Write stale-report refusal and deterministic output tests**

```js
test('report refuses stale required dependencies', () => {
  assert.throws(() => buildInvestigationReport(staleInvestigation), /STALE_DEPENDENCY/);
});

test('report preserves evidence, context, results, and judgment as separate sections', () => {
  const report = buildInvestigationReport(readyInvestigation);
  assert.deepEqual(Object.keys(report), ['identity','scope','evidence','operatorContext','hunt','results','disposition','limitations','provenance']);
  assert.equal(report.results.state, 'NO_RESULTS');
  assert.equal(report.disposition.state, 'NO_EVIDENCE_IDENTIFIED');
  assert.equal(renderInvestigationText(readyInvestigation), renderInvestigationText(importInvestigation(exportInvestigation(readyInvestigation))));
});
```

- [ ] **Step 3: Run report tests and verify RED**

Run: `node --test test/investigation-report-v12.test.mjs test/servicenow-projection-v10.test.js`

Expected: FAIL because investigation report functions are missing.

- [ ] **Step 4: Implement the report boundary**

`buildInvestigationReport` must call `importInvestigation`, require `status.reportReady === true`, reject any stale required artifact, preserve the tabled authority layers as separate fields, deduplicate source references, and never infer disposition/confidence. `renderInvestigationText` renders those exact sections through bounded plain text.

- [ ] **Step 5: Compose ServiceNow without submission**

Reuse `buildServiceNowProjection` only for compatible hunt/result fields, then add investigation identity, explicit analyst disposition, evidence references, stale-state proof, and approval-required language. Do not assign P1/P2 from disposition and do not add network access.

- [ ] **Step 6: Run report, ServiceNow, evidence, and public-audit tests**

Run: `node --test test/investigation-report-v12.test.mjs test/servicenow-projection-v10.test.js test/evidence-v2.test.js test/train-5-compatibility-v8.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit reporting slice**

```bash
git add src/report src/core/investigation/reducer.js app/shell-browser-executor.js test/investigation-report-v12.test.mjs test/servicenow-projection-v10.test.js
git commit -m "feat: add investigation disposition and reporting"
```

### Task 8: End-to-end workflow, documentation, and release closure

**Files:**
- Create: `test/investigation-e2e-v12.test.mjs`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ANALYST-MISSION-PACK.md`
- Modify: `docs/SHELL.md`
- Modify: `docs/SECURITY-CONTROLS.md`
- Modify: `docs/THREAT-MODEL.md`
- Modify: `docs/QA-REPORT.md`
- Modify: `CHANGELOG.md`
- Modify: `release-manifest.json`

**Interfaces:**
- Consumes the complete public Investigation v2 API and browser shell.
- Produces an exact acceptance fixture covering scope through portable export.

- [ ] **Step 1: Write the failing end-to-end acceptance test**

```js
test('one investigation completes the explicit analyst lifecycle without semantic promotion', async () => {
  const created = await runtime.handle({ type: 'NEW', title: 'Fortinet access review' });
  await runtime.handle({ type: 'SCOPE_SET', profile, context });
  await runtime.handle({ type: 'OBSERVABLE_ADD', observable: { type: 'ip', value: '203.0.113.10' } });
  await runtime.captureEvidence(enrichmentFixture);
  await runtime.handle({ type: 'RELEVANCE_BUILD' });
  await runtime.handle({ type: 'HUNT_BUILD', input: huntInput });
  await runtime.handle({ type: 'KQL_VALIDATE', query: boundedKql });
  await runtime.handle({ type: 'RESULT_SET', input: '[]' });
  await runtime.handle({ type: 'DISPOSITION_SET', value: noEvidenceDisposition });
  await runtime.handle({ type: 'REPORT_BUILD' });
  const exported = await runtime.handle({ type: 'EXPORT' });
  const restored = importInvestigation(exported.text);

  assert.equal(restored.status.phase, 'REPORT_READY');
  assert.equal(restored.workflow.result.state, 'NO_RESULTS');
  assert.equal(restored.workflow.disposition.state, 'NO_EVIDENCE_IDENTIFIED');
  assert.equal(restored.evidenceSnapshots.length, 1);
  assert.equal(restored.operatorArtifacts.some(item => item.promotedToEvidence), false);
});

test('new evidence makes the old hunt, result, disposition, and report stale', async () => {
  await runtime.captureEvidence(changedEnrichmentFixture);
  const status = (await runtime.handle({ type: 'STATUS' })).status;
  assert.deepEqual(status.staleArtifacts.map(item => item.artifact), ['hunt','result','disposition','report','serviceNow']);
  assert.equal(status.reportReady, false);
});
```

- [ ] **Step 2: Run E2E test and verify RED**

Run: `node --test test/investigation-e2e-v12.test.mjs`

Expected: FAIL until all runtime/report transitions are wired.

- [ ] **Step 3: Wire the complete E2E transition path through public interfaces**

Connect `runtime.captureEvidence` to `EVIDENCE_CAPTURE`, `RELEVANCE_BUILD` and `HUNT_BUILD` to the existing mission builders, `KQL_VALIDATE` to the existing KQL validator, `RESULT_SET` to the bounded result importer plus `analyzeMissionResults`, `REPORT_BUILD` to `buildInvestigationReport`, and `EXPORT` to `exportInvestigation`. Return `{ investigation, action, invalidated }` from mutations and `{ text, investigation }` from export. Do not introduce test-only production hooks; rerun the E2E test after each corrected boundary and retain all earlier tests.

- [ ] **Step 4: Update public documentation with exact current contracts**

Document:

```text
investigation new "Fortinet access review"
investigation scope set '<profile-and-context-json>'
investigation observable add ip 203.0.113.10
investigation capture evidence
investigation relevance
investigation hunt build '<hunt-json>'
investigation kql validate '<query>'
investigation result import
investigation disposition set '<disposition-json>'
investigation status
investigation report
investigation servicenow
investigation export
```

State explicitly that operator/imported/derived content is not Evidence v2, no-results is not benign, stale projections are refused, browser persistence is local, and ticket/query execution remains external.

- [ ] **Step 5: Run the complete local verification matrix**

```bash
npm ci --ignore-scripts
npm audit --omit=dev
bash -n scripts/*.sh maltego/install.sh
shellcheck scripts/*.sh maltego/install.sh
npm run verify:repo
npm run audit:public
npm test
(cd maltego && python3 -m unittest discover -s tests -v)
python3 -m compileall -q maltego workers/user-scanner
node scripts/generate-release-manifest.mjs --check
git diff --check
```

Expected: zero audit vulnerabilities, zero test failures, zero syntax errors, current release manifest, and clean diff checks.

- [ ] **Step 6: Perform live browser acceptance on a preview deployment**

Verify desktop and 360–430 px mobile widths, reduced motion, boot/skip, command discovery, new/open/status, evidence capture, file-picker cancellation, no-results disposition, report rendering, export download, refresh persistence, and migration of one legacy case. Confirm no application-origin console errors or CSP violations.

- [ ] **Step 7: Commit documentation and acceptance closure**

```bash
git add README.md CHANGELOG.md docs test/investigation-e2e-v12.test.mjs release-manifest.json
git commit -m "docs: finalize Investigation Workspace v2"
```

- [ ] **Step 8: Publish through protected main**

Push the feature branch, open a PR, and require fresh Tooling smoke and CodeQL on the exact PR head. Merge only after both pass. Then require fresh main Tooling smoke, READY Vercel deployments for PARA11AX and User Scanner, exact `githubCommitSha` equality, live security headers, and the public acceptance flow before declaring release completion.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
