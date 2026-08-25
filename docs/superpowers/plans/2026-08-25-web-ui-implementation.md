# PARA11AX Analyst Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production `/app` PARA11AX analyst terminal that lets a trusted token holder run single-indicator enrichment, inspect Evidence v2 semantically, export JSON/STIX, and use user-controlled synthesized cyberpunk sound cues without weakening the existing gateway/API security model.

**Architecture:** Keep the existing Node/Vercel API unchanged and add a standards-only browser client under `app/`. Split browser responsibilities into a same-origin API client, a token/session state machine, pure Evidence v2 view-model functions, safe DOM renderers, a fixed Web Audio cue engine, and a thin controller. The public landing page links to `/app`; Vercel filesystem routing serves `/app` before the existing `/api/*` catch-all and branded human error fallbacks.

**Tech Stack:** HTML5, CSS, ECMAScript modules, Web Audio API, Fetch API, AbortController, Blob/URL, Clipboard API, Node.js 24 built-in test runner, existing Vercel static/functions deployment. No frontend framework, no npm runtime dependency, no external JS/CSS/audio/fonts.

**Spec:** `docs/superpowers/specs/2026-08-25-web-ui-design.md`

## Global Constraints

- Preserve compatibility names: `cti-enrichment-gateway`, `cti`, `CTI_GATEWAY_TOKEN`, `/api/*`.
- Phase 1 is trusted external use with the existing bearer; no anonymous enrichment or per-user auth claims.
- Token is memory-only: never localStorage, sessionStorage, cookies, IndexedDB, URL, DOM attributes, logs, analytics, exports, or audio derivation.
- Provider credentials remain server-side.
- Browser uses same-origin relative `/api/*` only.
- Profiles are exactly `fast`, `standard`, `full`; no provider override UI.
- Only one active enrichment request at a time.
- Evidence semantics are preserved: context ≠ reputation, claims ≠ proof, failure ≠ negative evidence, KEV ≠ EPSS ≠ CVSS.
- No UI-generated maliciousness/risk score, attribution, provider progress, or graph relationship.
- All untrusted response strings render with DOM text nodes / `textContent`; no `innerHTML` for evidence.
- No third-party JavaScript, CSS, audio, analytics, trackers, remote fonts, `eval`, or dynamic code generation.
- Web Audio cues use fixed definitions only; no token/IOC/provider-value-derived frequencies or timings; token-field typing is silent.
- Audio is supplemental and non-blocking; all workflows work muted or without Web Audio.
- `prefers-reduced-motion` removes nonessential motion without removing semantic information.
- Mobile must not cause horizontal document overflow at narrow Android widths.
- Existing unknown `/api/*` JSON 404 behavior and branded human `403/404/500` behavior must remain intact.
- Existing Node/Maltego/repository invariant/public-release/Tooling smoke/CodeQL gates must remain green.

---

### Task 1: Establish the `/app` Static Surface and Safe Routing

**Files:**
- Create: `app/index.html`
- Create: `app/app.css`
- Create: `app/app.js`
- Create: `test/web-ui.test.mjs`
- Modify: `vercel.json`
- Modify: `index.html`

**Interfaces:**
- Consumes: existing Vercel `handle: filesystem`, `/api/(.*)` fallback, `/403`, `/500`, and human 404 route.
- Produces: `/app` and `/app/` static analyst shell; DOM element IDs used by later controller/rendering tasks: `access-form`, `token`, `sound-toggle`, `volume`, `workspace`, `pivot-form`, `indicator`, `profile`, `enrich`, `disconnect`, `result-status`, `tabs`, `view`, `live-status`.

- [ ] **Step 1: Write the failing static/security tests**

Create `test/web-ui.test.mjs`:

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

const forbiddenStorage = /localStorage|sessionStorage|indexedDB|document\.cookie/i;
const remoteAsset = /(?:src|href)=["']https?:\/\//i;

test('PARA11AX analyst surface exists and is mobile safe', () => {
  for (const path of ['app/index.html', 'app/app.css', 'app/app.js']) {
    assert.equal(existsSync(path), true, `${path} must exist`);
  }
  const html = read('app/index.html');
  assert.match(html, /name="viewport"\s+content="width=device-width,\s*initial-scale=1"/i);
  assert.match(html, /PARA11AX/);
  assert.match(html, /id="access-form"/);
  assert.match(html, /id="token"[^>]*type="password"/);
  assert.match(html, /id="workspace"/);
  assert.match(html, /id="live-status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(html, remoteAsset);
});

test('browser auth surface contains no persistence or third-party assets', () => {
  const source = ['app/index.html', 'app/app.css', 'app/app.js']
    .map((path) => read(path)).join('\n');
  assert.doesNotMatch(source, forbiddenStorage);
  assert.doesNotMatch(source, /eval\s*\(|new\s+Function\s*\(/);
  assert.doesNotMatch(source, /https?:\/\/[^"')\s]+\.(?:js|css|mp3|wav|ogg|woff2?)/i);
});

test('landing page enters PARA11AX app', () => {
  assert.match(read('index.html'), /href="\/app\/?"[^>]*>[^<]*ENTER PARA11AX/i);
});

test('Vercel routes app before API and human fallbacks', () => {
  const config = JSON.parse(read('vercel.json'));
  const filesystem = config.routes.findIndex((r) => r.handle === 'filesystem');
  const app = config.routes.findIndex((r) => r.src === '/app/?' && r.dest === '/app/index.html');
  const api = config.routes.findIndex((r) => r.src === '/api/(.*)' && r.dest === '/api/[...path].js');
  const human404 = config.routes.findIndex((r) => r.dest === '/404.html' && r.status === 404);
  assert.ok(filesystem >= 0);
  assert.ok(app > filesystem);
  assert.ok(api > app);
  assert.ok(api < human404);
});

test('motion is optional and document overflow is bounded', () => {
  const css = read('app/app.css');
  assert.match(css, /prefers-reduced-motion:\s*reduce/i);
  assert.match(css, /overflow-x:\s*hidden/i);
  assert.match(css, /max-width:\s*100%/i);
});
```

- [ ] **Step 2: Run the tests and verify the intended red state**

Run:

```bash
node --test test/web-ui.test.mjs
```

Expected: FAIL because `app/*` does not exist and the landing/routing assertions are not yet satisfied.

- [ ] **Step 3: Add the minimal accessible analyst shell**

Create `app/index.html` with a dependency-free module entrypoint and fixed control IDs:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#050608">
  <meta name="robots" content="noindex,nofollow">
  <title>PARA11AX // Analyst Terminal</title>
  <link rel="stylesheet" href="/app/app.css">
</head>
<body>
  <div class="matrix matrix-far" aria-hidden="true"></div>
  <div class="matrix matrix-mid" aria-hidden="true"></div>
  <div class="crt" aria-hidden="true"></div>

  <main class="app-shell">
    <section class="access" id="access-panel" aria-labelledby="access-title">
      <p class="micro">PARA11AX // ANALYST ACCESS</p>
      <h1 id="access-title">Establish session</h1>
      <form id="access-form" autocomplete="off">
        <label for="token">Gateway bearer</label>
        <input id="token" name="token" type="password" autocomplete="off" spellcheck="false" required>
        <button type="submit">ESTABLISH SESSION</button>
      </form>
      <p class="memory-note">TOKEN HELD IN MEMORY ONLY · NOT SAVED · NOT LOGGED · CLEARED ON REFRESH</p>
    </section>

    <section id="workspace" class="workspace" hidden>
      <header class="topbar">
        <a class="mark" href="/">PARA<span>11</span>AX</a>
        <span id="connection-state">CONNECTED</span>
        <button id="sound-toggle" type="button" aria-pressed="true">SOUND ON</button>
        <label class="volume-label" for="volume">VOL</label>
        <input id="volume" type="range" min="0" max="1" step="0.05" value="0.35">
        <button id="disconnect" type="button">DISCONNECT</button>
      </header>

      <form id="pivot-form" class="pivot-console">
        <label for="indicator">Observable</label>
        <input id="indicator" autocomplete="off" spellcheck="false" required>
        <label for="profile">Profile</label>
        <select id="profile">
          <option value="fast">FAST</option>
          <option value="standard" selected>STANDARD</option>
          <option value="full">FULL</option>
        </select>
        <button id="enrich" type="submit">ENRICH</button>
      </form>

      <div id="result-status" class="hud" hidden></div>
      <nav id="tabs" class="tabs" aria-label="Analysis views" hidden></nav>
      <section id="view" class="view" aria-label="Analysis output"></section>
    </section>

    <div id="live-status" class="sr-only" aria-live="polite"></div>
  </main>
  <script type="module" src="/app/app.js"></script>
</body>
</html>
```

Create a minimal `app/app.js` containing only `export {};` so module loading is valid until later tasks.

- [ ] **Step 4: Add the initial mobile-safe black-glass CSS contract**

Create `app/app.css` with the permanent palette, overflow bounds, focus states, and reduced-motion safety:

```css
:root{color-scheme:dark;--void:#050608;--panel:#0b0f12;--cyan:#00e5ff;--red:#ff1e2d;--hot:#ff4050;--green:#39ff88;--amber:#f6c945;--white:#f3f7fa;--muted:#7d8b95}
*{box-sizing:border-box;max-width:100%}
html,body{margin:0;min-height:100%;background:var(--void);color:var(--white);overflow-x:hidden}
body{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;line-height:1.45}
button,input,select{font:inherit}
button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}
.app-shell{position:relative;z-index:2;width:min(1440px,100%);margin:0 auto;padding:12px}
.access{width:min(560px,100%);margin:10vh auto 0;padding:20px;border:1px solid #22343c;background:rgba(11,15,18,.95)}
.workspace{min-width:0}.topbar,.pivot-console{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.view,.hud,.tabs{min-width:0;overflow-wrap:anywhere}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:720px){.app-shell{padding:8px}.topbar{position:sticky;top:0;z-index:5}.pivot-console{position:sticky;top:42px;z-index:4}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
```

- [ ] **Step 5: Add `/app` routing without disturbing `/api/*`**

Insert this route immediately after `{ "handle": "filesystem" }` and before `/api/(.*)` in `vercel.json`:

```json
{
  "src": "/app/?",
  "dest": "/app/index.html"
}
```

Do not change the existing `/api/(.*)` fallback or human error route order.

- [ ] **Step 6: Add the landing-page CTA**

Add one primary link in `index.html`:

```html
<a class="enter-app" href="/app">ENTER PARA11AX</a>
```

Style it using the existing local landing-page CSS only; do not load new assets.

- [ ] **Step 7: Re-run the task tests**

Run:

```bash
node --test test/web-ui.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/index.html app/app.css app/app.js test/web-ui.test.mjs vercel.json index.html
git commit -m "feat: add PARA11AX analyst app shell"
```

---

### Task 2: Implement the Same-Origin Gateway API Client

**Files:**
- Create: `app/api-client.js`
- Create: `test/web-ui-logic.test.mjs`

**Interfaces:**
- Produces: `GatewayHttpError`, `createGatewayClient({ fetchImpl, getToken })` with methods `health()`, `enrich(indicator, profile, signal)`, `stix(indicator, profile, signal)`.
- Contract: all paths are relative `/api/*`; auth header is constructed internally from `getToken()`; no retry loop.

- [ ] **Step 1: Write failing API-client tests**

Create `test/web-ui-logic.test.mjs` with:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGatewayClient, GatewayHttpError } from '../app/api-client.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('health uses same-origin bearer request', async () => {
  const calls = [];
  const client = createGatewayClient({
    getToken: () => 'secret-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { ready: true });
    },
  });
  assert.deepEqual(await client.health(), { ready: true });
  assert.equal(calls[0].url, '/api/health');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
  assert.equal(calls[0].init.credentials, 'same-origin');
});

test('enrich sends only fixed request fields', async () => {
  let body;
  const client = createGatewayClient({
    getToken: () => 't',
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return jsonResponse(200, { status: 'ok' });
    },
  });
  await client.enrich('example.org', 'standard');
  assert.deepEqual(body, { indicator: 'example.org', profile: 'standard' });
});

test('invalid profiles fail before network use', async () => {
  let called = false;
  const client = createGatewayClient({ getToken: () => 't', fetchImpl: async () => { called = true; } });
  await assert.rejects(() => client.enrich('x', 'provider-name'), /invalid profile/i);
  assert.equal(called, false);
});

test('structured HTTP errors are exposed without the token', async () => {
  const client = createGatewayClient({
    getToken: () => 'never-echo-me',
    fetchImpl: async () => jsonResponse(401, { error: 'unauthorized', requestId: 'r1' }),
  });
  await assert.rejects(
    () => client.health(),
    (error) => error instanceof GatewayHttpError && error.status === 401 &&
      error.code === 'unauthorized' && !String(error).includes('never-echo-me'),
  );
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
node --test test/web-ui-logic.test.mjs
```

Expected: FAIL because `app/api-client.js` does not exist.

- [ ] **Step 3: Implement the minimal API client**

Create `app/api-client.js`:

```js
const PROFILES = new Set(['fast', 'standard', 'full']);

export class GatewayHttpError extends Error {
  constructor(status, code, requestId = null) {
    super(`gateway request failed: ${code || status}`);
    this.name = 'GatewayHttpError';
    this.status = status;
    this.code = code || 'request_failed';
    this.requestId = requestId;
  }
}

export function createGatewayClient({ fetchImpl = fetch, getToken }) {
  if (typeof getToken !== 'function') throw new TypeError('getToken must be a function');

  async function request(path, { method = 'GET', body, signal } = {}) {
    if (!path.startsWith('/api/')) throw new Error('same-origin API path required');
    const token = getToken();
    if (!token) throw new GatewayHttpError(401, 'unauthorized');
    const headers = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetchImpl(path, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : null;
    if (!response.ok) {
      throw new GatewayHttpError(response.status, payload?.error, payload?.requestId);
    }
    if (!isJson) throw new GatewayHttpError(502, 'unexpected_response');
    return payload;
  }

  function payload(indicator, profile) {
    if (!PROFILES.has(profile)) throw new TypeError('invalid profile');
    return { indicator: String(indicator), profile };
  }

  return Object.freeze({
    health: (signal) => request('/api/health', { signal }),
    enrich: (indicator, profile, signal) => request('/api/enrich', {
      method: 'POST', body: payload(indicator, profile), signal,
    }),
    stix: (indicator, profile, signal) => request('/api/stix', {
      method: 'POST', body: payload(indicator, profile), signal,
    }),
  });
}
```

- [ ] **Step 4: Run API-client tests**

```bash
node --test test/web-ui-logic.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api-client.js test/web-ui-logic.test.mjs
git commit -m "feat: add browser gateway client"
```

---

### Task 3: Add the Memory-Only Session and Single-Request State Machine

**Files:**
- Create: `app/session.js`
- Modify: `test/web-ui-logic.test.mjs`

**Interfaces:**
- Produces: `createSession()` with methods `setToken(token)`, `getToken()`, `validateStarted(controller)`, `unlock()`, `startRequest(controller)`, `finishRequest(result)`, `reset()`, `disconnect()`, `snapshot()`.
- Invariants: token never appears in `snapshot()`; one active request; reset/disconnect abort the active controller; disconnect clears token/result.

- [ ] **Step 1: Add failing session tests**

Append:

```js
import { createSession } from '../app/session.js';

test('session never exposes token through snapshots', () => {
  const session = createSession();
  session.setToken('shared-bearer');
  assert.equal(session.getToken(), 'shared-bearer');
  assert.equal(JSON.stringify(session.snapshot()).includes('shared-bearer'), false);
});

test('session allows only one active enrichment request', () => {
  const session = createSession();
  session.setToken('t');
  session.unlock();
  const first = new AbortController();
  session.startRequest(first);
  assert.throws(() => session.startRequest(new AbortController()), /request already active/i);
});

test('disconnect aborts active work and clears sensitive state', () => {
  const session = createSession();
  session.setToken('t');
  session.unlock();
  const controller = new AbortController();
  session.startRequest(controller);
  session.disconnect();
  assert.equal(controller.signal.aborted, true);
  assert.equal(session.getToken(), null);
  assert.equal(session.snapshot().mode, 'locked');
  assert.equal(session.snapshot().result, null);
});
```

- [ ] **Step 2: Run and verify failure**

```bash
node --test test/web-ui-logic.test.mjs
```

Expected: FAIL because `app/session.js` is missing.

- [ ] **Step 3: Implement the state machine**

Create `app/session.js`:

```js
export function createSession() {
  let token = null;
  let mode = 'locked';
  let result = null;
  let activeController = null;

  function abortActive() {
    if (activeController && !activeController.signal.aborted) activeController.abort();
    activeController = null;
  }

  return Object.freeze({
    setToken(value) {
      token = String(value || '').trim() || null;
      mode = 'locked';
      result = null;
    },
    getToken: () => token,
    unlock() {
      if (!token) throw new Error('token required');
      mode = 'ready';
    },
    startRequest(controller) {
      if (mode !== 'ready' && mode !== 'result') throw new Error('session not ready');
      if (activeController) throw new Error('request already active');
      activeController = controller;
      mode = 'running';
      result = null;
    },
    finishRequest(value) {
      if (mode !== 'running') throw new Error('no active request');
      activeController = null;
      result = value;
      mode = 'result';
    },
    reset() {
      abortActive();
      result = null;
      mode = token ? 'ready' : 'locked';
    },
    disconnect() {
      abortActive();
      token = null;
      result = null;
      mode = 'locked';
    },
    snapshot() {
      return Object.freeze({ mode, result, hasToken: Boolean(token), requestActive: Boolean(activeController) });
    },
  });
}
```

- [ ] **Step 4: Re-run logic tests**

```bash
node --test test/web-ui-logic.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/session.js test/web-ui-logic.test.mjs
git commit -m "feat: add memory-only analyst session state"
```

---

### Task 4: Build Semantic Evidence View Models and Safe DOM Renderers

**Files:**
- Create: `app/view-model.js`
- Create: `app/renderers.js`
- Modify: `test/web-ui-logic.test.mjs`
- Modify: `test/web-ui.test.mjs`

**Interfaces:**
- Produces pure functions: `buildOverview(envelope)`, `buildEvidence(envelope)`, `buildCorrelation(envelope)`, `buildRelationships(envelope)`, `buildCoverage(envelope)`, `jsonLines(envelope)`.
- Produces DOM functions: `renderOverview`, `renderEvidence`, `renderCorrelation`, `renderRelationships`, `renderCoverage`, `renderRaw`.
- Renderers accept a target `HTMLElement` and a view model and create nodes with `document.createElement`/`textContent` only.

- [ ] **Step 1: Add failing semantic tests**

Append to `test/web-ui-logic.test.mjs`:

```js
import {
  buildOverview, buildEvidence, buildCorrelation, buildCoverage, jsonLines,
} from '../app/view-model.js';

const sampleEnvelope = {
  schemaVersion: '2.0',
  gatewayVersion: '2.0.0',
  requestId: 'req-1',
  indicator: 'evil.example',
  type: 'domain',
  profile: 'standard',
  durationMs: 420,
  status: 'partial',
  providerSummary: { ok: 2, failed: 1, skipped: 0, cached: 1 },
  evidence: [
    { provider: 'rdap', observation: { kind: 'registration', verdict: 'observed' }, references: [] },
    { provider: 'ransomware-live', observation: { kind: 'ransomware_victim_claim', verdict: 'observed' }, references: [] },
  ],
  failures: [{ provider: 'censys', error: 'rate_limited' }],
  relationships: [],
  correlation: {
    corroboration: [], contradictions: [{ kind: 'reputation', providers: ['a', 'b'] }],
    freshness: 'current', huntability: { level: 'high', rationale: 'actionable pivots' },
    riskAxes: { kev: { listed: true }, epss: { score: 0.94 }, cvss: { score: 9.8 } },
  },
};

test('overview preserves partial as incomplete coverage', () => {
  const overview = buildOverview(sampleEnvelope);
  assert.equal(overview.status, 'partial');
  assert.equal(overview.tone, 'amber');
  assert.equal(overview.providerSummary.failed, 1);
});

test('evidence keeps context and adversary claims semantically distinct', () => {
  const cards = buildEvidence(sampleEnvelope);
  assert.equal(cards[0].semanticClass, 'context');
  assert.equal(cards[1].semanticClass, 'claim');
  assert.match(cards[1].semanticNote, /claim|report/i);
});

test('CVE axes remain separate', () => {
  const correlation = buildCorrelation(sampleEnvelope);
  assert.deepEqual(Object.keys(correlation.riskAxes).sort(), ['cvss', 'epss', 'kev']);
  assert.equal(correlation.combinedScore, undefined);
});

test('provider failure stays outside evidence', () => {
  assert.equal(buildEvidence(sampleEnvelope).some((x) => x.provider === 'censys'), false);
  assert.equal(buildCoverage(sampleEnvelope).failures[0].provider, 'censys');
});

test('raw JSON line model reproduces exact parsed envelope', () => {
  const lines = jsonLines(sampleEnvelope);
  assert.deepEqual(JSON.parse(lines.map((x) => x.text).join('\n')), sampleEnvelope);
});
```

Add to `test/web-ui.test.mjs`:

```js
test('evidence renderer avoids innerHTML and dangerous DOM APIs', () => {
  const source = read('app/renderers.js');
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.match(source, /textContent/);
  assert.match(source, /createElement/);
});
```

- [ ] **Step 2: Verify the red state**

```bash
node --test test/web-ui-logic.test.mjs test/web-ui.test.mjs
```

Expected: FAIL because view-model/renderers do not exist.

- [ ] **Step 3: Implement semantic view models**

Create `app/view-model.js` with explicit classification helpers:

```js
const CONTEXT_KINDS = new Set([
  'registration', 'routing', 'network_identity', 'internet_exposure',
  'scanner_activity', 'internet_noise', 'tor_exit', 'attack_knowledge',
]);
const CLAIM_KINDS = new Set([
  'community_ioc_report', 'ransomware_post_reference', 'ransomware_victim_claim',
]);

export function buildOverview(e) {
  const tone = e.status === 'ok' ? 'green' : e.status === 'partial' ? 'amber' : 'red';
  return {
    indicator: e.indicator,
    type: e.type,
    requestId: e.requestId,
    profile: e.profile,
    status: e.status,
    tone,
    durationMs: e.durationMs,
    providerSummary: e.providerSummary || {},
    freshness: e.correlation?.freshness || 'unknown',
    huntability: e.correlation?.huntability || null,
  };
}

export function buildEvidence(e) {
  return (e.evidence || []).map((item) => {
    const kind = item.observation?.kind || 'unknown';
    const semanticClass = CONTEXT_KINDS.has(kind) ? 'context' : CLAIM_KINDS.has(kind) ? 'claim' : 'evidence';
    return {
      provider: item.provider,
      kind,
      verdict: item.observation?.verdict ?? null,
      semanticClass,
      semanticNote: semanticClass === 'claim' ? 'Reported/claimed evidence; not proof of compromise.' : '',
      confidence: item.observation?.confidence ?? null,
      firstSeen: item.observation?.firstSeen ?? null,
      lastSeen: item.observation?.lastSeen ?? null,
      attributes: item.observation?.attributes ?? {},
      tags: item.observation?.tags ?? [],
      references: item.references ?? [],
      cacheState: item.cacheState ?? null,
      retrievedAt: item.retrievedAt ?? null,
      parserVersion: item.integrity?.parserVersion ?? null,
      fingerprint: item.integrity?.fingerprint ?? null,
    };
  });
}

export function buildCorrelation(e) {
  const c = e.correlation || {};
  return {
    corroboration: c.corroboration || [],
    contradictions: c.contradictions || [],
    freshness: c.freshness || 'unknown',
    huntability: c.huntability || null,
    riskAxes: {
      kev: c.riskAxes?.kev ?? null,
      epss: c.riskAxes?.epss ?? null,
      cvss: c.riskAxes?.cvss ?? null,
    },
    attributionConfidence: c.attributionConfidence ?? null,
  };
}

export const buildRelationships = (e) => e.relationships || e.correlation?.relationships || [];
export const buildCoverage = (e) => ({ failures: e.failures || [], summary: e.providerSummary || {} });
export const jsonLines = (e) => JSON.stringify(e, null, 2).split('\n').map((text, index) => ({ number: index + 1, text }));
```

- [ ] **Step 4: Implement safe DOM helpers/renderers**

Create `app/renderers.js`. Use a single text helper and never accept HTML strings:

```js
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

export function clear(target) {
  while (target.firstChild) target.removeChild(target.firstChild);
}

export function renderOverview(target, model) {
  clear(target);
  const panel = el('section', `overview tone-${model.tone}`);
  for (const [label, value] of [
    ['STATUS', model.status], ['TYPE', model.type], ['INDICATOR', model.indicator],
    ['PROFILE', model.profile], ['DURATION', `${model.durationMs ?? '—'} ms`],
    ['FRESHNESS', model.freshness], ['HUNTABILITY', model.huntability?.level ?? '—'],
  ]) {
    const cell = el('div', 'hud-cell');
    cell.append(el('span', 'hud-label', label), el('strong', 'hud-value', value));
    panel.append(cell);
  }
  target.append(panel);
}

export function renderEvidence(target, cards) {
  clear(target);
  for (const card of cards) {
    const article = el('article', `signal semantic-${card.semanticClass}`);
    article.append(el('p', 'signal-provider', card.provider), el('p', 'signal-kind', card.kind));
    if (card.verdict !== null) article.append(el('strong', 'signal-verdict', card.verdict));
    if (card.semanticNote) article.append(el('p', 'semantic-note', card.semanticNote));
    const details = el('details', 'signal-details');
    details.append(el('summary', null, 'TECHNICAL / PROVENANCE'));
    details.append(el('p', null, `cache: ${card.cacheState ?? 'unknown'}`));
    details.append(el('p', null, `parser: ${card.parserVersion ?? 'unknown'}`));
    details.append(el('p', null, `fingerprint: ${card.fingerprint ?? 'unavailable'}`));
    for (const ref of card.references) {
      const a = el('a', 'reference', ref);
      try { const url = new URL(ref); if (url.protocol === 'https:') { a.href = url.href; a.rel = 'noopener noreferrer'; a.target = '_blank'; } }
      catch { /* show reference as text only */ }
      details.append(a);
    }
    article.append(details);
    target.append(article);
  }
}
```

Implement `renderCorrelation`, `renderRelationships`, `renderCoverage`, and `renderRaw` with the same `el()` pattern. `renderCorrelation` must create three separately labelled KEV/EPSS/CVSS rows and contradiction pairs; `renderCoverage` must render failures in its own container; `renderRaw` must append one `code-line` row per `{number,text}`.

- [ ] **Step 5: Run semantic/security tests**

```bash
node --test test/web-ui-logic.test.mjs test/web-ui.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/view-model.js app/renderers.js test/web-ui-logic.test.mjs test/web-ui.test.mjs
git commit -m "feat: add semantic evidence renderers"
```

---

### Task 5: Implement the Synthesized PARA11AX Web Audio Engine

**Files:**
- Create: `app/audio.js`
- Modify: `test/web-ui-logic.test.mjs`
- Modify: `test/web-ui.test.mjs`

**Interfaces:**
- Produces: `createAudioEngine({ AudioContextCtor, now })` with `enable()`, `mute(value)`, `setVolume(value)`, `play(name)`, `typing(fieldKind)`, `state()`.
- Cue names are fixed: `access-ok`, `access-denied`, `key`, `tab`, `scan`, `result-ok`, `result-partial`, `result-error`, `contradiction`, `copy`, `stix-start`, `stix-ok`, `disconnect`.
- `typing('token')` is always silent. `typing('pivot')` is rate-limited.

- [ ] **Step 1: Add failing audio tests**

Append:

```js
import { createAudioEngine } from '../app/audio.js';

class FakeParam {
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode {
  constructor() { this.frequency = new FakeParam(); this.gain = new FakeParam(); }
  connect() { return this; }
  start() {}
  stop() {}
}
class FakeAudioContext {
  constructor() { this.currentTime = 1; this.destination = {}; this.state = 'running'; this.created = 0; }
  createOscillator() { this.created += 1; return new FakeNode(); }
  createGain() { return new FakeNode(); }
  createBiquadFilter() { const n = new FakeNode(); n.type = 'bandpass'; return n; }
  createBuffer() { return { getChannelData: () => new Float32Array(32) }; }
  createBufferSource() { return new FakeNode(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}

test('audio is user-enabled, bounded, and token typing is silent', async () => {
  let clock = 1000;
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext, now: () => clock });
  assert.equal(audio.state().enabled, false);
  await audio.enable();
  const before = audio.state().emitted;
  audio.typing('token');
  assert.equal(audio.state().emitted, before);
  audio.typing('pivot');
  const afterOne = audio.state().emitted;
  audio.typing('pivot');
  assert.equal(audio.state().emitted, afterOne, 'typing cue must be rate limited');
  clock += 60;
  audio.typing('pivot');
  assert.ok(audio.state().emitted > afterOne);
});

test('audio mute and volume controls are bounded', async () => {
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext });
  await audio.enable();
  audio.setVolume(5);
  assert.equal(audio.state().volume, 1);
  audio.setVolume(-1);
  assert.equal(audio.state().volume, 0);
  audio.mute(true);
  const before = audio.state().emitted;
  audio.play('scan');
  assert.equal(audio.state().emitted, before);
});

test('unknown cue names are rejected', async () => {
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext });
  await audio.enable();
  assert.throws(() => audio.play('ioc-derived-frequency'), /unknown cue/i);
});
```

Add static assertions:

```js
test('audio engine is synthesized locally and contains no asset/network loading', () => {
  const source = read('app/audio.js');
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|new\s+Audio\s*\(|\.mp3|\.wav|\.ogg/i);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie/i);
});
```

- [ ] **Step 2: Run and verify failure**

```bash
node --test test/web-ui-logic.test.mjs test/web-ui.test.mjs
```

Expected: FAIL because `app/audio.js` is missing.

- [ ] **Step 3: Implement fixed cue definitions and engine**

Create `app/audio.js` with fixed-frequency/time recipes. The implementation must never accept frequency/duration from `play()` callers:

```js
const CUES = Object.freeze({
  'access-ok': [[330, 0.08], [660, 0.11]],
  'access-denied': [[190, 0.12], [120, 0.15]],
  key: [[1900, 0.025]],
  tab: [[720, 0.035]],
  scan: [[180, 0.18], [980, 0.22]],
  'result-ok': [[330, 0.07], [494, 0.08], [660, 0.12]],
  'result-partial': [[370, 0.10], [311, 0.16]],
  'result-error': [[150, 0.14], [105, 0.18]],
  contradiction: [[240, 0.08], [95, 0.12]],
  copy: [[840, 0.03]],
  'stix-start': [[220, 0.09], [880, 0.16]],
  'stix-ok': [[440, 0.06], [660, 0.10]],
  disconnect: [[330, 0.08], [165, 0.12], [82, 0.16]],
});

export function createAudioEngine({ AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext, now = () => performance.now() } = {}) {
  let context = null;
  let enabled = false;
  let muted = false;
  let volume = 0.35;
  let emitted = 0;
  let lastTyping = -Infinity;

  function state() { return Object.freeze({ enabled, muted, volume, emitted, supported: Boolean(AudioContextCtor) }); }

  async function enable() {
    if (!AudioContextCtor) return state();
    context ||= new AudioContextCtor();
    if (context.state === 'suspended') await context.resume();
    enabled = true;
    return state();
  }

  function tone(frequency, duration, offset) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + offset);
    gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, volume * 0.09), context.currentTime + offset + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + duration + 0.01);
  }

  function play(name) {
    const recipe = CUES[name];
    if (!recipe) throw new Error(`unknown cue: ${name}`);
    if (!enabled || muted || volume <= 0 || !context) return;
    let offset = 0;
    for (const [frequency, duration] of recipe) {
      tone(frequency, Math.min(duration, 0.45), offset);
      offset += duration * 0.55;
    }
    emitted += 1;
  }

  function typing(fieldKind) {
    if (fieldKind === 'token') return;
    const current = now();
    if (current - lastTyping < 45) return;
    lastTyping = current;
    play('key');
  }

  return Object.freeze({
    enable,
    play,
    typing,
    mute(value) { muted = Boolean(value); },
    setVolume(value) { volume = Math.min(1, Math.max(0, Number(value) || 0)); },
    state,
  });
}
```

If a richer scanner noise sweep is desired during implementation, it may add a short locally generated noise buffer inside the fixed `scan` recipe, but no network/media asset may be introduced and total cue duration stays under 700 ms.

- [ ] **Step 4: Re-run tests**

```bash
node --test test/web-ui-logic.test.mjs test/web-ui.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/audio.js test/web-ui-logic.test.mjs test/web-ui.test.mjs
git commit -m "feat: add synthesized PARA11AX sound cues"
```

---

### Task 6: Wire the Analyst Controller, Exports, Tabs, and Maximum Cyberpunk Presentation

**Files:**
- Modify: `app/app.js`
- Modify: `app/app.css`
- Modify: `app/index.html`
- Modify: `test/web-ui.test.mjs`
- Modify: `test/web-ui-logic.test.mjs`

**Interfaces:**
- Consumes: `createGatewayClient`, `createSession`, view-model functions, renderers, `createAudioEngine`.
- Produces: fully interactive access/auth, enrichment, semantic tabs, copy/download JSON, STIX download, reset, disconnect, sound/volume controls, and result/status motion classes.

- [ ] **Step 1: Add controller-level structural tests before wiring**

Append to `test/web-ui.test.mjs`:

```js
test('controller wires only approved gateway surfaces and semantic tabs', () => {
  const source = read('app/app.js');
  for (const path of ['/api/health', '/api/enrich', '/api/stix']) {
    assert.match(read('app/api-client.js'), new RegExp(path.replaceAll('/', '\\/')));
  }
  assert.doesNotMatch(source, /providerOverride|providers\s*:/i);
  for (const label of ['overview', 'evidence', 'correlation', 'relationships', 'coverage', 'raw']) {
    assert.match(source, new RegExp(`['"]${label}['"]`, 'i'));
  }
});

test('token input cannot invoke typing audio', () => {
  const source = read('app/app.js');
  assert.doesNotMatch(source, /token[^\n]{0,120}typing\s*\(/i);
});

test('maximum design retains semantic palette and mobile layout', () => {
  const css = read('app/app.css');
  for (const color of ['#050608', '#0b0f12', '#00e5ff', '#ff1e2d', '#39ff88', '#f6c945']) {
    assert.match(css.toLowerCase(), new RegExp(color));
  }
  assert.match(css, /matrix-far/);
  assert.match(css, /matrix-mid/);
  assert.match(css, /semantic-context/);
  assert.match(css, /semantic-claim/);
  assert.match(css, /tone-amber/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/i);
});
```

Add a pure export helper test by exporting `serializeJson` from `app/app.js` or, preferably, define it before DOM bootstrap:

```js
test('JSON export serialization is exact', async () => {
  const { serializeJson } = await import('../app/app.js');
  const value = { status: 'partial', evidence: [{ provider: 'x' }] };
  assert.deepEqual(JSON.parse(serializeJson(value)), value);
});
```

- [ ] **Step 2: Run and verify failure**

```bash
node --test test/web-ui.test.mjs test/web-ui-logic.test.mjs
```

Expected: FAIL because the controller and final CSS are not wired.

- [ ] **Step 3: Implement the controller without running on Node import**

Build `app/app.js` so exported helpers can be tested in Node and DOM bootstrap runs only when `document` exists:

```js
import { createGatewayClient, GatewayHttpError } from './api-client.js';
import { createSession } from './session.js';
import { createAudioEngine } from './audio.js';
import {
  buildOverview, buildEvidence, buildCorrelation, buildRelationships, buildCoverage, jsonLines,
} from './view-model.js';
import {
  renderOverview, renderEvidence, renderCorrelation, renderRelationships, renderCoverage, renderRaw, clear,
} from './renderers.js';

export const VIEWS = Object.freeze(['overview', 'evidence', 'correlation', 'relationships', 'coverage', 'raw']);
export const serializeJson = (value) => JSON.stringify(value, null, 2);

function safeFilename(indicator, suffix) {
  const stem = String(indicator || 'indicator').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'indicator';
  return `${stem}.${suffix}`;
}

function downloadText(text, type, filename) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  a.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

async function copyText(value) {
  await navigator.clipboard.writeText(String(value));
}

if (typeof document !== 'undefined') bootstrap();

function bootstrap() {
  const session = createSession();
  const audio = createAudioEngine();
  const client = createGatewayClient({ getToken: session.getToken });
  const byId = (id) => document.getElementById(id);
  const accessForm = byId('access-form');
  const tokenInput = byId('token');
  const workspace = byId('workspace');
  const pivotForm = byId('pivot-form');
  const indicatorInput = byId('indicator');
  const profile = byId('profile');
  const view = byId('view');
  const tabs = byId('tabs');
  const hud = byId('result-status');
  const live = byId('live-status');
  let activeView = 'overview';
  let currentResult = null;

  function announce(text) { live.textContent = text; }
  function setLocked(locked) {
    byId('access-panel').hidden = !locked;
    workspace.hidden = locked;
  }

  accessForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await audio.enable();
    session.setToken(tokenInput.value);
    try {
      await client.health();
      session.unlock();
      audio.play('access-ok');
      setLocked(false);
      tokenInput.value = '';
      announce('Session established.');
    } catch (error) {
      session.disconnect();
      audio.play('access-denied');
      announce(error instanceof GatewayHttpError && error.status === 401 ? 'Unauthorized token.' : 'Gateway unavailable.');
    }
  });

  indicatorInput.addEventListener('input', () => audio.typing('pivot'));
  byId('sound-toggle').addEventListener('click', () => {
    const nextMuted = !audio.state().muted;
    audio.mute(nextMuted);
    byId('sound-toggle').setAttribute('aria-pressed', String(!nextMuted));
    byId('sound-toggle').textContent = nextMuted ? 'SOUND OFF' : 'SOUND ON';
  });
  byId('volume').addEventListener('input', (event) => audio.setVolume(event.currentTarget.value));

  pivotForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const controller = new AbortController();
    try {
      session.startRequest(controller);
      audio.play('scan');
      document.body.classList.add('is-scanning');
      announce('Enrichment running.');
      const result = await client.enrich(indicatorInput.value, profile.value, controller.signal);
      currentResult = result;
      session.finishRequest(result);
      renderResult();
      audio.play(result.status === 'ok' ? 'result-ok' : result.status === 'partial' ? 'result-partial' : 'result-error');
      if (result.correlation?.contradictions?.length) audio.play('contradiction');
      announce(`Enrichment complete: ${result.status}.`);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        session.reset();
        audio.play('result-error');
        announce(error instanceof GatewayHttpError ? `Gateway error: ${error.code}.` : 'Request failed.');
      }
    } finally {
      document.body.classList.remove('is-scanning');
    }
  });

  function renderResult() {
    hud.hidden = false; tabs.hidden = false;
    renderOverview(hud, buildOverview(currentResult));
    renderTabs(); renderActiveView();
  }

  function renderTabs() {
    clear(tabs);
    for (const name of VIEWS) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = name.toUpperCase();
      button.dataset.view = name; button.setAttribute('aria-pressed', String(name === activeView));
      button.addEventListener('click', () => { activeView = name; audio.play('tab'); renderTabs(); renderActiveView(); });
      tabs.append(button);
    }
  }

  function renderActiveView() {
    if (activeView === 'overview') return renderOverview(view, buildOverview(currentResult));
    if (activeView === 'evidence') return renderEvidence(view, buildEvidence(currentResult));
    if (activeView === 'correlation') return renderCorrelation(view, buildCorrelation(currentResult));
    if (activeView === 'relationships') return renderRelationships(view, buildRelationships(currentResult));
    if (activeView === 'coverage') return renderCoverage(view, buildCoverage(currentResult));
    return renderRaw(view, jsonLines(currentResult));
  }

  byId('disconnect').addEventListener('click', () => {
    audio.play('disconnect');
    session.disconnect(); currentResult = null; clear(view); clear(hud); clear(tabs);
    hud.hidden = true; tabs.hidden = true; indicatorInput.value = ''; tokenInput.value = '';
    setLocked(true); announce('Disconnected.');
  });

  // Wire result action buttons after adding them to app/index.html:
  // copy IOC -> copyText(currentResult.indicator), copy JSON -> copyText(serializeJson(currentResult)),
  // download JSON -> downloadText(serializeJson(currentResult), 'application/json', safeFilename(currentResult.indicator,'evidence.json')),
  // STIX -> client.stix(currentResult.indicator,currentResult.profile, controller.signal) then download exact returned bundle.
}
```

During implementation, replace the final explanatory comment with actual event listeners for fixed action-button IDs `copy-ioc`, `copy-json`, `download-json`, `download-stix`, `reset`. Do not leave the comment as unfinished production behavior.

- [ ] **Step 4: Add fixed result action controls to `app/index.html`**

Inside the workspace after `#tabs`, add:

```html
<div class="result-actions" id="result-actions" hidden>
  <button id="copy-ioc" type="button">COPY IOC</button>
  <button id="copy-json" type="button">COPY JSON</button>
  <button id="download-json" type="button">DOWNLOAD JSON</button>
  <button id="download-stix" type="button">PACKAGE STIX 2.1</button>
  <button id="reset" type="button">RESET</button>
</div>
```

Controller requirements for these handlers:

```js
byId('copy-ioc').addEventListener('click', async () => { await copyText(currentResult.indicator); audio.play('copy'); });
byId('copy-json').addEventListener('click', async () => { await copyText(serializeJson(currentResult)); audio.play('copy'); });
byId('download-json').addEventListener('click', () => {
  downloadText(serializeJson(currentResult), 'application/json', safeFilename(currentResult.indicator, 'evidence.json'));
});
byId('download-stix').addEventListener('click', async () => {
  const controller = new AbortController();
  audio.play('stix-start');
  try {
    const bundle = await client.stix(currentResult.indicator, currentResult.profile, controller.signal);
    downloadText(serializeJson(bundle), 'application/stix+json', safeFilename(currentResult.indicator, 'stix.json'));
    audio.play('stix-ok');
  } catch (error) {
    audio.play('result-error');
    announce(error instanceof GatewayHttpError ? `STIX export failed: ${error.code}.` : 'STIX export failed.');
  }
});
byId('reset').addEventListener('click', () => {
  session.reset(); currentResult = null; clear(view); clear(hud); clear(tabs);
  hud.hidden = true; tabs.hidden = true; byId('result-actions').hidden = true; indicatorInput.value = '';
});
```

Show `result-actions` only after a result is present.

- [ ] **Step 5: Max out the CSS while preserving evidence readability**

Expand `app/app.css` with:

- `.matrix-far` and `.matrix-mid` fixed pseudo-rain using CSS repeating text/gradient or bounded local DOM columns; no external asset.
- `.crt::before` low-opacity scanline overlay and vignette.
- `.workspace` desktop grid: narrow control/top band plus analysis/inspector layout where space allows.
- `.pivot-console` black-glass targeting bar with cyan trace and `.is-scanning` red scanner sweep.
- `.hud` compact multi-cell strip.
- `.tabs` sticky compact controls.
- `.signal` scan-reveal animation, with `.semantic-context`, `.semantic-claim`, `.semantic-evidence` edge treatments.
- `.tone-green`, `.tone-amber`, `.tone-red` semantic HUD treatments.
- `.contradiction` split/collision treatment; animate once only.
- `.risk-axis` separate KEV/EPSS/CVSS rows.
- `.coverage-failure` red/amber failure treatment isolated from evidence.
- `.code-line` grid with line number gutter.
- `.result-actions` sticky action bar.
- mobile `@media(max-width:720px)` single-column signals, sticky top/pivot/tabs, internally scrollable raw JSON, simplified geometry, roughly 30% lower rain opacity/density.
- `@media(prefers-reduced-motion:reduce)` disables all rain/scanner/reveal/collision animations and chromatic transitions.

Use these font ceilings on active workspace:

```css
.mark{font-size:.9rem}.micro,.hud-label,.signal-kind{font-size:.68rem}.pivot-console input{font-size:clamp(1rem,4vw,1.35rem)}.signal{font-size:.82rem}.signal-provider{font-size:.8rem;font-weight:800}.signal-details{font-size:.7rem}
```

Do not introduce large marketing headings inside the unlocked workspace.

- [ ] **Step 6: Run all browser-surface tests**

```bash
node --test test/web-ui.test.mjs test/web-ui-logic.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Run the entire Node test suite**

```bash
npm test
```

Expected: all tests PASS; total count increases from the previous baseline because the web UI tests are included.

- [ ] **Step 8: Commit**

```bash
git add app/index.html app/app.css app/app.js test/web-ui.test.mjs test/web-ui-logic.test.mjs
git commit -m "feat: ship PARA11AX analyst terminal UX"
```

---

### Task 7: Repository Gates, PR, Merge, and Exact-SHA Production Acceptance

**Files:**
- Modify only if a gate requires an in-scope correction: `scripts/verify-repo.sh`, `release-manifest.json`, or documentation linked by existing invariants.
- Do not weaken an existing gate to make the UI pass.

**Interfaces:**
- Consumes: completed `/app` implementation.
- Produces: protected-main merge and production deployment verified against the exact merge SHA.

- [ ] **Step 1: Run focused tests from a clean dependency state**

```bash
npm ci --ignore-scripts
node --test test/web-ui.test.mjs test/web-ui-logic.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run repository verification**

```bash
npm run verify:repo
npm run audit:public
npm test
```

Expected: all PASS; `npm audit --omit=dev` reports zero production vulnerabilities through the existing repository verifier.

- [ ] **Step 3: Run shell/tooling checks used by the protected workflow**

```bash
npm run check
```

Expected: PASS. If local environment lacks a platform-specific tool used only in GitHub Actions, do not weaken the workflow; rely on the protected `Tooling smoke` job for that platform check.

- [ ] **Step 4: Verify the branch diff is bounded**

Expected implementation files are limited to:

```text
app/index.html
app/app.css
app/app.js
app/api-client.js
app/session.js
app/view-model.js
app/renderers.js
app/audio.js
test/web-ui.test.mjs
test/web-ui-logic.test.mjs
index.html
vercel.json
docs/superpowers/specs/2026-08-25-web-ui-design.md
docs/superpowers/plans/2026-08-25-web-ui-implementation.md
```

Any other change requires explicit justification before PR creation.

- [ ] **Step 5: Open the PR with security/UX acceptance spelled out**

Use a PR body containing:

```markdown
## Summary
- add the authenticated `/app` PARA11AX analyst terminal
- keep the gateway bearer in browser memory only and preserve same-origin `/api/*` contracts
- render Evidence v2 as separate evidence/correlation/relationship/coverage/raw views without a synthetic score
- add fixed synthesized Web Audio cues with explicit mute/volume controls and silent token typing
- preserve `/api/*` JSON fallbacks and branded human 403/404/500 routes

## Verification
- focused web UI tests
- full Node suite
- repository/public-release invariants
- Tooling smoke and CodeQL required before merge

## Production acceptance
After merge, verify exact deployed main SHA plus `/`, `/app`, `/api/meta`, protected `/api/health`, unknown `/api/*`, human errors, one authorized enrichment, JSON/STIX exports, mobile overflow, mute/volume, and silent token typing.
```

- [ ] **Step 6: Wait for both protected checks**

Required before merge:

```text
Tooling smoke = success
CodeQL = success
```

Do not claim a pending check passed.

- [ ] **Step 7: Squash-merge with expected head SHA**

Use the current PR head SHA as the merge guard. If head moved, re-run verification on the new head before merging.

- [ ] **Step 8: Verify Vercel deployed the exact merge SHA**

Acceptance requires the production deployment metadata `githubCommitSha` to equal the actual merged `main` SHA and deployment state `READY`.

- [ ] **Step 9: Verify production public/routing surfaces**

Check:

```text
GET /                         -> 200 HTML and ENTER PARA11AX link
GET /app                     -> 200 HTML analyst terminal
GET /api/meta                -> 200 application/json
GET /api/health without token -> 401 JSON
GET /api/definitely-unknown  -> 404 JSON gateway error, not HTML
GET /403                     -> 403 branded HTML
GET /definitely-unknown      -> 404 branded HTML
GET /500                     -> 500 branded HTML
```

- [ ] **Step 10: Perform authorized end-to-end UI acceptance**

Using a valid bearer through the browser UI:

1. Enable/establish session by user gesture.
2. Confirm token field clears after successful validation and no token appears in URL or browser storage.
3. Enrich one harmless/public test pivot using `fast` or `standard`.
4. Confirm result status, evidence, correlation, relationships, coverage, and raw views render without synthetic scoring.
5. Confirm any `partial` state is amber/incomplete coverage rather than benign.
6. Confirm JSON download parses back to the exact enrichment object.
7. Confirm STIX action calls `/api/stix` and downloads the returned bundle.
8. Confirm SOUND mute and volume controls work and workflow remains fully functional muted.
9. Confirm token-field typing is silent while pivot typing can produce the rate-limited cue after audio enablement.
10. Confirm disconnect clears visible result state and returns to the access terminal.

- [ ] **Step 11: Perform mobile acceptance**

At a narrow Android-equivalent viewport (target 360–430 CSS px):

```text
no horizontal document overflow
sticky header/pivot/tabs usable
evidence cards one column
raw JSON scrolls internally
relationship presentation is vertical/contained
buttons remain touchable
background rain/geometry do not obscure text
```

Also test `prefers-reduced-motion: reduce`: analysis remains fully understandable, animations stop, sound control remains independent.

- [ ] **Step 12: Final evidence capture**

Record in the completion message:

```text
PR number and merge SHA
Tooling smoke result
CodeQL result
exact Vercel production SHA/state
production /app status
unknown /api/* JSON status
one authorized UI enrichment result status
JSON/STIX export verification
mobile overflow verification
audio enable/mute/token-silence verification
```

Do not claim anything not freshly verified.
