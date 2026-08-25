# PARA11AX Analyst Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production `/app` PARA11AX analyst terminal that lets a trusted token holder run single-indicator enrichment, inspect Evidence v2 semantically, export JSON/STIX, and use user-controlled synthesized cyberpunk sound cues without weakening the existing gateway/API security model.

**Architecture:** Keep the Node/Vercel gateway unchanged and add a standards-only browser client under `app/`. Browser responsibilities are split into a same-origin API client, a memory-only session state machine, pure Evidence v2 view-model functions, safe DOM renderers, a fixed Web Audio cue engine, and a thin UI controller. The public landing page links to `/app`; Vercel serves `/app` before the existing `/api/*` catch-all and branded human error fallbacks.

**Tech Stack:** HTML5, CSS, ECMAScript modules, Web Audio API, Fetch API, AbortController, Blob/URL, Clipboard API, Node.js 24 built-in test runner, existing Vercel static/functions deployment. No frontend framework, no new npm runtime dependency, no external JS/CSS/audio/fonts.

**Spec:** `docs/superpowers/specs/2026-08-25-web-ui-design.md`

## Global Constraints

- Preserve `cti-enrichment-gateway`, `cti`, `CTI_GATEWAY_TOKEN`, and `/api/*` compatibility surfaces.
- Phase 1 is trusted external use with the current bearer; no anonymous enrichment or per-user isolation claims.
- Token is memory-only: never localStorage, sessionStorage, cookies, IndexedDB, URL, DOM attributes, logs, analytics, exports, or audio derivation.
- Provider credentials remain server-side.
- Browser calls same-origin relative `/api/*` only.
- Profiles are exactly `fast`, `standard`, `full`; no provider override UI.
- Only one active enrichment request at a time.
- Preserve Evidence v2 semantics: context ≠ reputation, claims ≠ proof, failure ≠ negative evidence, KEV ≠ EPSS ≠ CVSS.
- No UI-generated maliciousness/risk score, attribution, provider progress, or inferred graph relationship.
- All untrusted response strings render with text nodes / `textContent`; no `innerHTML`, `outerHTML`, or `insertAdjacentHTML`.
- No third-party JavaScript, CSS, audio, analytics, trackers, remote fonts, `eval`, or dynamic code generation.
- Web Audio cue frequencies/timing are fixed; token/IOC/provider values never influence sound; token-field typing is silent.
- Audio is supplemental; the app remains fully functional muted or without Web Audio.
- `prefers-reduced-motion` disables nonessential motion while retaining semantic information.
- Narrow Android layouts must not create horizontal document overflow.
- Existing unknown `/api/*` JSON 404 and branded human `403/404/500` behavior must remain intact.
- Existing Node, Maltego, repository invariant, public-release, Tooling smoke, and CodeQL gates remain green.

---

### Task 1: Add the `/app` Shell, Landing CTA, and Safe Vercel Route

**Files:**
- Create: `app/index.html`
- Create: `app/app.css`
- Create: `app/app.js`
- Create: `test/web-ui.test.mjs`
- Modify: `index.html`
- Modify: `vercel.json`

**Interfaces:**
- Produces DOM IDs used by later tasks: `access-panel`, `access-form`, `token`, `workspace`, `connection-state`, `sound-toggle`, `volume`, `disconnect`, `pivot-form`, `indicator`, `profile`, `enrich`, `result-status`, `tabs`, `result-actions`, `copy-ioc`, `copy-json`, `download-json`, `download-stix`, `reset`, `view`, `live-status`.

- [ ] **Step 1: Write the failing surface tests**

Create `test/web-ui.test.mjs`:

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

const forbiddenStorage = /localStorage|sessionStorage|indexedDB|document\.cookie/i;

test('analyst app assets exist and shell is accessible', () => {
  for (const path of ['app/index.html', 'app/app.css', 'app/app.js']) {
    assert.equal(existsSync(path), true, `${path} must exist`);
  }
  const html = read('app/index.html');
  assert.match(html, /name="viewport"\s+content="width=device-width,\s*initial-scale=1"/i);
  assert.match(html, /id="token"[^>]*type="password"/i);
  assert.match(html, /id="live-status"[^>]*aria-live="polite"/i);
  assert.match(html, /TOKEN HELD IN MEMORY ONLY/i);
});

test('browser surface has no auth persistence or third-party runtime assets', () => {
  const source = ['app/index.html', 'app/app.css', 'app/app.js'].map(read).join('\n');
  assert.doesNotMatch(source, forbiddenStorage);
  assert.doesNotMatch(source, /eval\s*\(|new\s+Function\s*\(/);
  assert.doesNotMatch(source, /https?:\/\/[^"')\s]+\.(?:js|css|mp3|wav|ogg|woff2?)/i);
});

test('landing page exposes ENTER PARA11AX', () => {
  assert.match(read('index.html'), /href="\/app\/?"[^>]*>[^<]*ENTER PARA11AX/i);
});

test('Vercel app route precedes API catch-all and human fallback', () => {
  const routes = JSON.parse(read('vercel.json')).routes;
  const fs = routes.findIndex((r) => r.handle === 'filesystem');
  const app = routes.findIndex((r) => r.src === '/app/?' && r.dest === '/app/index.html');
  const api = routes.findIndex((r) => r.src === '/api/(.*)' && r.dest === '/api/[...path].js');
  const human404 = routes.findIndex((r) => r.dest === '/404.html' && r.status === 404);
  assert.ok(fs >= 0 && app > fs && api > app && human404 > api);
});

test('mobile and reduced-motion contracts exist', () => {
  const css = read('app/app.css');
  assert.match(css, /overflow-x:\s*hidden/i);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/i);
});
```

- [ ] **Step 2: Run the focused test and confirm red**

```bash
node --test test/web-ui.test.mjs
```

Expected: FAIL because `app/*`, landing CTA, and `/app` route do not exist.

- [ ] **Step 3: Create the complete static shell**

Create `app/index.html`:

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
  <div class="geometry" aria-hidden="true"></div>
  <div class="crt" aria-hidden="true"></div>

  <main class="app-shell">
    <section id="access-panel" class="access" aria-labelledby="access-title">
      <p class="micro">PARA11AX // ANALYST ACCESS</p>
      <h1 id="access-title">Establish session</h1>
      <form id="access-form" autocomplete="off">
        <label for="token">Gateway bearer</label>
        <input id="token" type="password" autocomplete="off" spellcheck="false" required>
        <button type="submit">ESTABLISH SESSION</button>
      </form>
      <p class="memory-note">TOKEN HELD IN MEMORY ONLY · NOT SAVED · NOT LOGGED · CLEARED ON REFRESH</p>
    </section>

    <section id="workspace" class="workspace" hidden>
      <header class="topbar">
        <a class="mark" href="/">PARA<span>11</span>AX</a>
        <span id="connection-state" class="connection">CONNECTED</span>
        <div class="semantic-legend" aria-label="Color semantics">
          <span class="legend-cyan">CYAN CONTEXT</span>
          <span class="legend-green">GREEN CORROBORATED</span>
          <span class="legend-amber">AMBER UNCERTAIN / PARTIAL</span>
          <span class="legend-red">RED FAILURE / CONTRADICTION</span>
        </div>
        <button id="sound-toggle" type="button" aria-pressed="true">SOUND ON</button>
        <label for="volume">VOL</label>
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

      <div class="scanner-track" aria-hidden="true"><i></i></div>
      <section id="result-status" class="hud" hidden></section>
      <nav id="tabs" class="tabs" aria-label="Analysis views" hidden></nav>
      <div id="result-actions" class="result-actions" hidden>
        <button id="copy-ioc" type="button">COPY IOC</button>
        <button id="copy-json" type="button">COPY JSON</button>
        <button id="download-json" type="button">DOWNLOAD JSON</button>
        <button id="download-stix" type="button">PACKAGE STIX 2.1</button>
        <button id="reset" type="button">RESET</button>
      </div>
      <section id="view" class="view" aria-label="Analysis output"></section>
    </section>

    <div id="live-status" class="sr-only" aria-live="polite"></div>
  </main>
  <script type="module" src="/app/app.js"></script>
</body>
</html>
```

Create `app/app.js` containing only:

```js
export {};
```

- [ ] **Step 4: Create the initial black-glass/mobile CSS contract**

Create `app/app.css`:

```css
:root{color-scheme:dark;--void:#050608;--panel:#0b0f12;--cyan:#00e5ff;--red:#ff1e2d;--hot:#ff4050;--green:#39ff88;--amber:#f6c945;--white:#f3f7fa;--muted:#7d8b95}
*{box-sizing:border-box;max-width:100%}
html,body{margin:0;min-height:100%;background:var(--void);color:var(--white);overflow-x:hidden}
body{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;line-height:1.45}
button,input,select{font:inherit;color:inherit;background:#090d10;border:1px solid #26343b}
button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}
.app-shell{position:relative;z-index:4;width:min(1440px,100%);margin:0 auto;padding:12px}
.access{width:min(560px,100%);margin:10vh auto 0;padding:20px;border:1px solid #22343c;background:rgba(11,15,18,.96)}
.workspace,.view,.hud,.tabs{min-width:0;overflow-wrap:anywhere}
.topbar,.pivot-console,.result-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:720px){.app-shell{padding:8px}.topbar{position:sticky;top:0;z-index:8}.pivot-console{position:sticky;top:44px;z-index:7}.semantic-legend{display:none}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
```

- [ ] **Step 5: Add the `/app` route**

Insert immediately after `{ "handle": "filesystem" }` in `vercel.json`:

```json
{
  "src": "/app/?",
  "dest": "/app/index.html"
}
```

Keep the existing `/api/(.*)` route immediately after the app route and before human error fallbacks.

- [ ] **Step 6: Add the landing CTA**

Add to the landing page primary navigation/action area:

```html
<a class="enter-app" href="/app">ENTER PARA11AX</a>
```

Use existing landing-page CSS variables and no external assets.

- [ ] **Step 7: Re-run the focused test**

```bash
node --test test/web-ui.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/index.html app/app.css app/app.js test/web-ui.test.mjs index.html vercel.json
git commit -m "feat: add PARA11AX analyst app shell"
```

---

### Task 2: Implement Same-Origin API and Memory-Only Session Modules

**Files:**
- Create: `app/api-client.js`
- Create: `app/session.js`
- Create: `test/web-ui-logic.test.mjs`

**Interfaces:**
- `createGatewayClient({ fetchImpl, getToken })` → `health(signal)`, `enrich(indicator, profile, signal)`, `stix(indicator, profile, signal)`.
- `GatewayHttpError` exposes `status`, `code`, `requestId` only; never token/body/request headers.
- `createSession()` → `setToken`, `getToken`, `unlock`, `startRequest`, `finishRequest`, `reset`, `disconnect`, `snapshot`.

- [ ] **Step 1: Write failing API/session tests**

Create `test/web-ui-logic.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGatewayClient, GatewayHttpError } from '../app/api-client.js';
import { createSession } from '../app/session.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('gateway client uses relative same-origin bearer request', async () => {
  const calls = [];
  const client = createGatewayClient({
    getToken: () => 'secret-token',
    fetchImpl: async (url, init) => { calls.push({ url, init }); return jsonResponse(200, { ready: true }); },
  });
  assert.deepEqual(await client.health(), { ready: true });
  assert.equal(calls[0].url, '/api/health');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
});

test('enrich sends only indicator and fixed profile', async () => {
  let sent;
  const client = createGatewayClient({
    getToken: () => 't',
    fetchImpl: async (_url, init) => { sent = JSON.parse(init.body); return jsonResponse(200, { status: 'ok' }); },
  });
  await client.enrich('example.org', 'standard');
  assert.deepEqual(sent, { indicator: 'example.org', profile: 'standard' });
  await assert.rejects(() => client.enrich('example.org', 'virustotal'), /invalid profile/i);
});

test('structured errors never include bearer text', async () => {
  const client = createGatewayClient({
    getToken: () => 'never-echo-me',
    fetchImpl: async () => jsonResponse(401, { error: 'unauthorized', requestId: 'r1' }),
  });
  await assert.rejects(() => client.health(), (error) =>
    error instanceof GatewayHttpError && error.status === 401 && error.code === 'unauthorized' &&
    !JSON.stringify(error).includes('never-echo-me') && !String(error).includes('never-echo-me'));
});

test('session snapshot never exposes token and only one request is active', () => {
  const session = createSession();
  session.setToken('shared-bearer');
  session.unlock();
  assert.equal(JSON.stringify(session.snapshot()).includes('shared-bearer'), false);
  const first = new AbortController();
  session.startRequest(first);
  assert.throws(() => session.startRequest(new AbortController()), /request already active/i);
});

test('disconnect aborts active work and clears auth/result state', () => {
  const session = createSession();
  session.setToken('t');
  session.unlock();
  const controller = new AbortController();
  session.startRequest(controller);
  session.disconnect();
  assert.equal(controller.signal.aborted, true);
  assert.equal(session.getToken(), null);
  assert.deepEqual(session.snapshot(), { mode: 'locked', result: null, hasToken: false, requestActive: false });
});
```

- [ ] **Step 2: Run and confirm red**

```bash
node --test test/web-ui-logic.test.mjs
```

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement the gateway client**

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
      method, headers, credentials: 'same-origin', cache: 'no-store', signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : null;
    if (!response.ok) throw new GatewayHttpError(response.status, payload?.error, payload?.requestId);
    if (!isJson) throw new GatewayHttpError(502, 'unexpected_response');
    return payload;
  }

  function payload(indicator, profile) {
    if (!PROFILES.has(profile)) throw new TypeError('invalid profile');
    return { indicator: String(indicator), profile };
  }

  return Object.freeze({
    health: (signal) => request('/api/health', { signal }),
    enrich: (indicator, profile, signal) => request('/api/enrich', { method: 'POST', body: payload(indicator, profile), signal }),
    stix: (indicator, profile, signal) => request('/api/stix', { method: 'POST', body: payload(indicator, profile), signal }),
  });
}
```

- [ ] **Step 4: Implement the session state machine**

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
    setToken(value) { token = String(value || '').trim() || null; mode = 'locked'; result = null; },
    getToken: () => token,
    unlock() { if (!token) throw new Error('token required'); mode = 'ready'; },
    startRequest(controller) {
      if (!['ready', 'result'].includes(mode)) throw new Error('session not ready');
      if (activeController) throw new Error('request already active');
      activeController = controller; mode = 'running'; result = null;
    },
    finishRequest(value) {
      if (mode !== 'running') throw new Error('no active request');
      activeController = null; result = value; mode = 'result';
    },
    reset() { abortActive(); result = null; mode = token ? 'ready' : 'locked'; },
    disconnect() { abortActive(); token = null; result = null; mode = 'locked'; },
    snapshot() { return Object.freeze({ mode, result, hasToken: Boolean(token), requestActive: Boolean(activeController) }); },
  });
}
```

- [ ] **Step 5: Re-run logic tests**

```bash
node --test test/web-ui-logic.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api-client.js app/session.js test/web-ui-logic.test.mjs
git commit -m "feat: add browser gateway session client"
```

---

### Task 3: Add Semantic View Models and Safe DOM Renderers

**Files:**
- Create: `app/view-model.js`
- Create: `app/renderers.js`
- Modify: `test/web-ui-logic.test.mjs`
- Modify: `test/web-ui.test.mjs`

**Interfaces:**
- Pure: `buildOverview`, `buildEvidence`, `buildCorrelation`, `buildRelationships`, `buildCoverage`, `jsonLines`.
- DOM: `clear`, `renderOverview`, `renderEvidence`, `renderCorrelation`, `renderRelationships`, `renderCoverage`, `renderRaw`.

- [ ] **Step 1: Add failing semantic tests**

Append to `test/web-ui-logic.test.mjs`:

```js
import { buildOverview, buildEvidence, buildCorrelation, buildCoverage, jsonLines } from '../app/view-model.js';

const sampleEnvelope = {
  requestId: 'req-1', indicator: 'evil.example', type: 'domain', profile: 'standard', durationMs: 420,
  status: 'partial', providerSummary: { ok: 2, failed: 1, skipped: 0, cached: 1 },
  evidence: [
    { provider: 'rdap', observation: { kind: 'registration', verdict: 'observed' }, references: [] },
    { provider: 'ransomware-live', observation: { kind: 'ransomware_victim_claim', verdict: 'observed' }, references: [] },
  ],
  failures: [{ provider: 'censys', error: 'rate_limited' }], relationships: [],
  correlation: {
    corroboration: [], contradictions: [{ kind: 'reputation', providers: ['a', 'b'] }], freshness: 'current',
    huntability: { level: 'high', rationale: 'actionable pivots' },
    riskAxes: { kev: { listed: true }, epss: { score: 0.94 }, cvss: { score: 9.8 } },
  },
};

test('partial stays incomplete coverage', () => {
  const overview = buildOverview(sampleEnvelope);
  assert.equal(overview.status, 'partial');
  assert.equal(overview.tone, 'amber');
  assert.equal(overview.providerSummary.failed, 1);
});

test('context and adversary claims remain distinct', () => {
  const cards = buildEvidence(sampleEnvelope);
  assert.equal(cards[0].semanticClass, 'context');
  assert.equal(cards[1].semanticClass, 'claim');
  assert.match(cards[1].semanticNote, /claim|report/i);
});

test('CVE axes never become one score', () => {
  const model = buildCorrelation(sampleEnvelope);
  assert.deepEqual(Object.keys(model.riskAxes).sort(), ['cvss', 'epss', 'kev']);
  assert.equal(model.combinedScore, undefined);
});

test('provider failures remain outside evidence', () => {
  assert.equal(buildEvidence(sampleEnvelope).some((x) => x.provider === 'censys'), false);
  assert.equal(buildCoverage(sampleEnvelope).failures[0].provider, 'censys');
});

test('raw lines reconstruct exact object', () => {
  const text = jsonLines(sampleEnvelope).map((line) => line.text).join('\n');
  assert.deepEqual(JSON.parse(text), sampleEnvelope);
});
```

Append to `test/web-ui.test.mjs`:

```js
test('renderer uses safe DOM APIs only', () => {
  const source = read('app/renderers.js');
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML/);
  assert.match(source, /createElement/);
  assert.match(source, /textContent/);
});
```

- [ ] **Step 2: Run and confirm red**

```bash
node --test test/web-ui-logic.test.mjs test/web-ui.test.mjs
```

Expected: FAIL because the new modules are missing.

- [ ] **Step 3: Implement pure Evidence v2 view models**

Create `app/view-model.js`:

```js
const CONTEXT_KINDS = new Set(['registration','routing','network_identity','internet_exposure','scanner_activity','internet_noise','tor_exit','attack_knowledge']);
const CLAIM_KINDS = new Set(['community_ioc_report','ransomware_post_reference','ransomware_victim_claim']);

export function buildOverview(e) {
  return {
    indicator: e.indicator, type: e.type, requestId: e.requestId, profile: e.profile, status: e.status,
    tone: e.status === 'ok' ? 'green' : e.status === 'partial' ? 'amber' : 'red',
    durationMs: e.durationMs, providerSummary: e.providerSummary || {},
    freshness: e.correlation?.freshness || 'unknown', huntability: e.correlation?.huntability || null,
  };
}

export function buildEvidence(e) {
  return (e.evidence || []).map((item) => {
    const kind = item.observation?.kind || 'unknown';
    const semanticClass = CONTEXT_KINDS.has(kind) ? 'context' : CLAIM_KINDS.has(kind) ? 'claim' : 'evidence';
    return {
      provider: item.provider, kind, verdict: item.observation?.verdict ?? null, semanticClass,
      semanticNote: semanticClass === 'claim' ? 'Reported/claimed evidence; not proof of compromise.' : '',
      confidence: item.observation?.confidence ?? null, firstSeen: item.observation?.firstSeen ?? null,
      lastSeen: item.observation?.lastSeen ?? null, attributes: item.observation?.attributes ?? {},
      tags: item.observation?.tags ?? [], references: item.references ?? [], cacheState: item.cacheState ?? null,
      retrievedAt: item.retrievedAt ?? null, parserVersion: item.integrity?.parserVersion ?? null,
      fingerprint: item.integrity?.fingerprint ?? null,
    };
  });
}

export function buildCorrelation(e) {
  const c = e.correlation || {};
  return {
    corroboration: c.corroboration || [], contradictions: c.contradictions || [], freshness: c.freshness || 'unknown',
    huntability: c.huntability || null,
    riskAxes: { kev: c.riskAxes?.kev ?? null, epss: c.riskAxes?.epss ?? null, cvss: c.riskAxes?.cvss ?? null },
    attributionConfidence: c.attributionConfidence ?? null,
  };
}

export const buildRelationships = (e) => e.relationships || e.correlation?.relationships || [];
export const buildCoverage = (e) => ({ failures: e.failures || [], summary: e.providerSummary || {} });
export const jsonLines = (e) => JSON.stringify(e, null, 2).split('\n').map((text, index) => ({ number: index + 1, text }));
```

- [ ] **Step 4: Implement all DOM renderers with textContent only**

Create `app/renderers.js`:

```js
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

export function clear(target) { while (target.firstChild) target.removeChild(target.firstChild); }

export function renderOverview(target, model) {
  clear(target);
  const panel = el('section', `overview tone-${model.tone}`);
  const fields = [
    ['STATUS', model.status], ['TYPE', model.type], ['INDICATOR', model.indicator], ['PROFILE', model.profile],
    ['DURATION', model.durationMs == null ? '—' : `${model.durationMs} ms`], ['FRESHNESS', model.freshness],
    ['HUNTABILITY', model.huntability?.level ?? '—'], ['OK', model.providerSummary.ok ?? 0],
    ['FAILED', model.providerSummary.failed ?? 0], ['CACHED', model.providerSummary.cached ?? 0],
  ];
  for (const [label, value] of fields) {
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
    if (card.confidence !== null) article.append(el('p', 'signal-meta', `confidence: ${card.confidence}`));
    if (card.firstSeen) article.append(el('p', 'signal-meta', `first seen: ${card.firstSeen}`));
    if (card.lastSeen) article.append(el('p', 'signal-meta', `last seen: ${card.lastSeen}`));
    const details = el('details', 'signal-details');
    details.append(el('summary', null, 'TECHNICAL / PROVENANCE'));
    details.append(el('p', null, `cache: ${card.cacheState ?? 'unknown'}`));
    details.append(el('p', null, `retrieved: ${card.retrievedAt ?? 'unknown'}`));
    details.append(el('p', null, `parser: ${card.parserVersion ?? 'unknown'}`));
    details.append(el('p', null, `fingerprint: ${card.fingerprint ?? 'unavailable'}`));
    for (const ref of card.references) {
      let linked = false;
      const line = el('p', 'reference-line');
      try {
        const url = new URL(ref);
        if (url.protocol === 'https:') {
          const a = el('a', 'reference', ref); a.href = url.href; a.rel = 'noopener noreferrer'; a.target = '_blank';
          line.append(a); linked = true;
        }
      } catch {}
      if (!linked) line.append(el('span', 'reference', ref));
      details.append(line);
    }
    article.append(details); target.append(article);
  }
}

export function renderCorrelation(target, model) {
  clear(target);
  const summary = el('section', 'correlation-grid');
  summary.append(el('p', 'signal-meta', `freshness: ${model.freshness}`));
  summary.append(el('p', 'signal-meta', `huntability: ${model.huntability?.level ?? 'unknown'}`));
  if (model.huntability?.rationale) summary.append(el('p', 'signal-meta', model.huntability.rationale));
  for (const item of model.corroboration) summary.append(el('pre', 'corroboration', JSON.stringify(item, null, 2)));
  for (const item of model.contradictions) summary.append(el('pre', 'contradiction', JSON.stringify(item, null, 2)));
  const axes = el('section', 'risk-axes');
  for (const [name, value] of Object.entries(model.riskAxes)) {
    const row = el('div', `risk-axis risk-${name}`);
    row.append(el('strong', null, name.toUpperCase()), el('code', null, value == null ? 'unavailable' : JSON.stringify(value)));
    axes.append(row);
  }
  summary.append(axes); target.append(summary);
}

export function renderRelationships(target, relationships) {
  clear(target);
  const list = el('div', 'relationship-chain');
  for (const relationship of relationships) list.append(el('pre', 'relationship', JSON.stringify(relationship, null, 2)));
  if (!relationships.length) list.append(el('p', 'empty-state', 'No relationships emitted.'));
  target.append(list);
}

export function renderCoverage(target, model) {
  clear(target);
  const panel = el('section', 'coverage');
  panel.append(el('p', 'coverage-summary', `ok ${model.summary.ok ?? 0} · failed ${model.summary.failed ?? 0} · skipped ${model.summary.skipped ?? 0} · cached ${model.summary.cached ?? 0}`));
  for (const failure of model.failures) panel.append(el('pre', 'coverage-failure', JSON.stringify(failure, null, 2)));
  if (!model.failures.length) panel.append(el('p', 'empty-state', 'No provider failures reported.'));
  target.append(panel);
}

export function renderRaw(target, lines) {
  clear(target);
  const pre = el('pre', 'raw-console');
  for (const line of lines) {
    const row = el('span', 'code-line');
    row.append(el('span', 'line-number', line.number), el('span', 'line-text', line.text));
    pre.append(row);
  }
  target.append(pre);
}
```

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

### Task 4: Add Fixed Synthesized Sound Cues

**Files:**
- Create: `app/audio.js`
- Modify: `test/web-ui-logic.test.mjs`
- Modify: `test/web-ui.test.mjs`

**Interfaces:**
- `createAudioEngine({ AudioContextCtor, now })` → `enable`, `play`, `typing`, `mute`, `setVolume`, `state`.
- Fixed cue names: `access-ok`, `access-denied`, `key`, `tab`, `scan`, `result-ok`, `result-partial`, `result-error`, `contradiction`, `copy`, `stix-start`, `stix-ok`, `disconnect`.

- [ ] **Step 1: Add failing audio tests**

Append to `test/web-ui-logic.test.mjs`:

```js
import { createAudioEngine } from '../app/audio.js';

class FakeParam { setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
class FakeNode {
  constructor() { this.frequency = new FakeParam(); this.gain = new FakeParam(); }
  connect() { return this; } start() {} stop() {}
}
class FakeAudioContext {
  constructor() { this.currentTime = 1; this.destination = {}; this.state = 'running'; }
  createOscillator() { return new FakeNode(); }
  createGain() { return new FakeNode(); }
  resume() { return Promise.resolve(); }
}

test('audio is user-enabled and token typing is silent', async () => {
  let clock = 1000;
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext, now: () => clock });
  assert.equal(audio.state().enabled, false);
  await audio.enable();
  const before = audio.state().emitted;
  audio.typing('token');
  assert.equal(audio.state().emitted, before);
  audio.typing('pivot');
  const once = audio.state().emitted;
  audio.typing('pivot');
  assert.equal(audio.state().emitted, once);
  clock += 60;
  audio.typing('pivot');
  assert.ok(audio.state().emitted > once);
});

test('mute and volume are bounded', async () => {
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext });
  await audio.enable();
  audio.setVolume(5); assert.equal(audio.state().volume, 1);
  audio.setVolume(-1); assert.equal(audio.state().volume, 0);
  audio.setVolume(.35); audio.mute(true);
  const before = audio.state().emitted; audio.play('scan');
  assert.equal(audio.state().emitted, before);
});

test('unknown cue names are rejected', async () => {
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext });
  await audio.enable();
  assert.throws(() => audio.play('ioc-derived-frequency'), /unknown cue/i);
});
```

Append to `test/web-ui.test.mjs`:

```js
test('audio engine contains no network/media loading or persistence', () => {
  const source = read('app/audio.js');
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|new\s+Audio\s*\(|\.mp3|\.wav|\.ogg/i);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie/i);
});
```

- [ ] **Step 2: Run and confirm red**

```bash
node --test test/web-ui-logic.test.mjs test/web-ui.test.mjs
```

Expected: FAIL because `app/audio.js` is missing.

- [ ] **Step 3: Implement the fixed cue engine**

Create `app/audio.js`:

```js
const CUES = Object.freeze({
  'access-ok': [[330,.08],[660,.11]], 'access-denied': [[190,.12],[120,.15]], key: [[1900,.025]],
  tab: [[720,.035]], scan: [[180,.18],[980,.22]], 'result-ok': [[330,.07],[494,.08],[660,.12]],
  'result-partial': [[370,.10],[311,.16]], 'result-error': [[150,.14],[105,.18]],
  contradiction: [[240,.08],[95,.12]], copy: [[840,.03]], 'stix-start': [[220,.09],[880,.16]],
  'stix-ok': [[440,.06],[660,.10]], disconnect: [[330,.08],[165,.12],[82,.16]],
});

export function createAudioEngine({ AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext, now = () => performance.now() } = {}) {
  let context = null, enabled = false, muted = false, volume = .35, emitted = 0, lastTyping = -Infinity;
  const state = () => Object.freeze({ enabled, muted, volume, emitted, supported: Boolean(AudioContextCtor) });

  async function enable() {
    if (!AudioContextCtor) return state();
    context ||= new AudioContextCtor();
    if (context.state === 'suspended') await context.resume();
    enabled = true; return state();
  }

  function tone(frequency, duration, offset) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + offset);
    gain.gain.setValueAtTime(.0001, context.currentTime + offset);
    gain.gain.linearRampToValueAtTime(Math.max(.0001, volume * .09), context.currentTime + offset + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + offset + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + duration + .01);
  }

  function play(name) {
    const recipe = CUES[name];
    if (!recipe) throw new Error(`unknown cue: ${name}`);
    if (!enabled || muted || volume <= 0 || !context) return;
    let offset = 0;
    for (const [frequency, duration] of recipe) { tone(frequency, Math.min(duration, .45), offset); offset += duration * .55; }
    emitted += 1;
  }

  function typing(fieldKind) {
    if (fieldKind === 'token') return;
    const current = now();
    if (current - lastTyping < 45) return;
    lastTyping = current; play('key');
  }

  return Object.freeze({
    enable, play, typing,
    mute(value) { muted = Boolean(value); },
    setVolume(value) { volume = Math.min(1, Math.max(0, Number(value) || 0)); },
    state,
  });
}
```

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

### Task 5: Wire Controller, Exports, Error Semantics, and Maximum Cyberpunk UI

**Files:**
- Modify: `app/app.js`
- Modify: `app/app.css`
- Modify: `test/web-ui.test.mjs`
- Modify: `test/web-ui-logic.test.mjs`

**Interfaces:**
- Consumes all modules from Tasks 2–4.
- Produces the complete analyst workflow, semantic tabs, JSON/STIX exports, sound controls, scanner/rain transitions, and correct `401` teardown.

- [ ] **Step 1: Add failing controller/design tests**

Append to `test/web-ui.test.mjs`:

```js
test('controller exposes only approved semantic views and no provider override', () => {
  const source = read('app/app.js');
  for (const view of ['overview','evidence','correlation','relationships','coverage','raw']) {
    assert.match(source, new RegExp(`['"]${view}['"]`));
  }
  assert.doesNotMatch(source, /providerOverride|providers\s*:/i);
  assert.doesNotMatch(source, /token[^\n]{0,120}typing\s*\(/i);
});

test('maximum design contains semantic palette, rain depths and mobile rules', () => {
  const css = read('app/app.css').toLowerCase();
  for (const color of ['#050608','#0b0f12','#00e5ff','#ff1e2d','#39ff88','#f6c945']) assert.match(css, new RegExp(color));
  for (const token of ['matrix-far','matrix-mid','semantic-context','semantic-claim','tone-amber','coverage-failure','code-line']) assert.match(css, new RegExp(token));
});
```

Append to `test/web-ui-logic.test.mjs`:

```js
test('JSON serialization is exact', async () => {
  const { serializeJson } = await import('../app/app.js');
  const value = { status: 'partial', evidence: [{ provider: 'x' }] };
  assert.deepEqual(JSON.parse(serializeJson(value)), value);
});
```

- [ ] **Step 2: Run and confirm red**

```bash
node --test test/web-ui.test.mjs test/web-ui-logic.test.mjs
```

Expected: FAIL because the controller and maximum presentation are not wired.

- [ ] **Step 3: Implement the complete controller**

Replace `app/app.js` with:

```js
import { createGatewayClient, GatewayHttpError } from './api-client.js';
import { createSession } from './session.js';
import { createAudioEngine } from './audio.js';
import { buildOverview, buildEvidence, buildCorrelation, buildRelationships, buildCoverage, jsonLines } from './view-model.js';
import { clear, renderOverview, renderEvidence, renderCorrelation, renderRelationships, renderCoverage, renderRaw } from './renderers.js';

export const VIEWS = Object.freeze(['overview','evidence','correlation','relationships','coverage','raw']);
export const serializeJson = (value) => JSON.stringify(value, null, 2);

function safeFilename(indicator, suffix) {
  const stem = String(indicator || 'indicator').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'indicator';
  return `${stem}.${suffix}`;
}

function downloadText(text, type, filename) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener'; a.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

async function copyText(value) { await navigator.clipboard.writeText(String(value)); }

if (typeof document !== 'undefined') bootstrap();

function bootstrap() {
  const session = createSession();
  const audio = createAudioEngine();
  const client = createGatewayClient({ getToken: session.getToken });
  const byId = (id) => document.getElementById(id);
  const accessPanel = byId('access-panel'), accessForm = byId('access-form'), tokenInput = byId('token');
  const workspace = byId('workspace'), pivotForm = byId('pivot-form'), indicatorInput = byId('indicator');
  const profile = byId('profile'), hud = byId('result-status'), tabs = byId('tabs'), actions = byId('result-actions');
  const view = byId('view'), live = byId('live-status');
  let activeView = 'overview', currentResult = null;

  const announce = (text) => { live.textContent = text; };
  const setLocked = (locked) => { accessPanel.hidden = !locked; workspace.hidden = locked; };
  const clearResult = () => {
    currentResult = null; clear(hud); clear(tabs); clear(view); hud.hidden = true; tabs.hidden = true; actions.hidden = true;
  };
  const lockSession = (message) => {
    session.disconnect(); clearResult(); indicatorInput.value = ''; tokenInput.value = ''; setLocked(true); announce(message);
  };

  accessForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await audio.enable();
    session.setToken(tokenInput.value);
    try {
      await client.health(); session.unlock(); audio.play('access-ok'); setLocked(false); tokenInput.value = ''; announce('Session established.');
    } catch (error) {
      audio.play('access-denied'); lockSession(error instanceof GatewayHttpError && error.status === 401 ? 'Unauthorized token.' : 'Gateway unavailable.');
    }
  });

  indicatorInput.addEventListener('input', () => audio.typing('pivot'));
  byId('sound-toggle').addEventListener('click', () => {
    const muted = !audio.state().muted; audio.mute(muted);
    byId('sound-toggle').setAttribute('aria-pressed', String(!muted));
    byId('sound-toggle').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  });
  byId('volume').addEventListener('input', (event) => audio.setVolume(event.currentTarget.value));

  function renderTabs() {
    clear(tabs);
    for (const name of VIEWS) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = name.toUpperCase(); button.dataset.view = name;
      button.setAttribute('aria-pressed', String(name === activeView));
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

  function renderResult() {
    renderOverview(hud, buildOverview(currentResult)); hud.hidden = false; tabs.hidden = false; actions.hidden = false;
    renderTabs(); renderActiveView();
  }

  pivotForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const controller = new AbortController();
    try {
      session.startRequest(controller); audio.play('scan'); document.body.classList.add('is-scanning'); announce('Enrichment running.');
      const result = await client.enrich(indicatorInput.value, profile.value, controller.signal);
      currentResult = result; session.finishRequest(result); renderResult();
      audio.play(result.status === 'ok' ? 'result-ok' : result.status === 'partial' ? 'result-partial' : 'result-error');
      if (result.correlation?.contradictions?.length) audio.play('contradiction');
      announce(`Enrichment complete: ${result.status}.`);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (error instanceof GatewayHttpError && error.status === 401) { audio.play('access-denied'); lockSession('Session unauthorized.'); return; }
      session.reset(); audio.play('result-error');
      announce(error instanceof GatewayHttpError ? `Gateway error: ${error.code}.` : 'Request failed.');
    } finally { document.body.classList.remove('is-scanning'); }
  });

  byId('copy-ioc').addEventListener('click', async () => { if (!currentResult) return; await copyText(currentResult.indicator); audio.play('copy'); });
  byId('copy-json').addEventListener('click', async () => { if (!currentResult) return; await copyText(serializeJson(currentResult)); audio.play('copy'); });
  byId('download-json').addEventListener('click', () => {
    if (!currentResult) return;
    downloadText(serializeJson(currentResult), 'application/json', safeFilename(currentResult.indicator, 'evidence.json'));
  });
  byId('download-stix').addEventListener('click', async () => {
    if (!currentResult) return;
    const controller = new AbortController(); audio.play('stix-start');
    try {
      const bundle = await client.stix(currentResult.indicator, currentResult.profile, controller.signal);
      downloadText(serializeJson(bundle), 'application/stix+json', safeFilename(currentResult.indicator, 'stix.json')); audio.play('stix-ok');
    } catch (error) {
      if (error instanceof GatewayHttpError && error.status === 401) { audio.play('access-denied'); lockSession('Session unauthorized.'); return; }
      audio.play('result-error'); announce(error instanceof GatewayHttpError ? `STIX export failed: ${error.code}.` : 'STIX export failed.');
    }
  });
  byId('reset').addEventListener('click', () => { session.reset(); clearResult(); indicatorInput.value = ''; announce('Result cleared.'); });
  byId('disconnect').addEventListener('click', () => { audio.play('disconnect'); lockSession('Disconnected.'); });
}
```

- [ ] **Step 4: Replace the base CSS with the maximum terminal system**

Keep the existing variables and append/replace with this concrete core styling; tune only numeric spacing/opacity during visual QA, not color semantics or structural behavior:

```css
.matrix,.geometry,.crt{position:fixed;inset:0;pointer-events:none}.matrix{z-index:0;overflow:hidden;background-repeat:repeat;background-size:38px 92px;mix-blend-mode:screen}.matrix-far{opacity:.11;background-image:repeating-linear-gradient(180deg,transparent 0 12px,rgba(255,30,45,.22) 13px 14px,transparent 15px 30px);animation:rain-far 8s linear infinite}.matrix-mid{opacity:.18;background-image:repeating-linear-gradient(90deg,transparent 0 46px,rgba(255,64,80,.16) 47px 48px,transparent 49px 74px);animation:rain-mid 3.8s linear infinite}.geometry{z-index:1;background:linear-gradient(33deg,transparent 49.85%,rgba(0,229,255,.14) 50%,transparent 50.15%),linear-gradient(-33deg,transparent 49.85%,rgba(0,229,255,.14) 50%,transparent 50.15%)}.crt{z-index:3;opacity:.13;background:repeating-linear-gradient(180deg,transparent 0 3px,rgba(255,255,255,.035) 4px 5px);box-shadow:inset 0 0 16vw rgba(0,0,0,.78)}
@keyframes rain-far{to{transform:translateY(92px)}}@keyframes rain-mid{to{transform:translateY(184px)}}
.topbar{position:sticky;top:0;z-index:10;padding:8px 10px;border:1px solid #1f3038;background:rgba(5,6,8,.94);backdrop-filter:blur(10px)}.mark{font-size:.9rem;font-weight:900;letter-spacing:.12em;text-decoration:none;color:var(--white)}.mark span{color:var(--cyan)}.connection{color:var(--green);font-size:.7rem}.semantic-legend{display:flex;gap:8px;flex:1;font-size:.62rem}.legend-cyan{color:var(--cyan)}.legend-green{color:var(--green)}.legend-amber{color:var(--amber)}.legend-red{color:var(--red)}
.pivot-console{position:sticky;top:48px;z-index:9;margin-top:8px;padding:10px;border:1px solid #24404a;background:linear-gradient(90deg,rgba(0,229,255,.04),rgba(11,15,18,.96),rgba(255,30,45,.03));box-shadow:0 10px 36px rgba(0,0,0,.38)}.pivot-console input{flex:1;min-width:min(420px,100%);font-size:clamp(1rem,4vw,1.35rem);padding:10px;color:var(--white);border-color:#2d4d58}.pivot-console input:focus{box-shadow:0 0 0 1px var(--cyan),0 0 24px rgba(0,229,255,.1)}
.scanner-track{height:2px;margin:6px 0;overflow:hidden;background:#26090e}.scanner-track i{display:block;width:16%;height:100%;background:linear-gradient(90deg,transparent,var(--red),#fff,var(--red),transparent);transform:translateX(-120%)}.is-scanning .scanner-track i{animation:scanner .7s ease-in-out 1}@keyframes scanner{to{transform:translateX(720%)}}
.hud{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:5px;padding:8px;border:1px solid #213139;background:rgba(8,11,13,.94)}.hud-cell{padding:7px;border-left:2px solid var(--cyan);background:#090d10}.hud-label{display:block;color:var(--muted);font-size:.64rem}.hud-value{font-size:.76rem}.tone-green .hud-cell:first-child{border-color:var(--green)}.tone-amber .hud-cell:first-child{border-color:var(--amber)}.tone-red .hud-cell:first-child{border-color:var(--red)}
.tabs{position:sticky;top:108px;z-index:8;display:flex;gap:4px;overflow-x:auto;padding:6px 0;background:rgba(5,6,8,.94)}.tabs button{white-space:nowrap;font-size:.68rem;padding:7px 9px}.tabs button[aria-pressed="true"]{border-color:var(--cyan);color:var(--cyan);box-shadow:inset 0 -1px var(--cyan)}
.result-actions{position:sticky;bottom:0;z-index:9;padding:7px;background:rgba(5,6,8,.95);border-top:1px solid #24343c}.result-actions button{font-size:.66rem;padding:7px 9px}
.view{display:grid;gap:7px;padding:8px 0 64px}.signal{position:relative;padding:10px;border:1px solid #25323a;border-left-width:3px;background:rgba(11,15,18,.95);font-size:.82rem;animation:signal-in .22s ease-out both}.semantic-context{border-left-color:var(--cyan)}.semantic-claim{border-left-color:var(--amber)}.semantic-evidence{border-left-color:var(--green)}.signal-provider{margin:0;color:var(--white);font-size:.8rem;font-weight:800}.signal-kind{margin:2px 0;color:var(--muted);font-size:.68rem}.signal-verdict{color:var(--green)}.semantic-note{color:var(--amber)}.signal-details{font-size:.7rem;color:#aab4ba}@keyframes signal-in{from{opacity:0;transform:translateY(5px);clip-path:inset(0 0 100% 0)}to{opacity:1;transform:none;clip-path:inset(0)}}
.correlation-grid,.coverage,.relationship-chain,.raw-console{min-width:0;padding:10px;border:1px solid #213139;background:rgba(8,11,13,.95)}.contradiction{border-left:3px solid var(--red);color:#ffc1c6;white-space:pre-wrap;overflow-wrap:anywhere}.corroboration{border-left:3px solid var(--green);white-space:pre-wrap;overflow-wrap:anywhere}.risk-axes{display:grid;gap:5px}.risk-axis{display:grid;grid-template-columns:70px 1fr;gap:8px;padding:6px;border:1px solid #29343a}.risk-kev{border-left-color:var(--red)}.risk-epss{border-left-color:var(--amber)}.risk-cvss{border-left-color:var(--cyan)}.coverage-failure{white-space:pre-wrap;overflow-wrap:anywhere;border-left:3px solid var(--red);padding:7px;background:#14090c}.relationship{white-space:pre-wrap;overflow-wrap:anywhere;border-left:2px solid var(--cyan);padding:7px}.raw-console{max-height:68vh;overflow:auto}.code-line{display:grid;grid-template-columns:48px minmax(0,1fr);gap:8px}.line-number{color:#52616a;text-align:right;user-select:none}.line-text{white-space:pre;min-width:max-content;color:#cbd5da}
@media(max-width:720px){.matrix-far{opacity:.07}.matrix-mid{opacity:.12}.geometry{opacity:.45}.app-shell{padding:6px}.topbar{top:0}.pivot-console{top:44px;display:grid;grid-template-columns:1fr auto}.pivot-console label{font-size:.64rem}.pivot-console input{grid-column:1/-1;min-width:0;width:100%}.tabs{top:144px}.hud{grid-template-columns:repeat(2,minmax(0,1fr))}.view{grid-template-columns:1fr}.signal,.relationship,.coverage-failure{width:100%}.raw-console{max-width:100%;overflow:auto}.semantic-legend{display:none}.result-actions{overflow-x:auto;flex-wrap:nowrap}.result-actions button{white-space:nowrap}}
@media(prefers-reduced-motion:reduce){.matrix-far,.matrix-mid,.scanner-track i,.signal,.contradiction{animation:none!important;transform:none!important;clip-path:none!important}.crt{opacity:.08}}
```

- [ ] **Step 5: Run focused tests**

```bash
node --test test/web-ui.test.mjs test/web-ui-logic.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run the full Node suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add app/app.js app/app.css test/web-ui.test.mjs test/web-ui-logic.test.mjs
git commit -m "feat: ship PARA11AX analyst terminal UX"
```

---

### Task 6: Full Gates, PR, Merge, and Exact-SHA Production Acceptance

**Files:**
- Modify only if an existing gate requires an in-scope correction; never weaken a gate.

**Interfaces:**
- Produces protected-main merge and exact-SHA Vercel production verification.

- [ ] **Step 1: Run clean focused verification**

```bash
npm ci --ignore-scripts
node --test test/web-ui.test.mjs test/web-ui-logic.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run repository/public-release/full tests**

```bash
npm run verify:repo
npm run audit:public
npm test
npm run check
```

Expected: all available local gates PASS. Do not remove a platform-specific protected check if the local environment cannot run it.

- [ ] **Step 3: Verify the diff is bounded**

Expected implementation paths:

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

Any additional path requires explicit task-related justification before PR creation.

- [ ] **Step 4: Open the PR**

Use this body:

```markdown
## Summary
- add the authenticated `/app` PARA11AX analyst terminal
- keep the gateway bearer in browser memory only and preserve same-origin `/api/*` contracts
- render Evidence v2 as evidence/correlation/relationship/coverage/raw views without a synthetic score
- add fixed synthesized Web Audio cues with mute/volume controls and silent token typing
- preserve `/api/*` JSON fallbacks and branded human 403/404/500 routes

## Verification
- focused web UI tests
- full Node suite
- repository/public-release invariants
- Tooling smoke and CodeQL required before merge

## Production acceptance
Verify exact deployed main SHA plus `/`, `/app`, `/api/meta`, protected `/api/health`, unknown `/api/*`, human errors, one authorized enrichment, JSON/STIX exports, mobile overflow, mute/volume, and silent token typing.
```

- [ ] **Step 5: Wait for protected checks**

Required before merge:

```text
Tooling smoke = success
CodeQL = success
```

Do not claim pending checks passed.

- [ ] **Step 6: Squash-merge with current expected head SHA**

If the PR head moved, re-run relevant checks on the new head before merge.

- [ ] **Step 7: Verify Vercel exact-main deployment**

Production deployment must be `READY` and its `githubCommitSha` must equal the actual merge SHA.

- [ ] **Step 8: Verify production routes**

```text
GET /                          -> 200 HTML, ENTER PARA11AX present
GET /app                      -> 200 HTML analyst terminal
GET /api/meta                 -> 200 application/json
GET /api/health without bearer -> 401 JSON
GET /api/definitely-unknown   -> 404 JSON gateway error
GET /403                      -> 403 branded HTML
GET /definitely-unknown       -> 404 branded HTML
GET /500                      -> 500 branded HTML
```

- [ ] **Step 9: Perform authorized UI acceptance**

With a valid bearer:

1. Establish session via explicit user gesture.
2. Confirm the token input clears after validation and browser storage/URL contain no token.
3. Enrich one harmless/public test pivot using `fast` or `standard`.
4. Confirm Overview, Evidence, Correlation, Relationships, Coverage, Raw views render without synthetic scoring.
5. Confirm `partial` is amber/incomplete coverage, never benign.
6. Confirm JSON download parses to the exact enrichment object.
7. Confirm STIX action calls `/api/stix` and downloads that response.
8. Confirm sound can be muted and volume adjusted; workflow remains functional muted.
9. Confirm token-field typing is silent and pivot typing is rate-limited after audio enablement.
10. Confirm contradiction cue fires at most once for a result containing contradictions.
11. Force/observe `401` on an authenticated request and confirm the UI clears session/result state and returns to access mode.
12. Confirm disconnect clears visible results and access state.

- [ ] **Step 10: Perform mobile/reduced-motion acceptance**

At 360–430 CSS px:

```text
no horizontal document overflow
sticky header/pivot/tabs usable
evidence one column
relationships contained vertically
raw JSON scrolls internally
buttons remain usable
rain/geometry never obscure text
```

With `prefers-reduced-motion: reduce`, all analytical information remains available with motion stopped. Sound remains independently controllable.

- [ ] **Step 11: Capture completion evidence**

Completion message must report only freshly verified facts:

```text
PR number and merge SHA
Tooling smoke result
CodeQL result
exact Vercel production SHA/state
/app production status
unknown /api/* JSON status
authorized enrichment result status
JSON/STIX export verification
mobile overflow verification
audio enable/mute/token-silence verification
```
