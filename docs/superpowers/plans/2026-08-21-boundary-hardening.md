# Final Boundary Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four reproduced production/boundedness defects, add one small aggregate cache-byte ceiling if it remains dependency-free and deterministic, then prove exact CI and production parity before stopping.

**Architecture:** Preserve the existing v2 architecture and API/evidence contracts. Make narrow corrections at the existing central boundaries: streamed egress reads, production health authentication, batch reservation accounting, Retry-After parsing, and optionally cache retention accounting. No provider, schema, endpoint, Maltego, STIX, or workflow expansion is allowed unless a newly reproduced defect requires it.

**Tech Stack:** Node.js 24 ESM with built-in `node:test`, zero runtime npm dependencies, PowerShell 5.1+ deployment scripts, Python Maltego tests, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-21-boundary-hardening-design.md`

## Global Constraints

- Personal, read-only PARA11AX gateway.
- No submission, detonation, scanning, blocking, takedown, remediation, write-back, arbitrary egress, arbitrary provider selection, or master maliciousness score.
- Provider/gateway secrets never enter Git, responses, logs, errors, telemetry, evidence, generated artifacts, or printed command output.
- Preserve the exact v2 indicator types: `ip`, `domain`, `url`, `hash`, `cve`, `attack`, `asn`, `cidr`.
- Preserve profiles `fast`, `standard`, `full` and the existing evidence schema/API surface.
- Preserve single-indicator provider concurrency <= 4, batch indicator concurrency <= 3, batch inputs <= 20, batch provider calls <= 200, request deadline 20 seconds, STIX objects <= 100.
- Runtime remains Node.js `24.x`; no new runtime npm dependency.
- Every runtime change is RED -> GREEN before merge.
- Merge only after exact PR-head `Tooling smoke` success; merge with expected head SHA.
- Production acceptance requires Vercel `READY` on the exact merged `main` SHA plus live public/protected-boundary checks.

---

### Task 1: Enforce upstream response limits while streaming

**Files:**
- Modify: `src/core/egress.js`
- Test: `test/egress-policy.test.js`
- Adjacent test: `test/chaos-provider.test.js`

**Interfaces:**
- Consumes: `safeFetch(url, policy, options)` and existing `responseView(response, text)`.
- Produces: internal `readBoundedText(response, maxBytes)` returning a UTF-8 string or throwing `provider_response_too_large` without buffering bytes beyond the configured ceiling.

- [ ] **Step 1: Add RED streaming-bound tests**

Append focused tests to `test/egress-policy.test.js` using `ReadableStream` so the body is genuinely streamed:

```js
function streamedResponse(chunks, { status = 200, headers = {}, onCancel = () => {} } = {}) {
  let index = 0;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: new Headers(headers),
    body: new ReadableStream({
      pull(controller) {
        if (index >= chunks.length) return controller.close();
        controller.enqueue(Uint8Array.from(chunks[index++]));
      },
      cancel() { onCancel(); },
    }),
  };
}

test('safeFetch stops a chunked body as soon as the response ceiling is exceeded', async () => {
  let cancelled = false;
  const chunks = [[...Buffer.from('a'.repeat(40))], [...Buffer.from('b'.repeat(40))], [...Buffer.from('c'.repeat(40))]];
  const fetchImpl = async () => streamedResponse(chunks, { onCancel: () => { cancelled = true; } });
  await assert.rejects(safeFetch('https://api.example.test/x', policy, { fetchImpl }), /provider_response_too_large/);
  assert.equal(cancelled, true);
});

test('safeFetch accepts a streamed response exactly at the byte ceiling', async () => {
  const fetchImpl = async () => streamedResponse([[...Buffer.from('x'.repeat(64))]]);
  const result = await safeFetch('https://api.example.test/x', policy, { fetchImpl });
  assert.equal((await result.text()).length, 64);
});

test('safeFetch bounds streamed UTF-8 by bytes rather than JavaScript characters', async () => {
  const bytes = Buffer.from('€'.repeat(22), 'utf8'); // 66 bytes
  const fetchImpl = async () => streamedResponse([[...bytes]]);
  await assert.rejects(safeFetch('https://api.example.test/x', policy, { fetchImpl }), /provider_response_too_large/);
});

test('safeFetch does not trust an undersized Content-Length over streamed bytes', async () => {
  const fetchImpl = async () => streamedResponse(
    [[...Buffer.from('x'.repeat(40))], [...Buffer.from('y'.repeat(40))]],
    { headers: { 'content-length': '10' } },
  );
  await assert.rejects(safeFetch('https://api.example.test/x', policy, { fetchImpl }), /provider_response_too_large/);
});
```

- [ ] **Step 2: Run the new tests and record RED**

Run:

```bash
node --test test/egress-policy.test.js
```

Expected: at least the streamed-cancellation test fails against the pre-fix implementation because `safeFetch()` calls `response.text()` and the custom response does not provide a normal buffered text path.

- [ ] **Step 3: Implement the bounded stream reader**

Add an internal helper to `src/core/egress.js` and replace the direct `response.text()` call:

```js
async function readBoundedText(response, maxBytes) {
  const reader = response?.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw Object.assign(new Error('provider_response_too_large'), { status: 502 });
    }
    return text;
  }

  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value ?? 0);
      if (total + chunk.byteLength > maxBytes) {
        try { await reader.cancel(); } catch {}
        throw Object.assign(new Error('provider_response_too_large'), { status: 502 });
      }
      chunks.push(chunk);
      total += chunk.byteLength;
    }
  } finally {
    try { reader.releaseLock?.(); } catch {}
  }

  const body = Buffer.allocUnsafe(total);
  let offset = 0;
  for (const chunk of chunks) {
    Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).copy(body, offset);
    offset += chunk.byteLength;
  }
  return body.toString('utf8');
}
```

Then use:

```js
const text = await readBoundedText(response, responseLimit);
return responseView(response, text);
```

Keep the existing early `Content-Length` check exactly as defense in depth.

- [ ] **Step 4: Run focused and adjacent egress tests to GREEN**

Run:

```bash
node --test test/egress-policy.test.js test/chaos-provider.test.js test/provider-http.test.js
```

Expected: all pass, including redirect refusal, oversize handling, sanitized transport failures, retry behavior, and streamed cancellation.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/core/egress.js test/egress-policy.test.js
git commit -m "fix: enforce provider response bounds while streaming"
```

---

### Task 2: Restore authenticated production health verification

**Files:**
- Modify: `scripts/bootstrap-vercel.ps1`
- Test: `test/production-health.test.js`
- Adjacent test: `test/finalize.test.js`

**Interfaces:**
- Consumes: `Get-StoredGatewayToken`, `$ProductionAlias`, `$TeamSlug`, Vercel CLI 58.4.4.
- Produces: `Verify-ProductionHealth -Vercel <path> -GatewayToken <plaintext-in-memory-token>`; token is used only for the application Authorization header and cleared by the caller.

- [ ] **Step 1: Add RED static contract tests**

Replace/extend the production-health assertions so the test requires both Vercel Deployment Protection handling and app bearer authentication:

```js
test('production health supplies the DPAPI-backed gateway bearer through native curl flags', () => {
  const source = productionHealthFunction(bootstrap);
  assert.match(source, /param\([^)]*\$Vercel[^)]*\$GatewayToken/is);
  assert.match(source, /\$Vercel\s+curl\s+['"]?\/api\/health['"]?/i);
  assert.match(source, /--deployment\s+\$deploymentUrl/i);
  assert.match(source, /--scope\s+\$TeamSlug/i);
  assert.match(source, /--\s+--header/i);
  assert.match(source, /Authorization:\s*Bearer\s+\$GatewayToken/i);
  assert.doesNotMatch(source, /PARA11AX_TOKEN\s*=\s*['"][^'"]+['"]/i);
  assert.match(source, /ConvertFrom-Json/i);
  assert.match(source, /gatewayAuthConfigured/);
});

test('bootstrap obtains the production health bearer from the existing DPAPI token path', () => {
  assert.match(bootstrap, /\$gatewayToken\s*=\s*Get-StoredGatewayToken/);
  assert.match(bootstrap, /Verify-ProductionHealth\s+-Vercel\s+\$Vercel\s+-GatewayToken\s+\$gatewayToken/i);
});
```

- [ ] **Step 2: Run the static tests and record RED**

Run:

```bash
node --test test/production-health.test.js test/finalize.test.js
```

Expected: production-health authentication assertions fail because the current function supplies no application Authorization header.

- [ ] **Step 3: Implement the minimal PowerShell correction**

Change `Verify-ProductionHealth` to take the token explicitly and pass native curl flags after Vercel CLI's `--` separator. Current official Vercel CLI documentation shows native curl arguments in this form: `vercel curl <path> -- --header ...`.

Use this shape:

```powershell
function Verify-ProductionHealth {
    param(
        [Parameter(Mandatory = $true)][string]$Vercel,
        [Parameter(Mandatory = $true)][string]$GatewayToken
    )

    $deploymentUrl = "https://$ProductionAlias"
    Write-Host "Verifying protected production health at $deploymentUrl/api/para11ax/health ..."

    $authorization = "Authorization: Bearer $GatewayToken"
    try {
        $raw = (& $Vercel curl '/api/para11ax/health' --deployment $deploymentUrl --scope $TeamSlug -- --header $authorization 2>&1 | Out-String).Trim()
    } finally {
        $authorization = $null
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Authenticated Vercel production health request failed with exit code $LASTEXITCODE."
    }

    try {
        $health = $raw | ConvertFrom-Json
    } catch {
        throw 'Production health check failed: authenticated Vercel request did not return valid JSON.'
    }

    if ($health.status -ne 'ok') {
        throw "Production health check failed: status '$($health.status)'."
    }
    if (-not $health.gatewayAuthConfigured) {
        throw 'Production health check failed: PARA11AX_TOKEN is not configured.'
    }

    Write-Host 'Production health verified through authenticated Vercel CLI: gateway authentication is configured.'
}
```

Do not include `$raw` in any error because an upstream/proxy response might echo request material.

At the deployment call site, keep the token alive until health verification finishes, then clear it:

```powershell
Invoke-NativeChecked $Vercel deploy --prod --yes --scope $TeamSlug
try {
    Verify-ProductionHealth -Vercel $Vercel -GatewayToken $gatewayToken
} finally {
    $gatewayToken = $null
    [GC]::Collect()
}
```

Move the earlier `$gatewayToken = $null` so it does not occur before this call.

- [ ] **Step 4: Run Node contract tests and PowerShell parser**

Run:

```bash
node --test test/production-health.test.js test/finalize.test.js
pwsh -NoProfile -Command '$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path "scripts/bootstrap-vercel.ps1"),[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){$errors|% Message;exit 1}'
```

Expected: all pass, no syntax errors, and no literal bearer value in the repository.

- [ ] **Step 5: Commit Task 2**

```bash
git add scripts/bootstrap-vercel.ps1 test/production-health.test.js
git commit -m "fix: authenticate production health verification"
```

---

### Task 3: Fail closed when batch provider-call consumption becomes unknowable

**Files:**
- Modify: `src/core/batch.js`
- Test: `test/batch-api.test.js`

**Interfaces:**
- Consumes: `runBatch({ indicators, classify, enrichOne, callLimitFor, providerCallLimit, ... })`.
- Produces: the same response shape, but a thrown `enrichOne()` consumes the entire reservation instead of refunding an unknowable amount.

- [ ] **Step 1: Add RED accounting tests at the core behavior boundary**

Add a direct `runBatch` import and a deterministic test where the first enrichment throws after reserving calls:

```js
import { runBatch } from '../src/core/batch.js';

test('batch charges the full reservation when enrichment throws and consumption is unknowable', async () => {
  const started = [];
  const result = await runBatch({
    indicators: ['192.0.2.1', '192.0.2.2'],
    classify: value => ({ type: 'ip', value }),
    callLimitFor: () => 2,
    providerCallLimit: 2,
    indicatorConcurrency: 1,
    enrichOne: async classified => {
      started.push(classified.value);
      if (classified.value === '192.0.2.1') throw new Error('unknown consumption');
      return { status: 'ok', budget: { providerCalls: 1 } };
    },
  });

  assert.deepEqual(started, ['192.0.2.1']);
  assert.equal(result.budget.providerCalls, 2);
  assert.equal(result.budget.providerCalls <= result.budget.providerCallLimit, true);
  assert.equal(result.results[0].status, 'error');
  assert.equal(result.results[0].reason, 'batch_enrichment_error');
  assert.equal(result.results[1].status, 'skipped');
  assert.equal(result.results[1].reason, 'batch_provider_call_budget_exhausted');
});
```

Also retain the existing duplicate and normal-budget tests as the reclaim/control cases.

- [ ] **Step 2: Run batch tests and record RED**

Run:

```bash
node --test test/batch-api.test.js
```

Expected: the new test fails because the thrown first enrichment currently refunds its entire reservation and allows the second item to start.

- [ ] **Step 3: Implement conservative exception accounting**

Replace the exception/accounting block in `src/core/batch.js` with an explicit unknown-consumption flag:

```js
let enrichment;
let consumptionKnown = true;
try {
  enrichment = await enrichOne(item.classified, { profile, deadlineMs: remainingMs, callLimit: reserved });
} catch {
  enrichment = null;
  consumptionKnown = false;
}

const used = consumptionKnown
  ? Math.max(0, Math.min(reserved, Number(enrichment?.budget?.providerCalls) || 0))
  : reserved;
actualCalls += used;
availableCalls += reserved - used;
```

Keep the existing `batch_enrichment_error` return and never expose the exception.

- [ ] **Step 4: Run batch and orchestrator adjacency tests**

Run:

```bash
node --test test/batch-api.test.js test/orchestrator.test.js test/app.test.js
```

Expected: all pass; normal envelopes still reclaim unused calls and duplicates still execute once.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/core/batch.js test/batch-api.test.js
git commit -m "fix: fail closed on unknown batch call consumption"
```

---

### Task 4: Parse numeric and HTTP-date Retry-After deterministically

**Files:**
- Modify: `src/core/scheduler.js`
- Test: `test/scheduler.test.js`

**Interfaces:**
- Consumes: provider failure `retryAfter` string and scheduler-injected `nowMs()`.
- Produces: internal `retryDelayMs(result, nowMs)` returning a non-negative integer millisecond delay for delta-seconds or HTTP-date.

- [ ] **Step 1: Add RED scheduler tests**

Add deterministic tests that inject the clock and sleep function:

```js
test('scheduler honors Retry-After HTTP-date relative to the injected clock', async () => {
  const base = Date.parse('2026-08-21T03:00:00Z');
  let now = base;
  const sleeps = [];
  let calls = 0;
  const output = await runScheduledProviders({
    providers: [provider('p')],
    deadlineMs: 10_000,
    nowMs: () => now,
    sleep: async ms => { sleeps.push(ms); now += ms; },
    execute: async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, failure: { reason: 'rate_limited', status: 429, retryAfter: 'Fri, 21 Aug 2026 03:00:05 GMT' } }
        : { ok: true, provider: 'p' };
    },
  });
  assert.deepEqual(sleeps, [5000]);
  assert.equal(output.results[0].attempts, 2);
});

test('scheduler does not retry when HTTP-date Retry-After exhausts the deadline', async () => {
  const base = Date.parse('2026-08-21T03:00:00Z');
  let calls = 0;
  const output = await runScheduledProviders({
    providers: [provider('p')],
    deadlineMs: 4000,
    nowMs: () => base,
    sleep: async () => { throw new Error('sleep must not run'); },
    execute: async () => {
      calls += 1;
      return { ok: false, failure: { reason: 'rate_limited', status: 429, retryAfter: 'Fri, 21 Aug 2026 03:00:05 GMT' } };
    },
  });
  assert.equal(calls, 1);
  assert.equal(output.results[0].attempts, 1);
});

test('scheduler treats expired or malformed Retry-After as zero delay', async () => {
  const base = Date.parse('2026-08-21T03:00:05Z');
  for (const retryAfter of ['Fri, 21 Aug 2026 03:00:00 GMT', 'not-a-date']) {
    const sleeps = [];
    let calls = 0;
    await runScheduledProviders({
      providers: [provider('p')],
      nowMs: () => base,
      sleep: async ms => sleeps.push(ms),
      execute: async () => (++calls === 1
        ? { ok: false, failure: { reason: 'rate_limited', retryAfter } }
        : { ok: true }),
    });
    assert.deepEqual(sleeps, []);
    assert.equal(calls, 2);
  }
});
```

Retain the existing delta-seconds test; add an assertion with `retryAfter: '2'` and injected sleep if necessary to prove 2000 ms.

- [ ] **Step 2: Run scheduler tests and record RED**

Run:

```bash
node --test test/scheduler.test.js
```

Expected: future HTTP-date does not currently sleep and the beyond-deadline case retries when it should not.

- [ ] **Step 3: Implement dual-form parsing**

Change the helper to accept the injected clock:

```js
function retryDelayMs(result, nowMs) {
  const raw = result?.failure?.retryAfter;
  if (raw == null) return 0;
  const text = String(raw).trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds * 1000) : 0;
  }
  const at = Date.parse(text);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.floor(at - nowMs()));
}
```

Then call:

```js
const delay = retryDelayMs(result, nowMs);
```

Preserve the existing `if (delay >= remainingAfter) break;` and one-retry ceiling.

- [ ] **Step 4: Run scheduler, circuit breaker and provider chaos tests**

Run:

```bash
node --test test/scheduler.test.js test/circuit-breaker.test.js test/chaos-provider.test.js
```

Expected: all pass; no new retry classes or retry count changes.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/core/scheduler.js test/scheduler.test.js
git commit -m "fix: honor HTTP-date retry-after values"
```

---

### Task 5: Add a small aggregate cache-byte ceiling

**Files:**
- Modify: `src/core/cache.js`
- Test: `test/cache-v2.test.js`
- Modify only if status output changes: `docs/API.md`

**Interfaces:**
- Consumes: existing `BoundedCache({ maxEntries, now })`, `set/get/delete/clear/stats`.
- Produces: backward-compatible `BoundedCache({ maxEntries = 500, maxBytes = 32_000_000, now })`; `stats()` additionally returns `bytes` and `maxBytes`.

**Go/no-go decision:** The current cache stores plain provider results and is only ~100 lines. A JSON-serialized byte estimate with fail-closed non-cache behavior requires no dependency, no deep traversal, and no mutation tracking. This remains within the approved conditional complexity budget, so implement it. The accounting is explicitly an insertion-time retained-payload approximation, not heap measurement.

- [ ] **Step 1: Add RED cache-byte tests**

Append:

```js
test('BoundedCache evicts LRU entries until the aggregate byte ceiling is satisfied', () => {
  const cache = new BoundedCache({ maxEntries: 10, maxBytes: 16 });
  cache.set('a', '12345678', 1000); // JSON string is 10 bytes
  cache.set('b', 'abcdefgh', 1000);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('b'), 'abcdefgh');
  assert.equal(cache.stats().bytes <= 16, true);
});

test('BoundedCache never retains one value larger than maxBytes', () => {
  const cache = new BoundedCache({ maxBytes: 8 });
  assert.equal(cache.set('x', '12345678', 1000), false);
  assert.equal(cache.stats().entries, 0);
  assert.equal(cache.stats().bytes, 0);
});

test('BoundedCache byte accounting decreases on expiry delete and clear', () => {
  let now = 0;
  const cache = new BoundedCache({ maxBytes: 100, now: () => now });
  cache.set('a', { x: '1234' }, 5);
  const retained = cache.stats().bytes;
  assert.equal(retained > 0, true);
  now = 6;
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.stats().bytes, 0);
  cache.set('b', 'ok', 100);
  cache.clear();
  assert.equal(cache.stats().bytes, 0);
});

test('BoundedCache skips values that cannot be deterministically serialized', () => {
  const cache = new BoundedCache({ maxBytes: 100 });
  assert.equal(cache.set('x', 1n, 1000), false);
  assert.equal(cache.stats().entries, 0);
});
```

Update existing exact `stats()` assertions to include `bytes` and `maxBytes`.

- [ ] **Step 2: Run cache tests and record RED**

Run:

```bash
node --test test/cache-v2.test.js
```

Expected: constructor/stat/byte-limit assertions fail before implementation.

- [ ] **Step 3: Implement insertion-time byte accounting**

Use one small estimator:

```js
function serializedBytes(value) {
  try {
    const json = JSON.stringify(value);
    return typeof json === 'string' ? Buffer.byteLength(json, 'utf8') : 0;
  } catch {
    return null;
  }
}
```

Constructor additions:

```js
constructor({ maxEntries = 500, maxBytes = 32_000_000, now = () => Date.now() } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new TypeError('maxBytes must be a positive integer');
  this.maxBytes = maxBytes;
  this.bytes = 0;
  // existing fields...
}
```

Store `{ value, expiresAt, bytes }`. Centralize removal so expiry/LRU/delete/clear all decrement `this.bytes`. In `set()`:

```js
const bytes = serializedBytes(value);
if (bytes == null || bytes > this.maxBytes) return false;
// remove prior same key if present
while (this.map.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) {
  const oldest = this.map.keys().next().value;
  this.#remove(oldest, { eviction: true });
}
this.map.set(fullKey, { value, expiresAt: this.now() + ttlMs, bytes });
this.bytes += bytes;
```

`stats()` returns the existing counters plus:

```js
bytes: this.bytes,
maxBytes: this.maxBytes,
```

Do not inspect object internals beyond `JSON.stringify`; do not attempt heap-accurate accounting.

- [ ] **Step 4: Run cache and status-adjacency tests**

Run:

```bash
node --test test/cache-v2.test.js test/meta-status.test.js test/orchestrator.test.js
```

Expected: all pass after updating only assertions that intentionally compare the complete cache stats object.

- [ ] **Step 5: Document authenticated status semantics if needed**

If `docs/API.md` enumerates exact cache fields, add `bytes` as approximate retained serialized bytes and `maxBytes` as the configured hard cache ceiling. Do not change the evidence schema/version.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/core/cache.js test/cache-v2.test.js docs/API.md
git commit -m "fix: bound cache retention by serialized bytes"
```

If `docs/API.md` did not require a change, omit it from `git add`.

---

### Task 6: Full repository QA, review, PR and exact-head merge

**Files:**
- Potentially modify only tests/docs required by failures caused by Tasks 1-5.
- Do not modify provider adapters, evidence schema, STIX, Maltego mapping, workflow lists, or API endpoints without a newly reproduced defect.

**Interfaces:**
- Consumes: hardening branch after Tasks 1-5.
- Produces: one reviewable PR whose exact head passes the full gate.

- [ ] **Step 1: Run all local repository gates**

Run:

```bash
npm run check
cd maltego && python3 -m unittest discover -s tests -v && cd ..
python3 -m compileall -q maltego
pwsh -NoProfile -Command '$files=@("scripts/bootstrap-vercel.ps1","scripts/finalize.ps1","maltego/install.ps1");foreach($file in $files){$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $file),[ref]$t,[ref]$e)|Out-Null;if($e.Count){$e|% Message;exit 1}}'
```

Expected: zero Node failures/skips/todos beyond any explicit baseline, all Maltego tests pass, compileall clean, PowerShell parser clean, ShellCheck/public audit/release manifest/repository invariants clean through `npm run check`.

- [ ] **Step 2: Review the final diff for scope and secret safety**

Verify:

```bash
git diff main...HEAD -- src/core scripts test docs
```

Reject any accidental provider additions, new API endpoints, schema changes, literal tokens, arbitrary hosts, arbitrary headers, active operations, or unrelated refactors.

- [ ] **Step 3: Create the PR**

Use title:

```text
Final boundary hardening: streaming limits, auth health, budgets and retries
```

PR body must enumerate the four confirmed defects, the bounded cache enhancement, focused RED->GREEN evidence, full-gate results, and unchanged deliberate gaps.

- [ ] **Step 4: Require exact PR-head CI**

Fetch the PR's current head SHA. Require `Tooling smoke = success` on that exact SHA and inspect failed job logs if any. Do not merge an earlier green SHA after the PR head changes.

- [ ] **Step 5: Perform a final code/security review**

Review the PR patch specifically for:

- stream cancellation and byte accounting correctness;
- error normalization/no response-content reflection;
- PowerShell bearer lifetime and no secret echo;
- batch accounting races under concurrency <= 3;
- Retry-After date math against injected time;
- cache byte counter correctness on replacement, LRU eviction, expiry, delete and clear;
- no API/evidence contract drift.

Any real defect gets a new RED test before correction and a new exact-head CI cycle.

- [ ] **Step 6: Merge only the reviewed exact head**

Squash merge with `expected_head_sha=<green reviewed PR head>`.

- [ ] **Step 7: Verify post-merge `main`**

Require final `main` combined status to include:

```text
Tooling smoke: success
Vercel: success
```

Record the merged `main` SHA.

---

### Task 7: Production parity and diminishing-returns stop

**Files:**
- No source changes unless production verification reproduces a new defect.

**Interfaces:**
- Consumes: merged `main` SHA and existing Vercel project `para11ax`.
- Produces: final acceptance evidence or a reproducible defect routed back through TDD.

- [ ] **Step 1: Verify exact production deployment SHA**

List Vercel deployments for project `prj_ojUpOTw8x8KOj9CrTs8jih1mrPjo`, team `team_hXokufMlDFuhPPT5r8jPf4aH`.

Require the newest `target: production` deployment to be `READY` and `meta.githubCommitSha` to equal the merged `main` SHA. Do not issue a duplicate manual deployment if Git integration already deployed that exact SHA.

- [ ] **Step 2: Run live public/protected-boundary smoke**

Fetch production alias endpoints:

```text
GET /api/para11ax/meta    -> 200
GET /api/para11ax/health  -> 401 without gateway bearer
GET /api/para11ax/status  -> 401 without gateway bearer
```

Require `Cache-Control: no-store` on all gateway JSON responses and the existing security headers. Do not expose or extract `PARA11AX_TOKEN` through connectors.

- [ ] **Step 3: Check production runtime errors**

Query Vercel runtime error clusters for the current production deployment/time window. Require no new runtime errors attributable to the release.

- [ ] **Step 4: Record authenticated-smoke boundary accurately**

The positive authenticated health/status/enrichment smoke is accepted only when `scripts/finalize.ps1` / `scripts/bootstrap-vercel.ps1` is run in the trusted local Windows context with the DPAPI-protected bearer. Connector-only verification must not claim this positive smoke because it cannot safely inject the app bearer.

- [ ] **Step 5: Stop at diminishing returns**

End the tranche when all mandatory fixes and the simple cache byte bound are green and production is on the exact merged SHA. Do not add more providers, TLS/JA3, ATT&CK-wide expansion, queues/databases, new endpoints, a master score, write paths, or cosmetic refactors. Only continue if a remaining item is reproducible, materially impacts security/correctness/boundedness/evidence integrity/operations, and has a proportionate fix.
