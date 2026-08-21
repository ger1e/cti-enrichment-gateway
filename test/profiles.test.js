import test from 'node:test';
import assert from 'node:assert/strict';
import { selectProviders, PROFILE_NAMES } from '../src/profiles.js';

function registry(items) {
  const map = new Map(items.map(item => [item.name, item]));
  return { get: name => map.get(name) };
}

const workflow = ['scarce', 'tier3', 'tier1b', 'tier1a', 'knowledge'];
const reg = registry([
  { name: 'scarce', types: ['hash'], tier: 4, costClass: 'scarce' },
  { name: 'tier3', types: ['hash'], tier: 3, costClass: 'quota' },
  { name: 'tier1b', types: ['hash'], tier: 1, costClass: 'free' },
  { name: 'tier1a', types: ['hash'], tier: 1, costClass: 'free' },
  { name: 'knowledge', types: ['hash'], tier: 5, costClass: 'free', observationTypes: ['attack_knowledge'] },
]);

test('profiles are fixed and reject arbitrary values', () => {
  assert.deepEqual(PROFILE_NAMES, ['fast', 'standard', 'full']);
  assert.throws(() => selectProviders({ type: 'hash', profile: 'whatever', workflow, registry: reg }), /invalid_profile/);
});

test('full stays inside the workflow and orders deterministically by tier', () => {
  assert.deepEqual(selectProviders({ type: 'hash', profile: 'full', workflow, registry: reg }), ['tier1b', 'tier1a', 'tier3', 'scarce', 'knowledge']);
});

test('standard excludes scarce providers without inventing providers', () => {
  assert.deepEqual(selectProviders({ type: 'hash', profile: 'standard', workflow, registry: reg }), ['tier1b', 'tier1a', 'tier3', 'knowledge']);
});

test('fast excludes scarce and high-cost broad enrichment but preserves sole knowledge workflow', () => {
  assert.deepEqual(selectProviders({ type: 'hash', profile: 'fast', workflow, registry: reg }), ['tier1b', 'tier1a', 'knowledge']);
  const attackReg = registry([{ name: 'attack-taxii', types: ['attack'], tier: 5, costClass: 'free', observationTypes: ['attack_knowledge'] }]);
  assert.deepEqual(selectProviders({ type: 'attack', profile: 'fast', workflow: ['attack-taxii'], registry: attackReg }), ['attack-taxii']);
});
