# PARA11AX v8 Train 4 — Local Cases, Cross-Case Index, and Bundles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-local investigation workspace with plain IndexedDB persistence, immutable Evidence v2 snapshots, automatic semantic diffs, explicit `.para11ax` export/import, and a rebuildable cross-case index while keeping authentication and server state completely separate.

**Architecture:** Keep case domain logic pure and storage-agnostic. `case-model.js` owns schemas/mutations, `case-repository.js` coordinates persistence, `indexeddb-case-storage.js` is the browser adapter, `case-index.js` derives cross-case references, and `case-bundle.js` validates portability. The shell owns only an in-memory active-case ID; no token, provider key, or auth state enters case storage.

**Tech Stack:** Browser ES modules, IndexedDB, `crypto.randomUUID`, `structuredClone`, existing shell parser/UI/client, Train 3 `diffEvidenceSnapshots()`.

**Spec:** `docs/superpowers/specs/2026-08-28-para11ax-v8-full-maxx-design.md`

## Global Constraints

- Train 3 must be merged before execution.
- Database name: `para11ax-workspace-v1`; IndexedDB version: `1`; object store: `cases`; key path: `id`.
- The active case ID is memory-only and resets to `null` on page reload/reboot/disconnect.
- Plain IndexedDB is intentional; PARA11AX performs no case-data encryption.
- Case title max 120 characters; note body max 4,000 characters.
- Per case: max 256 pins, 500 notes, 500 snapshots, 500 semantic diffs.
- Bundle max encoded UTF-8 size: 8 MiB.
- A manual refresh handles at most 100 pinned observables per invocation, in sequential API batches of at most 20.
- `case refresh --stale` refreshes only pins whose latest snapshot is older than 24 hours or missing.
- Only HTTP-success enrichment envelopes with `status === 'ok'` or `status === 'partial'` auto-capture. Error envelopes are not persisted as evidence snapshots.
- Case/bundle data never contains `PARA11AX_TOKEN`, provider credential names/values, browser session objects, or AbortControllers.
- No cloud sync, service worker refresh, server scheduler, account identity, or collaboration endpoint.

---

### Task 1: Define the immutable case domain model

**Files:**
- Create: `app/case-model.js`
- Create: `test/case-model-v8.test.js`

**Interfaces:**

```js
export const CASE_SCHEMA_VERSION = '1.0';
export function createCase({ title, now, uuid });
export function addNote(caseValue, text, { now, uuid });
export function addPin(caseValue, observable, { now });
export function removePin(caseValue, observable);
export function appendSnapshot(caseValue, enrichment, { now, uuid });
export function latestSnapshot(caseValue, observable);
```

All mutation functions return a new deeply detached case object and never mutate the input.

- [ ] **Step 1: Write failing model tests**

Test exact base shape:

```js
{
  schemaVersion: '1.0',
  id: 'case-1',
  title: 'Operation Fixture',
  createdAt: '2026-08-28T20:00:00.000Z',
  updatedAt: '2026-08-28T20:00:00.000Z',
  notes: [],
  pins: [],
  snapshots: [],
  diffs: []
}
```

Test duplicate pins are rejected, notes over 4,000 chars are rejected, and modifying a returned snapshot does not mutate the original enrichment object.

- [ ] **Step 2: Run RED**

```bash
node --test test/case-model-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement exact observable identity**

Use:

```js
function observableKey({ type, value }) {
  return `${String(type)}\u0000${String(value)}`;
}
```

A pin is:

```js
{ type: string, value: string, addedAt: ISO8601 }
```

A snapshot is:

```js
{
  id: string,
  type: enrichment.type,
  indicator: enrichment.indicator,
  capturedAt: ISO8601,
  requestId: enrichment.requestId,
  evidence: structuredClone(enrichment)
}
```

- [ ] **Step 4: Generate semantic diff on second snapshot**

Import `diffEvidenceSnapshots()` from `../src/core/semantic-diff.js`. In `appendSnapshot()`, locate the latest prior snapshot for the same type/indicator. If present, append:

```js
{
  id: uuid(),
  type: enrichment.type,
  indicator: enrichment.indicator,
  capturedAt: now(),
  fromSnapshotId: previous.id,
  toSnapshotId: snapshot.id,
  diff: diffEvidenceSnapshots(previous.evidence, enrichment)
}
```

Do not append a diff for the first snapshot.

- [ ] **Step 5: Enforce case bounds before returning**

Reject additions with stable error codes/messages:

```text
case_title_invalid
case_note_invalid
case_pin_limit
case_note_limit
case_snapshot_limit
case_diff_limit
```

- [ ] **Step 6: Run GREEN and commit**

```bash
node --test test/case-model-v8.test.js
git add app/case-model.js test/case-model-v8.test.js
git commit -m "feat: add immutable local case model"
```

---

### Task 2: Add storage-agnostic repository and browser IndexedDB adapter

**Files:**
- Create: `app/case-repository.js`
- Create: `app/indexeddb-case-storage.js`
- Create: `test/case-repository-v8.test.js`
- Create: `test/indexeddb-case-storage-v8.test.js`

**Interfaces:**

```js
export function createCaseRepository({ storage, now, uuid });
// methods: create, get, list, save, remove, addNote, addPin, removePin, capture

export function createIndexedDbCaseStorage({ indexedDB });
// methods: get(id), put(caseValue), delete(id), list()
```

- [ ] **Step 1: Write repository tests with an in-memory storage double**

The test storage must implement the same four async methods and use a `Map`. Assert create/list/get/save/delete and snapshot capture behavior. Assert repository calls do not contain a property named `token`, `authorization`, `credential`, or `session` at case root.

- [ ] **Step 2: Run RED**

```bash
node --test test/case-repository-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement repository as the only domain mutation coordinator**

Every mutating method must load the current case, call the corresponding pure function from `case-model.js`, then `storage.put(next)` exactly once. `list()` sorts by `updatedAt` descending then `id` ascending.

- [ ] **Step 4: Write a minimal IndexedDB adapter test double**

Create a deterministic fake `indexedDB.open()` implementation in `test/indexeddb-case-storage-v8.test.js` that records requested database name/version and object-store configuration. Test:

```js
assert.equal(opened.name, 'para11ax-workspace-v1');
assert.equal(opened.version, 1);
assert.deepEqual(storeConfig, { name: 'cases', keyPath: 'id' });
```

Also test `get`, `put`, `delete`, and `getAll` request success/error paths.

- [ ] **Step 5: Implement IndexedDB adapter**

`createIndexedDbCaseStorage()` must throw if `indexedDB` is missing. On upgrade, create `cases` only when absent. Use `readonly` transactions for `get/list` and `readwrite` for `put/delete`. Resolve transaction/request errors as `Error('workspace_storage_failed')`; do not serialize the browser's raw error message into shell output.

- [ ] **Step 6: Run GREEN and commit**

```bash
node --test test/case-repository-v8.test.js test/indexeddb-case-storage-v8.test.js
git add app/case-repository.js app/indexeddb-case-storage.js test/case-repository-v8.test.js test/indexeddb-case-storage-v8.test.js
git commit -m "feat: persist local cases in indexeddb"
```

---

### Task 3: Add rebuildable local cross-case index

**Files:**
- Create: `app/case-index.js`
- Create: `test/case-index-v8.test.js`

**Interfaces:**

```js
export function buildCaseIndex(cases);
export function findCaseSightings(index, { type, value });
```

- [ ] **Step 1: Write failing index tests**

Use three cases with repeated domain/IP pins and evidence relationships. Assert exact-match sightings return only evidence-backed case IDs and relationship references. Assert case deletion followed by rebuild removes all deleted-case entries.

- [ ] **Step 2: Run RED**

```bash
node --test test/case-index-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement bounded index**

Index keys use the same `type\0value` canonical key as `case-model.js`. Include entries from:

```text
pins
snapshot primary subject
snapshot evidence relationships with explicit targetType + target
snapshot ATT&CK mappings with explicit IDs
```

Each sighting contains only:

```js
{ caseId, caseTitle, source: 'pin'|'snapshot'|'relationship'|'attack', snapshotId: string|null }
```

Deduplicate exact sightings and sort by case ID/source/snapshot ID. Cap aggregate index entries to 20,000; throw `case_index_limit` above the cap.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test test/case-index-v8.test.js
git add app/case-index.js test/case-index-v8.test.js
git commit -m "feat: add local cross-case index"
```

---

### Task 4: Add strict `.para11ax` bundle export/import

**Files:**
- Create: `app/case-bundle.js`
- Create: `test/case-bundle-v8.test.js`

**Interfaces:**

```js
export const CASE_BUNDLE_MEDIA_TYPE = 'application/vnd.para11ax.case+json';
export function serializeCaseBundle(caseValue);
export function parseCaseBundle(text);
```

- [ ] **Step 1: Write failing bundle tests**

Assert serialized top-level shape:

```js
{
  format: 'para11ax-case',
  version: '1.0',
  exportedAt: ISO8601,
  case: caseValue
}
```

Inject deterministic `now` through an options object so tests do not depend on wall clock. Assert 8 MiB limit, exact schema/version, case bounds, and rejection of unexpected top-level keys.

- [ ] **Step 2: Run RED**

```bash
node --test test/case-bundle-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement export**

Use JSON only; no ZIP, compression, executable content, HTML, or embedded binary. Export a structured clone of the case. Before serialization recursively reject object keys matching exactly, case-insensitively:

```text
authorization
para11ax_token
provider_credentials
session
```

This is a structural guard, not a scan for arbitrary words inside analyst notes/evidence.

- [ ] **Step 4: Implement import validation before mutation**

`parseCaseBundle(text)` checks byte length before `JSON.parse`, validates exact `format/version`, validates all case bounds from Task 1, validates snapshot Evidence v2 minimum shape (`schemaVersion`, `requestId`, `indicator`, `type`, `evidence`, `relationships`, `failures`), and returns a detached case. It performs no IndexedDB write itself.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test test/case-bundle-v8.test.js
git add app/case-bundle.js test/case-bundle-v8.test.js
git commit -m "feat: add para11ax case bundles"
```

---

### Task 5: Add shell command grammar for local case operations

**Files:**
- Modify: `app/shell.js`
- Modify: `test/shell.test.js`

**Interfaces:**
- New commands: `case`, `pin`, `unpin`, `note`, `diff`.

- [ ] **Step 1: Write failing parser tests**

Assert exact actions:

```js
interpretCommand('case new Operation Fixture')
// { action: 'case-new', title: 'Operation Fixture', historySafe: true }

interpretCommand('case open case-1')
// action case-open
interpretCommand('case close')
// action case-close
interpretCommand('case list')
// action case-list
interpretCommand('case show')
// action case-show
interpretCommand('case refresh')
// action case-refresh, staleOnly false
interpretCommand('case refresh --stale')
// action case-refresh, staleOnly true
interpretCommand('case export')
// action case-export
interpretCommand('case import')
// action case-import
interpretCommand('case find example.com')
// action case-find, observable example.com
interpretCommand('pin 203.0.113.5')
// action case-pin
interpretCommand('unpin 203.0.113.5')
// action case-unpin
interpretCommand('note investigate beacon overlap')
// action case-note
interpretCommand('diff')
// action case-diff
```

Reject inline bundle data and unsupported case subcommands.

- [ ] **Step 2: Run RED**

```bash
node --test test/shell.test.js
```

Expected: commands are unknown.

- [ ] **Step 3: Add command metadata and deterministic grammar**

Add one `case` command entry under new category `case`, plus `pin`, `unpin`, `note`, `diff`. `case import` takes no path because browser shell has no filesystem access. `case export` takes no output path because browser download is explicit.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test test/shell.test.js
git add app/shell.js test/shell.test.js
git commit -m "feat: add local case shell grammar"
```

---

### Task 6: Wire active-case capture, refresh, index lookup, and bundle handling into the shell

**Files:**
- Modify: `app/shell-ui.js`
- Modify: `app/boot.js`
- Modify: `app/index.html`
- Create: `test/shell-case-runtime-v8.test.js`

**Interfaces:**
- `mountAnalystShell()` receives new `cases` dependency containing repository/index/bundle operations.
- `activeCaseId` is local to the mounted shell and initialized to `null`.

- [ ] **Step 1: Write failing runtime tests around a fake repository and client**

Cover:

```text
case new sets activeCaseId
case close clears it
successful enrich with active case calls repository.capture once
successful enrich without active case calls repository.capture zero times
error enrichment calls repository.capture zero times
case refresh uses client.batch in sequential chunks <=20 and never >100 total
--stale filters using a 24-hour threshold
case export calls downloadText with .para11ax filename and case media type
case import validates before repository.save
case find rebuilds/queries local index only; no API call
```

- [ ] **Step 2: Run RED**

```bash
node --test test/shell-case-runtime-v8.test.js
```

Expected: missing case runtime behavior.

- [ ] **Step 3: Initialize workspace dependencies in `app/boot.js`**

Construct:

```js
const storage = createIndexedDbCaseStorage({ indexedDB: window.indexedDB });
const cases = createCaseRepository({ storage, now: () => new Date().toISOString(), uuid: () => crypto.randomUUID() });
```

Pass `cases` into `mountAnalystShell()`. Do not pass the session token or `session` into the case repository.

- [ ] **Step 4: Auto-capture after successful enrichment**

After `runEnrichmentOperation()` resolves and before rendering the result:

```js
if (activeCaseId && ['ok', 'partial'].includes(result.status)) {
  await cases.capture(activeCaseId, result);
}
```

Storage failure appends a local warning line `case capture failed; enrichment result remains valid` and must not change the enrichment result/session state.

- [ ] **Step 5: Implement manual refresh**

Load active case pins. Filter stale pins when requested by comparing latest snapshot `capturedAt` to `now - 86_400_000`. Reject more than 100 selected pins with `case refresh limit is 100 observables`. Process chunks of 20 sequentially through `client.batch()`. For each result with `ok` or `partial`, call `cases.capture()`; failures remain displayed but do not overwrite old snapshots.

- [ ] **Step 6: Add hidden file input for import**

In `app/index.html`, add one hidden input:

```html
<input id="case-import" type="file" accept=".para11ax,application/vnd.para11ax.case+json" hidden>
```

`case import` triggers the chooser. Read as text, call `parseCaseBundle()`, then `cases.save()` only after successful validation.

- [ ] **Step 7: Run GREEN and commit**

```bash
node --test test/shell-case-runtime-v8.test.js test/shell.test.js test/session.test.js
git add app/shell-ui.js app/boot.js app/index.html test/shell-case-runtime-v8.test.js
git commit -m "feat: wire local analyst cases"
```

---

### Task 7: Security, privacy, and complete verification

- [ ] **Step 1: Add static persistence guard**

Add to the appropriate browser-security regression test an assertion that source files under `app/case-*.js` and `app/indexeddb-case-storage.js` do not reference:

```text
PARA11AX_TOKEN
getToken(
Authorization
localStorage
sessionStorage
```

The only persistence primitive allowed is IndexedDB.

- [ ] **Step 2: Run focused browser/workspace tests**

```bash
node --test test/case-model-v8.test.js test/case-repository-v8.test.js test/indexeddb-case-storage-v8.test.js test/case-index-v8.test.js test/case-bundle-v8.test.js test/shell-case-runtime-v8.test.js test/shell.test.js
```

Expected: PASS.

- [ ] **Step 3: Run complete gates**

```bash
npm test
npm run verify:repo
npm run audit:public
npm run check
```

Expected: all PASS.

- [ ] **Step 4: Review scope**

```bash
git diff --stat main...HEAD
git diff main...HEAD -- app/case-model.js app/case-repository.js app/indexeddb-case-storage.js app/case-index.js app/case-bundle.js app/shell.js app/shell-ui.js app/boot.js app/index.html
```

Acceptance conditions:

```text
- no server/API persistence is added
- no browser bearer persistence is added
- no cloud sync or scheduler is added
- active case is memory-only
- successful active-case enrichments append immutable snapshots and semantic diffs
- interrupted/failed refresh never overwrites previous snapshots
- cross-case index is derived and rebuildable
- .para11ax import validates before IndexedDB mutation
- bundle contains no auth/session/credential structure
```

Do not create an empty verification commit.