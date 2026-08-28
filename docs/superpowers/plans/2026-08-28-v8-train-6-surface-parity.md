# PARA11AX v8 Train 6 — Shared Surface Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the same v8 capabilities through API, browser shell, operator CLI, Maltego, deterministic reporting, and STIX without duplicating intelligence semantics or weakening existing authentication and egress boundaries.

**Architecture:** Keep intelligence logic in the existing shared core. Add one bounded compare endpoint that calls the Train 3 semantic-diff core and performs zero provider calls, expose Train 1 capability metadata additively through `/meta`, add a Node operator gateway client that follows the same URL safety model as the existing Maltego client, extend report modeling from already-captured Evidence v2, and add certificate-aware Maltego/STIX adapters. Surface adapters format and transport shared results; they do not create new verdict logic.

**Tech Stack:** Node.js 24.x ESM, Vercel function wrappers, built-in `fetch`, browser ES modules, Python Maltego TRX, deterministic report compiler, STIX 2.1 JSON.

**Spec:** `docs/superpowers/specs/2026-08-28-para11ax-v8-full-maxx-design.md`

## Global Constraints

- Train 5 must be merged before execution.
- Existing endpoints remain compatible: `/meta` public; `/health`, `/status`, `/enrich`, `/batch`, `/stix` bearer-protected as before.
- New `/api/para11ax/compare` is bearer-protected, accepts two already-produced Evidence v2 snapshots, performs no provider/network calls, and has a 1 MiB request-body cap.
- Existing `PARA11AX_TOKEN` remains the only gateway bearer mechanism.
- Operator/Maltego gateway URL environment variable remains `PARA11AX_URL`; default is `https://para11ax.vercel.app`. HTTPS is mandatory except HTTP loopback (`localhost`, `127.0.0.1`, `::1`). Credentials in URL, query, fragment, and non-root paths are rejected.
- The Node operator client reads `PARA11AX_TOKEN` from process environment but never prints or persists it.
- `/meta` capability output must never expose provider credential environment-variable names or configuration state.
- Comparison/report/STIX rendering never refreshes evidence or calls providers.
- STIX remains an interoperability output; unsupported semantics stay in PARA11AX JSON.
- Certificate Maltego transforms must explicitly send `cert-sha256:<fingerprint>` while declaring gateway type `certificate`; a bare SHA-256 Maltego hash remains a file-hash enrichment.
- No interface-specific maliciousness score, attribution inference, or verdict logic.

---

### Task 1: Add the bounded shared compare API

**Files:**
- Modify: `src/app.js`
- Create: `api/para11ax/compare.js`
- Create: `test/compare-api-v8.test.js`
- Modify: `test/meta-status.test.js`

**Interfaces:**

```text
POST /api/para11ax/compare
Authorization: Bearer <PARA11AX_TOKEN>
Content-Type: application/json

{
  "before": <Evidence v2 envelope>,
  "after": <Evidence v2 envelope>
}
```

Response: Train 3 `diffEvidenceSnapshots(before, after)` result.

- [ ] **Step 1: Write failing endpoint tests**

Create `test/compare-api-v8.test.js` with two deterministic matching-subject Evidence v2 fixtures. Assert:

```js
assert.equal((await app.handleCompare({ method: 'POST', headers: {}, body })).status, 401);
assert.equal((await app.handleCompare(authRequest({ before, after }))).status, 200);
assert.equal(out.body.version, '1.0');
assert.equal(out.body.indicator, before.indicator);
```

Also assert method `GET` -> 405, wrong content type -> 415, unexpected request field -> 400, mismatched subjects -> 400, and JSON body over 1 MiB -> 413.

Use a `fetchImpl` that throws if called and construct the app with it. Successful comparison must not invoke it.

- [ ] **Step 2: Run RED**

```bash
node --test test/compare-api-v8.test.js
```

Expected: FAIL because `handleCompare` does not exist.

- [ ] **Step 3: Add the compare body limit and handler**

In `src/app.js` add:

```js
import { diffEvidenceSnapshots } from './core/semantic-diff.js';
const MAX_COMPARE_BODY_BYTES = 1024 * 1024;
```

Inside `createApp()` add:

```js
async handleCompare(request) {
  const gate = requestGate(request, env, 'POST');
  if (gate) return gate;
  let body;
  try { body = parseBody(request, MAX_COMPARE_BODY_BYTES); }
  catch (error) {
    return renderHttpError(request, error.status ?? 400, error.status === 413 ? 'payload_too_large' : 'invalid_request');
  }
  if (Object.keys(body).some(key => !['before', 'after'].includes(key))) {
    return renderHttpError(request, 400, 'unsupported_request_field');
  }
  if (!body.before || !body.after) return renderHttpError(request, 400, 'invalid_request');
  try {
    return response(200, diffEvidenceSnapshots(body.before, body.after), { 'cache-control': 'no-store' });
  } catch {
    return renderHttpError(request, 400, 'invalid_comparison');
  }
}
```

Do not log snapshot bodies.

- [ ] **Step 4: Add Vercel wrapper**

Create `api/para11ax/compare.js` using the existing route pattern:

```js
import { createApp, writeVercelResponse } from '../../src/app.js';
const app = createApp();
export default async function handler(req, res) {
  const result = await app.handleCompare(req);
  writeVercelResponse(res, result);
}
```

- [ ] **Step 5: Add compare limit to public `/meta`**

Add `compareBodyBytes: MAX_COMPARE_BODY_BYTES` under `limits`. Keep every existing field unchanged.

Update `test/meta-status.test.js` to expect the new additive limit while preserving the existing top-level response keys.

- [ ] **Step 6: Run GREEN and commit**

```bash
node --test test/compare-api-v8.test.js test/meta-status.test.js test/app.test.js
git add src/app.js api/para11ax/compare.js test/compare-api-v8.test.js test/meta-status.test.js
git commit -m "feat: add bounded evidence compare api"
```

---

### Task 2: Expose canonical capabilities through `/meta` and the browser client

**Files:**
- Modify: `src/app.js`
- Modify: `app/api-client.js`
- Modify: `test/meta-status.test.js`
- Modify: `test/api-client.test.js`

**Interfaces:**
- `/meta` gains additive `capabilities` from Train 1 `buildCapabilityRegistry()`.
- Browser client gains `compare(before, after, signal)`.

- [ ] **Step 1: Write failing capability/meta tests**

In `test/meta-status.test.js` assert:

```js
assert.equal(Array.isArray(out.body.capabilities.observableTypes), true);
assert.equal(Array.isArray(out.body.capabilities.providers), true);
assert.ok(out.body.capabilities.observableTypes.some(item => item.type === 'certificate'));
assert.ok(out.body.capabilities.providers.some(item => item.name === 'cloudflare-dns'));
assert.equal(JSON.stringify(out.body.capabilities).includes('CENSYS_PAT'), false);
assert.equal(JSON.stringify(out.body.capabilities).includes('VIRUSTOTAL_API_KEY'), false);
```

In `test/api-client.test.js`, assert `client.compare(before, after)` sends one authenticated POST to `/api/para11ax/compare` with exactly `{before, after}`.

- [ ] **Step 2: Run RED**

```bash
node --test test/meta-status.test.js test/api-client.test.js
```

Expected: capability field/client compare method missing.

- [ ] **Step 3: Build capabilities once per app instance**

In `src/app.js`, import Train 1 `buildCapabilityRegistry` and `OBSERVABLE_MANIFEST`. After the provider registry is constructed:

```js
const capabilities = buildCapabilityRegistry({ providerRegistry: registry, observableRegistry: OBSERVABLE_MANIFEST });
```

Return `capabilities` additively in `handleMeta()`. Do not include `providerStatus()` or environment configuration state inside it.

- [ ] **Step 4: Add browser compare client method**

In `app/api-client.js`, add a validator requiring `version`, `indicator`, `type`, `changed`, `summary`, and `changes[]`, then:

```js
compare: async (before, after, signal) => request('/api/para11ax/compare', {
  method: 'POST', body: { before, after }, signal, validate: validDiff,
}),
```

Do not persist the request or token.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test test/meta-status.test.js test/api-client.test.js test/compare-api-v8.test.js
git add src/app.js app/api-client.js test/meta-status.test.js test/api-client.test.js
git commit -m "feat: expose shared v8 capabilities"
```

---

### Task 3: Add a safe Node operator gateway client and parity commands

**Files:**
- Create: `src/control/gateway-client.js`
- Create: `src/control/evidence-commands.js`
- Modify: `bin/para11ax.mjs`
- Create: `test/control-gateway-client-v8.test.js`
- Create: `test/operator-cli-v8.test.js`

**Interfaces:**

```js
export function validateGatewayUrl(value);
export function createOperatorGatewayClient({ baseUrl, token, fetchImpl, timeoutMs });
// methods: meta(), enrich(indicator, profile), compare(before, after)

export function printEvidenceExplanation(snapshot);
export function printCoverage(snapshot);
export function printHunts(snapshot);
export function printGraph(snapshot);
```

- [ ] **Step 1: Write failing URL/client tests**

Assert:

```text
https://para11ax.vercel.app -> accepted
http://localhost:3000 -> accepted
http://127.0.0.1:3000 -> accepted
http://example.com -> rejected
https://user:pass@example.com -> rejected
https://example.com/path -> rejected
https://example.com/?token=x -> rejected
```

Mock `fetchImpl` and assert `enrich()` uses `/api/para11ax/enrich`, `compare()` uses `/api/para11ax/compare`, `Authorization: Bearer ...`, `cache: 'no-store'`, JSON body, and 20-second AbortSignal timeout. Assert thrown errors never include the token.

- [ ] **Step 2: Run RED**

```bash
node --test test/control-gateway-client-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement the gateway client**

Use `new URL()`. Default base URL is `process.env.PARA11AX_URL || 'https://para11ax.vercel.app'`; default token is `process.env.PARA11AX_TOKEN`. Require a non-empty token only for authenticated methods. Refuse redirects with `redirect: 'error'`. Cap response text at 2,000,000 UTF-8 bytes after reading; reject oversized/invalid JSON with generic errors.

- [ ] **Step 4: Write failing CLI-command tests**

Test command parsing for:

```text
para11ax enrich example.com --profile standard
para11ax compare before.json after.json
para11ax explain snapshot.json
para11ax coverage snapshot.json
para11ax hunt snapshot.json
para11ax graph snapshot.json
```

Reject profiles outside `fast|standard|full`, unknown flags, missing files, files over 8 MiB, and non-JSON evidence input.

- [ ] **Step 5: Implement deterministic evidence commands**

`evidence-commands.js` reads already-captured snapshot JSON and projects only existing fields:

```text
explain -> decision.assessment + decision.guidance
coverage -> coverage + failures
hunt -> decision.huntPlan
graph -> decision.entityGraph
```

Output canonical pretty JSON followed by newline. No provider calls occur for these four commands.

`enrich` and `compare` use `createOperatorGatewayClient()` and print returned JSON.

- [ ] **Step 6: Update CLI help and dispatch**

Add exact help lines and route commands in `bin/para11ax.mjs`. Reuse existing report commands; do not remove any current command.

- [ ] **Step 7: Run GREEN and commit**

```bash
node --test test/control-gateway-client-v8.test.js test/operator-cli-v8.test.js test/control-plane.test.js
git add src/control/gateway-client.js src/control/evidence-commands.js bin/para11ax.mjs test/control-gateway-client-v8.test.js test/operator-cli-v8.test.js
git commit -m "feat: add operator evidence parity commands"
```

---

### Task 4: Make deterministic reports consume v8 semantics/guidance/diffs

**Files:**
- Modify: `src/report/model.js`
- Modify: `src/report/render-text.js`
- Modify: `src/report/render-html.js`
- Modify: `src/report/compiler.js`
- Modify: `src/report/diff.js`
- Modify: `src/control/report-commands.js`
- Modify: `test/report-model.test.js`
- Modify: `test/report-compiler.test.js`
- Modify: `test/report-diff.test.js`

**Interfaces:**
- Report model gains additive `evidenceSemantics`, `guidance`, `entityGraph`, `semanticDiff` fields.
- `report diff` uses Train 3 `diffEvidenceSnapshots()` as its intelligence-change source.

- [ ] **Step 1: Write failing report-model tests**

Use a v8 snapshot with `evidence[].semantics`, `decision.guidance`, `decision.entityGraph`, and optional `semanticDiff`. Assert those structures survive into the model with bounded copies and do not alter `reproducibility.snapshotSha256` semantics.

- [ ] **Step 2: Run RED**

```bash
node --test test/report-model.test.js test/report-diff.test.js
```

Expected: v8 report fields absent / old diff path does not expose Train 3 categories.

- [ ] **Step 3: Extend report model additively**

In `copyEvidence()` add bounded `semantics` only when present:

```js
semantics: item.semantics ? {
  class: text(item.semantics.class, ...),
  semanticClass: text(item.semantics.semanticClass, ...),
  sourceRole: text(item.semantics.sourceRole, ...),
} : null
```

At model root add detached bounded copies:

```js
guidance: clone(snapshot.decision?.guidance ?? null),
entityGraph: clone(snapshot.decision?.entityGraph ?? null),
semanticDiff: clone(snapshot.semanticDiff ?? null),
```

Validate graph ≤100 nodes/edges and guidance arrays against Train 5 maxima before copying.

- [ ] **Step 4: Render explicit v8 sections**

Text and HTML reports add sections in this order after executive assessment:

```text
Evidence semantics
Coverage and gaps
Contradictions
What changed (only when semanticDiff present)
Suggested pivots
Telemetry validation
Prioritized hunts
Evidence graph summary
```

All text comes from fixed labels and data. No provider refresh, model call, or generated inference.

- [ ] **Step 5: Rebase report diff on shared semantic diff**

Keep existing report-diff compatibility fields where tests require them, but add `semanticDiff: diffEvidenceSnapshots(before, after)` and derive intelligence-change counts from that result. Remove any duplicate logic that treats retrieval timestamp/cache/order churn as an intelligence change.

- [ ] **Step 6: Run GREEN and commit**

```bash
node --test test/report-model.test.js test/report-compiler.test.js test/report-diff.test.js test/report-renderers.test.js
git add src/report/model.js src/report/render-text.js src/report/render-html.js src/report/compiler.js src/report/diff.js src/control/report-commands.js test/report-model.test.js test/report-compiler.test.js test/report-diff.test.js
git commit -m "feat: add v8 evidence semantics to reports"
```

---

### Task 5: Add certificate STIX 2.1 export without forcing unsupported semantics

**Files:**
- Modify: `src/export/stix.js`
- Modify: `config/observables.json`
- Modify: `test/stix.test.js`
- Modify: `test/observable-registry-v8.test.js`

**Interfaces:**
- Certificate enrichment exports a STIX 2.1 `x509-certificate` SCO as primary object.

- [ ] **Step 1: Write failing certificate STIX test**

For enrichment:

```js
{
  type: 'certificate',
  indicator: 'a'.repeat(64),
  evidence: [{
    observation: {
      kind: 'certificate_metadata',
      attributes: {
        fingerprintSha256: 'a'.repeat(64),
        fingerprintSha1: 'b'.repeat(40),
        serialNumber: '01AF',
        issuer: 'CN=Example CA',
        subject: 'CN=example.test',
        validity: { not_before: '2026-01-01T00:00:00Z', not_after: '2027-01-01T00:00:00Z' }
      }
    }
  }]
}
```

assert the first bundle object has:

```js
{
  type: 'x509-certificate',
  spec_version: '2.1',
  hashes: { 'SHA-256': '<fingerprint>', 'SHA-1': '<optional sha1>' },
  serial_number: '01AF',
  issuer: 'CN=Example CA',
  subject: 'CN=example.test'
}
```

with `validity_not_before` / `validity_not_after` only when valid ISO timestamps are present.

- [ ] **Step 2: Run RED**

```bash
node --test test/stix.test.js
```

Expected: certificate has no primary STIX object.

- [ ] **Step 3: Add bounded X.509 object builder**

In `src/export/stix.js`, add `certificateObject(enrichment, uuid)`. Always set SHA-256 from the classified indicator after verifying 64 hex. Search evidence only for `certificate_metadata`; optional fields are copied only after type/length validation. Do not synthesize domain indicators from SANs here; explicit relationships remain separate PARA11AX semantics unless the existing relationship exporter has a defensible STIX mapping.

Use `id: newId('x509-certificate', uuid)` and no `created`/`modified` fields, because STIX cyber-observable objects do not require SDO timestamps.

- [ ] **Step 4: Route certificate primary object and update manifest truth**

Choose primary object:

```js
const first = enrichment.type === 'attack'
  ? attackObject(enrichment)
  : enrichment.type === 'certificate'
    ? certificateObject(enrichment, uuid)
    : primaryObject(enrichment, created, uuid);
```

Change `config/observables.json` certificate `stixExport` from `unsupported` to `x509-certificate` and allow that value in observable registry validation.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test test/stix.test.js test/observable-registry-v8.test.js
git add src/export/stix.js config/observables.json test/stix.test.js test/observable-registry-v8.test.js
git commit -m "feat: export certificate evidence to stix"
```

---

### Task 6: Add certificate parity to Maltego without changing file-hash semantics

**Files:**
- Create: `maltego/transforms/EnrichCertificate.py`
- Modify: `maltego/transforms/common.py`
- Modify: `maltego/transforms/__init__.py`
- Modify: `maltego/gateway_client.py`
- Modify: `maltego/mapper.py`
- Modify: `maltego/README.md`
- Modify: `test/test_maltego.py`

**Interfaces:**
- New transform display name `PARA11AX Enrich Certificate SHA-256`.
- Input entity remains `maltego.Hash`, but transform explicitly prefixes the gateway value with `cert-sha256:` and requests type `certificate`.

- [ ] **Step 1: Write failing Python tests**

Assert:

```python
assert 'certificate' in SUPPORTED_INDICATOR_TYPES
```

and a certificate transform receiving `A`*64 sends JSON:

```json
{"indicator":"cert-sha256:aaaaaaaa...","type":"certificate"}
```

while existing `EnrichHash` sends the bare fingerprint with type `hash`.

Reject non-64-hex certificate input locally before the gateway call.

- [ ] **Step 2: Run RED**

```bash
python -m unittest discover -s test -p 'test_maltego.py'
```

Expected: certificate transform/type missing.

- [ ] **Step 3: Add value transformation hook**

Change `execute_gateway_transform()` signature to:

```python
def execute_gateway_transform(request, response, indicator_type: str, value_transform=None) -> None:
```

Before client call:

```python
value = request.Value
if value_transform is not None:
    try:
        value = value_transform(value)
    except ValueError as exc:
        response.addUIMessage(f'PARA11AX input error: {exc}', UIM_FATAL)
        return
result = client.enrich(value, indicator_type)
```

Existing transforms pass no hook and remain unchanged.

- [ ] **Step 4: Implement certificate transform**

`EnrichCertificate.py` validates `^[0-9A-Fa-f]{64}$`, lowercases it, and returns `f'cert-sha256:{value}'`. Register against `maltego.Hash`, with outputs limited to `maltego.Domain`, `maltego.Phrase`, and any existing graph entity types the mapper can defensibly produce from explicit relationships.

- [ ] **Step 5: Extend gateway and mapper**

Add `certificate` to `SUPPORTED_INDICATOR_TYPES`. Ensure `mapper.py` maps explicit `targetType: 'domain'` certificate-name relationships to `maltego.Domain` and does not treat certificate context as malicious reputation.

Import/export `EnrichCertificate` in `transforms/__init__.py` and document the explicit certificate-vs-file-hash distinction.

- [ ] **Step 6: Run GREEN and commit**

```bash
python -m unittest discover -s test -p 'test_maltego.py'
python -m unittest discover -s test
git add maltego/transforms/EnrichCertificate.py maltego/transforms/common.py maltego/transforms/__init__.py maltego/gateway_client.py maltego/mapper.py maltego/README.md test/test_maltego.py
git commit -m "feat: add certificate maltego transform"
```

---

### Task 7: Prove cross-surface semantic parity

**Files:**
- Create: `test/surface-parity-v8.test.js`
- Modify existing Python tests only if a parity assertion is missing.

- [ ] **Step 1: Add a single canonical Evidence v2 fixture**

The fixture must contain semantics, guidance, graph, certificate-capable capability metadata, and one semantic diff pair. Feed the same fixture into the core projectors used by API compare, CLI explain/coverage/hunt/graph, browser view models, report model, and STIX exporter.

- [ ] **Step 2: Assert semantic identity rather than presentation identity**

Assert:

```text
API compare changes === diffEvidenceSnapshots changes
CLI explain disposition/confidence/guidance === snapshot decision fields
browser guidance model === snapshot guidance fields
report guidance === snapshot guidance fields
CLI graph node/edge identity === browser graph base node/edge identity
STIX uses only already-normalized certificate/evidence data
```

Presentation strings/formatting may differ.

- [ ] **Step 3: Run complete surface tests**

```bash
node --test test/surface-parity-v8.test.js test/compare-api-v8.test.js test/api-client.test.js test/operator-cli-v8.test.js test/report-model.test.js test/stix.test.js
python -m unittest discover -s test
```

Expected: PASS.

- [ ] **Step 4: Run full repository gates**

```bash
npm test
npm run verify:repo
npm run audit:public
npm run check
```

Expected: all PASS.

- [ ] **Step 5: Review scope**

```bash
git diff --stat main...HEAD
git diff main...HEAD -- src/app.js api/para11ax/compare.js app/api-client.js src/control/gateway-client.js src/control/evidence-commands.js bin/para11ax.mjs src/report src/export/stix.js maltego
```

Acceptance conditions:

```text
- compare is bearer-protected, <=1 MiB and performs zero provider calls
- /meta capabilities contain no secret environment-variable names/configuration state
- Node CLI URL policy matches Maltego URL policy
- deterministic report rendering performs zero provider calls
- certificate STIX output is x509-certificate, not a fabricated reputation indicator
- file-hash and certificate Maltego transforms remain semantically distinct
- shell/API/CLI/report/Maltego adapters do not introduce separate verdict logic
```

Do not create an empty verification commit.