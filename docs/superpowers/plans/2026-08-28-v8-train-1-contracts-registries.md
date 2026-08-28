# PARA11AX v8 Train 1 — Contracts and Registries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the canonical v8 observable and provider contracts so later provider, evidence, case, guidance, and interface trains can evolve without duplicating semantics or weakening fixed-egress guarantees.

**Architecture:** Keep `config/providers.json` as the canonical provider policy source, add explicit source-role/freshness/admission semantics to it, and add `config/observables.json` as the canonical observable-type policy source. Generic fixture registries remain usable for tests and embedding. The production/default provider set receives an additional canonical cross-manifest validation gate in `createApp()`. A secret-free capability registry is generated from those validated runtime registries for later `/meta`, CLI, docs, and integration parity.

**Tech Stack:** Node.js 24.x ESM, built-in `node:test` / `node:assert`, JSON manifests, existing PARA11AX provider registry and fixed-egress core.

**Spec:** `docs/superpowers/specs/2026-08-28-para11ax-v8-full-maxx-design.md`

## Global constraints

- PARA11AX remains read-only and fixed-egress: no scanning, detonation, submission, remediation, blocking, arbitrary proxying, user-controlled egress, or autonomous action.
- Provider credentials remain server-side deployment/runtime secrets only.
- Current Evidence v2, API, CLI, and `PARA11AX_TOKEN` behavior remain backward compatible.
- `https:` remains the only accepted canonical provider protocol; provider methods remain limited to `GET` and `POST`.
- Existing provider hosts, methods, types, credentials, tiers, parser versions, activation state, scheduler limits, timeout budgets, and cache behavior do not change in Train 1.
- No new provider and no new observable type is activated in Train 1.
- Existing `distribution` remains the canonical export/licensing handling field in this train. Do not add a redundant second export-policy field.
- Existing `sourceUrl` remains the canonical provider documentation/provenance URL. Do not add an unverified terms URL field.
- `main` must remain deployable after every merge.

---

## Files

**Create**
- `config/observables.json`
- `src/core/observable-registry.js`
- `src/core/provider-contract.js`
- `src/core/capability-registry.js`
- `test/observable-registry-v8.test.js`
- `test/provider-contract-v8.test.js`
- `test/capability-registry-v8.test.js`

**Modify**
- `config/providers.json`
- `src/providers/manifest.js`
- `src/providers/metadata.js`
- `src/core/provider-manifest.js`
- `src/app.js`
- `test/provider-control-manifest.test.js`
- `test/provider-contract-manifest.test.js`
- `test/provider-manifest.test.js`
- `test/manifest-invariants.test.js`
- `test/evidence-v2.test.js`
- `test/meta-status.test.js`

**Do not modify**
- provider adapter implementations under `src/providers/*.js` except `manifest.js` and `metadata.js`
- `src/core/orchestrator.js`
- `src/core/scheduler.js`
- `src/core/decision-engine.js`
- `src/export/stix.js`
- API route files
- shell/UI files

## Canonical interfaces

```js
// src/core/observable-registry.js
export const OBSERVABLE_MANIFEST;
export function observablePolicy(type);
export function observableTypes();
export function isObservableType(type);
```

```js
// src/core/provider-contract.js
export function assertProviderContract({ adapter, policy, observableRegistry });
export function validateProviderSet({ adapters, manifest, observableRegistry });
```

```js
// src/core/capability-registry.js
export function buildCapabilityRegistry({ providerRegistry, observableRegistry });
```

Provider entries gain exactly these v8 fields:

```json
{
  "sourceRole": "authoritative|first_party|aggregator|community|contextual",
  "freshnessClass": "live|near_real_time|periodic|reference",
  "admissionVersion": "v8.1"
}
```

The observable manifest starts with exactly the eight already-supported types. Its `stixExport` field documents current exporter behavior rather than inventing a new export mapping:

```json
{
  "ip":     {"displayName":"IP address","category":"infrastructure","canonicalization":"ip","maxLength":64,"stixExport":"indicator","active":true},
  "domain": {"displayName":"Domain","category":"infrastructure","canonicalization":"idna-domain","maxLength":253,"stixExport":"indicator","active":true},
  "url":    {"displayName":"URL","category":"infrastructure","canonicalization":"http-url","maxLength":4096,"stixExport":"indicator","active":true},
  "hash":   {"displayName":"File hash","category":"artifact","canonicalization":"md5-sha1-sha256","maxLength":64,"stixExport":"indicator","active":true},
  "cve":    {"displayName":"CVE","category":"vulnerability","canonicalization":"cve","maxLength":32,"stixExport":"vulnerability","active":true},
  "attack": {"displayName":"ATT&CK ID","category":"knowledge","canonicalization":"attack-id","maxLength":16,"stixExport":"evidence-object","active":true},
  "asn":    {"displayName":"ASN","category":"infrastructure","canonicalization":"asn","maxLength":16,"stixExport":"indicator","active":true},
  "cidr":   {"displayName":"CIDR","category":"infrastructure","canonicalization":"cidr","maxLength":64,"stixExport":"unsupported","active":true}
}
```

---

### Task 1: Add the canonical observable manifest and registry

**Files:**
- Create: `config/observables.json`
- Create: `src/core/observable-registry.js`
- Create: `test/observable-registry-v8.test.js`

**Produces:** `OBSERVABLE_MANIFEST`, `observablePolicy`, `observableTypes`, `isObservableType`.

- [ ] **Step 1: Write the failing test**

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

test('v8 observable registry exposes exactly the current eight types', () => {
  assert.deepEqual(observableTypes(), EXPECTED);
  assert.deepEqual(Object.keys(OBSERVABLE_MANIFEST).sort(), EXPECTED);
});

test('observable policies are immutable and document canonicalization plus STIX posture', () => {
  const cve = observablePolicy('cve');
  assert.equal(cve.canonicalization, 'cve');
  assert.equal(cve.stixExport, 'vulnerability');
  assert.equal(cve.active, true);
  assert.equal(Object.isFrozen(cve), true);
  assert.throws(() => observablePolicy('email'), /unknown observable type: email/);
});

test('observable type lookup is strict', () => {
  assert.equal(isObservableType('ip'), true);
  assert.equal(isObservableType('IP'), false);
  assert.equal(isObservableType('anything'), false);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test test/observable-registry-v8.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/observable-registry.js`.

- [ ] **Step 3: Create `config/observables.json`**

Use the exact eight-entry JSON object shown under “Canonical interfaces”. Do not add candidate v8 types.

- [ ] **Step 4: Implement the strict registry**

Create `src/core/observable-registry.js`:

```js
import rawManifest from '../../config/observables.json' with { type: 'json' };

const CATEGORIES = new Set(['infrastructure', 'artifact', 'vulnerability', 'knowledge']);
const CANONICALIZATION = new Set(['ip', 'idna-domain', 'http-url', 'md5-sha1-sha256', 'cve', 'attack-id', 'asn', 'cidr']);
const STIX_EXPORT = new Set(['indicator', 'vulnerability', 'evidence-object', 'unsupported']);

function fail(message) {
  throw new Error(`invalid observable manifest: ${message}`);
}

function validate(type, input) {
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(type)) fail(`type ${type}`);
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(type);
  if (typeof input.displayName !== 'string' || input.displayName.length < 1 || input.displayName.length > 80) fail(`${type}.displayName`);
  if (!CATEGORIES.has(input.category)) fail(`${type}.category`);
  if (!CANONICALIZATION.has(input.canonicalization)) fail(`${type}.canonicalization`);
  if (!Number.isSafeInteger(input.maxLength) || input.maxLength < 1 || input.maxLength > 4096) fail(`${type}.maxLength`);
  if (!STIX_EXPORT.has(input.stixExport)) fail(`${type}.stixExport`);
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

- [ ] **Step 5: Run GREEN**

```bash
node --test test/observable-registry-v8.test.js
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add config/observables.json src/core/observable-registry.js test/observable-registry-v8.test.js
git commit -m "feat: add canonical observable registry"
```

---

### Task 2: Add explicit source-role, freshness, and admission semantics to all 37 providers

**Files:**
- Modify: `config/providers.json`
- Modify: `src/providers/manifest.js`
- Modify: `src/providers/metadata.js`
- Modify: `test/provider-control-manifest.test.js`
- Modify: `test/provider-contract-manifest.test.js`

**Produces:** frozen adapter fields `sourceRole`, `freshnessClass`, `admissionVersion`.

- [ ] **Step 1: Write failing manifest parity tests**

Extend `REQUIRED` in `test/provider-control-manifest.test.js` with:

```js
'sourceRole', 'freshnessClass', 'admissionVersion'
```

Add inside the existing provider loop:

```js
assert.equal(policy.sourceRole, provider.sourceRole);
assert.equal(policy.freshnessClass, provider.freshnessClass);
assert.equal(policy.admissionVersion, provider.admissionVersion);
```

Add to `test/provider-contract-manifest.test.js`:

```js
test('v8 source semantics distinguish authority, direct source, aggregation and context', () => {
  assert.equal(PROVIDER_MANIFEST['cisa-kev'].sourceRole, 'authoritative');
  assert.equal(PROVIDER_MANIFEST['cisa-kev'].freshnessClass, 'periodic');
  assert.equal(PROVIDER_MANIFEST.greynoise.sourceRole, 'first_party');
  assert.equal(PROVIDER_MANIFEST.greynoise.freshnessClass, 'near_real_time');
  assert.equal(PROVIDER_MANIFEST.virustotal.sourceRole, 'aggregator');
  assert.equal(PROVIDER_MANIFEST['ransomware-live'].sourceRole, 'contextual');
  assert.equal(PROVIDER_MANIFEST['attack-taxii'].freshnessClass, 'reference');
});
```

- [ ] **Step 2: Run RED**

```bash
node --test test/provider-control-manifest.test.js test/provider-contract-manifest.test.js
```

Expected: FAIL because the three v8 fields are absent.

- [ ] **Step 3: Extend manifest validation**

Add to `src/providers/manifest.js`:

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
output.sourceRole = input.sourceRole;
output.freshnessClass = input.freshnessClass;
output.admissionVersion = input.admissionVersion;
```

- [ ] **Step 4: Project the three fields onto adapters**

Add to the frozen object returned by `withProviderMetadata()` in `src/providers/metadata.js`:

```js
sourceRole: policy.sourceRole,
freshnessClass: policy.freshnessClass,
admissionVersion: policy.admissionVersion,
```

- [ ] **Step 5: Apply this exact 37-provider classification in `config/providers.json`**

Do not change any existing field. Add only the three fields listed in the table.

| Provider | `sourceRole` | `freshnessClass` |
|---|---|---|
| ipinfo | first_party | live |
| rdap | authoritative | reference |
| ripestat | first_party | near_real_time |
| dshield | community | periodic |
| spamhaus-drop | first_party | periodic |
| tor-exit | first_party | periodic |
| feodo-tracker | first_party | near_real_time |
| threatminer | aggregator | periodic |
| misp-circl-osint | community | periodic |
| misp-botvrij-osint | community | periodic |
| greynoise | first_party | near_real_time |
| abuseipdb | first_party | near_real_time |
| shodan | first_party | near_real_time |
| censys | first_party | near_real_time |
| modat | first_party | near_real_time |
| cloudflare-radar | first_party | near_real_time |
| virustotal | aggregator | near_real_time |
| otx | aggregator | near_real_time |
| threatfox | first_party | near_real_time |
| urlscan | first_party | near_real_time |
| webamon | first_party | near_real_time |
| pulsedive | aggregator | near_real_time |
| openphish | first_party | periodic |
| urlhaus | first_party | near_real_time |
| circl-hashlookup | first_party | periodic |
| malwarebazaar | first_party | near_real_time |
| malpedia | contextual | reference |
| hybrid-analysis | first_party | near_real_time |
| cisa-kev | authoritative | periodic |
| epss | authoritative | periodic |
| circl-vulnerability | aggregator | periodic |
| nvd | authoritative | periodic |
| osv | aggregator | near_real_time |
| attack-taxii | authoritative | reference |
| tweetfeed | community | near_real_time |
| ransomlook | contextual | near_real_time |
| ransomware-live | contextual | near_real_time |

Every entry gets:

```json
"admissionVersion":"v8.1"
```

- [ ] **Step 6: Run GREEN**

```bash
node --test test/provider-control-manifest.test.js test/provider-contract-manifest.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add config/providers.json src/providers/manifest.js src/providers/metadata.js test/provider-control-manifest.test.js test/provider-contract-manifest.test.js
git commit -m "feat: add v8 provider admission semantics"
```

---

### Task 3: Add the canonical provider contract validator without breaking fixture registries

**Files:**
- Create: `src/core/provider-contract.js`
- Create: `test/provider-contract-v8.test.js`
- Modify: `src/app.js`

**Consumes:** existing generic `createProviderRegistry()` and the two canonical manifests.

**Produces:** production/default catalog validation while preserving `createProviderRegistry([fixture])` behavior used by existing tests.

- [ ] **Step 1: Write failing contract tests**

Create `test/provider-contract-v8.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProviderContract, validateProviderSet } from '../src/core/provider-contract.js';
import { OBSERVABLE_MANIFEST } from '../src/core/observable-registry.js';

const policy = Object.freeze({
  types: Object.freeze(['ip']),
  observationTypes: Object.freeze(['network_identity']),
  fixedHosts: Object.freeze(['example.test']),
  methods: Object.freeze(['GET']),
  protocols: Object.freeze(['https:']),
  distribution: 'shareable',
  sourceRole: 'first_party',
  freshnessClass: 'near_real_time',
  admissionVersion: 'v8.1',
});

const adapter = Object.freeze({
  name: 'fixture',
  ...policy,
  run: async () => ({ ok: true }),
});

test('valid canonical provider contract passes', () => {
  assert.equal(assertProviderContract({ adapter, policy, observableRegistry: OBSERVABLE_MANIFEST }), true);
});

test('contract rejects unknown observable types', () => {
  const badPolicy = { ...policy, types: ['email'] };
  const badAdapter = { ...adapter, types: ['email'] };
  assert.throws(
    () => assertProviderContract({ adapter: badAdapter, policy: badPolicy, observableRegistry: OBSERVABLE_MANIFEST }),
    /provider fixture: unknown observable type email/,
  );
});

test('contract rejects adapter-policy divergence on bounded fields', () => {
  assert.throws(
    () => assertProviderContract({ adapter: { ...adapter, fixedHosts: ['other.test'] }, policy, observableRegistry: OBSERVABLE_MANIFEST }),
    /provider fixture: fixedHosts policy mismatch/,
  );
  assert.throws(
    () => assertProviderContract({ adapter: { ...adapter, protocols: ['http:'] }, policy, observableRegistry: OBSERVABLE_MANIFEST }),
    /provider fixture: protocols policy mismatch/,
  );
});

test('provider set requires an exact manifest entry for every adapter', () => {
  assert.throws(
    () => validateProviderSet({ adapters: [adapter], manifest: {}, observableRegistry: OBSERVABLE_MANIFEST }),
    /provider fixture: missing canonical policy/,
  );
});
```

- [ ] **Step 2: Run RED**

```bash
node --test test/provider-contract-v8.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/provider-contract.js`.

- [ ] **Step 3: Implement the validator**

Create `src/core/provider-contract.js`:

```js
const METHODS = new Set(['GET', 'POST']);
const SOURCE_ROLES = new Set(['authoritative', 'first_party', 'aggregator', 'community', 'contextual']);
const FRESHNESS = new Set(['live', 'near_real_time', 'periodic', 'reference']);

function sameStrings(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
}

function fail(name, reason) {
  throw new TypeError(`provider ${name}: ${reason}`);
}

export function assertProviderContract({ adapter, policy, observableRegistry }) {
  const name = adapter?.name ?? 'unknown';
  if (!adapter) fail(name, 'adapter is required');
  if (!policy) fail(name, 'missing canonical policy');
  if (!observableRegistry || typeof observableRegistry !== 'object') fail(name, 'observable registry is required');

  for (const type of policy.types ?? []) {
    if (!Object.hasOwn(observableRegistry, type)) fail(name, `unknown observable type ${type}`);
  }

  for (const field of ['types', 'observationTypes', 'fixedHosts', 'methods', 'protocols']) {
    if (!sameStrings(adapter[field], policy[field])) fail(name, `${field} policy mismatch`);
  }

  if (!adapter.protocols.every(protocol => protocol === 'https:')) fail(name, 'https-only protocol required');
  if (!adapter.methods.every(method => METHODS.has(method))) fail(name, 'unsupported method');
  if (!SOURCE_ROLES.has(policy.sourceRole)) fail(name, 'invalid sourceRole');
  if (!FRESHNESS.has(policy.freshnessClass)) fail(name, 'invalid freshnessClass');
  if (policy.admissionVersion !== 'v8.1') fail(name, 'invalid admissionVersion');
  if (adapter.sourceRole !== policy.sourceRole) fail(name, 'sourceRole policy mismatch');
  if (adapter.freshnessClass !== policy.freshnessClass) fail(name, 'freshnessClass policy mismatch');
  if (adapter.admissionVersion !== policy.admissionVersion) fail(name, 'admissionVersion policy mismatch');
  if (adapter.distribution !== policy.distribution) fail(name, 'distribution policy mismatch');
  if (typeof adapter.run !== 'function') fail(name, 'run function required');
  return true;
}

export function validateProviderSet({ adapters, manifest, observableRegistry }) {
  if (!Array.isArray(adapters)) throw new TypeError('adapters are required');
  if (!manifest || typeof manifest !== 'object') throw new TypeError('provider manifest is required');
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

- [ ] **Step 4: Add canonical validation only to the default production catalog**

In `src/app.js`, add imports:

```js
import { validateProviderSet } from './core/provider-contract.js';
import { OBSERVABLE_MANIFEST } from './core/observable-registry.js';
import { PROVIDER_MANIFEST } from './providers/manifest.js';
```

Immediately after:

```js
const registry = createProviderRegistry(adapters);
```

add:

```js
if (adapters === ALL_PROVIDERS) {
  validateProviderSet({
    adapters: registry.values(),
    manifest: PROVIDER_MANIFEST,
    observableRegistry: OBSERVABLE_MANIFEST,
  });
}
```

Do **not** change `createProviderRegistry()` in this train. Existing tests intentionally create ad-hoc fixture adapters that are not present in `config/providers.json`; the generic registry must remain fixture-friendly.

- [ ] **Step 5: Prove generic fixture registries and canonical production validation both work**

Run:

```bash
node --test test/provider-contract-v8.test.js test/provider-runtime.test.js test/app.test.js test/meta-status.test.js test/evidence-v2.test.js
```

Expected: PASS. In particular, `test/provider-runtime.test.js` must continue registering adapter `a`, and `test/evidence-v2.test.js` must continue using its fixture `rdap` adapter without requiring canonical metadata.

- [ ] **Step 6: Commit**

```bash
git add src/core/provider-contract.js src/app.js test/provider-contract-v8.test.js
git commit -m "feat: enforce canonical provider contracts"
```

---

### Task 4: Extend runtime provider manifest projection additively

**Files:**
- Modify: `src/core/provider-manifest.js`
- Modify: `test/provider-manifest.test.js`

- [ ] **Step 1: Extend the existing fixture helper before adding the failing assertion**

In `test/provider-manifest.test.js`, add these defaults inside `adapter()`:

```js
sourceRole: 'first_party',
freshnessClass: 'near_real_time',
admissionVersion: 'v8.1',
distribution: 'shareable',
```

Then add:

```js
test('provider manifest exposes v8 source semantics additively', () => {
  const registry = createProviderRegistry([adapter()]);
  const [item] = manifestForRegistry(registry);
  assert.equal(item.sourceRole, 'first_party');
  assert.equal(item.freshnessClass, 'near_real_time');
  assert.equal(item.admissionVersion, 'v8.1');
  assert.equal(item.distribution, 'shareable');
});
```

- [ ] **Step 2: Run RED**

```bash
node --test test/provider-manifest.test.js
```

Expected: FAIL because `manifestForRegistry()` does not yet project the four fields.

- [ ] **Step 3: Add fields to `entry(adapter)` in `src/core/provider-manifest.js`**

Add without removing or renaming existing fields:

```js
sourceRole: adapter.sourceRole ?? null,
freshnessClass: adapter.freshnessClass ?? null,
admissionVersion: adapter.admissionVersion ?? null,
distribution: adapter.distribution ?? null,
```

The null fallbacks preserve compatibility for generic fixture adapters that use `manifestForRegistry()` without v8 canonical metadata.

- [ ] **Step 4: Run GREEN**

```bash
node --test test/provider-manifest.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/provider-manifest.js test/provider-manifest.test.js
git commit -m "feat: expose v8 provider semantics"
```

---

### Task 5: Add the secret-free shared capability registry

**Files:**
- Create: `src/core/capability-registry.js`
- Create: `test/capability-registry-v8.test.js`

**Produces:** one deterministic projection for later `/meta`, CLI, docs, and integration parity. Train 1 does not wire it into those surfaces.

- [ ] **Step 1: Write the failing tests**

Create `test/capability-registry-v8.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { buildCapabilityRegistry } from '../src/core/capability-registry.js';
import { OBSERVABLE_MANIFEST } from '../src/core/observable-registry.js';
import { ALL_PROVIDERS } from '../src/providers/index.js';

test('capability registry is deterministic, frozen and type-indexed', () => {
  const providerRegistry = createProviderRegistry(ALL_PROVIDERS);
  const capabilities = buildCapabilityRegistry({ providerRegistry, observableRegistry: OBSERVABLE_MANIFEST });
  assert.equal(Object.isFrozen(capabilities), true);
  assert.deepEqual(capabilities.observableTypes.map(item => item.type), ['asn', 'attack', 'cidr', 'cve', 'domain', 'hash', 'ip', 'url']);
  assert.deepEqual(capabilities.providers.map(item => item.name), [...capabilities.providers.map(item => item.name)].sort());
  assert.ok(capabilities.byType.ip.providers.includes('censys'));
  assert.ok(capabilities.byType.cve.providers.includes('cisa-kev'));
});

test('capability registry exposes credential mode but never credential environment names', () => {
  const providerRegistry = createProviderRegistry(ALL_PROVIDERS);
  const capabilities = buildCapabilityRegistry({ providerRegistry, observableRegistry: OBSERVABLE_MANIFEST });
  const serialized = JSON.stringify(capabilities);
  assert.doesNotMatch(serialized, /(?:API_KEY|TOKEN|SECRET|PASSWORD)/);
  assert.match(serialized, /"credentialMode":"(?:required|optional|none)"/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test test/capability-registry-v8.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/capability-registry.js`.

- [ ] **Step 3: Implement deterministic projection**

Create `src/core/capability-registry.js`:

```js
function frozenObjects(values) {
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
    stixExport: observableRegistry[type].stixExport,
    active: observableRegistry[type].active,
  }));

  const providers = providerRegistry.values().map(provider => ({
    name: provider.name,
    displayName: provider.displayName ?? provider.name,
    types: Object.freeze([...provider.types].sort()),
    sourceRole: provider.sourceRole ?? null,
    freshnessClass: provider.freshnessClass ?? null,
    admissionVersion: provider.admissionVersion ?? null,
    distribution: provider.distribution ?? null,
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
    observableTypes: frozenObjects(observableTypes),
    providers: frozenObjects(providers),
    byType: Object.freeze(byType),
  });
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test test/capability-registry-v8.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/capability-registry.js test/capability-registry-v8.test.js
git commit -m "feat: add shared capability registry"
```

---

### Task 6: Add cross-manifest and backward-compatibility gates

**Files:**
- Modify: `test/manifest-invariants.test.js`
- Modify: `test/evidence-v2.test.js`
- Modify: `test/meta-status.test.js`

- [ ] **Step 1: Add cross-manifest invariants**

Add imports to `test/manifest-invariants.test.js`:

```js
import { OBSERVABLE_MANIFEST } from '../src/core/observable-registry.js';
import { PROVIDER_MANIFEST } from '../src/providers/manifest.js';
```

Append:

```js
test('every canonical provider type is an active canonical observable', () => {
  for (const [name, provider] of Object.entries(PROVIDER_MANIFEST)) {
    for (const type of provider.types) {
      assert.ok(Object.hasOwn(OBSERVABLE_MANIFEST, type), `${name}: unknown type ${type}`);
      assert.equal(OBSERVABLE_MANIFEST[type].active, true, `${name}: inactive type ${type}`);
    }
  }
});

test('all canonical providers are v8-admitted and HTTPS-only', () => {
  for (const [name, provider] of Object.entries(PROVIDER_MANIFEST)) {
    assert.equal(provider.admissionVersion, 'v8.1', `${name}: admissionVersion`);
    assert.ok(['authoritative', 'first_party', 'aggregator', 'community', 'contextual'].includes(provider.sourceRole), `${name}: sourceRole`);
    assert.ok(['live', 'near_real_time', 'periodic', 'reference'].includes(provider.freshnessClass), `${name}: freshnessClass`);
    assert.deepEqual(provider.protocols, ['https:'], `${name}: protocols`);
  }
});
```

- [ ] **Step 2: Strengthen the existing Evidence v2 compatibility test without changing production code**

In the first test of `test/evidence-v2.test.js`, after `const result = response.body;`, add:

```js
assert.deepEqual(
  Object.keys(result).sort(),
  ['budget', 'correlation', 'coverage', 'decision', 'durationMs', 'evidence', 'failures', 'gatewayVersion', 'huntContext', 'indicator', 'limitations', 'meta', 'profile', 'providerSummary', 'queriedAt', 'relationships', 'requestId', 'schemaVersion', 'status', 'type'].sort(),
);
```

This locks the current top-level Evidence v2 envelope during Train 1.

- [ ] **Step 3: Strengthen `/meta` non-regression**

In the first test of `test/meta-status.test.js`, after existing limit assertions add:

```js
assert.deepEqual(
  Object.keys(out.body).sort(),
  ['gatewayVersion', 'limits', 'profiles', 'providers', 'schemaVersion', 'types'].sort(),
);
```

Do not expose `buildCapabilityRegistry()` through `/meta` yet; that happens in Train 6 when surface parity is implemented deliberately.

- [ ] **Step 4: Run focused compatibility set**

```bash
node --test test/manifest-invariants.test.js test/evidence-v2.test.js test/meta-status.test.js test/core-security.test.js test/egress-policy.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/manifest-invariants.test.js test/evidence-v2.test.js test/meta-status.test.js
git commit -m "test: lock v8 registry compatibility"
```

---

### Task 7: Train 1 verification and acceptance

**Files:** no production changes.

- [ ] **Step 1: Run the complete Node suite**

```bash
npm test
```

Expected: PASS with zero failing tests.

- [ ] **Step 2: Run repository verification**

```bash
npm run verify:repo
```

Expected: PASS.

- [ ] **Step 3: Run public-release audit**

```bash
npm run audit:public
```

Expected: PASS with no secret leakage.

- [ ] **Step 4: Run the full local gate**

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 5: Inspect scope and compatibility**

```bash
git diff --stat main...HEAD
git diff main...HEAD -- config/observables.json config/providers.json src/core/observable-registry.js src/core/provider-contract.js src/core/capability-registry.js src/core/provider-manifest.js src/providers/manifest.js src/providers/metadata.js src/app.js
```

Acceptance checklist:

```text
- exactly eight observable types are canonical and active
- exactly 37 existing providers remain present and active/inactive exactly as before Train 1
- no provider host, method, supported type, credential field, tier, timeout, cache TTL, parser version or source URL changes
- every canonical provider protocol remains https:
- generic fixture registries still work without canonical manifest membership
- the default production provider catalog is cross-validated against provider and observable manifests
- capability projection contains no provider secret names
- Evidence v2 top-level envelope is unchanged
- /meta top-level response is unchanged
- auth, scheduler, provider execution and STIX behavior are unchanged
```

Do not create an empty verification commit.

---

## Train 1 acceptance contract

Train 1 is complete only when all conditions are true:

```text
1. The eight current observable types have one strict canonical manifest.
2. Every current provider has explicit sourceRole, freshnessClass and admissionVersion metadata.
3. The default production provider set cannot start with an unknown observable type or bounded-field policy mismatch.
4. Generic fixture registries remain backward compatible.
5. A deterministic secret-free capability registry exists but is not yet exposed through public surfaces.
6. Existing Evidence v2, API, auth, provider routing, scheduler budgets, STIX output and active provider set remain behaviorally unchanged.
7. npm test, npm run verify:repo, npm run audit:public and npm run check all pass.
```

## Subsequent v8 implementation plans

Create each later plan only after its predecessor lands on `main`, so exact paths, interfaces, fixtures and test counts are based on the actual merged state:

```text
Train 2 — curated provider and observable expansion
Train 3 — Evidence v2 semantic layers and normalized semantic diff engine
Train 4 — IndexedDB local cases, immutable snapshots, cross-case index and .para11ax bundles
Train 5 — deterministic guidance expansion and contextual evidence graph
Train 6 — shared API, CLI, shell, Maltego, report and STIX parity
Train 7 — terminal workspace UX, mobile, accessibility, docs, ops and brand convergence
Train 8 — complete regression, deployment, production verification and capability-truth audit
```

Each train gets its own implementation plan and its own TDD/verification cycle.