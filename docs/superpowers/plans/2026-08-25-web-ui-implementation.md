<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Document status:** Historical design record. Preserved for implementation history; current behavior is defined by [docs/ARCHITECTURE.md](https://github.com/ger1e/para11ax/blob/main/docs/ARCHITECTURE.md) and the current README.

# PARA11AX Analyst Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production `/app` PARA11AX analyst terminal that lets a trusted token holder run single-indicator enrichment, inspect Evidence v2 semantically, export exact JSON/STIX, and use user-controlled synthesized cyberpunk sound cues without weakening the existing gateway/API security model.

**Architecture:** Keep the Node/Vercel gateway unchanged and add a standards-only browser client under `app/`. Browser responsibilities are split into a same-origin API client with response-shape gates, a memory-only session state machine, pure Evidence v2 view-model functions, safe DOM renderers, a fixed Web Audio cue engine, and a thin UI controller. The public landing page links to `/app`; Vercel serves `/app` before the existing `/api/para11ax/*` catch-all and branded human error fallbacks.

**Tech Stack:** HTML5, CSS, ECMAScript modules, Web Audio API, Fetch API, AbortController, Blob/URL, Clipboard API, Node.js 24 built-in test runner, existing Vercel static/functions deployment. No frontend framework, no new npm runtime dependency, no external JS/CSS/audio/fonts.

**Spec:** `docs/superpowers/specs/2026-08-25-web-ui-design.md`

## Global Constraints

- Preserve `para11ax`, `para11ax`, `PARA11AX_TOKEN`, and `/api/para11ax/*` compatibility surfaces.
- Phase 1 is trusted external use with the current bearer; no anonymous enrichment or per-user isolation claims.
- Token is memory-only: never localStorage, sessionStorage, cookies, IndexedDB, URL, DOM attributes, logs, analytics, exports, or audio derivation.
- Provider credentials remain server-side.
- Browser calls same-origin relative `/api/para11ax/*` only.
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
- Existing unknown `/api/para11ax/*` JSON 404 and branded human `403/404/500` behavior must remain intact.
- Existing Node, Maltego, repository invariant, public-release, Tooling smoke, and CodeQL gates remain green.

---

### Task 1: Add the `/app` Shell, Real Glyph Rain, Landing CTA, and Safe Vercel Route

**Files:**
- Create: `app/index.html`
- Create: `app/app.css`
- Create: `app/app.js`
- Create: `test/web-ui.test.mjs`
- Modify: `index.html`
- Modify: `vercel.json`

**Interfaces:**
- Produces DOM IDs used by later tasks: `access-panel`, `access-form`, `token`, `workspace`, `connection-state`, `sound-toggle`, `volume`, `disconnect`, `pivot-form`, `indicator`, `profile`, `enrich`, `result-status`, `tabs`, `raw-search`, `result-actions`, `copy-ioc`, `copy-json`, `download-json`, `download-stix`, `reset`, `view`, `live-status`.

- [ ] **Step 1: Write the failing surface tests**

Create `test/web-ui.test.mjs`:

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const forbiddenStorage = /localStorage|sessionStorage|indexedDB|document\.cookie/i;

test('analyst app assets exist and shell is accessible', () => {
  for (const path of ['app/index.html', 'app/app.css', 'app/app.js']) assert.equal(existsSync(path), true, `${path} must exist`);
  const html = read('app/index.html');
  assert.match(html, /name="viewport"\s+content="width=device-width,\s*initial-scale=1"/i);
  assert.match(html, /id="token"[^>]*type="password"/i);
  assert.match(html, /id="live-status"[^>]*aria-live="polite"/i);
  assert.match(html, /TOKEN HELD IN MEMORY ONLY/i);
  assert.match(html, /matrix-far/); assert.match(html, /matrix-mid/); assert.match(html, /matrix-front/);
  assert.ok((html.match(/class="rain-col"/g) || []).length >= 24, 'glyph rain needs bounded static columns');
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
  const api = routes.findIndex((r) => r.src === '/api/para11ax/(.*)' && r.dest === '/api/para11ax/[...path].js');
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

- [ ] **Step 3: Create the complete static shell with bounded three-depth glyph rain**

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
  <div class="matrix matrix-far" aria-hidden="true">
    <span class="rain-col">11A0X101PARA110011AX10</span><span class="rain-col">010011AX1100PARA1011</span><span class="rain-col">EVIDENCE1100101AX11</span><span class="rain-col">0011011PARA11001010</span><span class="rain-col">STIX2110011AX01011</span><span class="rain-col">101100PARA11X00101</span><span class="rain-col">FIXEDEGRESS11001011</span><span class="rain-col">01101AX1100PARA1100</span>
  </div>
  <div class="matrix matrix-mid" aria-hidden="true">
    <span class="rain-col">PROVENANCE00110111</span><span class="rain-col">110010PARA11AX0011</span><span class="rain-col">READONLY1100110011</span><span class="rain-col">0110011AXPARA110101</span><span class="rain-col">CORRELATE11001011</span><span class="rain-col">1001PARA11AX110010</span><span class="rain-col">CONTEXT0011011011</span><span class="rain-col">1100AX11PARA010011</span><span class="rain-col">HUNTABILITY1011011</span><span class="rain-col">011PARA11AX100110</span><span class="rain-col">BOUNDED1100101011</span><span class="rain-col">11001AXPARA1100101</span>
  </div>
  <div class="matrix matrix-front" aria-hidden="true">
    <span class="rain-col">OBSERVE110011</span><span class="rain-col">VERIFY110011</span><span class="rain-col">PARA11AX0011</span><span class="rain-col">EVIDENCE1100</span>
  </div>
  <div class="geometry" aria-hidden="true"></div><div class="crt" aria-hidden="true"></div>

  <main class="app-shell">
    <section id="access-panel" class="access" aria-labelledby="access-title">
      <p class="micro">PARA11AX // ANALYST ACCESS</p><h1 id="access-title">Establish session</h1>
      <form id="access-form" autocomplete="off">
        <label for="token">Gateway bearer</label><input id="token" type="password" autocomplete="off" spellcheck="false" required>
        <button type="submit">ESTABLISH SESSION</button>
      </form>
      <p class="memory-note">TOKEN HELD IN MEMORY ONLY · NOT SAVED · NOT LOGGED · CLEARED ON REFRESH</p>
    </section>

    <section id="workspace" class="workspace" hidden>
      <header class="topbar">
        <a class="mark" href="/">PARA<span>11</span>AX</a><span id="connection-state" class="connection">CONNECTED</span>
        <div class="semantic-legend" aria-label="Color semantics"><span class="legend-cyan">CYAN CONTEXT</span><span class="legend-green">GREEN CORROBORATED</span><span class="legend-amber">AMBER UNCERTAIN / PARTIAL</span><span class="legend-red">RED FAILURE / CONTRADICTION</span></div>
        <button id="sound-toggle" type="button" aria-pressed="true">SOUND ON</button><label for="volume">VOL</label><input id="volume" type="range" min="0" max="1" step="0.05" value="0.35"><button id="disconnect" type="button">DISCONNECT</button>
      </header>
      <form id="pivot-form" class="pivot-console"><label for="indicator">Observable</label><input id="indicator" autocomplete="off" spellcheck="false" required><label for="profile">Profile</label><select id="profile"><option value="fast">FAST</option><option value="standard" selected>STANDARD</option><option value="full">FULL</option></select><button id="enrich" type="submit">ENRICH</button></form>
      <div class="scanner-track" aria-hidden="true"><i></i></div>
      <section id="result-status" class="hud" hidden></section><nav id="tabs" class="tabs" aria-label="Analysis views" hidden></nav>
      <label id="raw-search-label" class="raw-search-label" for="raw-search" hidden>FILTER RAW JSON</label><input id="raw-search" class="raw-search" type="search" autocomplete="off" hidden>
      <div id="result-actions" class="result-actions" hidden><button id="copy-ioc" type="button">COPY IOC</button><button id="copy-json" type="button">COPY JSON</button><button id="download-json" type="button">DOWNLOAD JSON</button><button id="download-stix" type="button">PACKAGE STIX 2.1</button><button id="reset" type="button">RESET</button></div>
      <section id="view" class="view" aria-label="Analysis output"></section>
    </section>
    <div id="live-status" class="sr-only" aria-live="polite"></div>
  </main>
  <script type="module" src="/app/app.js"></script>
</body>
</html>
```

Create `app/app.js` containing only `export {};` for this task.

- [ ] **Step 4: Create the base black-glass/mobile CSS contract**

Create `app/app.css`:

```css
:root{color-scheme:dark;--void:#050608;--panel:#0b0f12;--cyan:#00e5ff;--red:#ff1e2d;--hot:#ff4050;--green:#39ff88;--amber:#f6c945;--white:#f3f7fa;--muted:#7d8b95}
*{box-sizing:border-box;max-width:100%}html,body{margin:0;min-height:100%;background:var(--void);color:var(--white);overflow-x:hidden}body{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;line-height:1.45}button,input,select{font:inherit;color:inherit;background:#090d10;border:1px solid #26343b}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}.app-shell{position:relative;z-index:4;width:min(1440px,100%);margin:0 auto;padding:12px}.access{width:min(560px,100%);margin:10vh auto 0;padding:20px;border:1px solid #22343c;background:rgba(11,15,18,.96)}.workspace,.view,.hud,.tabs{min-width:0;overflow-wrap:anywhere}.topbar,.pivot-console,.result-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:720px){.app-shell{padding:8px}.topbar{position:sticky;top:0;z-index:8}.pivot-console{position:sticky;top:44px;z-index:7}.semantic-legend{display:none}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
```

- [ ] **Step 5: Add `/app` routing**

Insert immediately after `{ "handle": "filesystem" }` in `vercel.json`:

```json
{"src":"/app/?","dest":"/app/index.html"}
```

Keep the existing `/api/para11ax/(.*)` route immediately after it and before human error fallbacks.

- [ ] **Step 6: Add the landing CTA**

Add to the existing landing-page primary action area:

```html
<a class="enter-app" href="/app">ENTER PARA11AX</a>
```

Add this local style to the existing inline landing CSS:

```css
.enter-app{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border:1px solid #00e5ff;background:linear-gradient(90deg,rgba(0,229,255,.05),rgba(255,30,45,.05));box-shadow:inset 0 0 24px rgba(0,229,255,.04),0 0 18px rgba(0,229,255,.08);font-size:.72rem;font-weight:800;letter-spacing:.12em}
```

- [ ] **Step 7: Re-run focused test and commit**

```bash
node --test test/web-ui.test.mjs
git add app/index.html app/app.css app/app.js test/web-ui.test.mjs index.html vercel.json
git commit -m "feat: add PARA11AX analyst app shell"
```

Expected: PASS before commit.

---

### Task 2: Implement Same-Origin API, Response Gates, and Memory-Only Session

**Files:**
- Create: `app/api-client.js`
- Create: `app/session.js`
- Create: `test/web-ui-logic.test.mjs`

**Interfaces:**
- `createGatewayClient({ fetchImpl, getToken })` → `health`, `enrich`, `stix`.
- `GatewayHttpError` exposes `status`, `code`, `requestId` only.
- `createSession()` → `setToken`, `getToken`, `unlock`, `startRequest`, `finishRequest`, `reset`, `disconnect`, `snapshot`.

- [ ] **Step 1: Write failing API/session/shape-gate tests**

Create `test/web-ui-logic.test.mjs`:

```js
import assert from 'node:assert/strict';import test from 'node:test';
import { createGatewayClient, GatewayHttpError } from '../app/api-client.js';import { createSession } from '../app/session.js';
const jsonResponse=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('gateway client uses relative same-origin bearer request',async()=>{const calls=[];const client=createGatewayClient({getToken:()=> 'secret-token',fetchImpl:async(url,init)=>{calls.push({url,init});return jsonResponse(200,{ready:true});}});assert.deepEqual(await client.health(),{ready:true});assert.equal(calls[0].url,'/api/para11ax/health');assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.headers.Authorization,'Bearer secret-token');});

test('enrich sends only indicator and fixed profile',async()=>{let sent;const client=createGatewayClient({getToken:()=> 't',fetchImpl:async(_url,init)=>{sent=JSON.parse(init.body);return jsonResponse(200,{requestId:'r',indicator:'example.org',type:'domain',profile:'standard',status:'ok',evidence:[],failures:[],relationships:[],correlation:{}});}});await client.enrich('example.org','standard');assert.deepEqual(sent,{indicator:'example.org',profile:'standard'});await assert.rejects(()=>client.enrich('example.org','virustotal'),/invalid profile/i);});

test('malformed enrichment payload fails closed',async()=>{const client=createGatewayClient({getToken:()=> 't',fetchImpl:async()=>jsonResponse(200,{status:'ok'})});await assert.rejects(()=>client.enrich('example.org','fast'),(e)=>e instanceof GatewayHttpError&&e.code==='invalid_envelope');});

test('invalid STIX bundle fails closed',async()=>{const client=createGatewayClient({getToken:()=> 't',fetchImpl:async()=>jsonResponse(200,{objects:[]})});await assert.rejects(()=>client.stix('example.org','fast'),(e)=>e instanceof GatewayHttpError&&e.code==='invalid_stix_bundle');});

test('structured errors never include bearer text',async()=>{const client=createGatewayClient({getToken:()=> 'never-echo-me',fetchImpl:async()=>jsonResponse(401,{error:'unauthorized',requestId:'r1'})});await assert.rejects(()=>client.health(),(e)=>e instanceof GatewayHttpError&&e.status===401&&e.code==='unauthorized'&&!String(e).includes('never-echo-me'));});

test('session snapshot never exposes token and only one request is active',()=>{const session=createSession();session.setToken('shared-bearer');session.unlock();assert.equal(JSON.stringify(session.snapshot()).includes('shared-bearer'),false);const first=new AbortController();session.startRequest(first);assert.throws(()=>session.startRequest(new AbortController()),/request already active/i);});

test('disconnect aborts work and clears auth/result state',()=>{const session=createSession();session.setToken('t');session.unlock();const controller=new AbortController();session.startRequest(controller);session.disconnect();assert.equal(controller.signal.aborted,true);assert.equal(session.getToken(),null);assert.deepEqual(session.snapshot(),{mode:'locked',result:null,hasToken:false,requestActive:false});});
```

- [ ] **Step 2: Run and confirm red**

```bash
node --test test/web-ui-logic.test.mjs
```

Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement gateway client with strict enrichment/STIX gates**

Create `app/api-client.js`:

```js
const PROFILES=new Set(['fast','standard','full']);
export class GatewayHttpError extends Error{constructor(status,code,requestId=null){super(`gateway request failed: ${code||status}`);this.name='GatewayHttpError';this.status=status;this.code=code||'request_failed';this.requestId=requestId;}}
function validEnvelope(x){return x&&typeof x==='object'&&typeof x.requestId==='string'&&typeof x.indicator==='string'&&typeof x.type==='string'&&PROFILES.has(x.profile)&&['ok','partial','error'].includes(x.status)&&Array.isArray(x.evidence)&&Array.isArray(x.failures)&&Array.isArray(x.relationships)&&x.correlation&&typeof x.correlation==='object';}
function validStix(x){return x&&typeof x==='object'&&x.type==='bundle'&&Array.isArray(x.objects);}
export function createGatewayClient({fetchImpl=fetch,getToken}){if(typeof getToken!=='function')throw new TypeError('getToken must be a function');
  async function request(path,{method='GET',body,signal,validate}={}){if(!path.startsWith('/api/'))throw new Error('same-origin API path required');const token=getToken();if(!token)throw new GatewayHttpError(401,'unauthorized');const headers={Authorization:`Bearer ${token}`};if(body!==undefined)headers['Content-Type']='application/json';const response=await fetchImpl(path,{method,headers,credentials:'same-origin',cache:'no-store',signal,body:body===undefined?undefined:JSON.stringify(body)});const isJson=response.headers.get('content-type')?.includes('application/json');const payload=isJson?await response.json():null;if(!response.ok)throw new GatewayHttpError(response.status,payload?.error,payload?.requestId);if(!isJson)throw new GatewayHttpError(502,'unexpected_response');if(validate&&!validate(payload))throw new GatewayHttpError(502,path==='/api/para11ax/stix'?'invalid_stix_bundle':'invalid_envelope');return payload;}
  function payload(indicator,profile){if(!PROFILES.has(profile))throw new TypeError('invalid profile');return{indicator:String(indicator),profile};}
  return Object.freeze({health:(signal)=>request('/api/para11ax/health',{signal}),enrich:(indicator,profile,signal)=>request('/api/para11ax/enrich',{method:'POST',body:payload(indicator,profile),signal,validate:validEnvelope}),stix:(indicator,profile,signal)=>request('/api/para11ax/stix',{method:'POST',body:payload(indicator,profile),signal,validate:validStix})});}
```

- [ ] **Step 4: Implement session state**

Create `app/session.js`:

```js
export function createSession(){let token=null,mode='locked',result=null,activeController=null;const abortActive=()=>{if(activeController&&!activeController.signal.aborted)activeController.abort();activeController=null;};return Object.freeze({setToken(value){token=String(value||'').trim()||null;mode='locked';result=null;},getToken:()=>token,unlock(){if(!token)throw new Error('token required');mode='ready';},startRequest(controller){if(!['ready','result'].includes(mode))throw new Error('session not ready');if(activeController)throw new Error('request already active');activeController=controller;mode='running';result=null;},finishRequest(value){if(mode!=='running')throw new Error('no active request');activeController=null;result=value;mode='result';},reset(){abortActive();result=null;mode=token?'ready':'locked';},disconnect(){abortActive();token=null;result=null;mode='locked';},snapshot(){return Object.freeze({mode,result,hasToken:Boolean(token),requestActive:Boolean(activeController)});}});}
```

- [ ] **Step 5: Run and commit**

```bash
node --test test/web-ui-logic.test.mjs
git add app/api-client.js app/session.js test/web-ui-logic.test.mjs
git commit -m "feat: add browser gateway session client"
```

Expected: PASS before commit.

---

### Task 3: Add Semantic View Models and Safe DOM Renderers

**Files:**
- Create: `app/view-model.js`
- Create: `app/renderers.js`
- Modify: `test/web-ui-logic.test.mjs`
- Modify: `test/web-ui.test.mjs`

**Interfaces:**
- Pure: `buildOverview`, `buildEvidence`, `buildCorrelation`, `buildRelationships`, `buildCoverage`, `jsonLines`.
- DOM: `clear`, `renderOverview`, `renderEvidence`, `renderCorrelation`, `renderRelationships`, `renderCoverage`, `renderRaw(target, lines, query='')`.

- [ ] **Step 1: Add failing semantic tests**

Append:

```js
import { buildOverview,buildEvidence,buildCorrelation,buildCoverage,jsonLines } from '../app/view-model.js';
const sampleEnvelope={requestId:'req-1',indicator:'evil.example',type:'domain',profile:'standard',durationMs:420,status:'partial',providerSummary:{ok:2,failed:1,skipped:0,cached:1},evidence:[{provider:'rdap',observation:{kind:'registration',verdict:'observed'},references:[]},{provider:'ransomware-live',observation:{kind:'ransomware_victim_claim',verdict:'observed'},references:[]}],failures:[{provider:'censys',error:'rate_limited'}],relationships:[],correlation:{corroboration:[],contradictions:[{kind:'reputation',providers:['a','b']}],freshness:'current',huntability:{level:'high',rationale:'actionable pivots'},riskAxes:{kev:{listed:true},epss:{score:.94},cvss:{score:9.8}}}};
test('partial stays incomplete coverage',()=>{const m=buildOverview(sampleEnvelope);assert.equal(m.status,'partial');assert.equal(m.tone,'amber');});
test('context and claims remain distinct',()=>{const c=buildEvidence(sampleEnvelope);assert.equal(c[0].semanticClass,'context');assert.equal(c[1].semanticClass,'claim');assert.match(c[1].semanticNote,/claim|report/i);});
test('CVE axes stay separate',()=>{const m=buildCorrelation(sampleEnvelope);assert.deepEqual(Object.keys(m.riskAxes).sort(),['cvss','epss','kev']);assert.equal(m.combinedScore,undefined);});
test('failures stay outside evidence',()=>{assert.equal(buildEvidence(sampleEnvelope).some(x=>x.provider==='censys'),false);assert.equal(buildCoverage(sampleEnvelope).failures[0].provider,'censys');});
test('raw lines reconstruct exact object',()=>{assert.deepEqual(JSON.parse(jsonLines(sampleEnvelope).map(x=>x.text).join('\n')),sampleEnvelope);});
```

Append to `test/web-ui.test.mjs`:

```js
test('renderer uses safe DOM APIs only',()=>{const s=read('app/renderers.js');assert.doesNotMatch(s,/innerHTML|outerHTML|insertAdjacentHTML/);assert.match(s,/createElement/);assert.match(s,/textContent/);assert.match(s,/query/i);});
```

- [ ] **Step 2: Run and confirm red**

```bash
node --test test/web-ui-logic.test.mjs test/web-ui.test.mjs
```

- [ ] **Step 3: Implement view models**

Create `app/view-model.js`:

```js
const CONTEXT=new Set(['registration','routing','network_identity','internet_exposure','scanner_activity','internet_noise','tor_exit','attack_knowledge']);const CLAIM=new Set(['community_ioc_report','ransomware_post_reference','ransomware_victim_claim']);
export function buildOverview(e){return{indicator:e.indicator,type:e.type,requestId:e.requestId,profile:e.profile,status:e.status,tone:e.status==='ok'?'green':e.status==='partial'?'amber':'red',durationMs:e.durationMs,providerSummary:e.providerSummary||{},freshness:e.correlation?.freshness||'unknown',huntability:e.correlation?.huntability||null};}
export function buildEvidence(e){return(e.evidence||[]).map(item=>{const kind=item.observation?.kind||'unknown',semanticClass=CONTEXT.has(kind)?'context':CLAIM.has(kind)?'claim':'evidence';return{provider:item.provider,kind,verdict:item.observation?.verdict??null,semanticClass,semanticNote:semanticClass==='claim'?'Reported/claimed evidence; not proof of compromise.':'',confidence:item.observation?.confidence??null,firstSeen:item.observation?.firstSeen??null,lastSeen:item.observation?.lastSeen??null,attributes:item.observation?.attributes??{},tags:item.observation?.tags??[],references:item.references??[],cacheState:item.cacheState??null,retrievedAt:item.retrievedAt??null,parserVersion:item.integrity?.parserVersion??null,fingerprint:item.integrity?.fingerprint??null};});}
export function buildCorrelation(e){const c=e.correlation||{};return{corroboration:c.corroboration||[],contradictions:c.contradictions||[],freshness:c.freshness||'unknown',huntability:c.huntability||null,riskAxes:{kev:c.riskAxes?.kev??null,epss:c.riskAxes?.epss??null,cvss:c.riskAxes?.cvss??null},attributionConfidence:c.attributionConfidence??null};}
export const buildRelationships=e=>e.relationships||e.correlation?.relationships||[];export const buildCoverage=e=>({failures:e.failures||[],summary:e.providerSummary||{}});export const jsonLines=e=>JSON.stringify(e,null,2).split('\n').map((text,index)=>({number:index+1,text}));
```

- [ ] **Step 4: Implement safe renderers including Raw filtering**

Create `app/renderers.js`:

```js
function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined&&text!==null)n.textContent=String(text);return n;}export function clear(target){while(target.firstChild)target.removeChild(target.firstChild);}
export function renderOverview(target,m){clear(target);const p=el('section',`overview tone-${m.tone}`);for(const[label,value]of[['STATUS',m.status],['TYPE',m.type],['INDICATOR',m.indicator],['PROFILE',m.profile],['DURATION',m.durationMs==null?'—':`${m.durationMs} ms`],['FRESHNESS',m.freshness],['HUNTABILITY',m.huntability?.level??'—'],['OK',m.providerSummary.ok??0],['FAILED',m.providerSummary.failed??0],['CACHED',m.providerSummary.cached??0]]){const c=el('div','hud-cell');c.append(el('span','hud-label',label),el('strong','hud-value',value));p.append(c);}target.append(p);}
export function renderEvidence(target,cards){clear(target);for(const card of cards){const a=el('article',`signal semantic-${card.semanticClass}`);a.append(el('p','signal-provider',card.provider),el('p','signal-kind',card.kind));if(card.verdict!==null)a.append(el('strong','signal-verdict',card.verdict));if(card.semanticNote)a.append(el('p','semantic-note',card.semanticNote));if(card.tags.length)a.append(el('p','signal-meta',`tags: ${card.tags.join(', ')}`));if(Object.keys(card.attributes).length)a.append(el('pre','signal-attributes',JSON.stringify(card.attributes,null,2)));const d=el('details','signal-details');d.append(el('summary',null,'TECHNICAL / PROVENANCE'),el('p',null,`cache: ${card.cacheState??'unknown'}`),el('p',null,`retrieved: ${card.retrievedAt??'unknown'}`),el('p',null,`parser: ${card.parserVersion??'unknown'}`),el('p',null,`fingerprint: ${card.fingerprint??'unavailable'}`));for(const ref of card.references){const line=el('p','reference-line');let linked=false;try{const u=new URL(ref);if(u.protocol==='https:'){const link=el('a','reference',ref);link.href=u.href;link.rel='noopener noreferrer';link.target='_blank';line.append(link);linked=true;}}catch{}if(!linked)line.append(el('span','reference',ref));d.append(line);}a.append(d);target.append(a);}}
export function renderCorrelation(target,m){clear(target);const s=el('section','correlation-grid');s.append(el('p','signal-meta',`freshness: ${m.freshness}`),el('p','signal-meta',`huntability: ${m.huntability?.level??'unknown'}`));if(m.huntability?.rationale)s.append(el('p','signal-meta',m.huntability.rationale));for(const x of m.corroboration)s.append(el('pre','corroboration',JSON.stringify(x,null,2)));for(const x of m.contradictions)s.append(el('pre','contradiction',JSON.stringify(x,null,2)));const axes=el('section','risk-axes');for(const[name,value]of Object.entries(m.riskAxes)){const row=el('div',`risk-axis risk-${name}`);row.append(el('strong',null,name.toUpperCase()),el('code',null,value==null?'unavailable':JSON.stringify(value)));axes.append(row);}s.append(axes);target.append(s);}
export function renderRelationships(target,r){clear(target);const l=el('div','relationship-chain');for(const x of r)l.append(el('pre','relationship',JSON.stringify(x,null,2)));if(!r.length)l.append(el('p','empty-state','No relationships emitted.'));target.append(l);}
export function renderCoverage(target,m){clear(target);const p=el('section','coverage');p.append(el('p','coverage-summary',`ok ${m.summary.ok??0} · failed ${m.summary.failed??0} · skipped ${m.summary.skipped??0} · cached ${m.summary.cached??0}`));for(const f of m.failures)p.append(el('pre','coverage-failure',JSON.stringify(f,null,2)));if(!m.failures.length)p.append(el('p','empty-state','No provider failures reported.'));target.append(p);}
export function renderRaw(target,lines,query=''){clear(target);const needle=String(query).toLowerCase(),pre=el('pre','raw-console');for(const line of lines){if(needle&&!line.text.toLowerCase().includes(needle))continue;const row=el('span','code-line');row.append(el('span','line-number',line.number),el('span','line-text',line.text));pre.append(row);}target.append(pre);}
```

- [ ] **Step 5: Run and commit**

```bash
node --test test/web-ui-logic.test.mjs test/web-ui.test.mjs
git add app/view-model.js app/renderers.js test/web-ui-logic.test.mjs test/web-ui.test.mjs
git commit -m "feat: add semantic evidence renderers"
```

Expected: PASS before commit.

---

### Task 4: Add Fixed Synthesized Sound Cues

**Files:**
- Create: `app/audio.js`
- Modify: `test/web-ui-logic.test.mjs`
- Modify: `test/web-ui.test.mjs`

**Interfaces:**
- `createAudioEngine({ AudioContextCtor, now })` → `enable`, `play`, `typing`, `mute`, `setVolume`, `state`.
- Fixed cues: `access-ok`, `access-denied`, `key`, `tab`, `scan`, `result-ok`, `result-partial`, `result-error`, `contradiction`, `copy`, `stix-start`, `stix-ok`, `disconnect`.

- [ ] **Step 1: Add failing audio tests**

Append:

```js
import { createAudioEngine } from '../app/audio.js';
class FakeParam{setValueAtTime(){}linearRampToValueAtTime(){}exponentialRampToValueAtTime(){}}class FakeNode{constructor(){this.frequency=new FakeParam();this.gain=new FakeParam();}connect(){return this;}start(){}stop(){}}class FakeAudioContext{constructor(){this.currentTime=1;this.destination={};this.state='running';}createOscillator(){return new FakeNode();}createGain(){return new FakeNode();}resume(){return Promise.resolve();}}
test('audio is user-enabled and token typing is silent',async()=>{let clock=1000;const a=createAudioEngine({AudioContextCtor:FakeAudioContext,now:()=>clock});assert.equal(a.state().enabled,false);await a.enable();const before=a.state().emitted;a.typing('token');assert.equal(a.state().emitted,before);a.typing('pivot');const once=a.state().emitted;a.typing('pivot');assert.equal(a.state().emitted,once);clock+=60;a.typing('pivot');assert.ok(a.state().emitted>once);});
test('mute and volume are bounded',async()=>{const a=createAudioEngine({AudioContextCtor:FakeAudioContext});await a.enable();a.setVolume(5);assert.equal(a.state().volume,1);a.setVolume(-1);assert.equal(a.state().volume,0);a.setVolume(.35);a.mute(true);const before=a.state().emitted;a.play('scan');assert.equal(a.state().emitted,before);});
test('unknown cues are rejected',async()=>{const a=createAudioEngine({AudioContextCtor:FakeAudioContext});await a.enable();assert.throws(()=>a.play('ioc-derived-frequency'),/unknown cue/i);});
```

Append static test:

```js
test('audio engine contains no network/media loading or persistence',()=>{const s=read('app/audio.js');assert.doesNotMatch(s,/fetch\s*\(|XMLHttpRequest|new\s+Audio\s*\(|\.mp3|\.wav|\.ogg/i);assert.doesNotMatch(s,/localStorage|sessionStorage|indexedDB|document\.cookie/i);});
```

- [ ] **Step 2: Run and confirm red**

```bash
node --test test/web-ui-logic.test.mjs test/web-ui.test.mjs
```

- [ ] **Step 3: Implement fixed Web Audio engine**

Create `app/audio.js`:

```js
const CUES=Object.freeze({'access-ok':[[330,.08],[660,.11]],'access-denied':[[190,.12],[120,.15]],key:[[1900,.025]],tab:[[720,.035]],scan:[[180,.18],[980,.22]],'result-ok':[[330,.07],[494,.08],[660,.12]],'result-partial':[[370,.10],[311,.16]],'result-error':[[150,.14],[105,.18]],contradiction:[[240,.08],[95,.12]],copy:[[840,.03]],'stix-start':[[220,.09],[880,.16]],'stix-ok':[[440,.06],[660,.10]],disconnect:[[330,.08],[165,.12],[82,.16]]});
export function createAudioEngine({AudioContextCtor=globalThis.AudioContext||globalThis.webkitAudioContext,now=()=>performance.now()}={}){let context=null,enabled=false,muted=false,volume=.35,emitted=0,lastTyping=-Infinity;const state=()=>Object.freeze({enabled,muted,volume,emitted,supported:Boolean(AudioContextCtor)});async function enable(){if(!AudioContextCtor)return state();context||=new AudioContextCtor();if(context.state==='suspended')await context.resume();enabled=true;return state();}function tone(frequency,duration,offset){const o=context.createOscillator(),g=context.createGain();o.type='square';o.frequency.setValueAtTime(frequency,context.currentTime+offset);g.gain.setValueAtTime(.0001,context.currentTime+offset);g.gain.linearRampToValueAtTime(Math.max(.0001,volume*.09),context.currentTime+offset+.008);g.gain.exponentialRampToValueAtTime(.0001,context.currentTime+offset+duration);o.connect(g).connect(context.destination);o.start(context.currentTime+offset);o.stop(context.currentTime+offset+duration+.01);}function play(name){const recipe=CUES[name];if(!recipe)throw new Error(`unknown cue: ${name}`);if(!enabled||muted||volume<=0||!context)return;let offset=0;for(const[f,d]of recipe){tone(f,Math.min(d,.45),offset);offset+=d*.55;}emitted+=1;}function typing(kind){if(kind==='token')return;const t=now();if(t-lastTyping<45)return;lastTyping=t;play('key');}return Object.freeze({enable,play,typing,mute(v){muted=Boolean(v);},setVolume(v){volume=Math.min(1,Math.max(0,Number(v)||0));},state});}
```

- [ ] **Step 4: Run and commit**

```bash
node --test test/web-ui-logic.test.mjs test/web-ui.test.mjs
git add app/audio.js test/web-ui-logic.test.mjs test/web-ui.test.mjs
git commit -m "feat: add synthesized PARA11AX sound cues"
```

Expected: PASS before commit.

---

### Task 5: Wire Controller, Raw Search, Exports, Correct 401 Teardown, and Maximum Cyberpunk UI

**Files:**
- Modify: `app/app.js`
- Modify: `app/app.css`
- Modify: `test/web-ui.test.mjs`
- Modify: `test/web-ui-logic.test.mjs`

**Interfaces:**
- Consumes all modules from Tasks 2–4.
- Contradiction sound fires once per request only when Correlation first becomes visible.

- [ ] **Step 1: Add failing controller/design tests**

Append to `test/web-ui.test.mjs`:

```js
test('controller exposes approved views, raw filter, and no provider override',()=>{const s=read('app/app.js');for(const v of ['overview','evidence','correlation','relationships','coverage','raw'])assert.match(s,new RegExp(`['"]${v}['"]`));assert.match(s,/raw-search/);assert.doesNotMatch(s,/providerOverride|providers\s*:/i);assert.doesNotMatch(s,/token[^\n]{0,120}typing\s*\(/i);});
test('maximum design contains semantic palette and three rain depths',()=>{const c=read('app/app.css').toLowerCase();for(const x of ['#050608','#0b0f12','#00e5ff','#ff1e2d','#39ff88','#f6c945','matrix-far','matrix-mid','matrix-front','semantic-context','semantic-claim','tone-amber','coverage-failure','code-line'])assert.match(c,new RegExp(x));});
```

Append to `test/web-ui-logic.test.mjs`:

```js
test('JSON serialization is exact',async()=>{const{serializeJson}=await import('../app/app.js');const v={status:'partial',evidence:[{provider:'x'}]};assert.deepEqual(JSON.parse(serializeJson(v)),v);});
```

- [ ] **Step 2: Run and confirm red**

```bash
node --test test/web-ui.test.mjs test/web-ui-logic.test.mjs
```

- [ ] **Step 3: Implement complete controller**

Replace `app/app.js`:

```js
import{createGatewayClient,GatewayHttpError}from'./api-client.js';import{createSession}from'./session.js';import{createAudioEngine}from'./audio.js';import{buildOverview,buildEvidence,buildCorrelation,buildRelationships,buildCoverage,jsonLines}from'./view-model.js';import{clear,renderOverview,renderEvidence,renderCorrelation,renderRelationships,renderCoverage,renderRaw}from'./renderers.js';
export const VIEWS=Object.freeze(['overview','evidence','correlation','relationships','coverage','raw']);export const serializeJson=value=>JSON.stringify(value,null,2);
function safeFilename(indicator,suffix){const stem=String(indicator||'indicator').replace(/[^a-z0-9._-]+/gi,'_').slice(0,80)||'indicator';return`${stem}.${suffix}`;}function downloadText(text,type,filename){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.rel='noopener';a.click();queueMicrotask(()=>URL.revokeObjectURL(url));}async function copyText(v){await navigator.clipboard.writeText(String(v));}
if(typeof document!=='undefined')bootstrap();
function bootstrap(){const session=createSession(),audio=createAudioEngine(),client=createGatewayClient({getToken:session.getToken}),byId=id=>document.getElementById(id);const accessPanel=byId('access-panel'),accessForm=byId('access-form'),tokenInput=byId('token'),workspace=byId('workspace'),pivotForm=byId('pivot-form'),indicatorInput=byId('indicator'),profile=byId('profile'),hud=byId('result-status'),tabs=byId('tabs'),actions=byId('result-actions'),view=byId('view'),live=byId('live-status'),rawSearch=byId('raw-search'),rawSearchLabel=byId('raw-search-label');let activeView='overview',currentResult=null,contradictionCueRequestId=null;
  const announce=t=>{live.textContent=t;},setLocked=locked=>{accessPanel.hidden=!locked;workspace.hidden=locked;};
  function clearResult(){currentResult=null;contradictionCueRequestId=null;clear(hud);clear(tabs);clear(view);hud.hidden=true;tabs.hidden=true;actions.hidden=true;rawSearch.hidden=true;rawSearchLabel.hidden=true;rawSearch.value='';}
  function lockSession(message){session.disconnect();clearResult();indicatorInput.value='';tokenInput.value='';setLocked(true);announce(message);}
  accessForm.addEventListener('submit',async event=>{event.preventDefault();await audio.enable();session.setToken(tokenInput.value);try{await client.health();session.unlock();audio.play('access-ok');setLocked(false);tokenInput.value='';announce('Session established.');}catch(error){audio.play('access-denied');lockSession(error instanceof GatewayHttpError&&error.status===401?'Unauthorized token.':'Gateway unavailable.');}});
  indicatorInput.addEventListener('input',()=>audio.typing('pivot'));byId('sound-toggle').addEventListener('click',()=>{const muted=!audio.state().muted;audio.mute(muted);byId('sound-toggle').setAttribute('aria-pressed',String(!muted));byId('sound-toggle').textContent=muted?'SOUND OFF':'SOUND ON';});byId('volume').addEventListener('input',e=>audio.setVolume(e.currentTarget.value));
  function renderTabs(){clear(tabs);for(const name of VIEWS){const b=document.createElement('button');b.type='button';b.textContent=name.toUpperCase();b.dataset.view=name;b.setAttribute('aria-pressed',String(name===activeView));b.addEventListener('click',()=>{activeView=name;audio.play('tab');renderTabs();renderActiveView();});tabs.append(b);}}
  function renderActiveView(){rawSearch.hidden=activeView!=='raw';rawSearchLabel.hidden=activeView!=='raw';if(activeView==='overview')return renderOverview(view,buildOverview(currentResult));if(activeView==='evidence')return renderEvidence(view,buildEvidence(currentResult));if(activeView==='correlation'){const model=buildCorrelation(currentResult);renderCorrelation(view,model);if(model.contradictions.length&&contradictionCueRequestId!==currentResult.requestId){audio.play('contradiction');contradictionCueRequestId=currentResult.requestId;}return;}if(activeView==='relationships')return renderRelationships(view,buildRelationships(currentResult));if(activeView==='coverage')return renderCoverage(view,buildCoverage(currentResult));return renderRaw(view,jsonLines(currentResult),rawSearch.value);}
  rawSearch.addEventListener('input',()=>{if(currentResult&&activeView==='raw')renderActiveView();});
  function renderResult(){renderOverview(hud,buildOverview(currentResult));hud.hidden=false;tabs.hidden=false;actions.hidden=false;renderTabs();renderActiveView();}
  pivotForm.addEventListener('submit',async event=>{event.preventDefault();const controller=new AbortController();try{session.startRequest(controller);audio.play('scan');document.body.classList.add('is-scanning');announce('Enrichment running.');const result=await client.enrich(indicatorInput.value,profile.value,controller.signal);currentResult=result;session.finishRequest(result);renderResult();audio.play(result.status==='ok'?'result-ok':result.status==='partial'?'result-partial':'result-error');announce(`Enrichment complete: ${result.status}.`);}catch(error){if(error?.name==='AbortError')return;if(error instanceof GatewayHttpError&&error.status===401){audio.play('access-denied');lockSession('Session unauthorized.');return;}session.reset();audio.play('result-error');announce(error instanceof GatewayHttpError?`Gateway error: ${error.code}.`:'Request failed.');}finally{document.body.classList.remove('is-scanning');}});
  byId('copy-ioc').addEventListener('click',async()=>{if(currentResult){await copyText(currentResult.indicator);audio.play('copy');}});byId('copy-json').addEventListener('click',async()=>{if(currentResult){await copyText(serializeJson(currentResult));audio.play('copy');}});byId('download-json').addEventListener('click',()=>{if(currentResult)downloadText(serializeJson(currentResult),'application/json',safeFilename(currentResult.indicator,'evidence.json'));});
  byId('download-stix').addEventListener('click',async()=>{if(!currentResult)return;const controller=new AbortController();audio.play('stix-start');try{const bundle=await client.stix(currentResult.indicator,currentResult.profile,controller.signal);downloadText(serializeJson(bundle),'application/stix+json',safeFilename(currentResult.indicator,'stix.json'));audio.play('stix-ok');}catch(error){if(error instanceof GatewayHttpError&&error.status===401){audio.play('access-denied');lockSession('Session unauthorized.');return;}audio.play('result-error');announce(error instanceof GatewayHttpError?`STIX export failed: ${error.code}.`:'STIX export failed.');}});
  byId('reset').addEventListener('click',()=>{session.reset();clearResult();indicatorInput.value='';announce('Result cleared.');});byId('disconnect').addEventListener('click',()=>{audio.play('disconnect');lockSession('Disconnected.');});}
```

- [ ] **Step 4: Replace base CSS with maximum terminal design**

Append/replace the base styling with this core; visual QA may tune only spacing/opacity, not semantic color meanings:

```css
.matrix,.geometry,.crt{position:fixed;inset:0;pointer-events:none}.matrix{z-index:0;overflow:hidden}.rain-col{position:absolute;top:-130%;width:1rem;color:var(--red);font-size:.61rem;line-height:.78rem;word-break:break-all;text-shadow:0 0 7px var(--red);opacity:.26;animation:fall var(--rain-speed,4.5s) linear infinite}.matrix-far .rain-col{opacity:.13;--rain-speed:8s}.matrix-mid .rain-col{opacity:.25;--rain-speed:3.7s}.matrix-front{opacity:0;transition:opacity .12s}.matrix-front .rain-col{opacity:.38;--rain-speed:1.6s}.is-scanning .matrix-front{opacity:.55}.rain-col:nth-child(1){left:3%;animation-delay:-.2s}.rain-col:nth-child(2){left:11%;animation-delay:-1.1s}.rain-col:nth-child(3){left:19%;animation-delay:-2.3s}.rain-col:nth-child(4){left:27%;animation-delay:-.8s}.rain-col:nth-child(5){left:35%;animation-delay:-3.1s}.rain-col:nth-child(6){left:43%;animation-delay:-1.7s}.rain-col:nth-child(7){left:51%;animation-delay:-.4s}.rain-col:nth-child(8){left:59%;animation-delay:-2.6s}.rain-col:nth-child(9){left:67%;animation-delay:-1.3s}.rain-col:nth-child(10){left:75%;animation-delay:-3.4s}.rain-col:nth-child(11){left:83%;animation-delay:-.9s}.rain-col:nth-child(12){left:91%;animation-delay:-2.1s}@keyframes fall{to{transform:translateY(245vh)}}
.geometry{z-index:1;background:linear-gradient(33deg,transparent 49.85%,rgba(0,229,255,.14) 50%,transparent 50.15%),linear-gradient(-33deg,transparent 49.85%,rgba(0,229,255,.14) 50%,transparent 50.15%)}.crt{z-index:3;opacity:.13;background:repeating-linear-gradient(180deg,transparent 0 3px,rgba(255,255,255,.035) 4px 5px);box-shadow:inset 0 0 16vw rgba(0,0,0,.78)}
.topbar{position:sticky;top:0;z-index:10;padding:8px 10px;border:1px solid #1f3038;background:rgba(5,6,8,.94);backdrop-filter:blur(10px)}.mark{font-size:.9rem;font-weight:900;letter-spacing:.12em;text-decoration:none;color:var(--white)}.mark span{color:var(--cyan)}.connection{color:var(--green);font-size:.7rem}.semantic-legend{display:flex;gap:8px;flex:1;font-size:.62rem}.legend-cyan{color:var(--cyan)}.legend-green{color:var(--green)}.legend-amber{color:var(--amber)}.legend-red{color:var(--red)}
.pivot-console{position:sticky;top:48px;z-index:9;margin-top:8px;padding:10px;border:1px solid #24404a;background:linear-gradient(90deg,rgba(0,229,255,.04),rgba(11,15,18,.96),rgba(255,30,45,.03));box-shadow:0 10px 36px rgba(0,0,0,.38)}.pivot-console input{flex:1;min-width:min(420px,100%);font-size:clamp(1rem,4vw,1.35rem);padding:10px;border-color:#2d4d58}.pivot-console input:focus{box-shadow:0 0 0 1px var(--cyan),0 0 24px rgba(0,229,255,.1)}
.scanner-track{height:2px;margin:6px 0;overflow:hidden;background:#26090e}.scanner-track i{display:block;width:16%;height:100%;background:linear-gradient(90deg,transparent,var(--red),#fff,var(--red),transparent);transform:translateX(-120%)}.is-scanning .scanner-track i{animation:scanner .7s ease-in-out 1}@keyframes scanner{to{transform:translateX(720%)}}
.hud{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:5px;padding:8px;border:1px solid #213139;background:rgba(8,11,13,.94)}.hud-cell{padding:7px;border-left:2px solid var(--cyan);background:#090d10}.hud-label{display:block;color:var(--muted);font-size:.64rem}.hud-value{font-size:.76rem}.tone-green .hud-cell:first-child{border-color:var(--green)}.tone-amber .hud-cell:first-child{border-color:var(--amber)}.tone-red .hud-cell:first-child{border-color:var(--red)}
.tabs{position:sticky;top:108px;z-index:8;display:flex;gap:4px;overflow-x:auto;padding:6px 0;background:rgba(5,6,8,.94)}.tabs button{white-space:nowrap;font-size:.68rem;padding:7px 9px}.tabs button[aria-pressed="true"]{border-color:var(--cyan);color:var(--cyan);box-shadow:inset 0 -1px var(--cyan)}.raw-search-label{display:block;color:var(--cyan);font-size:.64rem}.raw-search{width:100%;padding:7px;margin:4px 0}
.result-actions{position:sticky;bottom:0;z-index:9;padding:7px;background:rgba(5,6,8,.95);border-top:1px solid #24343c}.result-actions button{font-size:.66rem;padding:7px 9px}.view{display:grid;gap:7px;padding:8px 0 64px}.signal{position:relative;padding:10px;border:1px solid #25323a;border-left-width:3px;background:rgba(11,15,18,.95);font-size:.82rem;animation:signal-in .22s ease-out both}.semantic-context{border-left-color:var(--cyan)}.semantic-claim{border-left-color:var(--amber)}.semantic-evidence{border-left-color:var(--green)}.signal-provider{margin:0;font-size:.8rem;font-weight:800}.signal-kind{margin:2px 0;color:var(--muted);font-size:.68rem}.signal-verdict{color:var(--green)}.semantic-note{color:var(--amber)}.signal-details{font-size:.7rem;color:#aab4ba}@keyframes signal-in{from{opacity:0;transform:translateY(5px);clip-path:inset(0 0 100% 0)}to{opacity:1;transform:none;clip-path:inset(0)}}
.correlation-grid,.coverage,.relationship-chain,.raw-console{min-width:0;padding:10px;border:1px solid #213139;background:rgba(8,11,13,.95)}.contradiction{border-left:3px solid var(--red);color:#ffc1c6;white-space:pre-wrap;overflow-wrap:anywhere}.corroboration{border-left:3px solid var(--green);white-space:pre-wrap;overflow-wrap:anywhere}.risk-axes{display:grid;gap:5px}.risk-axis{display:grid;grid-template-columns:70px 1fr;gap:8px;padding:6px;border:1px solid #29343a}.risk-kev{border-left-color:var(--red)}.risk-epss{border-left-color:var(--amber)}.risk-cvss{border-left-color:var(--cyan)}.coverage-failure{white-space:pre-wrap;overflow-wrap:anywhere;border-left:3px solid var(--red);padding:7px;background:#14090c}.relationship{white-space:pre-wrap;overflow-wrap:anywhere;border-left:2px solid var(--cyan);padding:7px}.raw-console{max-height:68vh;overflow:auto}.code-line{display:grid;grid-template-columns:48px minmax(0,1fr);gap:8px}.line-number{color:#52616a;text-align:right;user-select:none}.line-text{white-space:pre;min-width:max-content;color:#cbd5da}
@media(max-width:720px){.matrix-far .rain-col:nth-child(2n),.matrix-mid .rain-col:nth-child(3n){display:none}.matrix-far{opacity:.7}.matrix-mid{opacity:.7}.geometry{opacity:.45}.app-shell{padding:6px}.topbar{top:0}.pivot-console{top:44px;display:grid;grid-template-columns:1fr auto}.pivot-console input{grid-column:1/-1;min-width:0;width:100%}.tabs{top:144px}.hud{grid-template-columns:repeat(2,minmax(0,1fr))}.view{grid-template-columns:1fr}.signal,.relationship,.coverage-failure{width:100%}.raw-console{max-width:100%;overflow:auto}.semantic-legend{display:none}.result-actions{overflow-x:auto;flex-wrap:nowrap}.result-actions button{white-space:nowrap}}
@media(prefers-reduced-motion:reduce){.rain-col,.scanner-track i,.signal,.contradiction{animation:none!important;transform:none!important;clip-path:none!important}.matrix-front{opacity:0!important}.crt{opacity:.08}}
```

- [ ] **Step 5: Run focused and full Node tests, then commit**

```bash
node --test test/web-ui.test.mjs test/web-ui-logic.test.mjs
npm test
git add app/app.js app/app.css test/web-ui.test.mjs test/web-ui-logic.test.mjs
git commit -m "feat: ship PARA11AX analyst terminal UX"
```

Expected: focused and full Node suites PASS before commit.

---

### Task 6: Full Gates, PR, Merge, and Exact-SHA Production Acceptance

**Files:**
- Modify only if an existing gate requires an in-scope correction; never weaken a gate.

- [ ] **Step 1: Run clean verification**

```bash
npm ci --ignore-scripts
node --test test/web-ui.test.mjs test/web-ui-logic.test.mjs
npm run verify:repo
npm run audit:public
npm test
npm run check
```

Expected: all available local gates PASS. Do not remove a protected/platform-specific check if the local environment cannot run it.

- [ ] **Step 2: Verify bounded diff**

Expected paths:

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

Any additional path needs explicit task-related justification before PR creation.

- [ ] **Step 3: Open PR**

Use:

```markdown
## Summary
- add authenticated `/app` PARA11AX analyst terminal
- keep bearer in browser memory only and preserve same-origin `/api/para11ax/*`
- render Evidence v2 as evidence/correlation/relationship/coverage/raw views without synthetic scoring
- add three-depth red glyph rain and fixed synthesized Web Audio cues with mute/volume and silent token typing
- fail closed on malformed enrichment/STIX responses
- preserve `/api/para11ax/*` JSON fallbacks and branded human 403/404/500 routes

## Verification
- focused web UI tests
- full Node suite
- repository/public-release invariants
- Tooling smoke and CodeQL required before merge
```

- [ ] **Step 4: Wait for protected checks**

Required:

```text
Tooling smoke = success
CodeQL = success
```

- [ ] **Step 5: Squash-merge with current expected head SHA**

If head moved, re-run relevant checks on the new head first.

- [ ] **Step 6: Verify exact Vercel main deployment**

Production deployment must be `READY` and `githubCommitSha` must equal the merge SHA.

- [ ] **Step 7: Verify production routes**

```text
GET /                          -> 200 HTML, ENTER PARA11AX present
GET /app                      -> 200 HTML analyst terminal
GET /api/para11ax/meta                 -> 200 application/json
GET /api/para11ax/health without bearer -> 401 JSON
GET /api/definitely-unknown   -> 404 JSON gateway error
GET /403                      -> 403 branded HTML
GET /definitely-unknown       -> 404 branded HTML
GET /500                      -> 500 branded HTML
```

- [ ] **Step 8: Perform authorized UI acceptance**

With a valid bearer:

1. Establish session by explicit user gesture.
2. Confirm token input clears and token is absent from URL and browser storage.
3. Enrich one harmless/public pivot with `fast` or `standard`.
4. Confirm all six semantic views render and malformed data cannot reach analytical renderers.
5. Confirm `partial` is amber/incomplete coverage, never benign.
6. Confirm Raw filter works without changing underlying JSON export.
7. Confirm JSON download parses to the exact enrichment object.
8. Confirm STIX action calls `/api/para11ax/stix`, rejects non-bundle JSON, and downloads a valid returned bundle.
9. Confirm sound mute/volume work and app remains functional muted.
10. Confirm token-field typing is silent and pivot typing is rate-limited after audio enablement.
11. Confirm contradiction cue fires only once when Correlation first becomes visible for that request.
12. Confirm authenticated `401` clears session/result and returns to access mode.
13. Confirm disconnect clears visible result state.

- [ ] **Step 9: Perform mobile/reduced-motion acceptance**

At 360–430 CSS px:

```text
no horizontal document overflow
sticky header/pivot/tabs usable
evidence one column
relationships contained vertically
raw JSON scrolls internally
buttons remain usable
rain density visibly reduced versus desktop
rain/geometry never obscure text
```

With `prefers-reduced-motion: reduce`, all analytical information remains available with motion stopped; audio remains independently controllable.

- [ ] **Step 10: Capture completion evidence**

Report only freshly verified facts:

```text
PR number and merge SHA
Tooling smoke result
CodeQL result
exact Vercel production SHA/state
/app production status
unknown /api/para11ax/* JSON status
authorized enrichment result status
JSON/STIX export verification
mobile overflow verification
audio enable/mute/token-silence/contradiction-cue verification
```

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
