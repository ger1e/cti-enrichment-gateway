import test from 'node:test';
import assert from 'node:assert/strict';
import { probeProviders, PROBE_SAMPLE_BY_TYPE } from '../src/control/provider-probe.js';
import { PROVIDER_MANIFEST } from '../src/providers/manifest.js';
import { WORKFLOWS } from '../src/workflows.js';

test('provider probe executes every advertised type sequentially and fails closed on one broken surface', async () => {
  const seen = [];
  const provider = {
    name: 'multi-surface',
    types: ['ip', 'domain', 'url'],
    timeoutMs: 100,
    fixedHosts: ['api.example.test'],
    methods: ['GET'],
    protocols: ['https:'],
    maxResponseBytes: 1024,
    async run(input) {
      seen.push(input.type);
      if (input.type === 'domain') throw Object.assign(new Error('bad domain contract'), { status: 400 });
      return { observationType: 'test_observation', verdict: 'unknown' };
    },
  };

  const [result] = await probeProviders({ providers: [provider], includeCredentialed: true });
  assert.deepEqual(seen, ['ip', 'domain', 'url']);
  assert.equal(result.provider, 'multi-surface');
  assert.equal(result.status, 'contract_error');
  assert.deepEqual(result.checks.map(check => [check.type, check.status]), [
    ['ip', 'ok'],
    ['domain', 'contract_error'],
    ['url', 'ok'],
  ]);
});

test('every active manifest indicator type has a canonical harmless probe sample', () => {
  for (const [name, policy] of Object.entries(PROVIDER_MANIFEST)) {
    if (!policy.active) continue;
    for (const type of policy.types) {
      assert.equal(typeof PROBE_SAMPLE_BY_TYPE[type], 'string', `${name}:${type}`);
      assert.ok(PROBE_SAMPLE_BY_TYPE[type].length > 0, `${name}:${type}`);
    }
  }
});

test('every workflow entry is backed by a provider that actually advertises that indicator type', () => {
  for (const [type, providers] of Object.entries(WORKFLOWS)) {
    assert.equal(new Set(providers).size, providers.length, `${type}: duplicate provider`);
    for (const name of providers) {
      const policy = PROVIDER_MANIFEST[name];
      assert.ok(policy, `${type}:${name}: missing manifest provider`);
      assert.ok(policy.active, `${type}:${name}: inactive provider`);
      assert.ok(policy.types.includes(type), `${type}:${name}: unsupported type`);
    }
  }
});
