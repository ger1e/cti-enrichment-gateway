# PARA11AX v8 Train 1 — Contracts and Registries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the canonical v8 observable and provider contracts so later provider, evidence, case, guidance, and interface trains can evolve without duplicating semantics or weakening fixed-egress guarantees.

**Architecture:** Keep `config/providers.json` as the canonical provider policy source, extend it with explicit source/admission semantics, and add a separate canonical observable manifest at `config/observables.json`. Runtime adapters continue to receive immutable metadata from manifests; a new contract validator cross-checks provider types, observable types, egress constraints, credential posture, distribution policy, freshness semantics, and evidence roles before a registry can be used.

**Tech Stack:** Node.js 24.x ESM, built-in `node:test` / `node:assert`, JSON manifests, existing PARA11AX provider registry and fixed-egress core.

**Spec:** `docs/superpowers/specs/2026-08-28-para11ax-v8-full-maxx-design.md`

## Global Constraints

- PARA11AX remains read-only and fixed-egress: no scanning, detonation, submission, remediation, blocking, arbitrary proxying, user-controlled egress, or autonomous action.
- Provider credentials remain server-side deployment/runtime secrets only.
- Current Evidence v2, API, CLI, and `PARA11AX_TOKEN` behavior remain backward compatible.
- New provider policy must be explicit, bounded, immutable after load, and fail closed on invalid manifests.
- `https:` is the only accepted provider protocol.
- Provider methods remain limited to `GET` and `POST`.
- Existing provider call budgets, timeouts, cache semantics, and scheduler behavior are not changed in this train.
- No new provider or observable type is activated in Train 1; this train creates the admission contract used by Train 2.
- `main` must remain deployable after the train merges.

---

## File Structure

**Create**
- `config/observables.json` — canonical observable-type policy for the eight currently supported types.
- `src/core/observable-registry.js` — immutable observable manifest loader/validator and lookup API.
- `src/core/provider-contract.js` — cross-validator for provider policy, runtime adapter metadata, observable registry membership, and fixed-egress admission rules.
- `src/core/capability-registry.js` — deterministic projection consumed later by `/meta`, CLI help, docs generation, and integrations.
- `test/observable-registry-v8.test.js` — observable manifest validation and lookup tests.
- `test/provider-contract-v8.test.js` — provider source/admission contract and fail-closed tests.
- `test/capability-registry-v8.test.js` — deterministic provider/type capability projection tests.

**Modify**
- `config/providers.json` — add v8 policy fields to every existing provider without changing active provider behavior.
- `src/providers/manifest.js` — validate and freeze the new provider fields.
- `src/providers/metadata.js` — project those fields onto runtime adapters.
- `src/core/provider-registry.js` — call the shared v8 contract validator and remove duplicated protocol policy where possible.
- `src/core/provider-manifest.js` — expose the new fields in runtime/public manifest projections.
- `test/provider-control-manifest.test.js` — require full provider-policy parity for the new fields.
- `test/provider-contract-manifest.test.js` — pin source-role/freshness/admission behavior for representative providers.
- `test/manifest-invariants.test.js` — add cross-manifest invariants.

## Canonical Interfaces

```js
// src/core/observable-registry.js
export const OBSERVABLE_MANIFEST;
export function observablePolicy(type); // -> frozen policy, throws on unknown type
export function observableTypes(); // -> frozen sorted string[]
export function isObservableType(type); // -> boolean
```

```js
// src/core/provider-contract.js
export function assertProviderContract({ adapter, policy, observableRegistry });
// returns true; throws TypeError/Error with provider-qualified reason on violation

export function validateProviderSet({ adapters, manifest, observableRegistry });
// returns Object.freeze({ providerNames, observableTypes });
```

```js
// src/core/capability-registry.js
export function buildCapabilityRegistry({ providerRegistry, observableRegistry });
// -> frozen {
//   observableTypes: [{ type, displayName, category, canonicalization, stix }],
//   providers: [{ name, displayName, types, sourceRole, freshnessClass, distribution, credentialMode, active }],
//   byType: { [type]: { providers: string[], activeProviders: string[] } }
// }
```

### Provider v8 policy fields

Every entry in `config/providers.json` must additionally define:

```json
{
  "sourceRole": "authoritative|first_party|aggregator|community|contextual",
  "freshnessClass": "live|near_real_time|periodic|reference",
  "admissionVersion": "v8.1",
  "termsUrl": "https://...",
  "exportPolicy": "shareable|internal|internal_only"
}
```

`exportPolicy` must equal the existing `distribution` value during Train 1. The duplicate field is intentional only for migration: later trains consume `exportPolicy`; a future cleanup may remove `distribution` after a separately approved compatibility window.

### Observable v8 policy shape

`config/observables.json` starts with exactly the currently supported eight types:

```json
{
  "ip": {"displayName":"IP address","category":"infrastructure","canonicalization":"ip","stix":"ipv4-addr|ipv6-addr","maxLength":64,"active":true},
  "domain": {"displayName":"Domain","category":"infrastructure","canonicalization":"idna-domain","stix":"domain-name","maxLength":253,"active":true},
  "url": {"displayName":"URL","category":"infrastructure","canonicalization":"http-url","stix":"url","maxLength":4096,"active":true},
  "hash": {"displayName":"File hash","category":"artifact","canonicalization":"md5|sha1|sha256","stix":"file.hashes","maxLength":64,"active":true},
  "cve": {"displayName":"CVE","category":"vulnerability","canonicalization":"cve","stix":null,"maxLength":32,"active":true},
  "attack": {"displayName":"ATT&CK ID","category":"knowledge","canonicalization":"attack-id","stix":null,"maxLength":16,"active":true},
  "asn": {"displayName":"ASN","category":"infrastructure","canonicalization":"asn","stix":"autonomous-system","maxLength":16,"active":true},
  "cidr": {"displayName":"CIDR","category":"infrastructure","canonicalization":"cidr","stix":null,"maxLength":64,"active":true}
}
```

---

### Task 1: Add the canonical observable manifest and registry

**Files:**
- Create: `config/observables.json`
- Create: `src/core/observable-registry.js`
- Test: `test/observable-registry-v8.test.js`

**Interfaces:**
- Consumes: no new interfaces.
- Produces: `OBSERVABLE_MANIFEST`, `observablePolicy(type)`, `observableTypes()`, `isObservableType(type)`.

- [ ] **Step 1: Write the failing observable-registry tests**

Create `test/observable-registry-v8.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OBSERVABLE_MANIFEST,
  observablePolicy,
  observableTypes,
  isObservableType,
} from '../src/core/observable-registry.js';

const EXPECTED = ['asn', 'attack', 'cidr', 'cve', 'domain', 'hash', 'ip', 'url'];

test('v8 observable registry exposes exactly the currently supported types', () => {
  assert.deepEqual(observableTypes(), EXPECTED);
  assert.deepEqual(Object.keys(OBSERVABLE_MANIFEST).sort(), EXPECTED);
});

test('observable policies are immutable and explicitly describe canonicalization and STIX posture', () => {
  const domain = observablePolicy('domain');
  assert.equal(domain.canonicalization, 'idna-domain');
  assert.equal(domain.stix, 'domain-name');
  assert.equal(domain.active, true);
  assert.equal(Object.isFrozen(domain), true);
  assert.throws(() => observablePolicy('email'), /unknown observable type: email/);
});

test('isObservableType is strict and does not accept arbitrary strings', () => {
  assert.equal(isObservableType('ip'), true);
  assert.equal(isObservableType('IP'), false);
  assert.equal(isObservableType('anything'), false);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test test/observable-registry-v8.test.js
```

Expected: FAIL with module-not-found for `src/core/observable-registry.js`.

- [ ] **Step 3: Add `config/observables.json` with the exact eight-policy object from this plan**

Use the exact JSON shown in “Observable v8 policy shape”. Do not add candidate v8 types yet.

- [ ] **Step 4: Implement the minimal strict registry**

Create `src/core/observable-registry.js`:

```js
import rawManifest from '../../config/observables.json' with { type: 'json' };

const CATEGORIES = new Set(['infrastructure', 'artifact', 'vulnerability', 'knowledge']);
const CANONICALIZATION = new Set(['ip', 'idna-domain', 'http-url', 'md5|sha1|sha256', 'cve', 'attack-id', 'asn', 'cidr']);

function fail(message) {
  throw new Error(`invalid observable manifest: ${message}`);
}

function validate(type, input) {
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(type)) fail(`type ${type}`);
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(type);
  if (typeof input.displayName !== 'string' || input.displayName.length < 1 || input.displayName.length > 80) fail(`${type}.displayName`);
  if (!CATEGORIES.has(input.category)) fail(`${type}.category`);
  if (!CANONICALIZATION.has(input.canonicalization)) fail(`${type}.canonicalization`);
  if (!(input.stix === null || (typeof input.stix === 'string' && input.stix.length <= 64))) fail(`${type}.stix`);
  if (!Number.isSafeInteger(input.maxLength) || input.maxLength < 1 || input.maxLength > 4096) fail(`${type}.maxLength`);
  if (typeof input.active !== 'boolean') fail(`${type}.active`);
  return Object.freeze({ ...input });
}

export const OBSERVABLE_MANIFEST = Object.freeze(Object.fromEntries(
  Object.entries(rawManifest).map(([type, policy]) => [type, validate(type, policy)]),
));

export function observablePolicy(type) {
  const policy = OBSERVABLE_MANIFEST[type];
  if (!policy) throw new Error(`unknown observable type: ${String(type)}`);
  return policy;
}

export function observableTypes() {
  return Object.freeze(Object.keys(OBSERVABLE_MANIFEST).sort());
}

export function isObservableType(type) {
  return typeof type === 'string' && Object.hasOwn(OBSERVABLE_MANIFEST, type);
}
```

- [ ] **Step 5: Run the observable registry test and verify GREEN**

```bash
node --test test/observable-registry-v8.test.js
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add config/observables.json src/core/observable-registry.js test/observable-registry-v8.test.js
git commit -m "feat: add canonical observable registry"
```

---

### Task 2: Extend every provider policy with explicit v8 source/admission semantics

**Files:**
- Modify: `config/providers.json`
- Modify: `src/providers/manifest.js`
- Modify: `src/providers/metadata.js`
- Modify: `test/provider-control-manifest.test.js`
- Modify: `test/provider-contract-manifest.test.js`

**Interfaces:**
- Consumes: existing `PROVIDER_MANIFEST`, `providerPolicy(name)`, `withProviderMetadata(adapter)`.
- Produces: immutable adapter fields `sourceRole`, `freshnessClass`, `admissionVersion`, `termsUrl`, `exportPolicy`.

- [ ] **Step 1: Write failing manifest parity tests for the new fields**

In `test/provider-control-manifest.test.js`, extend `REQUIRED` with:

```js
'sourceRole', 'freshnessClass', 'admissionVersion', 'termsUrl', 'exportPolicy'
```

Inside the provider loop add:

```js
assert.equal(policy.sourceRole, provider.sourceRole);
assert.equal(policy.freshnessClass, provider.freshnessClass);
assert.equal(policy.admissionVersion, provider.admissionVersion);
assert.equal(policy.termsUrl, provider.termsUrl);
assert.equal(policy.exportPolicy, provider.exportPolicy);
assert.equal(policy.exportPolicy, policy.distribution);
```

In `test/provider-contract-manifest.test.js`, add representative semantic pins:

```js
test('v8 source semantics distinguish reference, first-party and aggregator providers', () => {
  assert.equal(PROVIDER_MANIFEST['cisa-kev'].sourceRole, 'authoritative');
  assert.equal(PROVIDER_MANIFEST['cisa-kev'].freshnessClass, 'periodic');
  assert.equal(PROVIDER_MANIFEST.greynoise.sourceRole, 'first_party');
  assert.equal(PROVIDER_MANIFEST.greynoise.freshnessClass, 'near_real_time');
  assert.equal(PROVIDER_MANIFEST.virustotal.sourceRole, 'aggregator');
  assert.equal(PROVIDER_MANIFEST.virustotal.exportPolicy, PROVIDER_MANIFEST.virustotal.distribution);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
node --test test/provider-control-manifest.test.js test/provider-contract-manifest.test.js
```

Expected: FAIL because the new policy fields are absent.

- [ ] **Step 3: Extend provider manifest validation**

In `src/providers/manifest.js`, add:

```js
const SOURCE_ROLES = new Set(['authoritative', 'first_party', 'aggregator', 'community', 'contextual']);
const FRESHNESS_CLASSES = new Set(['live', 'near_real_time', 'periodic', 'reference']);
const ADMISSION_VERSIONS = new Set(['v8.1']);
```

Inside `validatePolicy(name, input)` add:

```js
if (!SOURCE_ROLES.has(input.sourceRole)) fail(`${name}.sourceRole`);
if (!FRESHNESS_CLASSES.has(input.freshnessClass)) fail(`${name}.freshnessClass`);
if (!ADMISSION_VERSIONS.has(input.admissionVersion)) fail(`${name}.admissionVersion`);
output.termsUrl = boundedText(input.termsUrl, `${name}.termsUrl`);
try {
  const terms = new URL(output.termsUrl);
  if (terms.protocol !== 'https:') fail(`${name}.termsUrl protocol`);
} catch {
  fail(`${name}.termsUrl`);
}
if (!DISTRIBUTIONS.has(input.exportPolicy)) fail(`${name}.exportPolicy`);
if (input.exportPolicy !== input.distribution) fail(`${name}.exportPolicy migration parity`);
output.sourceRole = input.sourceRole;
output.freshnessClass = input.freshnessClass;
output.admissionVersion = input.admissionVersion;
output.exportPolicy = input.exportPolicy;
```

- [ ] **Step 4: Project the new fields onto runtime adapters**

In `src/providers/metadata.js`, add these properties to the frozen adapter projection:

```js
sourceRole: policy.sourceRole,
freshnessClass: policy.freshnessClass,
admissionVersion: policy.admissionVersion,
termsUrl: policy.termsUrl,
exportPolicy: policy.exportPolicy,
```

- [ ] **Step 5: Populate all existing provider policies without changing runtime routing**

For every entry in `config/providers.json`:

```json
"admissionVersion":"v8.1",
"exportPolicy":"<copy existing distribution exactly>",
"termsUrl":"<provider HTTPS docs/terms page>",
"sourceRole":"<one allowed role>",
"freshnessClass":"<one allowed class>"
```

Classification rules for this migration are deterministic:

```text
CISA KEV, NVD, EPSS, ATT&CK TAXII, IANA/RDAP-backed registration -> authoritative
provider-owned direct telemetry/reputation APIs such as GreyNoise, Shodan, Censys, IPinfo, AbuseIPDB, urlscan, Cloudflare Radar -> first_party
multi-source intelligence aggregators such as VirusTotal, OTX, Pulsedive, ThreatMiner -> aggregator
community/public blocklists and community feeds such as DShield, Feodo, Spamhaus DROP, Tor exit, OpenPhish, abuse.ch list-style feeds -> community
contextual ransomware/news/reference datasets -> contextual
```

Freshness rules:

```text
live -> request represents current service state and is intended to change continuously
near_real_time -> service is continuously/rapidly updated but results may lag collection
periodic -> dataset is refreshed on a batch cadence
reference -> taxonomy/reference/slow-changing knowledge
```

Do not alter `types`, hosts, methods, credentials, tiers, budgets, parser versions, or activation flags in this task.

- [ ] **Step 6: Run focused manifest tests and verify GREEN**

```bash
node --test test/provider-control-manifest.test.js test/provider-contract-manifest.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add config/providers.json src/providers/manifest.js src/providers/metadata.js test/provider-control-manifest.test.js test/provider-contract-manifest.test.js
git commit -m "feat: add v8 provider admission metadata"
```

---

### Task 3: Add the fail-closed provider contract validator

**Files:**
- Create: `src/core/provider-contract.js`
- Create: `test/provider-contract-v8.test.js`
- Modify: `src/core/provider-registry.js`

**Interfaces:**
- Consumes: `observablePolicy`, `isObservableType`, existing provider adapter metadata.
- Produces: `assertProviderContract(...)`, `validateProviderSet(...)`; `createProviderRegistry()` rejects contract-invalid adapters before registration.

- [ ] **Step 1: Write failing contract tests**

Create `test/provider-contract-v8.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProviderContract } from '../src/core/provider-contract.js';
import { OBSERVABLE_MANIFEST } from '../src/core/observable-registry.js';

const basePolicy = Object.freeze({
  displayName: 'Fixture',
  credentialEnv: null,
  optionalCredential: false,
  authType: 'none',
  tier: 1,
  costClass: 'free',
  types: Object.freeze(['ip']),
  observationTypes: Object.freeze(['network_identity']),
  semanticClassHints: Object.freeze(['network_context']),
  timeoutMs: 1000,
  cacheTtlMs: 1000,
  negativeCacheTtlMs: 1000,
  maxResponseBytes: 1024,
  fixedHosts: Object.freeze(['example.test']),
  methods: Object.freeze(['GET']),
  protocols: Object.freeze(['https:']),
  parserVersion: 'fixture-1',
  sourceUrl: 'https://example.test/docs',
  distribution: 'shareable',
  active: true,
  sourceRole: 'first_party',
  freshnessClass: 'near_real_time',
  admissionVersion: 'v8.1',
  termsUrl: 'https://example.test/terms',
  exportPolicy: 'shareable',
});

const baseAdapter = Object.freeze({
  ...basePolicy,
  name: 'fixture',
  run: async () => ({ ok: true, data: {} }),
});

test('valid provider contract passes', () => {
  assert.equal(assertProviderContract({ adapter: baseAdapter, policy: basePolicy, observableRegistry: OBSERVABLE_MANIFEST }), true);
});

test('provider contract rejects undeclared observable types', () => {
  const policy = { ...basePolicy, types: ['email'] };
  const adapter = { ...baseAdapter, types: ['email'] };
  assert.throws(
    () => assertProviderContract({ adapter, policy, observableRegistry: OBSERVABLE_MANIFEST }),
    /fixture.*unknown observable type email/,
  );
});

test('provider contract rejects non-HTTPS and adapter-policy divergence', () => {
  assert.throws(
    () => assertProviderContract({ adapter: { ...baseAdapter, protocols: ['http:'] }, policy: basePolicy, observableRegistry: OBSERVABLE_MANIFEST }),
    /fixture.*protocols.*policy mismatch/,
  );
  assert.throws(
    () => assertProviderContract({ adapter: { ...baseAdapter, fixedHosts: ['other.test'] }, policy: basePolicy, observableRegistry: OBSERVABLE_MANIFEST }),
    /fixture.*fixedHosts.*policy mismatch/,
  );
});
```

- [ ] **Step 2: Run the new test and verify RED**

```bash
node --test test/provider-contract-v8.test.js
```

Expected: FAIL because `src/core/provider-contract.js` does not exist.

- [ ] **Step 3: Implement provider contract validation**

Create `src/core/provider-contract.js` with this shape:

```js
const METHODS = new Set(['GET', 'POST']);
const SOURCE_ROLES = new Set(['authoritative', 'first_party', 'aggregator', 'community', 'contextual']);
const FRESHNESS = new Set(['live', 'near_real_time', 'periodic', 'reference']);

function sameStrings(a, b) {
  return Array.isArray(a) && Array.isArray(b) &&
    a.length === b.length && a.every((value, index) => value === b[index]);
}

function fail(name, reason) {
  throw new TypeError(`provider ${name}: ${reason}`);
}

export function assertProviderContract({ adapter, policy, observableRegistry }) {
  const name = adapter?.name ?? 'unknown';
  if (!adapter || !policy) fail(name, 'adapter and policy are required');
  for (const type of policy.types ?? []) {
    if (!Object.hasOwn(observableRegistry ?? {}, type)) fail(name, `unknown observable type ${type}`);
  }
  for (const field of ['types', 'observationTypes', 'fixedHosts', 'methods', 'protocols']) {
    if (!sameStrings(adapter[field], policy[field])) fail(name, `${field} policy mismatch`);
  }
  if (!adapter.protocols.every(protocol => protocol === 'https:')) fail(name, 'https-only protocol required');
  if (!adapter.methods.every(method => METHODS.has(method))) fail(name, 'unsupported method');
  if (!SOURCE_ROLES.has(policy.sourceRole)) fail(name, 'invalid sourceRole');
  if (!FRESHNESS.has(policy.freshnessClass)) fail(name, 'invalid freshnessClass');
  if (policy.admissionVersion !== 'v8.1') fail(name, 'invalid admissionVersion');
  if (policy.exportPolicy !== policy.distribution) fail(name, 'export policy migration mismatch');
  if (typeof adapter.run !== 'function') fail(name, 'run function required');
  return true;
}

export function validateProviderSet({ adapters, manifest, observableRegistry }) {
  const names = [];
  const types = new Set();
  for (const adapter of adapters) {
    const policy = manifest[adapter.name];
    assertProviderContract({ adapter, policy, observableRegistry });
    names.push(adapter.name);
    for (const type of adapter.types) types.add(type);
  }
  return Object.freeze({
    providerNames: Object.freeze([...names].sort()),
    observableTypes: Object.freeze([...types].sort()),
  });
}
```

- [ ] **Step 4: Wire the validator into `createProviderRegistry()`**

In `src/core/provider-registry.js`, import the observable manifest and contract validator:

```js
import { OBSERVABLE_MANIFEST } from './observable-registry.js';
import { assertProviderContract } from './provider-contract.js';
import { providerPolicy } from '../providers/manifest.js';
```

Before inserting an adapter into the map:

```js
const policy = providerPolicy(adapter.name);
assertProviderContract({ adapter, policy, observableRegistry: OBSERVABLE_MANIFEST });
```

Keep existing numeric bounds, duplicate-name rejection, and object freezing. Remove support for `http:` from the local `PROTOCOLS` set so registry and contract both fail closed on non-HTTPS adapters.

- [ ] **Step 5: Run focused registry/contract tests**

```bash
node --test test/provider-contract-v8.test.js test/provider-control-manifest.test.js test/provider-runtime.test.js test/egress-policy.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/core/provider-contract.js src/core/provider-registry.js test/provider-contract-v8.test.js
git commit -m "feat: enforce v8 provider contracts"
```

---

### Task 4: Extend runtime provider manifest projection with v8 semantics

**Files:**
- Modify: `src/core/provider-manifest.js`
- Modify: `test/provider-manifest.test.js`

**Interfaces:**
- Consumes: immutable adapter metadata.
- Produces: runtime provider manifest entries containing the five v8 admission fields while preserving existing fields and caller compatibility.

- [ ] **Step 1: Write a failing projection test**

In `test/provider-manifest.test.js`, add:

```js
test('runtime provider manifest exposes v8 source and export semantics additively', () => {
  const manifest = manifestForRegistry(createProviderRegistry(ALL_PROVIDERS));
  const censys = manifest.find(item => item.name === 'censys');
  assert.ok(censys);
  assert.equal(censys.admissionVersion, 'v8.1');
  assert.equal(censys.sourceRole, 'first_party');
  assert.equal(censys.freshnessClass, 'near_real_time');
  assert.match(censys.termsUrl, /^https:\/\//);
  assert.equal(censys.exportPolicy, censys.distribution);
});
```

If the file does not currently import `ALL_PROVIDERS`, `createProviderRegistry`, and `manifestForRegistry`, add those exact imports.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
node --test test/provider-manifest.test.js
```

Expected: FAIL on missing v8 projection fields.

- [ ] **Step 3: Add the fields to `entry(adapter)`**

In `src/core/provider-manifest.js` return:

```js
sourceRole: adapter.sourceRole,
freshnessClass: adapter.freshnessClass,
admissionVersion: adapter.admissionVersion,
termsUrl: adapter.termsUrl,
exportPolicy: adapter.exportPolicy,
distribution: adapter.distribution,
```

Do not remove or rename any existing field.

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
node --test test/provider-manifest.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/core/provider-manifest.js test/provider-manifest.test.js
git commit -m "feat: expose v8 provider semantics"
```

---

### Task 5: Add a deterministic shared capability registry

**Files:**
- Create: `src/core/capability-registry.js`
- Create: `test/capability-registry-v8.test.js`

**Interfaces:**
- Consumes: `providerRegistry.values()`, observable manifest/registry.
- Produces: `buildCapabilityRegistry({ providerRegistry, observableRegistry })` for later API, CLI, docs, and integration parity.

- [ ] **Step 1: Write failing capability projection tests**

Create `test/capability-registry-v8.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { buildCapabilityRegistry } from '../src/core/capability-registry.js';
import { OBSERVABLE_MANIFEST } from '../src/core/observable-registry.js';
import { ALL_PROVIDERS } from '../src/providers/index.js';

test('capability registry is deterministic, frozen, and type-indexed', () => {
  const providerRegistry = createProviderRegistry(ALL_PROVIDERS);
  const capabilities = buildCapabilityRegistry({ providerRegistry, observableRegistry: OBSERVABLE_MANIFEST });
  assert.equal(Object.isFrozen(capabilities), true);
  assert.deepEqual(capabilities.observableTypes.map(item => item.type), ['asn', 'attack', 'cidr', 'cve', 'domain', 'hash', 'ip', 'url']);
  assert.deepEqual(capabilities.providers.map(item => item.name), [...capabilities.providers.map(item => item.name)].sort());
  assert.ok(capabilities.byType.ip.providers.includes('censys'));
  assert.ok(capabilities.byType.cve.providers.includes('cisa-kev'));
});

test('capability registry never exposes credential environment variable names', () => {
  const providerRegistry = createProviderRegistry(ALL_PROVIDERS);
  const capabilities = buildCapabilityRegistry({ providerRegistry, observableRegistry: OBSERVABLE_MANIFEST });
  const serialized = JSON.stringify(capabilities);
  assert.doesNotMatch(serialized, /(?:API_KEY|TOKEN|SECRET|PASSWORD)/);
  assert.match(serialized, /"credentialMode":"required"|"credentialMode":"optional"|"credentialMode":"none"/);
});
```

- [ ] **Step 2: Run the new test and verify RED**

```bash
node --test test/capability-registry-v8.test.js
```

Expected: FAIL because `src/core/capability-registry.js` does not exist.

- [ ] **Step 3: Implement deterministic capability projection**

Create `src/core/capability-registry.js`:

```js
function freezeArray(values) {
  return Object.freeze(values.map(value => Object.freeze(value)));
}

export function buildCapabilityRegistry({ providerRegistry, observableRegistry }) {
  if (!providerRegistry || typeof providerRegistry.values !== 'function') throw new TypeError('providerRegistry is required');
  if (!observableRegistry || typeof observableRegistry !== 'object') throw new TypeError('observableRegistry is required');

  const observableTypes = Object.keys(observableRegistry).sort().map(type => ({
    type,
    displayName: observableRegistry[type].displayName,
    category: observableRegistry[type].category,
    canonicalization: observableRegistry[type].canonicalization,
    stix: observableRegistry[type].stix,
    active: observableRegistry[type].active,
  }));

  const providers = providerRegistry.values().map(provider => ({
    name: provider.name,
    displayName: provider.displayName,
    types: Object.freeze([...provider.types].sort()),
    sourceRole: provider.sourceRole,
    freshnessClass: provider.freshnessClass,
    distribution: provider.distribution,
    exportPolicy: provider.exportPolicy,
    credentialMode: provider.requiredEnv ? 'required' : provider.optionalEnv ? 'optional' : 'none',
    active: provider.active !== false,
  })).sort((a, b) => a.name.localeCompare(b.name));

  const byType = Object.fromEntries(observableTypes.map(({ type }) => {
    const matching = providers.filter(provider => provider.types.includes(type));
    return [type, Object.freeze({
      providers: Object.freeze(matching.map(provider => provider.name)),
      activeProviders: Object.freeze(matching.filter(provider => provider.active).map(provider => provider.name)),
    })];
  }));

  return Object.freeze({
    observableTypes: freezeArray(observableTypes),
    providers: freezeArray(providers),
    byType: Object.freeze(byType),
  });
}
```

- [ ] **Step 4: Run the capability tests and verify GREEN**

```bash
node --test test/capability-registry-v8.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add src/core/capability-registry.js test/capability-registry-v8.test.js
git commit -m "feat: add shared capability registry"
```

---

### Task 6: Add cross-manifest invariants and backward-compatibility gates

**Files:**
- Modify: `test/manifest-invariants.test.js`
- Modify: `test/evidence-v2.test.js`
- Modify: `test/meta-status.test.js`

**Interfaces:**
- Consumes: observable manifest, provider manifest, current Evidence v2/API behavior.
- Produces: regression gates ensuring Train 1 is metadata-only from the caller perspective.

- [ ] **Step 1: Add cross-manifest invariant tests**

Append to `test/manifest-invariants.test.js`:

```js
import { OBSERVABLE_MANIFEST } from '../src/core/observable-registry.js';
import { PROVIDER_MANIFEST } from '../src/providers/manifest.js';

test('every provider type exists in the canonical observable manifest', () => {
  for (const [name, provider] of Object.entries(PROVIDER_MANIFEST)) {
    for (const type of provider.types) {
      assert.ok(Object.hasOwn(OBSERVABLE_MANIFEST, type), `${name}: unknown type ${type}`);
      assert.equal(OBSERVABLE_MANIFEST[type].active, true, `${name}: inactive type ${type}`);
    }
  }
});

test('provider egress and export policy remain fail-closed', () => {
  for (const [name, provider] of Object.entries(PROVIDER_MANIFEST)) {
    assert.deepEqual(provider.protocols, ['https:'], `${name}: protocols`);
    assert.equal(provider.exportPolicy, provider.distribution, `${name}: export migration parity`);
    assert.match(provider.termsUrl, /^https:\/\//, `${name}: termsUrl`);
  }
});
```

If `assert` is already imported, reuse the existing import rather than duplicating it.

- [ ] **Step 2: Add an Evidence v2 non-regression assertion**

In `test/evidence-v2.test.js`, add one assertion to an existing successful enrichment fixture that the schema version and existing top-level keys remain unchanged by registry metadata. Use the current expected schema version from the file, not a new version.

Example shape:

```js
assert.equal(result.schemaVersion, '2.0');
assert.equal(Object.hasOwn(result, 'evidence'), true);
assert.equal(Object.hasOwn(result, 'decision'), true);
```

Use the exact current schema string already asserted elsewhere in the file if it differs from `'2.0'`.

- [ ] **Step 3: Add a `/meta` non-regression assertion**

In `test/meta-status.test.js`, assert the existing response fields still exist and auth behavior remains unchanged. Do not wire the new capability registry into `/meta` in Train 1.

```js
assert.equal(response.statusCode, 200);
assert.ok(body.version);
```

Use the existing test helper names and response shape already present in the file.

- [ ] **Step 4: Run the focused compatibility set**

```bash
node --test test/manifest-invariants.test.js test/evidence-v2.test.js test/meta-status.test.js test/core-security.test.js test/egress-policy.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add test/manifest-invariants.test.js test/evidence-v2.test.js test/meta-status.test.js
git commit -m "test: lock v8 registry compatibility"
```

---

### Task 7: Full verification and Train 1 acceptance

**Files:**
- No production files added in this task.
- Update only this plan's checkbox state if the execution workflow tracks plan completion in git.

**Interfaces:**
- Consumes: completed Tasks 1–6.
- Produces: verified Train 1 branch suitable for review/PR.

- [ ] **Step 1: Run the complete Node test suite**

```bash
npm test
```

Expected: all tests PASS; no skipped failure caused by the new registries.

- [ ] **Step 2: Run repository verification**

```bash
npm run verify:repo
```

Expected: PASS.

- [ ] **Step 3: Run public-release audit**

```bash
npm run audit:public
```

Expected: PASS with no credential leakage and no forbidden secret material.

- [ ] **Step 4: Run the complete local gate**

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 5: Inspect the final diff for scope discipline**

```bash
git diff --stat HEAD~6..HEAD
git diff HEAD~6..HEAD -- config/observables.json config/providers.json src/core/observable-registry.js src/core/provider-contract.js src/core/capability-registry.js src/providers/manifest.js src/providers/metadata.js src/core/provider-registry.js src/core/provider-manifest.js
```

Acceptance conditions:

```text
- no provider host/method/type/tier/credential activation changed except new metadata fields
- no new observable type activated
- no API route or auth behavior changed
- no Evidence v2 field removed or renamed
- all provider protocols remain https:
- capability projection contains no secret environment-variable names
- all manifest/adapter objects remain frozen or copied into frozen structures
```

- [ ] **Step 6: Create the Train 1 review commit only if plan tracking changed**

If no files changed during verification, do not create an empty commit. If checkbox state or acceptance notes were committed:

```bash
git add docs/superpowers/plans/2026-08-28-v8-train-1-contracts-registries.md
git commit -m "docs: record v8 train 1 verification"
```

---

## Train 1 Acceptance Contract

Train 1 is complete only when all of the following are true:

```text
1. The eight current observable types have one canonical validated manifest.
2. Every current provider has one complete v8 policy with sourceRole, freshnessClass, admissionVersion, termsUrl, and exportPolicy.
3. Runtime adapters cannot register unless policy and adapter metadata match exactly on bounded fields.
4. Any provider referencing an unknown observable type fails closed.
5. Non-HTTPS provider protocols fail closed.
6. A deterministic secret-free capability registry exists for later API/CLI/docs/integration parity.
7. Existing Evidence v2, auth, API, provider routing, scheduler budgets, and active provider set remain behaviorally unchanged.
8. `npm test`, `npm run verify:repo`, `npm run audit:public`, and `npm run check` all pass.
```

## Subsequent v8 Plans

After Train 1 merges, create the remaining plans against the new mainline so their exact files and interfaces reflect the landed contracts rather than today's pre-v8 tree:

```text
Train 2 — curated provider + observable expansion
Train 3 — Evidence v2 semantic layers + normalized semantic diff engine
Train 4 — IndexedDB local cases + immutable snapshots + cross-case index + .para11ax bundles
Train 5 — deterministic guidance expansion + evidence graph
Train 6 — shared API/CLI/shell/Maltego/report/STIX parity
Train 7 — terminal workspace UX + mobile + accessibility + docs/ops/brand convergence
Train 8 — full regression, production deployment, production verification, capability truth audit
```

Each train must receive its own implementation plan after the predecessor merges because later file paths, interfaces, test counts, and compatibility surfaces will change.