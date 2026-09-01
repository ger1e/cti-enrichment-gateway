<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Document status:** Historical design record after implementation. Current behavior is defined by [docs/ARCHITECTURE.md](https://github.com/ger1e/para11ax/blob/main/docs/ARCHITECTURE.md), `docs/SHELL.md`, and the current README.

# Mission Workspace v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Analyst Mission Pack v1 into a usable deterministic browser workspace and file/stdin-oriented CLI workflow with one portable mission bundle.

**Architecture:** Add a pure `mission-workspace-v1.0` state machine above the existing Mission Core, plus a shared command adapter consumed by both shell executors. The Web executor owns volatile in-memory state and delegates explicit local file selection/download; the Node executor owns process-local state and receives bounded file/stdin content from an explicit transport layer.

**Tech Stack:** Node.js 24 ESM, Node test runner, existing PARA11AX shared shell registry/runtime, browser-local callbacks, Node standard library only.

**Spec:** `docs/superpowers/specs/2026-09-01-mission-workspace-v1-design.md`

## Global Constraints

- No LLM, new egress, HTTP route, provider, secret, dependency, background job, or automatic ServiceNow submission.
- No server-side, IndexedDB, localStorage, or cross-process mission persistence.
- All state transitions are deterministic, immutable, deeply frozen, and fail closed.
- Mission bundle schema is exactly `mission-workspace-v1.0` with the nine top-level keys defined in the spec.
- Bundle/result input is bounded to 2 MiB UTF-8 before parsing.
- Existing Mission Core bounds remain authoritative: 5,000 rows, 128 columns, 4,096 characters per result field, 8 KQL candidates, and 32,000 characters per KQL query.
- `NO_RESULTS` never becomes benign evidence.
- ServiceNow remains projection-only with mandatory analyst approval.
- Browser and CLI use the same reducer, command adapter, and core projections.
- Node runtime remains 24.x and no package dependency changes are permitted.

---

### Task 1: Portable Mission Bundle

**Files:**
- Create: `src/core/mission/workspace.js`
- Modify: `src/core/mission/index.js`
- Create: `test/mission-workspace-v11.test.js`

**Interfaces:**
- Consumes: `normalizeClientProfile`, `assessClientRelevance`, `validateMissionKql`, `buildHuntPackage`, and `analyzeMissionResults` from the merged Mission Core, plus `buildServiceNowProjection` from the deterministic report layer.
- Produces: `MISSION_WORKSPACE_SCHEMA_VERSION`, `createMissionWorkspace()`, `importMissionWorkspace(input)`, and `exportMissionWorkspace(workspace)`.

- [ ] **Step 1: Write failing creation and export tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMissionWorkspace,
  exportMissionWorkspace,
  importMissionWorkspace,
} from '../src/core/mission/workspace.js';

test('empty mission workspace has the exact portable frozen contract', () => {
  const workspace = createMissionWorkspace();
  assert.deepEqual(workspace, {
    schemaVersion: 'mission-workspace-v1.0', revision: 0, profile: null, context: null,
    relevance: null, hunt: null, kqlValidations: [], result: null, serviceNow: null,
  });
  assert.equal(Object.isFrozen(workspace), true);
  assert.equal(Object.isFrozen(workspace.kqlValidations), true);
});

test('mission bundle export and import are byte-stable', () => {
  const serialized = exportMissionWorkspace(createMissionWorkspace());
  assert.equal(serialized.endsWith('\n'), true);
  assert.equal(exportMissionWorkspace(importMissionWorkspace(serialized)), serialized);
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `node --test test/mission-workspace-v11.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/mission/workspace.js`.

- [ ] **Step 3: Implement the exact schema, canonical JSON, UTF-8 bound, exact-key validation, and deep freeze**

```js
export const MISSION_WORKSPACE_SCHEMA_VERSION = 'mission-workspace-v1.0';
const MAX_BUNDLE_BYTES = 2 * 1024 * 1024;
const KEYS = Object.freeze([
  'schemaVersion','revision','profile','context','relevance','hunt',
  'kqlValidations','result','serviceNow',
]);

export function createMissionWorkspace() {
  return deepFreeze({
    schemaVersion: MISSION_WORKSPACE_SCHEMA_VERSION,
    revision: 0,
    profile: null,
    context: null,
    relevance: null,
    hunt: null,
    kqlValidations: [],
    result: null,
    serviceNow: null,
  });
}
```

Implement `canonicalize()` by recursively sorting plain-object keys, `deepFreeze()` without following prototypes, and `exportMissionWorkspace()` as two-space canonical JSON plus one trailing newline. Before validation, walk the entire candidate and reject non-plain nested objects, inherited properties, sparse arrays, non-finite numbers, `undefined`, functions, symbols, bigint values, accessors, and cycles. `importMissionWorkspace()` must parse strings only after the 2 MiB check, accept an already parsed plain object, reject keys not exactly equal to `KEYS`, and require a non-negative integer revision.

Validate the nested state exactly:

- normalize `profile` again with `normalizeClientProfile()` and require deep equality with the stored canonical profile;
- allow only `technologies`, `industries`, `geographies`, `attackPaths`, `actors`, `requiredTelemetry`, `observedExploitation`, and `evidenceConfidence` in `context`; normalize list fields to lowercase sorted unique arrays and validate scalars through `assessClientRelevance()`;
- recompute `relevance` from profile/context and require deep equality when stored;
- reconstruct the hunt input from stored `subject`, `hypothesis`, `attackIds`, `evidenceFingerprints`, `sourceReferences`, and `kqlCandidates[].query`, then recompute with stored profile/context and require deep equality;
- recompute every independent KQL validation from its exact query and require deep equality;
- allow only `schemaVersion`, `format`, `state`, `rowCount`, `columnCount`, `columns`, `nonEmptyRowCount`, `formulaLikeCellCount`, and `limitations` in result summaries; enforce the existing numeric ceilings, `columnCount === columns.length`, sorted unique bounded column names, and the exact state/format/count/limitation combinations emitted by `analyzeMissionResults()`;
- recompute `serviceNow` from the validated hunt and result and require deep equality;
- reject any derived field whose prerequisites are absent.

Return only the detached, deeply frozen, validated value.

- [ ] **Step 4: Add adversarial import tests**

```js
test('mission import rejects unknown keys versions prototypes and oversized input', () => {
  const empty = createMissionWorkspace();
  assert.throws(() => importMissionWorkspace({ ...empty, extra: true }), /mission workspace/i);
  assert.throws(() => importMissionWorkspace({ ...empty, schemaVersion: 'mission-workspace-v2.0' }), /version/i);
  assert.throws(() => importMissionWorkspace(Object.assign(Object.create({ inherited: true }), empty)), /plain object/i);
  assert.throws(() => importMissionWorkspace('x'.repeat((2 * 1024 * 1024) + 1)), /too large/i);
});
```

- [ ] **Step 5: Export the new public functions and verify GREEN**

Update the public API assertion to:

```js
assert.deepEqual(Object.keys(mission).sort(), [
  'analyzeMissionResults',
  'assessClientRelevance',
  'buildHuntPackage',
  'createMissionWorkspace',
  'exportMissionWorkspace',
  'importMissionWorkspace',
  'normalizeClientProfile',
  'validateMissionKql',
]);
for (const value of Object.values(mission)) assert.equal(typeof value, 'function');
```

Run: `node --test test/mission-workspace-v11.test.js test/mission-public-api-v10.test.js`

Expected: all tests PASS; update the public API test to assert the approved additive workspace exports exactly.

- [ ] **Step 6: Commit the portable bundle**

```bash
git add src/core/mission/workspace.js src/core/mission/index.js test/mission-workspace-v11.test.js test/mission-public-api-v10.test.js
git commit -m "feat: add portable mission workspace"
```

---

### Task 2: Deterministic Workspace Reducer

**Files:**
- Modify: `src/core/mission/workspace.js`
- Modify: `src/core/mission/index.js`
- Modify: `test/mission-workspace-v11.test.js`
- Modify: `test/mission-public-api-v10.test.js`

**Interfaces:**
- Consumes: the portable schema from Task 1 and existing Mission Core functions.
- Produces: `reduceMissionWorkspace(workspace, action)` supporting `PROFILE_SET`, `CONTEXT_SET`, `RELEVANCE_ASSESS`, `HUNT_BUILD`, `KQL_VALIDATE`, `RESULT_ANALYZE`, `SERVICENOW_BUILD`, `IMPORT`, and `CLEAR`.

- [ ] **Step 1: Write failing lifecycle and invalidation tests**

```js
const profile = { id: 'bor', name: 'Example Industrial', technologies: ['fortinet'], telemetry: ['DeviceNetworkEvents'] };
const context = { technologies: ['fortinet'], observedExploitation: true, requiredTelemetry: ['DeviceNetworkEvents'], evidenceConfidence: 0.8 };
const huntInput = {
  subject: 'Remote-access credential abuse',
  hypothesis: 'Valid-account abuse may produce anomalous endpoint activity.',
  attackIds: ['T1078'],
  evidenceFingerprints: ['a'.repeat(64)],
  sourceReferences: ['https://example.org/research'],
  kqlCandidates: ['DeviceNetworkEvents | where Timestamp > ago(24h) | project Timestamp, DeviceName, RemoteIP'],
};

test('workspace reducer executes the complete mission lifecycle', () => {
  let state = createMissionWorkspace();
  state = reduceMissionWorkspace(state, { type: 'PROFILE_SET', value: profile });
  state = reduceMissionWorkspace(state, { type: 'CONTEXT_SET', value: context });
  state = reduceMissionWorkspace(state, { type: 'RELEVANCE_ASSESS' });
  state = reduceMissionWorkspace(state, { type: 'HUNT_BUILD', value: huntInput });
  state = reduceMissionWorkspace(state, { type: 'RESULT_ANALYZE', value: 'DeviceName,RemoteIP\nhost-1,203.0.113.10\n' });
  state = reduceMissionWorkspace(state, { type: 'SERVICENOW_BUILD' });
  assert.equal(state.revision, 6);
  assert.equal(state.hunt.state, 'READY');
  assert.equal(state.result.state, 'RESULTS_PRESENT');
  assert.equal(state.serviceNow.provenance.autoSubmission, false);
});

test('changing profile invalidates every downstream projection', () => {
  const complete = completeWorkspaceFixture();
  const next = reduceMissionWorkspace(complete, { type: 'PROFILE_SET', value: { id: 'new', name: 'New Client' } });
  assert.deepEqual({ relevance: next.relevance, hunt: next.hunt, result: next.result, serviceNow: next.serviceNow }, {
    relevance: null, hunt: null, result: null, serviceNow: null,
  });
  assert.deepEqual(next.kqlValidations, []);
});
```

- [ ] **Step 2: Run the reducer tests and confirm RED**

Run: `node --test test/mission-workspace-v11.test.js`

Expected: FAIL because `reduceMissionWorkspace` is not exported.

- [ ] **Step 3: Implement prerequisite checks, transitions, revision increments, and exact invalidation**

Use a single transition table and return through `importMissionWorkspace({...next, revision: current.revision + 1})`. Implement this exact invalidation matrix:

| Action | Prerequisites | Written fields | Cleared fields |
|---|---|---|---|
| `PROFILE_SET` | workspace | profile | relevance, hunt, kqlValidations, result, serviceNow |
| `CONTEXT_SET` | workspace | context | relevance, hunt, kqlValidations, result, serviceNow |
| `RELEVANCE_ASSESS` | profile + context | relevance | hunt, kqlValidations, result, serviceNow |
| `HUNT_BUILD` | profile + context | hunt + hunt KQL validations | result, serviceNow |
| `KQL_VALIDATE` | workspace | independent deduplicated KQL validation | none |
| `RESULT_ANALYZE` | workspace | result | serviceNow |
| `SERVICENOW_BUILD` | hunt | serviceNow | none |
| `CLEAR` | workspace | empty bundle at next revision | all prior content |
| `IMPORT` | valid portable bundle | imported bundle and revision | executor replaces all prior content |

`HUNT_BUILD` must call:

```js
buildHuntPackage({
  ...action.value,
  profile: current.profile,
  context: current.context,
});
```

Reject `profile` or `context` keys inside `HUNT_BUILD.value` so callers cannot silently override workspace facts. Copy the built hunt's `kqlCandidates` into the workspace's `{ query, validation }` list. `KQL_VALIDATE` stores `{ query, validation }`, deduplicates by exact query, sorts by query, and rejects a ninth distinct query. `IMPORT` delegates to `importMissionWorkspace(action.value)` without incrementing the imported revision. Every other successful transition increments once.

- [ ] **Step 4: Add prerequisite, failure atomicity, deduplication, and clear tests**

```js
test('failed transitions do not mutate the current workspace', () => {
  const state = createMissionWorkspace();
  assert.throws(() => reduceMissionWorkspace(state, { type: 'RELEVANCE_ASSESS' }), /profile/i);
  assert.deepEqual(state, createMissionWorkspace());
});

test('clear removes all content and increments revision exactly once', () => {
  const state = reduceMissionWorkspace(createMissionWorkspace(), { type: 'PROFILE_SET', value: profile });
  const cleared = reduceMissionWorkspace(state, { type: 'CLEAR' });
  assert.equal(cleared.revision, 2);
  assert.equal(cleared.profile, null);
});
```

- [ ] **Step 5: Verify the reducer and existing Mission Core**

Export `reduceMissionWorkspace` from `src/core/mission/index.js` and add it to the sorted public API assertion between `normalizeClientProfile` and `validateMissionKql`.

Run: `node --test test/mission-workspace-v11.test.js test/mission-*.test.js`

Expected: all tests PASS.

- [ ] **Step 6: Commit the reducer**

```bash
git add src/core/mission/workspace.js src/core/mission/index.js test/mission-workspace-v11.test.js test/mission-public-api-v10.test.js
git commit -m "feat: add deterministic mission reducer"
```

---

### Task 3: Shared Mission Command Adapter

**Files:**
- Create: `src/core/mission/command-adapter.js`
- Modify: `src/core/mission/index.js`
- Create: `test/mission-command-adapter-v11.test.js`
- Modify: `test/mission-public-api-v10.test.js`

**Interfaces:**
- Consumes: `createMissionWorkspace`, `importMissionWorkspace`, `exportMissionWorkspace`, and `reduceMissionWorkspace`.
- Produces: `MISSION_HANDLERS`, `executeMissionCommand({ handler, args, input, workspace, loadContent })` returning `{ output, workspace }`, where `output` is an existing typed shell value.

- [ ] **Step 1: Write failing adapter tests for command/action mapping**

```js
test('shared adapter creates shows and mutates a workspace', async () => {
  const created = await executeMissionCommand({ handler: 'mission-new', args: [], input: { type: 'void', value: null }, workspace: null });
  assert.equal(created.output.type, 'record');
  const updated = await executeMissionCommand({
    handler: 'mission-profile-set',
    args: [JSON.stringify(profile)],
    input: created.output,
    workspace: null,
  });
  assert.equal(updated.workspace.profile.id, 'bor');
});

test('mission export returns one deterministic artifact contract', async () => {
  const result = await executeMissionCommand({ handler: 'mission-export', args: [], input: { type: 'record', value: createMissionWorkspace() } });
  assert.deepEqual(Object.keys(result.output.value), ['filename','mimeType','encoding','content']);
  assert.equal(result.output.value.filename, 'para11ax-mission.json');
});
```

- [ ] **Step 2: Run the adapter tests and confirm RED**

Run: `node --test test/mission-command-adapter-v11.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement shared parsing and output mapping**

Define the exact handler set:

```js
export const MISSION_HANDLERS = Object.freeze([
  'mission-new','mission-show','mission-profile-set','mission-context-set',
  'mission-relevance','mission-hunt-build','mission-kql-validate',
  'mission-result-analyze','mission-servicenow','mission-export','mission-import','mission-clear',
]));
```

Use piped `record` input only when it validates as a mission workspace; otherwise use the executor-owned workspace. Parse JSON with a safe wrapper. For profile, context, hunt, and result commands, delegate args beginning with exact `--file` or `--stdin` tokens to `loadContent({ kind, args })`; otherwise parse their bounded inline content. `mission-result-analyze` preserves raw CSV text and also calls the loader with empty args so the Web surface can open its explicit picker. `mission-import` always calls `loadContent({ kind: 'workspace', args })`. The loader, not the shared adapter, owns surface-specific flag policy. A loader cancellation (`null`) raises `shellError('OPERATION_ABORTED', 'file selection cancelled')` before reducer execution, preserving the current workspace. Normalize all core `TypeError` and `RangeError` failures to `shellError('INVALID_ARGUMENT', safeMessage)`; convert byte-bound failures to `OUTPUT_LIMIT`. Never return the raw caught error object.

- [ ] **Step 4: Add failure and transport-delegation tests**

```js
test('adapter rejects malformed JSON without reflecting raw internals', async () => {
  await assert.rejects(
    executeMissionCommand({ handler: 'mission-profile-set', args: ['{bad'], input: { type: 'void', value: null }, workspace: createMissionWorkspace() }),
    error => error.code === 'INVALID_ARGUMENT' && !error.message.includes('position'),
  );
});

test('result analysis requests explicit content when inline input is absent', async () => {
  const calls = [];
  await executeMissionCommand({
    handler: 'mission-result-analyze', args: [], input: { type: 'void', value: null }, workspace: seededWorkspace(),
    loadContent: async request => { calls.push(request); return 'DeviceName\nhost-1\n'; },
  });
  assert.deepEqual(calls, [{ kind: 'result', args: [] }]);
});
```

- [ ] **Step 5: Verify GREEN and run shell type-bound tests**

Export `executeMissionCommand` from `src/core/mission/index.js`, add it to the exact sorted public API assertion, and keep `MISSION_HANDLERS` private to the direct command-adapter module so the mission package surface remains function-only.

Run: `node --test test/mission-command-adapter-v11.test.js test/mission-public-api-v10.test.js test/shell-security-v9.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit the shared adapter**

```bash
git add src/core/mission/command-adapter.js src/core/mission/index.js test/mission-command-adapter-v11.test.js test/mission-public-api-v10.test.js
git commit -m "feat: add mission command adapter"
```

---

### Task 4: Declarative Shell Catalog

**Files:**
- Modify: `app/shell-core/catalog.js`
- Modify: `app/shell-core/registry.js`
- Create: `test/shell-mission-catalog-v11.test.mjs`

**Interfaces:**
- Consumes: handler names from Task 3 and the existing generic completion engine.
- Produces: the allowed `mission` namespace plus twelve `mission.*` descriptors with `egressClass: 'none'`, no auth/capability requirements, and exact side-effect metadata.

- [ ] **Step 1: Write failing catalog and completion tests**

```js
test('mission namespace exposes the approved shared command contract', () => {
  const expected = [
    'mission new','mission show','mission profile set','mission context set','mission relevance',
    'mission hunt build','mission kql validate','mission result analyze','mission servicenow',
    'mission export','mission import','mission clear',
  ];
  for (const command of expected) {
    const resolved = COMMAND_REGISTRY.resolve(command.split(' '), 'web');
    assert.equal(resolved?.surfaceAvailable, true, command);
    assert.equal(resolved.descriptor.namespace, 'mission');
    assert.equal(resolved.descriptor.egressClass, 'none');
    assert.deepEqual(resolved.descriptor.capabilities, []);
  }
  assert.deepEqual(completeShellInput('mission ', { surface: 'web' }), ['clear','context','export','hunt','import','kql','new','profile','relevance','result','servicenow','show']);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test test/shell-mission-catalog-v11.test.mjs`

Expected: FAIL because `mission` commands are absent.

- [ ] **Step 3: Allow the namespace and register exact descriptors**

Add `mission` to the fixed namespace allowlist in `app/shell-core/registry.js`. Use `inputTypes: ['void','record']` and `outputType: 'record'` for every transition. Set `mission-export` to `outputType: 'artifact'`. Set `sideEffect: 'session'` for `new`, profile/context mutation, relevance, hunt, KQL, result, ServiceNow, import, and clear. `show` and export remain read-only; Web download still requires the existing explicit `download` pipeline stage. Do not special-case completion: the existing registry-driven child completion must discover every nested command from the catalog.

- [ ] **Step 4: Add security metadata assertions**

Assert that no mission descriptor declares `gateway`, `provider`, `filesystem`, `local-admin`, auth, or capability requirements, and that `mission export | download` resolves only because the second existing command declares `browser-download`.

- [ ] **Step 5: Verify catalog, discovery, completion, and security suites**

Run: `node --test test/shell-mission-catalog-v11.test.mjs test/shell-catalog-v9.test.mjs test/shell-registry-v9.test.mjs test/shell-security-v9.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit the catalog**

```bash
git add app/shell-core/catalog.js app/shell-core/registry.js test/shell-mission-catalog-v11.test.mjs
git commit -m "feat: register mission shell commands"
```

---

### Task 5: Volatile Browser Mission Workspace

**Files:**
- Create: `app/mission-file-bridge.js`
- Modify: `app/shell-browser-executor.js`
- Modify: `app/shell-ui.js`
- Create: `test/mission-file-bridge-v11.test.mjs`
- Create: `test/shell-mission-browser-v11.test.mjs`

**Interfaces:**
- Consumes: `MISSION_HANDLERS`, `executeMissionCommand`, existing `downloads.save`, and a new optional `missionFiles.select(kind)` callback.
- Produces: browser executor state containing `missionWorkspace`, mission command execution, explicit local selection, and disconnect/reboot clearing.

- [ ] **Step 1: Write failing browser lifecycle tests**

```js
test('browser mission state is volatile and sequential', async () => {
  const executor = createBrowserShellExecutor(browserFixture());
  await run(executor, 'mission-new', []);
  await run(executor, 'mission-profile-set', [JSON.stringify(profile)]);
  assert.equal(executor.state().missionWorkspace.profile.id, 'bor');
  await run(executor, 'disconnect', []);
  assert.equal(executor.state().missionWorkspace, null);
});

test('browser mission export remains an in-memory artifact until explicit download', async () => {
  const saved = [];
  const executor = createBrowserShellExecutor(browserFixture({ downloads: { save: (...args) => saved.push(args) } }));
  const output = await run(executor, 'mission-export', [], { type: 'record', value: createMissionWorkspace() });
  assert.equal(output.type, 'artifact');
  assert.equal(saved.length, 0);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test test/shell-mission-browser-v11.test.mjs`

Expected: FAIL because mission handlers and state are not wired.

- [ ] **Step 3: Wire one adapter branch and volatile state**

Validate `initialState.missionWorkspace` through `importMissionWorkspace()` when supplied, otherwise initialize it to `null`. Before general command branches:

```js
if (MISSION_HANDLERS.includes(handler)) {
  const outcome = await executeMissionCommand({
    handler, args, input, workspace: state.missionWorkspace,
    loadContent: request => missionFiles?.select?.(request),
  });
  state.missionWorkspace = outcome.workspace;
  return outcome.output;
}
```

Set `state.missionWorkspace = null` in disconnect and reboot paths. `auth clear` remains authentication-only and does not silently destroy analyst work. Expose only the frozen portable workspace in `state()`; do not expose file callbacks or DOM objects.

- [ ] **Step 4: Add a dedicated session-only file bridge and wire it through the shell UI**

Create `createMissionFileSelector({ documentRef })` in `app/mission-file-bridge.js`. It may mirror the existing hidden input mechanics, but it must not import or reuse the case runtime, repository, or IndexedDB bridge. The selector reads exactly one file as text, rejects files over 2 MiB before `file.text()`, accepts `.json` for workspace import and `.json,.csv` for result import, clears the input value after every attempt, and returns content only to the current explicit command. Its policy denies browser `--file`/`--stdin` flags and permits only empty-arg `workspace`/`result` picker requests. Unit-test the injected DOM boundary, file-size check, cancellation, and reset behavior; pass `missionFiles` from `app/shell-ui.js` into `createBrowserShellExecutor`.

- [ ] **Step 5: Add no-network and reboot tests, then verify GREEN**

Run: `node --test test/mission-file-bridge-v11.test.mjs test/shell-mission-browser-v11.test.mjs test/shell-browser-executor-v9.test.mjs test/shell-security-v9.test.mjs`

Expected: all tests PASS and the fixture client records zero gateway calls for the full mission lifecycle.

- [ ] **Step 6: Commit browser integration**

```bash
git add app/mission-file-bridge.js app/shell-browser-executor.js app/shell-ui.js test/mission-file-bridge-v11.test.mjs test/shell-mission-browser-v11.test.mjs
git commit -m "feat: add volatile browser mission workspace"
```

---

### Task 6: Explicit Node File and Stdin Transport

**Files:**
- Create: `src/control/mission-content-loader.js`
- Modify: `src/control/shell-node-executor.js`
- Modify: `bin/para11ax.mjs`
- Create: `test/shell-mission-node-v11.test.mjs`
- Modify: `test/cli.test.js`

**Interfaces:**
- Consumes: shared mission adapter from Task 3.
- Produces: `createMissionContentLoader({ readFile, stdinContent })`, Node mission state, explicit `--file`/`--stdin` parsing, and mission artifact stdout rendering.

- [ ] **Step 1: Write failing bounded loader tests**

```js
test('node loader accepts exactly one explicit transport', async () => {
  const loader = createMissionContentLoader({
    readFile: async path => path === 'profile.json' ? '{"id":"x","name":"X"}' : '',
    stdinContent: 'DeviceName\nhost-1\n',
  });
  assert.equal(await loader({ kind: 'profile', args: ['--file','profile.json'] }), '{"id":"x","name":"X"}');
  assert.equal(await loader({ kind: 'result', args: ['--stdin'] }), 'DeviceName\nhost-1\n');
  await assert.rejects(loader({ kind: 'result', args: ['--file','x','--stdin'] }), error => error.code === 'POLICY_DENIED');
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test test/shell-mission-node-v11.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement explicit transport and Node executor wiring**

Use `readFile(path, 'utf8')`, reject empty paths, unknown flags, more than one path, mutual file/stdin selection, and content above 2 MiB UTF-8. Permit `--file`/`--stdin` only for `profile`, `context`, `hunt`, `result`, and `workspace` request kinds. Do not resolve, glob, recurse, follow a path found in content, or write any file. Add process-local `missionWorkspace` to Node executor state, create one loader from injected `readFile`/`missionStdin`, and delegate all mission handlers through `executeMissionCommand`. Clear process-local mission state on the registered `disconnect` command.

- [ ] **Step 4: Add bounded stdin acquisition to the CLI entry point**

In `bin/para11ax.mjs`, detect the exact token `--stdin`. Only then read `process.stdin` through an async bounded reader that aborts above 2 MiB. Pass the acquired string into `createNodeShellExecutor({ missionStdin: value })`. Never read stdin for other commands.

- [ ] **Step 5: Render mission artifacts as their content and test one-shot pipelines**

Extend `renderNodeShellOutput` so a `mission.export` artifact with `encoding: 'utf8'` writes `artifact.content` directly. Add a CLI test invoking literal PARA11AX pipeline tokens:

```js
const result = spawnSync(process.execPath, [
  'bin/para11ax.mjs', 'mission', 'import', '--file', fixture,
  '|', 'mission', 'relevance',
  '|', 'mission', 'export',
], { encoding: 'utf8' });
assert.equal(result.status, 0);
assert.equal(JSON.parse(result.stdout).relevance.schemaVersion, 'mission-relevance-v1.0');
```

- [ ] **Step 6: Verify Node, CLI, parser, and security suites**

Run: `node --test test/shell-mission-node-v11.test.mjs test/cli.test.js test/shell-parser-v9.test.mjs test/shell-security-v9.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit Node integration**

```bash
git add src/control/mission-content-loader.js src/control/shell-node-executor.js bin/para11ax.mjs test/shell-mission-node-v11.test.mjs test/cli.test.js
git commit -m "feat: add mission CLI transports"
```

---

### Task 7: Cross-Surface Workflow, Documentation, and Security Gate

**Files:**
- Create: `test/mission-workspace-e2e-v11.test.mjs`
- Create: `test/mission-workspace-security-v11.test.mjs`
- Modify: `docs/SHELL.md`
- Modify: `docs/ANALYST-MISSION-PACK.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: parity evidence, current public documentation, and release-quality security assertions.

- [ ] **Step 1: Write the failing end-to-end parity test**

Create one fixture that executes profile → context → relevance → hunt → KQL → CSV result → ServiceNow → export/import through the shared adapter, browser executor, and Node executor. Assert byte-identical exported bundle content and exact preservation of:

```js
assert.equal(bundle.hunt.state, 'READY');
assert.equal(bundle.result.state, 'RESULTS_PRESENT');
assert.equal(bundle.serviceNow.provenance.projectionOnly, true);
assert.equal(bundle.serviceNow.provenance.autoSubmission, false);
assert.match(bundle.serviceNow.recommendedActions.join(' '), /Analyst approval required/i);
```

- [ ] **Step 2: Run and confirm any parity gaps fail before documentation changes**

Run: `node --test test/mission-workspace-e2e-v11.test.mjs`

Expected: PASS only if Tasks 1–6 implement identical semantics; otherwise fix production at the shared boundary, not in the test.

- [ ] **Step 3: Add security source-contract tests**

```js
test('mission workspace adds no egress secrets persistence dynamic execution or submission', () => {
  const sources = [
    'src/core/mission/workspace.js','src/core/mission/command-adapter.js',
    'src/control/mission-content-loader.js',
  ].map(path => readFileSync(path, 'utf8')).join('\n');
  assert.doesNotMatch(sources, /\bfetch\s*\(|process\.env|localStorage|indexedDB|child_process|\beval\s*\(|new Function|ServiceNow[^\n]*POST/i);
});
```

Also assert `package.json` and `package-lock.json` have no dependency delta from `origin/main`, every mission descriptor has `egressClass: 'none'`, and exported bundles contain none of `token`, `authorization`, `cookie`, `password`, or `apiKey` structural keys.

- [ ] **Step 4: Update current documentation with exact commands and examples**

Document:

```text
mission new
mission profile set '<json>'
mission context set '<json>'
mission relevance
mission hunt build '<json>'
mission result analyze
mission servicenow
mission export | download
mission clear
```

Add the CLI form `para11ax mission import --file mission.json '|' mission show`, explain explicit `--stdin`, state that Web mission state is volatile, and repeat that KQL is not executed and ServiceNow is not submitted.

- [ ] **Step 5: Run focused and full verification**

Run:

```bash
node --test test/mission-*.test.js test/mission-*.test.mjs test/shell-mission-*.test.mjs
node --test
bash -n scripts/*.sh maltego/install.sh
node scripts/audit-public-release.mjs
node scripts/generate-release-manifest.mjs --check
python3 -m compileall -q maltego
(cd maltego && python3 -m unittest discover -s tests -v)
```

Expected: zero failures; public-release audit and release-manifest check pass.

- [ ] **Step 6: Inspect the complete branch diff against `origin/main`**

Run:

```bash
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- src/core/mission app/shell-core/catalog.js app/shell-browser-executor.js src/control/shell-node-executor.js bin/para11ax.mjs
```

Confirm no new egress, secret read, dependency, persistence, dynamic execution, silent evidence promotion, automatic download, or automatic submission.

- [ ] **Step 7: Commit documentation and final contracts**

```bash
git add test/mission-workspace-e2e-v11.test.mjs test/mission-workspace-security-v11.test.mjs docs/SHELL.md docs/ANALYST-MISSION-PACK.md docs/ARCHITECTURE.md README.md CHANGELOG.md
git commit -m "docs: publish mission workspace v1"
```

- [ ] **Step 8: Push the branch and open a draft PR**

Push `feat/mission-workspace-v1`, open `feat: mission workspace v1` against `main`, and keep it draft until Tooling smoke and CodeQL both succeed for the exact head SHA. Mark ready only after fresh CI evidence and final PR diff review.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
