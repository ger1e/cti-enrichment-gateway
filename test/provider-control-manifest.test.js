import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL_PROVIDERS } from '../src/providers/index.js';
import { PROVIDER_MANIFEST, providerPolicy, providerSecretNames } from '../src/providers/manifest.js';

const json = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const REQUIRED = [
  'displayName','credentialEnv','optionalCredential','authType','tier','costClass','types','observationTypes',
  'timeoutMs','cacheTtlMs','negativeCacheTtlMs','maxResponseBytes','fixedHosts','methods','protocols','parserVersion','sourceUrl','distribution',
];

test('canonical provider manifest has exactly one complete policy for every active adapter', () => {
  const names = ALL_PROVIDERS.map(p => p.name).sort();
  assert.deepEqual(Object.keys(PROVIDER_MANIFEST).sort(), names);
  for (const provider of ALL_PROVIDERS) {
    const policy = providerPolicy(provider.name);
    for (const field of REQUIRED) assert.ok(Object.hasOwn(policy, field), `${provider.name}.${field}`);
    assert.deepEqual(policy.types, provider.types);
    assert.deepEqual(policy.observationTypes, provider.observationTypes);
    assert.equal(policy.tier, provider.tier);
    assert.equal(policy.costClass, provider.costClass);
    assert.equal(policy.timeoutMs, provider.timeoutMs);
    assert.equal(policy.cacheTtlMs, provider.cacheTtlMs);
    assert.equal(policy.negativeCacheTtlMs, provider.negativeCacheTtlMs);
    assert.equal(policy.maxResponseBytes, provider.maxResponseBytes);
    assert.deepEqual(policy.fixedHosts, provider.fixedHosts);
    assert.deepEqual(policy.methods, provider.methods ?? ['GET']);
    assert.deepEqual(policy.protocols, provider.protocols ?? ['https:']);
    assert.equal(policy.parserVersion, provider.parserVersion);
    assert.equal(policy.sourceUrl, provider.sourceUrl);
    assert.match(policy.displayName, /^.{1,80}$/);
    assert.ok(['none','api_key','bearer','basic','token'].includes(policy.authType));
    assert.ok(['internal','shareable','internal_only'].includes(policy.distribution));
  }
});

test('provider secret inventory is the exact source for env and bootstrap provider credentials', () => {
  const providerNames = [...providerSecretNames()].sort();
  assert.deepEqual(providerNames, [...new Set(providerNames)].sort());
  assert.equal(providerNames.includes('PARA11AX_TOKEN'), false);
  assert.equal(providerNames.includes('SENTRY_AUTH_TOKEN'), false);
  for (const name of providerNames) assert.match(name, /^[A-Z0-9_]+$/);

  const expected = ['PARA11AX_TOKEN', ...providerNames, 'SENTRY_AUTH_TOKEN'].sort();
  const envNames = text('.env.example').split(/\r?\n/).filter(line => /^[A-Z0-9_]+=$/.test(line)).map(line => line.slice(0, -1)).sort();
  assert.deepEqual(envNames, expected);

  const bootstrap = text('scripts/bootstrap-vercel.ps1');
  const block = bootstrap.match(/\$SecretNames\s*=\s*@\(([\s\S]*?)\)\s*\n/);
  assert.ok(block, 'bootstrap SecretNames block missing');
  const bootstrapNames = [...block[1].matchAll(/'([A-Z0-9_]+)'/g)].map(match => match[1]).sort();
  assert.deepEqual(bootstrapNames, expected);
});

test('checked-in JSON is identical to the runtime manifest projection and contains no credential values', () => {
  const raw = json('config/providers.json');
  assert.deepEqual(raw, PROVIDER_MANIFEST);
  const serialized = JSON.stringify(raw);
  assert.doesNotMatch(serialized, /eyJ[a-zA-Z0-9_-]{20,}\./);
  assert.doesNotMatch(serialized, /(?:sk-|sntryu_|AIza|AKIA)[A-Za-z0-9_-]{8,}/);
});
