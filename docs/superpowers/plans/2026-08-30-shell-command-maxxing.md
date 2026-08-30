# PARA11AX Shell Command Maxxing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split WebUI and Node command implementations with one shared, typed, fail-closed PARA11AX command fabric while preserving the existing command surface and adding absolute-max discovery, provider, evidence, report, and safe pipeline capabilities.

**Architecture:** Browser-safe command primitives live under `app/shell-core/` and are imported by both the WebUI and Node CLI. The shared core owns descriptors, parsing, ASTs, type validation, help/completion, transforms, and pipeline execution. Browser and Node executors own surface-specific effects. Direct provider commands route through one authenticated gateway endpoint that selects one named registered provider and still executes through the existing provider registry/orchestrator controls.

**Tech Stack:** Node.js 24.x, ECMAScript modules, browser ES modules, `node:test`, Vercel serverless functions, existing PARA11AX provider/orchestrator/report/case modules.

**Spec:** `docs/superpowers/specs/2026-08-30-shell-command-maxxing-design.md`

## Non-negotiable constraints

- One grammar and one declarative command registry are shared by WebUI and Node CLI.
- Existing WebUI commands and aliases remain compatible unless a current behavior is demonstrably unsafe.
- Existing Node CLI commands remain available: `doctor`, `providers list`, `providers env-template`, `providers probe`, `maltego check`, `release verify`, `setup`, `repair`, `report compile`, and `report diff`.
- No arbitrary OS command execution, `eval`, `Function`, command substitution, shell chaining, host redirects, arbitrary URL fetching, or generic filesystem primitives.
- Backticks, `$()`, `&&`, `||`, semicolon command chaining, and OS-shell redirects are invalid PARA11AX syntax.
- Provider commands inherit active state, supported types, fixed hosts, HTTPS-only policy, allowed methods, credential policy, cost class, admission/execution policy, timeout, response size, concurrency, retries, and distribution policy.
- Browser secrets remain memory-only and never enter history, output, errors, or command metadata.
- Browser provider execution never receives provider credentials; it calls same-origin authenticated PARA11AX endpoints only.
- Pipelines are sequential, typed, bounded, cancellable, and fail-fast.
- TDD is mandatory: write the failing test before each behavior change.
- `npm test`, `npm run check`, and `npm run verify:tooling` must pass before the implementation PR is considered complete.

## Target file structure

### New shared core

- `app/shell-core/errors.js` — stable shell error codes and `ShellCommandError`.
- `app/shell-core/types.js` — shell value types and size/record limits.
- `app/shell-core/registry.js` — descriptor validation, canonical resolution, aliases, namespaces, surfaces.
- `app/shell-core/parser.js` — tokenizer, safe grammar, pipeline AST, forbidden-shell rejection.
- `app/shell-core/transforms.js` — typed structured transforms and the safe text subset.
- `app/shell-core/runtime.js` — sequential pipeline execution, policy/type validation, cancellation, bounds.
- `app/shell-core/catalog.js` — the only command taxonomy source.
- `app/shell-core/help.js` — `help`, `man`, `apropos`, `which`, aliases, capabilities, limits.
- `app/shell-core/completion.js` — parser-position-aware completion generated from the catalog.

### Browser integration

- `app/shell-browser-executor.js` — browser handler map and shell state.
- `app/shell.js` — compatibility facade for existing imports/tests; no independent taxonomy.
- `app/shell-ui.js` — DOM/input/history/rendering/audio/cancellation only.
- `app/case-shell-bridge.js` — case storage/runtime adapter; no second submit path.
- `app/api-client.js` — add bounded named-provider operation.

### Gateway integration

- `src/app.js` — add one named-provider handler using the existing orchestrator.
- `api/para11ax/provider.js` — Vercel adapter for the named-provider endpoint.

### Node integration

- `src/control/shell-node-executor.js` — Node-only handlers for doctor/provider probe/env-template/setup/repair/Maltego/release/report/filesystem-safe operations.
- `bin/para11ax.mjs` — thin argv adapter over shared parser/runtime.

### New test support

- `test/helpers/shell-v9-fixtures.mjs` — shared concrete fixtures for shell-v9 tests.

Fixture exports must be real implementations, not test pseudocode:

```js
export function makeSession({ authenticated = true } = {}) {
  let token = authenticated ? 'fixture-token' : null;
  return {
    snapshot: () => ({ mode: token ? 'ready' : 'locked', hasToken: Boolean(token) }),
    setToken: value => { token = value; },
    unlock: () => {},
    startRequest: () => {},
    completeRequest: () => {},
    failRequest: () => {},
    reset: () => {},
    disconnect: () => { token = null; },
  };
}

export function makeAudio() {
  return { enable:async()=>{}, mute:()=>{}, play:()=>{}, typing:()=>{}, setVolume:()=>{} };
}

export function makeEnvelope(indicator = '8.8.8.8') {
  return {
    schemaVersion:'2.0', gatewayVersion:'test', requestId:'req-1', indicator, type:'ip', profile:'standard',
    status:'ok', queriedAt:'2026-08-30T00:00:00.000Z', durationMs:1,
    evidence:[], failures:[], relationships:[], correlation:{ contradictions:[], corroboration:[], limitations:[] },
    coverage:{}, decision:{}, guidance:{}, evidenceGraph:{ nodes:[], edges:[], counts:{nodes:0,edges:0} },
  };
}

export function makeRichEnvelope() {
  const value = makeEnvelope();
  value.evidence = [
    { provider:'virustotal', observation:{ verdict:'malicious', confidence:0.95 }, references:[] },
    { provider:'greynoise', observation:{ verdict:'unknown', confidence:0.70 }, references:[] },
  ];
  value.relationships = [{ type:'resolves_to', target:'1.1.1.1', provider:'virustotal' }];
  value.evidenceGraph = { nodes:[{id:'observable:fixture',type:'observable'}], edges:[], counts:{nodes:1,edges:0} };
  value.guidance = { disposition:'investigate', confidence:'medium', hunts:[], attackMappings:[], telemetry:{} };
  return value;
}

export function makeClient(overrides = {}) {
  return {
    health:async()=>({status:'ok'}), status:async()=>({status:'ok'}), meta:async()=>({providers:[]}),
    enrich:async indicator=>makeEnvelope(indicator), batch:async()=>({requestId:'b1',results:[]}),
    shodan:async()=>({requestId:'s1',command:'info',creditImpact:'none',durationMs:1,data:{}}),
    userScanner:async()=>({scanId:'u1',durationMs:1,summary:{totalScanned:0,found:0,errors:0},results:[],erroredSites:[]}),
    provider:async (_provider, indicator)=>makeEnvelope(indicator), stix:async()=>({type:'bundle',objects:[]}),
    ...overrides,
  };
}

export function makeProviderAdapter({ name='unit-provider', types=['ip'], active=true, run=async()=>({kind:'fixture_context',verdict:'unknown'}) } = {}) {
  return {
    name, types, active, observationTypes:['fixture_context'], cacheTtlMs:1000, negativeCacheTtlMs:100,
    costClass:'free', tier:1, timeoutMs:100, maxResponseBytes:2048, fixedHosts:['example.test'],
    parserVersion:'1', sourceUrl:'https://example.test/docs', run,
  };
}
```

Keep test fixtures deliberately credential-free. For gateway request fixtures, use the existing request shape already used in `test/app.test.js` / `test/health-auth.test.js`; do not create a second incompatible request abstraction.

---

## Task 1: Shared errors, value types, registry, and test fixtures

**Files:**
- Create `app/shell-core/errors.js`
- Create `app/shell-core/types.js`
- Create `app/shell-core/registry.js`
- Create `test/helpers/shell-v9-fixtures.mjs`
- Create `test/shell-registry-v9.test.mjs`

**Interfaces:**
- `ShellCommandError`, `shellError(code, message, context)`, `SHELL_ERROR_CODES`.
- `VALUE_TYPES`, `PIPELINE_LIMITS`, `estimateValueBytes(value)`, `assertBoundedValue(value, limits)`.
- `createCommandRegistry(descriptors)` returning `{ all(), get(id), resolve(tokens, surface), byNamespace(namespace), forSurface(surface) }`.

- [ ] Write failing registry tests for longest-prefix resolution, canonical aliases, duplicate token sequences, invalid surfaces/types/handlers, and frozen descriptors.

```js
const registry = createCommandRegistry([
  { id:'provider.list', tokens:['provider','list'], aliases:[['providers']], namespace:'provider', surfaces:['web','cli'], auth:'none', inputTypes:['void'], outputType:'records', egressClass:'none', sideEffect:'none', capabilities:[], handler:'provider-list', usage:'provider list', summary:'list providers' },
  { id:'provider.run', tokens:['provider','run'], aliases:[], namespace:'provider', surfaces:['web','cli'], auth:'required', inputTypes:['void'], outputType:'enrichment', egressClass:'provider', sideEffect:'none', capabilities:['provider-read'], handler:'provider-run', usage:'provider run <provider> <observable>', summary:'run one provider' },
]);
assert.equal(registry.resolve(['provider','run','virustotal'], 'web').descriptor.id, 'provider.run');
assert.equal(registry.resolve(['providers'], 'web').descriptor.id, 'provider.list');
```

- [ ] Run `node --test test/shell-registry-v9.test.mjs`; expected FAIL because the new modules do not exist.
- [ ] Implement the minimal primitives. Use stable codes approved by the spec and central bounds:

```js
export const PIPELINE_LIMITS = Object.freeze({
  stages: 12,
  records: 1000,
  intermediateBytes: 2_000_000,
  renderedBytes: 512_000,
  textLines: 10_000,
});
```

- [ ] Run `node --test test/shell-registry-v9.test.mjs test/shell.test.mjs`; expected PASS.
- [ ] Commit: `feat(shell): add shared command registry primitives`.

---

## Task 2: Safe tokenizer and pipeline AST

**Files:**
- Create `app/shell-core/parser.js`
- Create `test/shell-parser-v9.test.mjs`

**Interfaces:**
- `tokenizeShellLine(input)`.
- `parseShellLine(input) -> { type:'pipeline', stages:[{ type:'invocation', tokens:string[] }] }`.
- `parseShellTokens(argv)` for Node argv.

- [ ] Write failing tests proving quotes/backslash escapes survive, `|` splits only outside quotes, empty stages fail, the stage limit fails, and forbidden host-shell constructs are rejected.

```js
assert.deepEqual(parseShellLine('enrich "example.com" --full | evidence | head 20').stages.map(x => x.tokens), [
  ['enrich','example.com','--full'], ['evidence'], ['head','20'],
]);
for (const line of ['echo `id`','echo $(id)','help && whoami','help || whoami','help; whoami','echo x > file','cat < file']) {
  assert.throws(() => parseShellLine(line), error => error.code === 'INVALID_SYNTAX');
}
assert.deepEqual(parseShellLine('result evidence | where confidence >= 0.8').stages[1].tokens, ['where','confidence','>=','0.8']);
```

- [ ] Run `node --test test/shell-parser-v9.test.mjs`; expected FAIL.
- [ ] Implement a deterministic character scanner; do not use shell libraries or dynamic evaluation. Comparison tokens `< <= > >= == !=` are accepted only inside the registered `where` expression position; redirect-like usage elsewhere is `INVALID_SYNTAX`.
- [ ] Run `node --test test/shell-parser-v9.test.mjs test/shell.test.mjs`; expected PASS.
- [ ] Commit: `feat(shell): add safe pipeline parser`.

---

## Task 3: Structured and text transforms

**Files:**
- Create `app/shell-core/transforms.js`
- Create `test/shell-transforms-v9.test.mjs`

**Interfaces:**
- `TRANSFORM_HANDLERS` with `where`, `select`, `fields`, `sort`, `unique`, `count`, `group`, `pluck`, `head`, `tail`, `jsonpath`, `grep`, `wc`, `uniq`.
- Handler contract: `handler({ input:{type,value}, args, limits }) -> { type, value }`.

- [ ] Write failing tests for numeric/string comparisons, dotted field lookup, stable sort, unique records, grouping/counting, bounded head/tail, read-only dotted-path `jsonpath`, and text-only grep/wc/uniq.
- [ ] Run `node --test test/shell-transforms-v9.test.mjs`; expected FAIL.
- [ ] Implement transforms with no third-party evaluator. Restrict field paths to `/^[A-Za-z0-9_.-]{1,128}$/`. `jsonpath` means dotted keys plus numeric array indices only, not full JSONPath syntax.
- [ ] Verify wrong input types produce `PIPELINE_TYPE_MISMATCH`, malformed expressions produce `INVALID_ARGUMENT`, and oversized input/output produces `OUTPUT_LIMIT`.
- [ ] Run `node --test test/shell-transforms-v9.test.mjs`; expected PASS.
- [ ] Commit: `feat(shell): add bounded pipeline transforms`.

---

## Task 4: Shared pipeline runtime

**Files:**
- Create `app/shell-core/runtime.js`
- Create `test/shell-pipeline-v9.test.mjs`
- Modify `test/shell-runtime.test.mjs`

**Interface:**

```js
executePipeline(ast, { registry, executor, context, signal, limits = PIPELINE_LIMITS })
```

Executor contract:

```js
executor.execute({ descriptor, args, input, context, signal }) -> Promise<{ type, value }>
```

- [ ] Write failing tests showing typed output from stage N becomes input to stage N+1, the runtime stops after the first failing stage, auth/surface/type/capability checks occur before execution, and an aborted signal yields `OPERATION_ABORTED`.
- [ ] Run `node --test test/shell-pipeline-v9.test.mjs`; expected FAIL.
- [ ] Implement stage flow exactly: resolve alias → validate descriptor/args → surface → auth/capability → input type → execute handler/transform → assert typed output → enforce bounds → continue.
- [ ] Preserve `ShellCommandError`; convert `AbortError` to `OPERATION_ABORTED`; wrap unexpected executor failures as `UPSTREAM_FAILED` with bounded/redacted context.
- [ ] Run `node --test test/shell-pipeline-v9.test.mjs test/shell-runtime.test.mjs`; expected PASS.
- [ ] Commit: `feat(shell): add typed pipeline runtime`.

---

## Task 5: Absolute-max catalog, discovery, help, and completion

**Files:**
- Create `app/shell-core/catalog.js`
- Create `app/shell-core/help.js`
- Create `app/shell-core/completion.js`
- Create `test/shell-catalog-v9.test.mjs`

**Interfaces:**
- `COMMAND_DESCRIPTORS`, `COMMAND_REGISTRY`.
- `renderCommandIndex`, `renderManual`, `searchCommands`, `whichCommand`, `listAliases`, `renderCapabilities`, `renderLimits`.
- `completeShellInput(input, { surface, providerNames, observableTypes, caseTypes })`.

- [ ] Write failing tests asserting every approved namespace exists: discovery/session/system/intel/provider/result/case/report/export/terminal/transform.
- [ ] Assert legacy aliases resolve: `?`, `cls`, `scan`, `pivot`, `osint`, `identity`, view aliases, current Shodan/User Scanner forms, existing case aliases, `providers list`, `providers env-template`, `providers probe`.
- [ ] Assert unavailable commands are omitted from normal completion but visible in help/man with `[CLI ONLY]` or `[WEB ONLY]`.
- [ ] Register fixed provider front doors as descriptors with immutable provider metadata: `vt→virustotal`, `gn→greynoise`, `otx`, `urlscan`, `threatfox`, `malwarebazaar`, `rdap`, `epss`, `kev→cisa-kev`, `nvd`, `censys`; keep the specialized Shodan family.
- [ ] Register `provider run <provider> <observable>` as a policy-bound operation, never as a generic HTTP command.
- [ ] Run `node --test test/shell-catalog-v9.test.mjs`; expected FAIL before implementation, PASS after.
- [ ] Run regression set: `node --test test/shell.test.mjs test/shodan-terminal.test.mjs test/user-scanner-terminal.test.mjs`.
- [ ] Commit: `feat(shell): add declarative absolute-max command catalog`.

---

## Task 6: Browser executor and compatibility facade

**Files:**
- Create `app/shell-browser-executor.js`
- Modify `app/shell.js`
- Create `test/shell-browser-executor-v9.test.mjs`
- Modify `test/shell.test.mjs`

**Interface:**

```js
createBrowserShellExecutor({
  client, session, cases = null, downloads, clipboard, audio,
  now = () => new Date(), monotonicNow, version,
  initialState = { profile:'standard', currentResult:null },
})
```

The executor exposes `execute(...)` and `state()`. `initialState` is legitimate dependency injection for restoring/test-driving session-local state; it must not bypass auth/policy gates.

- [ ] Write failing tests using only fixtures from `test/helpers/shell-v9-fixtures.mjs`.

```js
const result = makeEnvelope('8.8.8.8');
const executor = createBrowserShellExecutor({
  client:makeClient({ enrich:async()=>result }), session:makeSession(), cases:null,
  downloads:{ save:()=>{} }, clipboard:{ writeText:async()=>{} }, audio:makeAudio(),
  monotonicNow:()=>0, version:'2.0.0',
});
const output = await executor.execute({
  descriptor:{ handler:'intel-enrich', fixedArgs:[] }, args:['8.8.8.8'],
  input:{type:'void',value:null}, context:{surface:'web',authenticated:true,profile:'standard'},
  signal:new AbortController().signal,
});
assert.equal(output.type, 'enrichment');
assert.equal(executor.state().currentResult.requestId, 'req-1');
```

- [ ] Run `node --test test/shell-browser-executor-v9.test.mjs`; expected FAIL.
- [ ] Implement existing browser behavior first: login/auth, health/status/meta, enrich/profile/batch, User Scanner, Shodan, result aliases, JSON/STIX/copy, sound/volume/theme/pwd/hostname/date/echo, reboot/disconnect.
- [ ] Convert `app/shell.js` to a compatibility facade. It may retain `parseCommand`, `interpretCommand`, `completeCommand`, `COMMANDS`, and `createHistory` exports during migration, but derives metadata/completion from the shared catalog and must not contain a second command taxonomy.
- [ ] Run `node --test test/shell-browser-executor-v9.test.mjs test/shell.test.mjs test/shell-api.test.mjs test/shell-runtime.test.mjs test/unix-shell-surface.test.mjs test/shodan-terminal.test.mjs test/user-scanner-terminal.test.mjs`; expected PASS.
- [ ] Commit: `refactor(shell): route browser commands through shared executor`.

---

## Task 7: Named-provider gateway operation

**Files:**
- Modify `src/app.js`
- Create `api/para11ax/provider.js`
- Modify `app/api-client.js`
- Create `test/provider-command-api-v9.test.mjs`
- Modify `test/shell-api.test.mjs`

**HTTP contract:**
- `POST /api/para11ax/provider`
- Body keys allowed: `{ provider:string, indicator:string, type?:string }` only.
- Response: normal Evidence v2 enrichment envelope restricted to exactly one registered provider.
- Expected failures: unknown provider `404 provider_not_found`; inactive `409 provider_inactive`; unsupported observable type `400 provider_type_unsupported`; required credential absent `409 provider_unconfigured`.

- [ ] Write failing tests with a minimal provider adapter matching the existing `test/provider-runtime.test.js` contract. Use the same request helper pattern as `test/app.test.js`.
- [ ] Positive test: adapter `unit-provider` supports only `ip`; call `handleProvider` with `8.8.8.8`; assert HTTP 200, exactly one adapter invocation, and all evidence/failures name only `unit-provider`.
- [ ] Negative tests: unknown name, inactive adapter, domain sent to IP-only adapter, and credential-required provider without config; for every case assert the exact HTTP/error code above and zero provider `run()` calls.
- [ ] Run `node --test test/provider-command-api-v9.test.mjs`; expected FAIL because `handleProvider` does not exist.
- [ ] Implement `handleProvider` using the same auth/content-type/body-size gates as enrichment. Validate provider names with `/^[a-z0-9-]{1,64}$/`. Classify the indicator before provider execution. Never accept host, URL override, method, credential, timeout, parser, response-size, raw request, or arbitrary fetch options.
- [ ] Execute exactly one named provider by calling the existing orchestrator with `providerNames:[providerName]`; do not call the adapter directly from the HTTP handler.
- [ ] Add `client.provider(provider, indicator, signal)` in `app/api-client.js` using the existing same-origin `request()` and Evidence v2 envelope validation.
- [ ] Run: `node --test test/provider-command-api-v9.test.mjs test/shell-api.test.mjs test/provider-contract-v8.test.js test/egress-policy.test.js test/execution-policy-v8.test.js`; expected PASS.
- [ ] Commit: `feat(shell): add bounded named-provider gateway operation`.

---

## Task 8: Browser system/intel/provider command families

**Files:**
- Modify `app/shell-browser-executor.js`
- Modify `app/shell-core/catalog.js`
- Create `test/shell-provider-terminal-v9.test.mjs`

- [ ] Build a local test helper in the test file, using only real shared interfaces:

```js
async function runLine(line, { client=makeClient(), authenticated=true, initialState={} } = {}) {
  const executor = createBrowserShellExecutor({
    client, session:makeSession({authenticated}), cases:null,
    downloads:{save:()=>{}}, clipboard:{writeText:async()=>{}}, audio:makeAudio(),
    monotonicNow:()=>0, version:'2.0.0', initialState,
  });
  return executePipeline(parseShellLine(line), {
    registry:COMMAND_REGISTRY, executor,
    context:{surface:'web',authenticated,capabilities:new Set(['provider-read']),profile:'standard'},
  });
}
```

- [ ] Write failing test: `vt example.com` calls `client.provider('virustotal','example.com',...)` exactly once and returns an enrichment value.
- [ ] Write failing test: `intel ip example.com` returns `INVALID_ARGUMENT` and `client.enrich` is never called.
- [ ] Test `provider list/show/coverage` from `meta`, `provider status` from authenticated health/status, `provider run` via `client.provider`, and `provider probe` returns `SURFACE_UNAVAILABLE` on Web.
- [ ] Implement `normalize`, `type`, and `validate` using the existing browser-safe observable normalization/classification code; do not add a second classifier.
- [ ] Direct provider execution updates `currentResult` exactly like normal enrichment so subsequent `result ...` stages work.
- [ ] Run `node --test test/shell-provider-terminal-v9.test.mjs test/shell-browser-executor-v9.test.mjs test/shodan-terminal.test.mjs test/shell-api.test.mjs`; expected PASS.
- [ ] Commit: `feat(shell): expose provider and intel command families`.

---

## Task 9: Pipeline-native result/evidence commands

**Files:**
- Modify `app/shell-browser-executor.js`
- Modify `app/shell-core/catalog.js`
- Create `test/shell-result-v9.test.mjs`
- Modify `app/view-model.js` only if a pure projection currently exists only inside UI rendering code.

**Typed outputs:**
- `result evidence → evidence`
- `result relationships → relationships`
- `result graph → graph`
- `result guidance → guidance`
- `result providers/failures/references/contradictions/corroboration/attacks/hunts/telemetry/freshness → records|record|text as appropriate`
- `result raw → enrichment`

- [ ] Use the concrete `runLine` pattern from Task 8 with `initialState:{currentResult:makeRichEnvelope()}`.
- [ ] Failing test: `result evidence | fields provider | unique` returns exactly `[{provider:'virustotal'},{provider:'greynoise'}]`.
- [ ] Failing test: `result graph` returns the exact `currentResult.evidenceGraph` object and `result guidance` returns the exact `currentResult.guidance`; no browser recomputation.
- [ ] Preserve all existing direct aliases (`overview`, `evidence`, `cor`, `rel`, `coverage`, `raw`, `last`, `request`, `failures`, `contradictions`, `corroboration`, `references`, `providers`).
- [ ] Run `node --test test/shell-result-v9.test.mjs test/shell.test.mjs test/unix-shell-surface.test.mjs`; expected PASS.
- [ ] Commit: `feat(shell): make result commands pipeline-native`.

---

## Task 10: Integrate case workspace into the shared executor

**Files:**
- Modify `app/case-shell-bridge.js`
- Modify `app/shell-browser-executor.js`
- Modify `app/shell-ui.js`
- Create `test/shell-case-v9.test.mjs`
- Modify `test/case-shell-wiring-v8.test.mjs`
- Modify `test/shell-case-grammar-v8.test.js`
- Modify `test/shell-case-runtime-v8.test.js`

- [ ] Write failing test with a concrete case adapter `{ handle: async (action,state) => { calls.push([action,state]); return {case:{id:'c1',title:'A'}}; } }`; execute `case new A` through the browser executor and assert `calls[0][0].action === 'case-new'`.
- [ ] Add a source-level wiring assertion in `test/case-shell-wiring-v8.test.mjs` that `app/case-shell-bridge.js` no longer calls `addEventListener('submit', ..., true)` and that `app/shell-ui.js` remains the sole shell submit owner.
- [ ] Keep IndexedDB repository/runtime creation, import-file picker, case download helper, and enrichment-capture observer in the case bridge, but expose them as an adapter to the browser executor instead of intercepting form submission.
- [ ] Route `case new/open/close/list/show/refresh/import/export/find`, pin/unpin/note/diff, and read-only `case pins/notes/timeline/graph` through the shared catalog/executor. Do not add duplicate persistence.
- [ ] Run `node --test test/shell-case-v9.test.mjs test/case-shell-wiring-v8.test.mjs test/shell-case-grammar-v8.test.js test/shell-case-runtime-v8.test.js test/shell.test.mjs`; expected PASS.
- [ ] Commit: `refactor(shell): integrate case workspace into shared runtime`.

---

## Task 11: WebUI executes the shared pipeline runtime

**Files:**
- Modify `app/shell-ui.js`
- Modify `app/shell.js`
- Modify `test/unix-shell-surface.test.mjs`
- Modify `test/shell.test.mjs`

- [ ] Before implementation, add an exact structural regression test using `readFile`:

```js
const source = await readFile(new URL('../app/shell-ui.js', import.meta.url), 'utf8');
assert.match(source, /parseShellLine/);
assert.match(source, /executePipeline/);
assert.match(source, /completeShellInput/);
assert.doesNotMatch(source, /interpretCommand\(/);
```

This test must FAIL before the migration because `shell-ui.js` still submits via `interpretCommand`.

- [ ] Add a behavior test at the shared browser-runtime boundary: execute `enrich 8.8.8.8 | result evidence | head 1` with a client returning `makeRichEnvelope()`; assert one enrichment call and one evidence record in the final typed value.
- [ ] Add a behavior test: parse/execute `echo x && health`; assert `INVALID_SYNTAX` and zero health calls.
- [ ] Replace command-specific `executeAction()`/`runGateway()` knowledge in `shell-ui.js` with `parseShellLine()` + `executePipeline()` + final typed-value rendering. Keep DOM, status, history, prompt, audio/glitch callbacks, downloads, and cancellation in UI.
- [ ] `Ctrl+C` aborts the active pipeline controller. Tab completion uses `completeShellInput()`.
- [ ] Run `node --test test/shell.test.mjs test/shell-api.test.mjs test/shell-runtime.test.mjs test/unix-shell-surface.test.mjs test/shodan-terminal.test.mjs test/user-scanner-terminal.test.mjs test/shell-case-v9.test.mjs test/shell-result-v9.test.mjs`; expected PASS.
- [ ] Commit: `refactor(shell): execute shared pipelines in WebUI`.

---

## Task 12: Node executor and CLI migration

**Files:**
- Create `src/control/shell-node-executor.js`
- Modify `bin/para11ax.mjs`
- Modify `src/control/commands.js` only to expose structured return-value variants where needed.
- Modify `src/control/provider-probe.js` only if a return-value wrapper is needed.
- Modify `src/control/report-commands.js` only if a return-value wrapper is needed.
- Create `test/node-cli-shell-v9.test.mjs`

**Interface:**

```js
createNodeShellExecutor({ env, stdout, stderr, cwd, now })
```

- [ ] Write failing CLI tests with `spawnSync(process.execPath, ['bin/para11ax.mjs', ...args])` proving legacy forms are still recognized: `doctor`, `providers list`, `providers env-template`, `providers probe`, `maltego check`, `release verify`, `setup`, `repair`, `report compile`, `report diff`.
- [ ] Add failing test that `['provider','list','|','head','1']` executes an internal PARA11AX pipeline when the literal `|` reaches argv. Document that a real host shell requires quoting/escaping the pipe; PARA11AX does not override the host shell.
- [ ] Implement Node handler mappings by delegating to existing control modules. Where an existing control helper only prints, add a pure return-value variant in that control module and keep the printing wrapper for compatibility. Do not scrape stdout to recover structured values.
- [ ] Convert `bin/para11ax.mjs` into argv parsing → shared runtime → Node executor → stdout/stderr rendering. Remove the independent command if-chain.
- [ ] Run `node --test test/node-cli-shell-v9.test.mjs test/cli.test.js test/provider-probe-all-types.test.js test/report-bundle.test.js test/report-diff.test.js test/report-quality.test.js`; expected PASS.
- [ ] Run `npm run verify:tooling`; expected exit 0.
- [ ] Commit: `refactor(shell): unify Node CLI with shared command fabric`.

---

## Task 13: Reports and exports with explicit surface gates

**Files:**
- Modify `app/shell-core/catalog.js`
- Modify `app/shell-browser-executor.js`
- Modify `src/control/shell-node-executor.js`
- Create `test/shell-report-v9.test.mjs`

- [ ] Write failing test: Web completion for `report c` does not suggest `compile`, while `help report compile` shows `[CLI ONLY]`.
- [ ] Write failing test: direct Web execution of `report compile ...` yields `SURFACE_UNAVAILABLE` before any filesystem effect.
- [ ] Write failing Node test: `report text <fixture>` returns `{type:'artifact', value:{mediaType:'text/plain', ...}}` without requiring an output directory.
- [ ] Node exposes `report compile`, `diff`, `quality`, `text`, `html`, `pdf`, `csv`, `kql`, `navigator`, `stix`, `evidence`, `manifest` by reusing existing report model/quality/renderers/compiler. Filesystem writes remain only in descriptors with `sideEffect:'filesystem'`.
- [ ] Web exposes only report projections/artifacts that can be produced safely from the current in-memory result or existing gateway operation; do not port Node-only filesystem/PDF machinery solely for parity.
- [ ] Preserve `json`, `stix`, `copy`, and browser download behavior.
- [ ] Run `node --test test/shell-report-v9.test.mjs test/report-bundle.test.js test/report-diff.test.js test/report-model.test.js test/report-quality.test.js test/report-renderers.test.js test/report-release-security.test.js test/shell.test.mjs`; expected PASS.
- [ ] Commit: `feat(shell): add surface-gated report command family`.

---

## Task 14: Security and compatibility hardening

**Files:**
- Create `test/shell-security-v9.test.mjs`
- Modify implementation files only for demonstrated failures.

- [ ] Add adversarial parser/runtime tests for:

```text
echo `id`
echo $(id)
help && health
help || health
help; health
echo x > /tmp/x
echo x >> /tmp/x
cat < /etc/passwd
provider run virustotal 8.8.8.8 --host evil.example
provider run virustotal 8.8.8.8 --method POST
provider run virustotal 8.8.8.8 --credential TOPSECRET
```

- [ ] For each case assert rejection before executor/provider/fetch execution; fake call counters remain zero.
- [ ] Assert registry contains no generic `sudo`, `ssh`, `curl`, `wget`, `eval`, `exec`, or `source` command.
- [ ] Assert every direct-provider descriptor has an immutable provider identity and no host/method/credential flags.
- [ ] Assert login token `super-secret-token` is absent from history, rendered errors, error context, and JSON serialization.
- [ ] Assert stage, record, intermediate-byte, rendered-byte, and text-line ceilings produce `OUTPUT_LIMIT`.
- [ ] Assert duplicate canonical/alias metadata fails registry construction.
- [ ] Run `node --test test/shell-security-v9.test.mjs test/shell-catalog-v9.test.mjs test/core-security.test.js test/egress-policy.test.js test/execution-policy-v8.test.js test/provider-contract-regression.test.js`; expected PASS after fixes.
- [ ] Run full verification:

```bash
npm test
npm run check
npm run verify:tooling
```

All three commands must exit 0.

- [ ] Commit only demonstrated hardening fixes and tests: `test(shell): harden command fabric security and compatibility`.

---

## Task 15: Shell documentation and final acceptance

**Files:**
- Create `docs/SHELL.md`
- Modify `docs/SHODAN-SHELL.md`
- Modify `README.md` only where the public shell summary is stale.
- Modify `test/shell-catalog-v9.test.mjs`

- [ ] Add a failing documentation parity test that reads `docs/SHELL.md` and verifies the canonical public namespaces `discovery`, `session`, `system`, `intel`, `provider`, `result`, `case`, `report`, `export`, `terminal` are documented and every documented direct-provider shorthand resolves in `COMMAND_REGISTRY`.
- [ ] Run `node --test test/shell-catalog-v9.test.mjs`; expected FAIL because `docs/SHELL.md` does not exist yet.
- [ ] Write `docs/SHELL.md` from the live registry: grammar/quoting, internal pipes, host-shell pipe caveat for CLI, discovery commands, namespaces, aliases, provider cost/surface visibility, report/export differences, hard security exclusions, and worked examples.
- [ ] Update `docs/SHODAN-SHELL.md` to explain that Shodan remains the specialized bounded operator family inside the unified fabric.
- [ ] Run final verification:

```bash
npm test
npm run check
npm run verify:tooling
git diff --check
git status --short
```

Expected: all verification commands exit 0; `git diff --check` prints nothing; status shows only intended changes before the final commit.

- [ ] Commit: `docs(shell): document unified command fabric`.

---

## Final acceptance checklist

- [ ] `COMMAND_REGISTRY` is the only command taxonomy source.
- [ ] WebUI and Node CLI both use the shared parser/runtime.
- [ ] Existing WebUI commands/aliases remain behaviorally compatible.
- [ ] Existing Node administrative/report commands remain available.
- [ ] Direct provider front doors and `provider run` cannot override provider policy.
- [ ] Named-provider gateway execution selects exactly one registered provider through the existing orchestrator.
- [ ] Evidence graph and guidance are read from the authoritative enrichment envelope.
- [ ] Case shell no longer has a second submit/dispatch path.
- [ ] Typed and safe text pipelines are both supported and bounded.
- [ ] Completion/help/man/apropos/which derive from the shared registry.
- [ ] Web/CLI surface restrictions are deterministic and visible.
- [ ] Backticks, `$()`, `&&`, `||`, semicolon chaining, and host redirects are rejected before execution.
- [ ] No provider secret value can appear in metadata, output, history, or errors.
- [ ] `npm test`, `npm run check`, and `npm run verify:tooling` pass.
- [ ] Implementation ships through a PR and required branch-protection checks; no direct protected-branch bypass.
