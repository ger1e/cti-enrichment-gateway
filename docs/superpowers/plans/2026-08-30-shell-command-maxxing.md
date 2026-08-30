# PARA11AX Shell Command Maxxing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split WebUI/Node command implementations with one shared, typed, fail-closed PARA11AX command fabric that preserves legacy behavior while adding absolute-max discovery, provider, evidence, report, and safe pipeline capabilities.

**Architecture:** Browser-safe command primitives live under `app/shell-core/` and are imported by both the WebUI and Node CLI. The shared core owns descriptors, parsing, ASTs, type validation, help/completion, transforms, and pipeline execution; browser and Node executors own surface-specific effects. Direct provider commands route through one authenticated gateway endpoint that selects a named registered provider and still executes through the existing provider registry/orchestrator controls.

**Tech Stack:** Node.js 24.x, ECMAScript modules, browser ES modules, `node:test`, Vercel serverless functions, existing PARA11AX provider/orchestrator/report/case modules.

**Spec:** `docs/superpowers/specs/2026-08-30-shell-command-maxxing-design.md`

## Global Constraints

- One grammar and one declarative command registry are shared by WebUI and Node CLI.
- Existing WebUI commands and aliases remain compatible unless a current behavior is demonstrably unsafe.
- Existing Node CLI commands remain available: doctor, provider list/env-template/probe, Maltego check, release verify, setup/repair, report compile/diff.
- No arbitrary OS command execution, `eval`, `Function`, command substitution, shell chaining, redirects, arbitrary URL fetching, or generic filesystem primitives.
- Backticks, `$()`, `&&`, `||`, semicolon command chaining, and OS-shell redirects are invalid syntax.
- Provider commands inherit active state, types, fixed hosts, HTTPS protocol, allowed methods, credentials, cost class, admission/execution policy, timeout, response bytes, concurrency, retries, and distribution policy.
- Browser secrets remain memory-only and are never written to history or rendered.
- Browser provider execution never receives provider credentials; it calls same-origin authenticated PARA11AX API endpoints only.
- Pipeline execution is sequential, bounded, typed, and fail-fast.
- Node engine remains `24.x` and all tests continue to use `node --test`.
- TDD is mandatory: every behavior change starts with a failing test.

---

## File Structure

### New shared browser-safe core

- `app/shell-core/errors.js` — stable typed shell error codes and `ShellCommandError`.
- `app/shell-core/types.js` — shell value-type constants and bounded-value helpers.
- `app/shell-core/registry.js` — command descriptor validation, canonical resolution, aliases, namespaces, and surface filtering.
- `app/shell-core/parser.js` — tokenizer, safe grammar, pipeline AST, and forbidden-shell syntax rejection.
- `app/shell-core/transforms.js` — typed structured transforms plus the safe text-transform subset.
- `app/shell-core/runtime.js` — sequential pipeline execution, type/surface/auth checks, limits, cancellation, fail-fast propagation.
- `app/shell-core/catalog.js` — declarative command taxonomy and legacy aliases.
- `app/shell-core/help.js` — command index, `man`, `apropos`, `which`, aliases, capabilities, and limits projections.
- `app/shell-core/completion.js` — parser-position-aware completion generated from the catalog.

### Browser integration

- `app/shell-browser-executor.js` — browser handler keys, current-result state, gateway calls, browser local/session effects.
- `app/shell.js` — compatibility facade over the shared core for existing imports/tests while migration completes.
- `app/shell-ui.js` — UI/input/rendering/audio only; submits parsed pipelines to the shared runtime.
- `app/case-shell-bridge.js` — remove parallel command interception and expose its case runtime through the browser executor.
- `app/api-client.js` — add bounded provider-run client method and envelope validation.

### Gateway integration

- `src/app.js` — add a named-provider handler that validates provider/type/configuration and uses the existing orchestrator.
- `api/para11ax/provider.js` — Vercel route for the named-provider operation.

### Node integration

- `src/control/shell-node-executor.js` — Node-only command handlers for doctor/provider probe/env-template/setup/repair/Maltego/release/report/filesystem-safe operations.
- `bin/para11ax.mjs` — become a thin argv adapter over the shared parser/runtime and Node executor.

### Tests

- `test/shell-registry-v9.test.mjs`
- `test/shell-parser-v9.test.mjs`
- `test/shell-transforms-v9.test.mjs`
- `test/shell-pipeline-v9.test.mjs`
- `test/shell-catalog-v9.test.mjs`
- `test/shell-browser-executor-v9.test.mjs`
- `test/provider-command-api-v9.test.mjs`
- `test/shell-result-v9.test.mjs`
- `test/shell-case-v9.test.mjs`
- `test/node-cli-shell-v9.test.mjs`
- `test/shell-security-v9.test.mjs`
- Modify existing shell/runtime/UI/Shodan/User Scanner/case tests only where imports move, preserving behavioral expectations.

---

### Task 1: Shared error, value-type, and registry primitives

**Files:**
- Create: `app/shell-core/errors.js`
- Create: `app/shell-core/types.js`
- Create: `app/shell-core/registry.js`
- Test: `test/shell-registry-v9.test.mjs`

**Interfaces:**
- Produces: `ShellCommandError`, `shellError(code, message, context)`, `SHELL_ERROR_CODES`.
- Produces: `VALUE_TYPES`, `PIPELINE_LIMITS`, `estimateValueBytes(value)`, `assertBoundedValue(value, limits)`.
- Produces: `createCommandRegistry(descriptors)` returning `{ all(), get(id), resolve(tokens, surface), byNamespace(namespace), forSurface(surface) }`.
- Command descriptor identity is `id` plus `tokens`; handlers are string keys, never executable text.

- [ ] **Step 1: Write the failing registry tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommandRegistry } from '../app/shell-core/registry.js';

test('registry resolves longest command token prefix and aliases', () => {
  const registry = createCommandRegistry([
    { id:'provider.list', tokens:['provider','list'], aliases:[['providers']], namespace:'provider', surfaces:['web','cli'], auth:'none', inputTypes:['void'], outputType:'records', egressClass:'none', sideEffect:'none', capabilities:[], handler:'provider-list', usage:'provider list', summary:'list providers' },
    { id:'provider.run', tokens:['provider','run'], aliases:[], namespace:'provider', surfaces:['web','cli'], auth:'required', inputTypes:['void'], outputType:'enrichment', egressClass:'provider', sideEffect:'none', capabilities:['provider-read'], handler:'provider-run', usage:'provider run <provider> <observable>', summary:'run one provider' },
  ]);
  assert.equal(registry.resolve(['provider','run','virustotal'], 'web').descriptor.id, 'provider.run');
  assert.equal(registry.resolve(['providers'], 'web').descriptor.id, 'provider.list');
});

test('registry rejects duplicate aliases and malformed metadata', () => {
  assert.throws(() => createCommandRegistry([
    { id:'a', tokens:['a'], aliases:[['x']], namespace:'core', surfaces:['web'], auth:'none', inputTypes:['void'], outputType:'text', egressClass:'none', sideEffect:'none', capabilities:[], handler:'a', usage:'a', summary:'a' },
    { id:'b', tokens:['b'], aliases:[['x']], namespace:'core', surfaces:['web'], auth:'none', inputTypes:['void'], outputType:'text', egressClass:'none', sideEffect:'none', capabilities:[], handler:'b', usage:'b', summary:'b' },
  ]), /duplicate command token sequence/i);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test test/shell-registry-v9.test.mjs`

Expected: FAIL because `app/shell-core/registry.js` does not exist.

- [ ] **Step 3: Implement the minimal primitives**

```js
// app/shell-core/errors.js
export const SHELL_ERROR_CODES = Object.freeze([
  'COMMAND_NOT_FOUND','INVALID_SYNTAX','INVALID_ARGUMENT','PIPELINE_TYPE_MISMATCH',
  'AUTH_REQUIRED','CAPABILITY_UNAVAILABLE','SURFACE_UNAVAILABLE','PROVIDER_UNAVAILABLE',
  'POLICY_DENIED','QUOTA_GUARD','OUTPUT_LIMIT','OPERATION_ABORTED','UPSTREAM_FAILED',
]);

export class ShellCommandError extends Error {
  constructor(code, message, context = {}) {
    super(message);
    this.name = 'ShellCommandError';
    this.code = code;
    this.context = Object.freeze({ ...context });
  }
}

export function shellError(code, message, context = {}) {
  if (!SHELL_ERROR_CODES.includes(code)) throw new TypeError(`unknown shell error code: ${code}`);
  return new ShellCommandError(code, message, context);
}
```

```js
// app/shell-core/types.js
export const VALUE_TYPES = Object.freeze(['void','text','scalar','record','records','enrichment','evidence','relationships','graph','guidance','provider-list','artifact','error']);
export const PIPELINE_LIMITS = Object.freeze({ stages: 12, records: 1000, intermediateBytes: 2_000_000, renderedBytes: 512_000, textLines: 10_000 });

export function estimateValueBytes(value) {
  if (value == null) return 0;
  if (typeof value === 'string') return new TextEncoder().encode(value).length;
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
```

Implement `createCommandRegistry` with frozen descriptor copies, validation of every required metadata field, duplicate token-sequence detection across canonical names and aliases, longest-prefix resolution, and explicit surface filtering.

- [ ] **Step 4: Run focused tests and the current shell suite**

Run: `node --test test/shell-registry-v9.test.mjs test/shell.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/shell-core/errors.js app/shell-core/types.js app/shell-core/registry.js test/shell-registry-v9.test.mjs
git commit -m "feat(shell): add shared command registry primitives"
```

---

### Task 2: Safe tokenizer and pipeline AST parser

**Files:**
- Create: `app/shell-core/parser.js`
- Test: `test/shell-parser-v9.test.mjs`

**Interfaces:**
- Consumes: `shellError()` from Task 1.
- Produces: `tokenizeShellLine(input) -> token[]`.
- Produces: `parseShellLine(input) -> { type:'pipeline', stages:[{ type:'invocation', tokens:string[] }] }`.
- Produces: `parseShellTokens(argv) -> PipelineAST` for Node argv; literal `|` tokens are internal pipeline separators only when they reach PARA11AX argv.

- [ ] **Step 1: Write failing parser/security tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseShellLine } from '../app/shell-core/parser.js';

const stageTokens = input => parseShellLine(input).stages.map(stage => stage.tokens);

test('parser preserves quotes and creates pipeline stages', () => {
  assert.deepEqual(stageTokens('enrich "example.com" --full | evidence | head 20'), [
    ['enrich','example.com','--full'], ['evidence'], ['head','20'],
  ]);
});

test('parser rejects host-shell syntax', () => {
  for (const line of ['echo `id`','echo $(id)','help && whoami','help || whoami','help; whoami','echo x > file','cat < file']) {
    assert.throws(() => parseShellLine(line), error => error.code === 'INVALID_SYNTAX');
  }
});

test('comparison operators remain valid only inside where expressions', () => {
  assert.deepEqual(stageTokens('result evidence | where confidence >= 0.8'), [
    ['result','evidence'], ['where','confidence','>=','0.8'],
  ]);
  assert.throws(() => parseShellLine('echo x > file'), error => error.code === 'INVALID_SYNTAX');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/shell-parser-v9.test.mjs`

Expected: FAIL because parser module is missing.

- [ ] **Step 3: Implement tokenizer and parser**

Implement a deterministic character scanner that tracks quote state and backslash escaping, emits `|` only outside quotes, rejects forbidden shell constructs before AST creation, and rejects empty pipeline stages.

```js
export function parseShellLine(input) {
  const tokens = tokenizeShellLine(String(input ?? ''));
  const stages = splitPipeline(tokens);
  if (stages.length > PIPELINE_LIMITS.stages) throw shellError('OUTPUT_LIMIT', 'pipeline stage limit exceeded', { limit: PIPELINE_LIMITS.stages });
  validateRedirectLikeTokens(stages);
  return Object.freeze({ type: 'pipeline', stages: Object.freeze(stages.map(tokens => Object.freeze({ type:'invocation', tokens:Object.freeze(tokens) }))) });
}
```

`validateRedirectLikeTokens()` allows `<`, `<=`, `>`, `>=`, `==`, `!=` only when the stage's first token is `where`; bare redirect tokens elsewhere are `INVALID_SYNTAX`.

- [ ] **Step 4: Run parser and legacy parser tests**

Run: `node --test test/shell-parser-v9.test.mjs test/shell.test.mjs`

Expected: PASS; legacy `parseCommand()` behavior remains unchanged until Task 5.

- [ ] **Step 5: Commit**

```bash
git add app/shell-core/parser.js test/shell-parser-v9.test.mjs
git commit -m "feat(shell): add safe pipeline parser"
```

---

### Task 3: Structured and text transforms

**Files:**
- Create: `app/shell-core/transforms.js`
- Test: `test/shell-transforms-v9.test.mjs`

**Interfaces:**
- Produces: `TRANSFORM_HANDLERS`, a frozen map keyed by `where`, `select`, `fields`, `sort`, `unique`, `count`, `group`, `pluck`, `head`, `tail`, `jsonpath`, `grep`, `wc`, `uniq`.
- Each handler signature: `handler({ input, args, limits }) -> { type, value }`.
- Structured transforms never stringify input unless the command itself is text-oriented.

- [ ] **Step 1: Write failing transform tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { TRANSFORM_HANDLERS } from '../app/shell-core/transforms.js';

const run = (name, input, args=[]) => TRANSFORM_HANDLERS[name]({ input, args, limits:{ records:1000, textLines:10000 } });

test('where filters records with bounded comparison grammar', () => {
  const input = { type:'records', value:[{provider:'a',score:90},{provider:'b',score:20}] };
  assert.deepEqual(run('where', input, ['score','>=','80']).value, [{provider:'a',score:90}]);
});

test('fields, unique, count and group remain typed', () => {
  const input = { type:'records', value:[{provider:'a',kind:'x'},{provider:'a',kind:'y'}] };
  assert.deepEqual(run('fields', input, ['provider']).value, [{provider:'a'},{provider:'a'}]);
  assert.equal(run('count', input).value, 2);
});

test('grep is an internal text transform', () => {
  assert.equal(run('grep', { type:'text', value:'ok\nmalicious\nclean' }, ['malicious']).value, 'malicious');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/shell-transforms-v9.test.mjs`

Expected: FAIL because transform module is missing.

- [ ] **Step 3: Implement all approved transforms**

Use a small comparison parser for `where` supporting `==`, `!=`, `<`, `<=`, `>`, `>=`, with field lookup restricted to dotted object paths composed of `/^[A-Za-z0-9_.-]{1,128}$/`. `jsonpath` supports read-only dotted paths plus numeric array indices only; do not embed a general JSONPath evaluator.

```js
export const TRANSFORM_HANDLERS = Object.freeze({
  where: runWhere,
  select: runFields,
  fields: runFields,
  sort: runSort,
  unique: runUnique,
  count: runCount,
  group: runGroup,
  pluck: runPluck,
  head: runHead,
  tail: runTail,
  jsonpath: runJsonPath,
  grep: runGrep,
  wc: runWc,
  uniq: runTextUniq,
});
```

Every transform validates accepted input types and record/text limits and throws `ShellCommandError` with `INVALID_ARGUMENT`, `PIPELINE_TYPE_MISMATCH`, or `OUTPUT_LIMIT`.

- [ ] **Step 4: Run focused tests**

Run: `node --test test/shell-transforms-v9.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/shell-core/transforms.js test/shell-transforms-v9.test.mjs
git commit -m "feat(shell): add bounded pipeline transforms"
```

---

### Task 4: Shared pipeline runtime and cancellation

**Files:**
- Create: `app/shell-core/runtime.js`
- Test: `test/shell-pipeline-v9.test.mjs`
- Modify: `test/shell-runtime.test.mjs`

**Interfaces:**
- Consumes: registry, parser AST, `TRANSFORM_HANDLERS`, `PIPELINE_LIMITS`.
- Produces: `executePipeline(ast, { registry, executor, context, signal, limits = PIPELINE_LIMITS })`.
- Executor contract: `executor.execute({ descriptor, args, input, context, signal }) -> Promise<{type,value}>`.
- Runtime resolves the descriptor, validates surface/auth/capabilities/input type, executes, bounds output, and passes it to the next stage.

- [ ] **Step 1: Write failing runtime tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { executePipeline } from '../app/shell-core/runtime.js';
import { parseShellLine } from '../app/shell-core/parser.js';

// Build a tiny test registry with source -> records and head -> transform.
test('pipeline is sequential and passes typed output', async () => {
  const output = await executePipeline(parseShellLine('source | head 1'), { registry, executor, context:{ surface:'web', authenticated:true, capabilities:new Set() } });
  assert.deepEqual(output.value, [{id:1}]);
});

test('pipeline stops after first failure', async () => {
  const calls = [];
  const executor = { execute: async ({ descriptor }) => { calls.push(descriptor.id); if (descriptor.id === 'boom') throw shellError('UPSTREAM_FAILED','boom'); return {type:'text',value:'x'}; } };
  await assert.rejects(() => executePipeline(parseShellLine('ok | boom | never'), { registry, executor, context:{surface:'web',authenticated:true,capabilities:new Set()} }));
  assert.deepEqual(calls, ['ok','boom']);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/shell-pipeline-v9.test.mjs`

Expected: FAIL because runtime module is missing.

- [ ] **Step 3: Implement runtime**

```js
export async function executePipeline(ast, { registry, executor, context, signal, limits = PIPELINE_LIMITS }) {
  let current = { type:'void', value:null };
  for (let index = 0; index < ast.stages.length; index += 1) {
    if (signal?.aborted) throw shellError('OPERATION_ABORTED', 'operation aborted', { stage:index });
    const resolved = registry.resolve(ast.stages[index].tokens, context.surface);
    validateInvocation(resolved, current, context, index);
    current = resolved.descriptor.handler.startsWith('transform:')
      ? await runTransform(resolved, current, limits)
      : await executor.execute({ descriptor:resolved.descriptor, args:resolved.args, input:current, context, signal });
    assertTypedValue(current);
    assertBoundedValue(current.value, limits);
  }
  return current;
}
```

Map thrown `AbortError` to `OPERATION_ABORTED`; preserve existing `ShellCommandError`; wrap unexpected executor failures as `UPSTREAM_FAILED` with bounded context only.

- [ ] **Step 4: Run focused and existing runtime tests**

Run: `node --test test/shell-pipeline-v9.test.mjs test/shell-runtime.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/shell-core/runtime.js test/shell-pipeline-v9.test.mjs test/shell-runtime.test.mjs
git commit -m "feat(shell): add typed pipeline runtime"
```

---

### Task 5: Declarative absolute-max catalog, help, discovery, and completion

**Files:**
- Create: `app/shell-core/catalog.js`
- Create: `app/shell-core/help.js`
- Create: `app/shell-core/completion.js`
- Test: `test/shell-catalog-v9.test.mjs`

**Interfaces:**
- Produces: `COMMAND_DESCRIPTORS`, `COMMAND_REGISTRY`.
- Produces: `renderCommandIndex(registry, { surface })`, `renderManual(registry, topic, { surface })`, `searchCommands(registry, term, { surface })`, `whichCommand(registry, token, { surface })`, `listAliases(registry, { surface })`.
- Produces: `completeShellInput(input, { surface, providerNames = [], observableTypes = [], caseTypes = [] })`.
- Unavailable commands are omitted from normal completion and shown by `help`/`man` with `[CLI ONLY]` or `[WEB ONLY]` markers.

- [ ] **Step 1: Write failing catalog/discovery tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { renderCommandIndex, searchCommands } from '../app/shell-core/help.js';
import { completeShellInput } from '../app/shell-core/completion.js';

test('catalog exposes approved namespaces and legacy aliases', () => {
  for (const id of ['system.health','intel.enrich','provider.list','provider.run','result.evidence','case.new','report.compile','transform.where']) {
    assert.ok(COMMAND_REGISTRY.get(id), `missing ${id}`);
  }
  assert.equal(COMMAND_REGISTRY.resolve(['scan','example.org'], 'web').descriptor.id, 'intel.enrich');
});

test('help marks surface restrictions while completion omits unavailable commands', () => {
  assert.match(renderCommandIndex(COMMAND_REGISTRY, { surface:'web' }), /report compile.*CLI ONLY/i);
  assert.equal(completeShellInput('report c', { surface:'web' }).includes('compile'), false);
});

test('apropos is local registry search', () => {
  assert.ok(searchCommands(COMMAND_REGISTRY, 'provider', { surface:'web' }).some(item => item.id === 'provider.list'));
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/shell-catalog-v9.test.mjs`

Expected: FAIL because catalog/help/completion modules are missing.

- [ ] **Step 3: Implement the catalog**

Register the full approved taxonomy. Handler keys are explicit strings such as `system-health`, `intel-enrich`, `provider-run`, `result-evidence`, `case-new`, `report-compile`, and `transform:where`.

Direct provider front doors are descriptors, not raw aliases, so provider identity is fixed metadata:

```js
{
  id:'provider.vt', tokens:['vt'], aliases:[], namespace:'provider', surfaces:['web','cli'], auth:'required',
  inputTypes:['void'], outputType:'enrichment', egressClass:'provider', sideEffect:'none', capabilities:['provider-read'],
  handler:'provider-run', fixedArgs:['virustotal'], usage:'vt <observable>', summary:'run VirusTotal through bounded provider execution',
}
```

Add equivalent fixed front doors for `gn -> greynoise`, `otx`, `urlscan`, `threatfox`, `malwarebazaar`, `rdap`, `epss`, `kev -> cisa-kev`, `nvd`, `censys`, and preserve the specialized existing `shodan` command family.

Register every legacy one-word view/filter command as a canonical descriptor or explicit alias pointing to the relevant result handler.

- [ ] **Step 4: Run catalog plus legacy completion tests**

Run: `node --test test/shell-catalog-v9.test.mjs test/shell.test.mjs test/shodan-terminal.test.mjs test/user-scanner-terminal.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/shell-core/catalog.js app/shell-core/help.js app/shell-core/completion.js test/shell-catalog-v9.test.mjs
git commit -m "feat(shell): add declarative absolute-max command catalog"
```

---

### Task 6: Browser executor and compatibility facade

**Files:**
- Create: `app/shell-browser-executor.js`
- Modify: `app/shell.js`
- Test: `test/shell-browser-executor-v9.test.mjs`
- Modify: `test/shell.test.mjs`

**Interfaces:**
- Produces: `createBrowserShellExecutor({ client, session, cases, downloads, clipboard, audio, now, monotonicNow, version })`.
- Executor exposes `execute({ descriptor, args, input, context, signal })` plus `state()` returning `{ profile, currentResult, mountedAt }`.
- `app/shell.js` re-exports `COMMANDS`, `parseCommand`, `interpretCommand`, `completeCommand`, and `createHistory` for compatibility, but derives command metadata/completion from the shared catalog.

- [ ] **Step 1: Write failing browser executor tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserShellExecutor } from '../app/shell-browser-executor.js';

test('browser executor stores enrichment result and returns a typed value', async () => {
  const result = { requestId:'r1', indicator:'8.8.8.8', type:'ip', profile:'standard', status:'ok', evidence:[], failures:[], relationships:[], correlation:{}, decision:{}, coverage:{}, guidance:{}, evidenceGraph:{} };
  const executor = createBrowserShellExecutor({ client:{ enrich:async()=>result }, session:fakeSession(), cases:null, downloads:fakeDownloads(), clipboard:fakeClipboard(), audio:fakeAudio(), now:()=>new Date(0), monotonicNow:()=>0, version:'2.0.0' });
  const output = await executor.execute({ descriptor:{handler:'intel-enrich',fixedArgs:[]}, args:['8.8.8.8'], input:{type:'void',value:null}, context:{profile:'standard'}, signal:new AbortController().signal });
  assert.equal(output.type, 'enrichment');
  assert.equal(executor.state().currentResult.requestId, 'r1');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/shell-browser-executor-v9.test.mjs`

Expected: FAIL because browser executor module is missing.

- [ ] **Step 3: Implement browser handler map and compatibility wrappers**

Implement handler keys for existing browser behavior first: login/auth, health/status/meta, enrich/profile/batch, User Scanner, Shodan, current views/filters, JSON/STIX/copy, sound/volume/theme/pwd/hostname/date/echo, reboot/disconnect.

`app/shell.js` should become a thin compatibility facade; `interpretCommand()` may map a one-stage shared invocation to the legacy action object so old tests and case migration can remain green during this task. Do not keep a second handwritten command taxonomy.

- [ ] **Step 4: Run all current shell-facing tests**

Run: `node --test test/shell-browser-executor-v9.test.mjs test/shell.test.mjs test/shell-api.test.mjs test/shell-runtime.test.mjs test/unix-shell-surface.test.mjs test/shodan-terminal.test.mjs test/user-scanner-terminal.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/shell-browser-executor.js app/shell.js test/shell-browser-executor-v9.test.mjs test/shell.test.mjs
git commit -m "refactor(shell): route browser commands through shared executor"
```

---

### Task 7: Named-provider gateway operation and browser client

**Files:**
- Modify: `src/app.js`
- Create: `api/para11ax/provider.js`
- Modify: `app/api-client.js`
- Test: `test/provider-command-api-v9.test.mjs`
- Modify: `test/shell-api.test.mjs`

**Interfaces:**
- Produces server handler: `app.handleProvider(request)`.
- Request: `POST /api/para11ax/provider` body `{ provider:string, indicator:string, type?:string }`.
- Response: normal Evidence v2 enrichment envelope, restricted to exactly one selected provider.
- Produces browser client: `client.provider(provider, indicator, signal)`.

- [ ] **Step 1: Write failing API tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';

test('named provider run selects exactly one registered provider', async () => {
  const calls = [];
  const adapter = fakeProvider({ name:'unit-provider', types:['ip'], run:async input => { calls.push(input); return fakeProviderSuccess(); } });
  const app = createApp({ adapters:[adapter], env:{ PARA11AX_TOKEN:'t' } });
  const response = await app.handleProvider(fakeJsonRequest({ provider:'unit-provider', indicator:'8.8.8.8' }, 't'));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.evidence.map(item => item.provider), ['unit-provider']);
  assert.equal(calls.length, 1);
});

test('provider run rejects unknown, unsupported, inactive, and unconfigured providers before egress', async () => {
  // assert 400/409-style bounded error codes and zero adapter run calls for each case
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/provider-command-api-v9.test.mjs`

Expected: FAIL because `handleProvider` does not exist.

- [ ] **Step 3: Implement provider endpoint through existing orchestration**

Add an internal helper in `src/app.js`:

```js
async function enrichNamedProvider(classified, providerName) {
  const adapter = registry.get(providerName);
  if (!adapter || adapter.active === false) throw Object.assign(new Error('provider_unavailable'), { code:'provider_unavailable' });
  if (!adapter.types.includes(classified.type)) throw Object.assign(new Error('provider_type_unsupported'), { code:'provider_type_unsupported' });
  if (!configured(providerName)) throw Object.assign(new Error('provider_unconfigured'), { code:'provider_unconfigured' });
  return enrich({
    indicator: classified.value,
    type: classified.type,
    providerNames: [providerName],
    registry,
    cache,
    requestId: randomUUID(),
    now,
    nowMs,
    gatewayVersion,
    profile: 'standard',
    deadlineMs: REQUEST_DEADLINE_MS,
    callLimit: 2,
    circuitBreaker: breaker,
    telemetry: events,
    context: { fetchImpl, env },
  });
}
```

`handleProvider()` must use the existing auth/content-type/body-size gates, allow only `provider`, `indicator`, `type`, validate provider name with `/^[a-z0-9-]{1,64}$/`, classify the indicator before lookup, and map expected provider-policy errors to stable HTTP error codes. It never accepts host, URL, method, credential, timeout, parser, response-size, or raw request parameters.

Add `api/para11ax/provider.js` as the same thin Vercel adapter pattern used by `enrich.js`.

Add `client.provider()` to `app/api-client.js`, reusing `validEnvelope` and same-origin `request()`.

- [ ] **Step 4: Run API/security regression tests**

Run: `node --test test/provider-command-api-v9.test.mjs test/shell-api.test.mjs test/provider-contract.test.mjs test/egress.test.mjs`

If an exact existing egress-test filename differs, use `ls test/*egress*` and run the matching existing file in addition to the two v9 tests; do not omit the egress regression.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.js api/para11ax/provider.js app/api-client.js test/provider-command-api-v9.test.mjs test/shell-api.test.mjs
git commit -m "feat(shell): add bounded named-provider gateway operation"
```

---

### Task 8: Provider/system/intelligence command families in the browser

**Files:**
- Modify: `app/shell-browser-executor.js`
- Modify: `app/shell-core/catalog.js`
- Test: `test/shell-browser-executor-v9.test.mjs`
- Create: `test/shell-provider-terminal-v9.test.mjs`

**Interfaces:**
- `provider list/show/coverage` use cached/public gateway metadata from `client.meta()`.
- `provider status` uses authenticated `client.health()`.
- `provider run` and direct provider front doors call `client.provider()`.
- `provider probe` is CLI-only and returns `SURFACE_UNAVAILABLE` on WebUI.
- `intel ip|domain|url|hash|cve|asn|cidr|certificate` validates expected type locally and calls normal `client.enrich()`.
- `normalize`, `type`, `validate` are pure/local operations using `app/observable-input.js` or an extracted browser-safe helper from that module.

- [ ] **Step 1: Add failing browser command tests**

```js
test('vt is a fixed VirusTotal front door', async () => {
  const calls = [];
  const client = fakeClient({ provider: async (provider, indicator) => { calls.push([provider, indicator]); return fakeEnvelope(indicator); } });
  const output = await runBrowserLine('vt example.com', { client, authenticated:true });
  assert.deepEqual(calls, [['virustotal','example.com']]);
  assert.equal(output.type, 'enrichment');
});

test('typed intel front door rejects mismatched observable before egress', async () => {
  const client = fakeClient({ enrich: async () => { throw new Error('must not execute'); } });
  await assert.rejects(() => runBrowserLine('intel ip example.com', { client, authenticated:true }), error => error.code === 'INVALID_ARGUMENT');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/shell-provider-terminal-v9.test.mjs test/shell-browser-executor-v9.test.mjs`

Expected: FAIL for unimplemented handlers.

- [ ] **Step 3: Implement handlers**

Use descriptor `fixedArgs` before user args for fixed provider front doors. Provider metadata output must omit credential values and include only public fields already surfaced by `/meta`/`health`.

For direct provider execution, set `currentResult` to the returned enrichment envelope exactly as normal enrichment does so subsequent `result ...` commands and pipelines work identically.

- [ ] **Step 4: Run provider/browser suites**

Run: `node --test test/shell-provider-terminal-v9.test.mjs test/shell-browser-executor-v9.test.mjs test/shodan-terminal.test.mjs test/shell-api.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/shell-browser-executor.js app/shell-core/catalog.js test/shell-browser-executor-v9.test.mjs test/shell-provider-terminal-v9.test.mjs
git commit -m "feat(shell): expose provider and intel command families"
```

---

### Task 9: Result/evidence projections and pipeline-native outputs

**Files:**
- Modify: `app/shell-browser-executor.js`
- Modify: `app/shell-core/catalog.js`
- Create: `test/shell-result-v9.test.mjs`
- Modify: `app/view-model.js` only if a reusable pure projection is currently embedded in UI rendering code.

**Interfaces:**
- Result handlers return typed data instead of rendering directly.
- `result evidence -> { type:'evidence', value:currentResult.evidence }`.
- `result relationships -> { type:'relationships', value:currentResult.relationships }`.
- `result graph -> { type:'graph', value:currentResult.evidenceGraph }`.
- `result guidance -> { type:'guidance', value:currentResult.guidance }`.
- `result decision`, `attacks`, `hunts`, `telemetry`, `freshness`, `coverage`, `failures`, `references`, `providers`, `contradictions`, `corroboration`, `request`, `raw` return stable typed values derived only from `currentResult`.

- [ ] **Step 1: Write failing projection/pipeline tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';

test('result evidence can feed structured transforms', async () => {
  const output = await runBrowserLine('result evidence | fields provider | unique', { currentResult: fakeRichEnvelope(), authenticated:true });
  assert.equal(output.type, 'records');
  assert.deepEqual(output.value, [{provider:'virustotal'},{provider:'greynoise'}]);
});

test('graph and guidance use the authoritative enrichment envelope', async () => {
  const envelope = fakeRichEnvelope();
  assert.strictEqual((await runBrowserLine('result graph', { currentResult:envelope, authenticated:true })).value, envelope.evidenceGraph);
  assert.strictEqual((await runBrowserLine('result guidance', { currentResult:envelope, authenticated:true })).value, envelope.guidance);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/shell-result-v9.test.mjs`

Expected: FAIL because result handlers still render/return legacy actions.

- [ ] **Step 3: Implement typed result handlers**

Do not recompute evidence graph or guidance in the browser; `src/core/orchestrator.js` already includes `evidenceGraph` and `guidance` on successful/partial envelopes. Missing fields return a bounded empty typed value or `CAPABILITY_UNAVAILABLE`, depending on whether the field is optional or semantically required.

Preserve legacy aliases (`evidence`, `cor`, `rel`, `coverage`, `raw`, `last`, etc.) in the catalog and route them to these same typed handlers.

- [ ] **Step 4: Run result and existing UI view tests**

Run: `node --test test/shell-result-v9.test.mjs test/shell.test.mjs test/unix-shell-surface.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/shell-browser-executor.js app/shell-core/catalog.js app/view-model.js test/shell-result-v9.test.mjs
git commit -m "feat(shell): make result commands pipeline-native"
```

---

### Task 10: Integrate case workspace into the shared executor

**Files:**
- Modify: `app/case-shell-bridge.js`
- Modify: `app/shell-browser-executor.js`
- Modify: `app/shell-ui.js`
- Create: `test/shell-case-v9.test.mjs`
- Modify: `test/case-shell-wiring-v8.test.mjs`
- Modify: `test/shell-case-grammar-v8.test.js`
- Modify: `test/shell-case-runtime-v8.test.js`

**Interfaces:**
- Browser executor receives a case adapter implementing `handle(action, { currentResult, profile })`, matching the existing `createCaseRuntime()` contract.
- Case handler keys map shared descriptors to the existing action objects expected by `createCaseRuntime`: `case-new`, `case-open`, `case-close`, `case-list`, `case-show`, `case-refresh`, `case-export`, `case-import`, `case-find`, `case-pin`, `case-unpin`, `case-note`, `case-diff`.
- `case pins`, `notes`, `timeline`, and `graph` are read-only projections over the active case returned by `case-show`; no duplicate storage is introduced.

- [ ] **Step 1: Write failing unified-case tests**

```js
test('case command executes through browser executor rather than submit interception', async () => {
  const calls = [];
  const cases = { handle: async (action, state) => { calls.push([action, state]); return { case:{ id:'c1', title:'A' } }; } };
  await runBrowserLine('case new A', { cases, authenticated:true });
  assert.equal(calls[0][0].action, 'case-new');
});
```

Add a DOM wiring assertion that `case-shell-bridge.js` no longer installs a capturing `submit` handler that preempts `.shell-prompt`.

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/shell-case-v9.test.mjs test/case-shell-wiring-v8.test.mjs test/shell-case-grammar-v8.test.js test/shell-case-runtime-v8.test.js`

Expected: FAIL until interception is removed.

- [ ] **Step 3: Refactor bridge into an adapter**

Keep IndexedDB repository/runtime creation, import-file picker, case download helper, and enrichment capture observer in `case-shell-bridge.js`, but export the initialized case adapter to shell bootstrap rather than intercepting form submission.

Route all case descriptors through `shell-browser-executor.js`. `shell-ui.js` owns the only shell submit path.

- [ ] **Step 4: Run case and shell tests**

Run: `node --test test/shell-case-v9.test.mjs test/case-shell-wiring-v8.test.mjs test/shell-case-grammar-v8.test.js test/shell-case-runtime-v8.test.js test/shell.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/case-shell-bridge.js app/shell-browser-executor.js app/shell-ui.js test/shell-case-v9.test.mjs test/case-shell-wiring-v8.test.mjs test/shell-case-grammar-v8.test.js test/shell-case-runtime-v8.test.js
git commit -m "refactor(shell): integrate case workspace into shared runtime"
```

---

### Task 11: WebUI submits shared pipelines and renders typed final values

**Files:**
- Modify: `app/shell-ui.js`
- Modify: `app/shell.js`
- Test: `test/unix-shell-surface.test.mjs`
- Test: `test/shell-pipeline-v9.test.mjs`
- Modify: `test/shell.test.mjs`

**Interfaces:**
- `mountAnalystShell()` parses with `parseShellLine()`, executes with `executePipeline()`, and renders only the final typed value.
- UI renderer function: `renderShellValue({ type, value }, { appendLine, appendPre, appendJson, renderers... })`.
- `Ctrl+C` aborts the active pipeline controller.
- `Tab` uses `completeShellInput()`.
- Help/manual/discovery are normal command outputs from shared handlers.

- [ ] **Step 1: Add failing UI pipeline tests**

```js
test('web shell accepts safe native pipeline syntax', async () => {
  // mount shell with fake client, submit: enrich 8.8.8.8 | result evidence | head 1
  // assert one enrichment call and only one evidence record in final rendered output
});

test('web shell rejects host-shell constructs before any executor call', async () => {
  // submit: echo x && health
  // assert INVALID_SYNTAX rendering and zero health calls
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/unix-shell-surface.test.mjs test/shell-pipeline-v9.test.mjs`

Expected: FAIL because UI still calls `interpretCommand()` one command at a time.

- [ ] **Step 3: Replace UI dispatch with the shared runtime**

Remove the large command-specific `executeAction()`/`runGateway()` knowledge from `shell-ui.js` after equivalent browser-executor handlers exist. Retain UI-only concerns: DOM, scrollback, status bar, prompt, history navigation, audio/glitch effects through executor callbacks, rendering, download UI, and cancellation.

Keep `app/shell.js` as a thin compatibility/public facade, not a second dispatcher.

- [ ] **Step 4: Run all WebUI shell regressions**

Run: `node --test test/shell.test.mjs test/shell-api.test.mjs test/shell-runtime.test.mjs test/unix-shell-surface.test.mjs test/shodan-terminal.test.mjs test/user-scanner-terminal.test.mjs test/shell-case-v9.test.mjs test/shell-result-v9.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/shell-ui.js app/shell.js test/unix-shell-surface.test.mjs test/shell-pipeline-v9.test.mjs test/shell.test.mjs
git commit -m "refactor(shell): execute shared pipelines in WebUI"
```

---

### Task 12: Node executor and CLI migration

**Files:**
- Create: `src/control/shell-node-executor.js`
- Modify: `bin/para11ax.mjs`
- Create: `test/node-cli-shell-v9.test.mjs`
- Modify existing control/report tests if imports move.

**Interfaces:**
- Produces: `createNodeShellExecutor({ env, stdout, stderr, cwd, now })` implementing the same executor contract as the browser executor.
- Node handlers delegate to existing functions from `src/control/doctor.js`, `src/control/commands.js`, `src/control/provider-probe.js`, and `src/control/report-commands.js`.
- `bin/para11ax.mjs` uses `parseShellTokens(process.argv.slice(2))` and `executePipeline()`.
- Internal PARA11AX pipelines on a host shell require literal `|` to reach argv, for example `para11ax provider list \| where costClass == quota`; unescaped host-shell `|` remains the host shell's operator and is not claimed by PARA11AX.

- [ ] **Step 1: Write failing CLI tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

test('legacy Node commands remain available through shared catalog', () => {
  for (const args of [
    ['doctor'], ['providers','list'], ['providers','env-template'], ['maltego','check'], ['release','verify'],
  ]) {
    const result = spawnSync(process.execPath, ['bin/para11ax.mjs', ...args], { encoding:'utf8', env:process.env });
    assert.notEqual(result.status, 2, `${args.join(' ')} was treated as unknown`);
  }
});

test('CLI can execute an internal pipeline when literal pipe reaches argv', () => {
  const result = spawnSync(process.execPath, ['bin/para11ax.mjs','provider','list','|','head','1'], { encoding:'utf8', env:process.env });
  assert.equal(result.status, 0);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/node-cli-shell-v9.test.mjs`

Expected: FAIL because Node CLI is still its own if-chain and has no shared pipeline runtime.

- [ ] **Step 3: Implement Node handler map and migrate CLI**

Node descriptor mappings:

- `system doctor` and legacy `doctor` -> `collectDoctorState()`.
- `provider list`/legacy `providers list` -> provider manifest records, not direct stdout side effects inside shared handler.
- `provider env-template`/legacy `providers env-template` -> env-template text.
- `provider probe`/legacy `providers probe` -> `probeProviders()`.
- `maltego check` -> `runMaltegoCheck()`.
- `release verify` -> `runReleaseVerify()`.
- `setup` and `repair` -> `runSetup()` variants.
- `report compile` and `report diff` -> existing `runReportCompile()`/`runReportDiff()` initially; then expose typed return values around them without weakening their filesystem checks.
- pure transforms/discovery use shared handlers and require no Node executor branch.

Where existing control functions only write to stdout, add small return-value variants in their own modules while preserving current exported wrapper behavior; do not scrape stdout to reconstruct typed values.

- [ ] **Step 4: Run Node CLI, report, provider, and tooling tests**

Run: `node --test test/node-cli-shell-v9.test.mjs test/provider-probe.test.mjs test/report*.test.mjs`

Then run: `npm run verify:tooling`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/control/shell-node-executor.js bin/para11ax.mjs src/control/commands.js src/control/provider-probe.js src/control/report-commands.js test/node-cli-shell-v9.test.mjs
git commit -m "refactor(shell): unify Node CLI with shared command fabric"
```

---

### Task 13: Reports, exports, and surface-gated artifact commands

**Files:**
- Modify: `app/shell-core/catalog.js`
- Modify: `app/shell-browser-executor.js`
- Modify: `src/control/shell-node-executor.js`
- Create: `test/shell-report-v9.test.mjs`
- Modify report tests as needed.

**Interfaces:**
- Node supports `report compile`, `diff`, `quality`, `text`, `html`, `pdf`, `csv`, `kql`, `navigator`, `stix`, `evidence`, `manifest` using existing report model/compiler/renderers and explicit filesystem capability only for compile/save operations.
- Web supports read-only/in-memory report projections that can be produced from the current result without importing Node-only filesystem/Buffer code; unsupported artifact commands return `SURFACE_UNAVAILABLE` and are omitted from Web completion.
- Existing `json`, `stix`, `copy`, and browser download behavior remains compatible.

- [ ] **Step 1: Write failing surface-gate tests**

```js
test('web completion omits filesystem-only report compile', () => {
  assert.equal(completeShellInput('report c', { surface:'web' }).includes('compile'), false);
});

test('web execution of report compile fails with SURFACE_UNAVAILABLE', async () => {
  await assert.rejects(() => runBrowserLine('report compile snapshot.json --out out'), error => error.code === 'SURFACE_UNAVAILABLE');
});

test('Node report text returns artifact text without requiring filesystem output', async () => {
  const output = await runNodeTokens(['report','text','fixture.json']);
  assert.equal(output.type, 'artifact');
  assert.equal(output.value.mediaType, 'text/plain');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/shell-report-v9.test.mjs`

Expected: FAIL for unimplemented report handlers.

- [ ] **Step 3: Implement report/export handlers**

Use existing `buildReportModel`, quality checks, renderers, compiler presets, and STIX generation. Keep filesystem validation in the existing report compiler. For browser-side commands, reuse already available result/report text and gateway STIX capabilities; do not port Node-only PDF/filesystem code solely to make a command appear available.

- [ ] **Step 4: Run report and export tests**

Run: `node --test test/shell-report-v9.test.mjs test/report*.test.mjs test/shell.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/shell-core/catalog.js app/shell-browser-executor.js src/control/shell-node-executor.js test/shell-report-v9.test.mjs
git commit -m "feat(shell): add surface-gated report command family"
```

---

### Task 14: Security, compatibility, and registry-invariant hardening

**Files:**
- Create: `test/shell-security-v9.test.mjs`
- Modify: `test/shell.test.mjs`
- Modify: `test/unix-shell-surface.test.mjs`
- Modify: `test/shell-catalog-v9.test.mjs`
- Modify implementation files only for failures discovered by these tests.

**Interfaces:**
- No new runtime interface; this task freezes the trust boundary and compatibility contract.

- [ ] **Step 1: Add adversarial tests**

Test every forbidden construct in Web and shared parser paths:

```js
const forbidden = [
  'echo `id`', 'echo $(id)', 'help && health', 'help || health', 'help; health',
  'echo x > /tmp/x', 'echo x >> /tmp/x', 'cat < /etc/passwd',
  'provider run virustotal https://evil.example --host evil.example',
];
```

Assert:
- parser or validator rejects before executor/network execution;
- zero fake fetch/provider calls occur;
- errors contain stable codes but no supplied secret values;
- `login super-secret-token` remains excluded from history and the error object/string does not contain the token;
- registry contains none of `sudo`, `ssh`, `curl`, `wget`, `eval`, `exec`, `source`;
- direct provider descriptors have fixed provider names and no host/method/credential flags;
- duplicate command/alias metadata fails registry construction;
- pipeline stage/record/byte limits produce `OUTPUT_LIMIT`.

- [ ] **Step 2: Run adversarial tests and expect any migration regressions to fail**

Run: `node --test test/shell-security-v9.test.mjs test/shell-catalog-v9.test.mjs`

Expected before fixes: at least any uncovered migration/security regressions fail; if everything already passes, record the clean run and continue.

- [ ] **Step 3: Fix only demonstrated failures**

Do not add new features in this task. Tighten parser, descriptor metadata, context redaction, size checks, or executor validation only where tests identify a gap.

- [ ] **Step 4: Run full automated verification**

Run:

```bash
npm test
npm run check
npm run verify:tooling
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/shell-core app/shell.js app/shell-ui.js app/shell-browser-executor.js app/api-client.js src/app.js src/control bin/para11ax.mjs api/para11ax/provider.js test
git commit -m "test(shell): harden command fabric security and compatibility"
```

---

### Task 15: Command documentation and final acceptance verification

**Files:**
- Create: `docs/SHELL.md`
- Modify: `docs/SHODAN-SHELL.md`
- Modify: `README.md` only where the public command-surface summary is stale.
- Modify: `docs/superpowers/specs/2026-08-30-shell-command-maxxing-design.md` only if implementation reveals a factual discrepancy; do not silently change approved requirements.

**Interfaces:**
- Documentation must match the live registry rather than list unsupported commands.

- [ ] **Step 1: Add a documentation parity test**

Add to `test/shell-catalog-v9.test.mjs` a check that every public canonical namespace is represented in `docs/SHELL.md`, and that all documented direct provider aliases exist in `COMMAND_REGISTRY`.

```js
for (const namespace of ['discovery','session','system','intel','provider','result','case','report','export','terminal']) {
  assert.match(shellDocs, new RegExp(`\\b${namespace}\\b`, 'i'));
}
```

- [ ] **Step 2: Run the parity test and verify failure**

Run: `node --test test/shell-catalog-v9.test.mjs`

Expected: FAIL because `docs/SHELL.md` does not yet exist.

- [ ] **Step 3: Write final shell documentation**

Document:
- grammar and quoting;
- internal pipe behavior and the host-shell escaping caveat for Node CLI;
- discovery commands;
- all namespaces and direct provider front doors;
- type/pipeline examples;
- surface markers;
- provider cost-class visibility;
- report/export differences between Web and Node;
- security invariants and explicitly unsupported host-shell constructs;
- examples such as:

```text
enrich 8.8.8.8 | result evidence | where observation.verdict != benign | fields provider observation.verdict
provider list | where costClass == quota | fields name types
vt example.com | result guidance
result relationships | group type | count
```

Update `docs/SHODAN-SHELL.md` to explain that Shodan remains its specialized bounded operator family inside the larger command fabric.

- [ ] **Step 4: Run final verification and inspect diff**

Run:

```bash
npm test
npm run check
npm run verify:tooling
git diff --check
git status --short
```

Expected: all verification commands exit 0; `git diff --check` prints nothing; status contains only intended changes before commit.

- [ ] **Step 5: Commit**

```bash
git add docs/SHELL.md docs/SHODAN-SHELL.md README.md test/shell-catalog-v9.test.mjs
git commit -m "docs(shell): document unified command fabric"
```

---

## Final Acceptance Checklist

- [ ] `COMMAND_REGISTRY` is the only command taxonomy source.
- [ ] WebUI and Node CLI both use the shared parser/runtime.
- [ ] Existing WebUI commands/aliases remain behaviorally compatible.
- [ ] Existing Node administrative/report commands remain available.
- [ ] Direct provider front doors cannot override provider policy.
- [ ] Named-provider gateway execution uses one registered provider through the existing orchestrator.
- [ ] Evidence graph/guidance are read from the authoritative enrichment envelope.
- [ ] Case shell no longer runs a second submit/dispatch path.
- [ ] Typed and text pipelines are both supported and bounded.
- [ ] Completion/help/man/apropos/which derive from the same registry.
- [ ] Web/CLI surface restrictions are deterministic and visible.
- [ ] Backticks, `$()`, `&&`, `||`, semicolon chaining, and redirects are rejected before execution.
- [ ] No provider secret value is returned by shell metadata/errors.
- [ ] `npm test`, `npm run check`, and `npm run verify:tooling` all pass.
- [ ] No generated implementation commit bypasses branch protection; implementation ships through a PR with required checks.
