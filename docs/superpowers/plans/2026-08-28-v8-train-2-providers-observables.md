# PARA11AX v8 Train 2 — Curated Providers and Observables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one defensible new observable class and one defensible new read-only provider while extending two existing commercial adapters to support the new type under the Train 1 admission contract.

**Architecture:** Add explicit `cert-sha256:<64-hex>` classification for X.509 certificate fingerprints so certificate inputs cannot collide with file hashes. Use existing Censys and VirusTotal fixed-host GET APIs for certificate lookup, and add Cloudflare 1.1.1.1 DNS-over-HTTPS as a free bounded domain-context provider. All additions remain read-only, fixed-host, response-capped, profile-governed, and provenance-bearing.

**Tech Stack:** Node.js 24.x ESM, built-in `node:test`, existing `fetchJson`/`safeFetch` egress controls, Evidence v2 normalization, provider manifest/observable manifest from Train 1.

**Spec:** `docs/superpowers/specs/2026-08-28-para11ax-v8-full-maxx-design.md`

## Global Constraints

- Train 1 must already be merged; rebase this plan's execution branch onto that merged `main` before writing tests.
- No generic arbitrary-string routing. Certificate classification is prefix-explicit and deterministic.
- Certificate lookup accepts SHA-256 certificate fingerprints only.
- Censys uses `https://api.platform.censys.io/v3/global/asset/certificate/{certificate_id}` with the existing `CENSYS_PAT` server secret.
- VirusTotal certificate lookup uses `GET https://www.virustotal.com/api/v3/ssl_certs/{sha256}` with the existing `VIRUSTOTAL_API_KEY` server secret.
- Cloudflare DNS context uses only `GET https://cloudflare-dns.com/dns-query?name=<domain>&type=A` with `Accept: application/dns-json`; it requires no credential.
- No provider submission, analysis/rescan, file upload, PATCH, DELETE, or write endpoint is allowed.
- Existing eight observable syntaxes and provider behavior remain backward compatible.
- Provider count after this train is 38; active observable count is 9.

---

### Task 1: Add explicit certificate classification

**Files:**
- Modify: `config/observables.json`
- Modify: `src/core/observable-registry.js`
- Modify: `src/core/validate.js`
- Test: `test/validation.test.js`
- Test: `test/observable-registry-v8.test.js`

**Interfaces:**
- Consumes: `classifyIndicator(input: string)`.
- Produces: `{ type: 'certificate', value: '<lowercase sha256>' }` for `cert-sha256:<64 hex>` only.

- [ ] **Step 1: Write failing classifier tests**

Add to `test/validation.test.js`:

```js
test('classifies explicit SHA-256 certificate fingerprints without colliding with file hashes', () => {
  const fp = 'A'.repeat(64);
  assert.deepEqual(classifyIndicator(`cert-sha256:${fp}`), { type: 'certificate', value: fp.toLowerCase() });
  assert.deepEqual(classifyIndicator(fp), { type: 'hash', value: fp.toLowerCase() });
  assert.throws(() => classifyIndicator(`cert-sha256:${'a'.repeat(63)}`), /unsupported indicator/);
});
```

Extend the expected observable list in `test/observable-registry-v8.test.js` to include `certificate`.

- [ ] **Step 2: Run RED**

```bash
node --test test/validation.test.js test/observable-registry-v8.test.js
```

Expected: certificate classification fails and registry test reports missing `certificate`.

- [ ] **Step 3: Add the observable policy**

Add to `config/observables.json`:

```json
"certificate": {
  "displayName": "X.509 certificate SHA-256",
  "category": "infrastructure",
  "canonicalization": "cert-sha256",
  "maxLength": 76,
  "stixExport": "unsupported",
  "active": true
}
```

Add `cert-sha256` to the allowed canonicalization set in `src/core/observable-registry.js`.

- [ ] **Step 4: Implement strict prefix classification**

In `src/core/validate.js` add:

```js
const CERT_SHA256_RE = /^cert-sha256:([a-fA-F0-9]{64})$/;
```

Inside `classifyIndicator()`, before `HASH_RE` handling:

```js
const certificate = CERT_SHA256_RE.exec(value);
if (certificate) return { value: certificate[1].toLowerCase(), type: 'certificate' };
if (/^cert-sha256:/i.test(value)) throw new TypeError('unsupported indicator');
```

- [ ] **Step 5: Run GREEN**

```bash
node --test test/validation.test.js test/observable-registry-v8.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add config/observables.json src/core/observable-registry.js src/core/validate.js test/validation.test.js test/observable-registry-v8.test.js
git commit -m "feat: add certificate observable"
```

---

### Task 2: Extend Censys with bounded certificate lookup

**Files:**
- Modify: `config/providers.json`
- Modify: `src/providers/censys.js`
- Test: `test/censys-v3.test.js`
- Test: `test/provider-contract-manifest.test.js`

**Interfaces:**
- Consumes: `{ type: 'certificate', value: sha256 }`.
- Produces Evidence source data with `observationType: 'certificate_metadata'` and explicit domain relationships from certificate names.

- [ ] **Step 1: Write a failing certificate fixture test**

Add a Censys test with a mocked `fetchImpl` returning:

```js
{
  result: {
    resource: {
      fingerprint_sha256: 'a'.repeat(64),
      parsed: {
        subject_dn: 'CN=example.test',
        issuer_dn: 'CN=Example CA',
        names: ['example.test', 'www.example.test'],
        validity_period: {
          not_before: '2026-01-01T00:00:00Z',
          not_after: '2027-01-01T00:00:00Z'
        }
      }
    }
  }
}
```

Assert the requested URL is exactly:

```text
https://api.platform.censys.io/v3/global/asset/certificate/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

Assert output includes `observationType === 'certificate_metadata'`, the fingerprint, issuer/subject, validity values, and two domain relationships.

- [ ] **Step 2: Run RED**

```bash
node --test test/censys-v3.test.js
```

Expected: FAIL because Censys only implements IP lookup.

- [ ] **Step 3: Extend the Censys policy**

In `config/providers.json` change only the Censys `types` and observation semantics:

```json
"types":["ip","certificate"],
"observationTypes":["internet_exposure","certificate_metadata"],
"semanticClassHints":["network_context","certificate_context"]
```

Increment Censys parser version to `v3-2026-08-28.1` in both policy and parser-version contract test.

- [ ] **Step 4: Implement the certificate branch**

In `src/providers/censys.js`, dispatch on `input.type`. Keep the IP path unchanged. For certificate inputs:

```js
const url = `https://api.platform.censys.io/v3/global/asset/certificate/${encodeURIComponent(input.value)}`;
```

Fetch with the existing bearer token and 3 MB response cap. Parse `raw.result.resource ?? raw.result ?? {}`. Return:

```js
{
  observationType: 'certificate_metadata',
  verdict: 'observed',
  firstSeen: parsed.validity_period?.not_before ?? null,
  lastSeen: parsed.validity_period?.not_after ?? null,
  attributes: {
    fingerprintSha256: d.fingerprint_sha256 ?? input.value,
    subject: parsed.subject_dn ?? null,
    issuer: parsed.issuer_dn ?? null,
    names: names.slice(0, 100),
    notBefore: parsed.validity_period?.not_before ?? null,
    notAfter: parsed.validity_period?.not_after ?? null
  },
  relationships: names.slice(0, 100).map(name => relation('certificate_name', name, 'domain')),
  references: [`https://search.censys.io/certificates/${encodeURIComponent(input.value)}`]
}
```

On HTTP 404 return the same shape with `verdict: 'no_result'`, empty names/relationships and null metadata.

- [ ] **Step 5: Run GREEN**

```bash
node --test test/censys-v3.test.js test/provider-contract-manifest.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add config/providers.json src/providers/censys.js test/censys-v3.test.js test/provider-contract-manifest.test.js
git commit -m "feat: enrich certificate fingerprints with censys"
```

---

### Task 3: Extend VirusTotal with read-only certificate lookup

**Files:**
- Modify: `config/providers.json`
- Modify: `src/providers/virustotal.js`
- Test: `test/provider-fixtures.test.js`
- Test: `test/provider-contract-manifest.test.js`

- [ ] **Step 1: Add a failing VirusTotal certificate fixture**

Use a mocked VT response whose `data.type` is `ssl_cert`, `data.id` is the SHA-256 fingerprint, and attributes contain `thumbprint_sha256`, `thumbprint`, `subject`, `issuer`, `validity`, and `extensions.subject_alternative_name`.

Assert the adapter requests:

```text
https://www.virustotal.com/api/v3/ssl_certs/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

and returns `certificate_metadata`, not `multi_engine_reputation`.

- [ ] **Step 2: Run RED**

```bash
node --test test/provider-fixtures.test.js
```

Expected: FAIL because `vtPath()` rejects `certificate`.

- [ ] **Step 3: Extend the VT policy**

In `config/providers.json` change VirusTotal to:

```json
"types":["ip","domain","url","hash","certificate"],
"observationTypes":["reputation","malware_association","certificate_metadata"],
"semanticClassHints":["reputation","malware_association","certificate_context"]
```

Increment parser version to `v3-2026-08-28.1`.

- [ ] **Step 4: Implement certificate path and parser**

Add to `vtPath()`:

```js
if (input.type === 'certificate') return `ssl_certs/${encodeURIComponent(input.value)}`;
```

Add `certificate: Object.freeze(['certificate_metadata'])` to `COVERAGE_OBSERVATION_TYPES`.

Before reputation parsing in `run()` add a certificate branch that returns:

```js
{
  observationType: 'certificate_metadata',
  verdict: 'observed',
  firstSeen: a.validity?.not_before ?? null,
  lastSeen: a.validity?.not_after ?? null,
  tags: compact(a.extensions?.tags),
  attributes: {
    fingerprintSha256: a.thumbprint_sha256 ?? input.value,
    fingerprintSha1: a.thumbprint ?? null,
    subject: a.subject ?? {},
    issuer: a.issuer ?? {},
    serialNumber: a.serial_number ?? null,
    signatureAlgorithm: a.signature_algorithm ?? null,
    names: compact(a.extensions?.subject_alternative_name).slice(0, 100),
    validity: a.validity ?? null
  },
  relationships: compact(a.extensions?.subject_alternative_name).slice(0, 100)
    .map(name => ({ type: 'certificate_name', target: name, targetType: 'domain' })),
  references: [`https://www.virustotal.com/gui/search/${encodeURIComponent(input.value)}`]
}
```

Make the 404 helper type-aware so certificate 404 returns `certificate_metadata` with `no_result` rather than a reputation record.

- [ ] **Step 5: Run GREEN**

```bash
node --test test/provider-fixtures.test.js test/provider-contract-manifest.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add config/providers.json src/providers/virustotal.js test/provider-fixtures.test.js test/provider-contract-manifest.test.js
git commit -m "feat: enrich certificate fingerprints with virustotal"
```

---

### Task 4: Add Cloudflare DNS as a bounded free domain-context provider

**Files:**
- Create: `src/providers/cloudflare-dns.js`
- Modify: `config/providers.json`
- Modify: `src/providers/index.js`
- Test: `test/provider-fixtures.test.js`
- Test: `test/provider-control-manifest.test.js`

- [ ] **Step 1: Write the failing provider fixture**

Mock one JSON response:

```js
{
  Status: 0,
  AD: true,
  Answer: [
    { name: 'example.com.', type: 1, TTL: 300, data: '93.184.216.34' }
  ]
}
```

Assert output:

```js
{
  observationType: 'dns_resolution',
  verdict: 'observed'
}
```

with one `resolves_to` IP relationship and no reputation claim.

- [ ] **Step 2: Run RED**

```bash
node --test test/provider-fixtures.test.js test/provider-control-manifest.test.js
```

Expected: FAIL because `cloudflare-dns` is not implemented or registered.

- [ ] **Step 3: Add exact provider policy**

Add to `config/providers.json`:

```json
"cloudflare-dns": {
  "displayName":"Cloudflare 1.1.1.1 DNS",
  "credentialEnv":null,
  "optionalCredential":false,
  "authType":"none",
  "tier":1,
  "costClass":"free",
  "types":["domain"],
  "observationTypes":["dns_resolution"],
  "semanticClassHints":["network_context"],
  "timeoutMs":5000,
  "cacheTtlMs":300000,
  "negativeCacheTtlMs":60000,
  "maxResponseBytes":1048576,
  "fixedHosts":["cloudflare-dns.com"],
  "methods":["GET"],
  "protocols":["https:"],
  "parserVersion":"2026-08-28.1",
  "sourceUrl":"https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/",
  "distribution":"shareable",
  "active":true,
  "sourceRole":"first_party",
  "freshnessClass":"live",
  "admissionVersion":"v8.1"
}
```

- [ ] **Step 4: Implement the provider**

Create `src/providers/cloudflare-dns.js`. Use exactly one GET request per enrichment:

```js
const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(input.value)}&type=A`;
```

Call `fetchJson()` with header `Accept: application/dns-json` and `maxBytes: 1_000_000`. Keep only type-1 A answers, strip a terminal dot from names, cap answers at 100, and map each valid answer to:

```js
{ type: 'resolves_to', target: answer.data, targetType: 'ip' }
```

Return `verdict: 'no_result'` for a successful DNS response with no A answers. Never translate DNS absence to `benign` or `clean`.

- [ ] **Step 5: Register the adapter**

Import and wrap it in `src/providers/index.js`, then append it once to `ALL_PROVIDERS`.

- [ ] **Step 6: Run GREEN**

```bash
node --test test/provider-fixtures.test.js test/provider-control-manifest.test.js test/provider-contract-v8.test.js
```

Expected: PASS and canonical provider count becomes 38.

- [ ] **Step 7: Commit**

```bash
git add src/providers/cloudflare-dns.js config/providers.json src/providers/index.js test/provider-fixtures.test.js test/provider-control-manifest.test.js
git commit -m "feat: add bounded cloudflare dns context"
```

---

### Task 5: Route the new capabilities through fixed workflows

**Files:**
- Modify: `src/workflows.js`
- Modify: `src/core/semantics.js`
- Modify: `src/core/decision-engine.js`
- Test: `test/workflows.test.js`
- Test: `test/manifest-invariants.test.js`
- Test: `test/decision-support.test.js`

- [ ] **Step 1: Write failing routing tests**

Assert:

```js
assert.deepEqual(WORKFLOWS.certificate, ['censys', 'virustotal']);
assert.equal(WORKFLOW_CALL_LIMITS.certificate, 4);
assert.equal(WORKFLOWS.domain.includes('cloudflare-dns'), true);
```

Also assert `semanticClass('certificate_metadata') === 'certificate_context'` and `semanticClass('dns_resolution') === 'network_context'`.

- [ ] **Step 2: Run RED**

```bash
node --test test/workflows.test.js test/manifest-invariants.test.js test/decision-support.test.js
```

Expected: FAIL on missing workflow/semantic classes.

- [ ] **Step 3: Add workflow routing**

In `src/workflows.js`:

```js
certificate: Object.freeze(['censys', 'virustotal'])
```

and:

```js
certificate: 4
```

Insert `cloudflare-dns` into the domain workflow after `threatminer`. The domain workflow remains within its existing 15-call ceiling because it grows from 14 to 15 providers.

- [ ] **Step 4: Add semantics**

In `src/core/semantics.js`, treat `dns_resolution` as `network_context` and `certificate_metadata` as `certificate_context`. Do not classify either as reputation.

- [ ] **Step 5: Keep certificate telemetry conditional**

In `src/core/decision-engine.js`, add:

```js
certificate: []
```

to `TELEMETRY`. Do not add a KQL template for certificate fingerprints in this train; `telemetryReadiness('certificate')` must remain `conditional`.

- [ ] **Step 6: Run GREEN**

```bash
node --test test/workflows.test.js test/manifest-invariants.test.js test/decision-support.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/workflows.js src/core/semantics.js src/core/decision-engine.js test/workflows.test.js test/manifest-invariants.test.js test/decision-support.test.js
git commit -m "feat: route curated v8 intelligence sources"
```

---

### Task 6: Verify boundedness, compatibility and source truth

**Files:**
- Modify tests only if a regression gate is missing.

- [ ] **Step 1: Run security/egress regression set**

```bash
node --test test/egress-policy.test.js test/core-security.test.js test/provider-safety-regressions.test.js test/provider-contract-v8.test.js
```

Expected: PASS; Cloudflare DNS, Censys and VirusTotal remain fixed-host HTTPS-only.

- [ ] **Step 2: Run API/Evidence regression set**

```bash
node --test test/evidence-v2.test.js test/meta-status.test.js test/batch.test.js test/stix.test.js
```

Expected: PASS. Existing types retain behavior. Certificate STIX export must fail/omit through the existing unsupported-type behavior rather than fabricate an object.

- [ ] **Step 3: Run complete gates**

```bash
npm test
npm run verify:repo
npm run audit:public
npm run check
```

Expected: all PASS.

- [ ] **Step 4: Confirm scoped diff**

```bash
git diff --stat main...HEAD
git diff main...HEAD -- config/observables.json config/providers.json src/core/validate.js src/providers/censys.js src/providers/virustotal.js src/providers/cloudflare-dns.js src/providers/index.js src/workflows.js src/core/semantics.js src/core/decision-engine.js
```

Acceptance conditions:

```text
- cert-sha256 prefix is required; a bare 64-hex value is still a file hash
- Censys and VirusTotal perform GET-only certificate retrieval
- Cloudflare performs one GET-only A lookup per provider execution
- no new credential name is introduced
- no provider submission/rescan endpoint exists in the diff
- provider count is 38 and observable count is 9
- all old API/Evidence behavior remains compatible
```

Do not create an empty verification commit.