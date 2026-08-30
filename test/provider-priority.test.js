import test from 'node:test';
import assert from 'node:assert/strict';
import {
  providerPriority,
  rankProvidersForExecution,
} from '../src/core/provider-priority.js';

const COMPLETE = Object.freeze({
  authorityClass: 'specialist',
  semanticUniqueness: 'unique',
  intelligenceValue: 'direct',
  pivotValue: 'high',
  latencyClass: 'normal',
});

function adapter(name, overrides = {}) {
  const { descriptor = COMPLETE, ...rest } = overrides;
  return {
    name,
    tier: 3,
    costClass: 'quota',
    schedulerByType: descriptor ? { ip: { ...descriptor } } : {},
    ...rest,
  };
}

function order(providers) {
  return rankProvidersForExecution({ providers, type: 'ip' }).map(item => item.adapter.name);
}

const dimensions = [
  ['authorityClass', 'authoritative', 'first_party'],
  ['semanticUniqueness', 'unique', 'complementary'],
  ['intelligenceValue', 'direct', 'supporting'],
  ['pivotValue', 'high', 'medium'],
  ['latencyClass', 'fast', 'normal'],
];

for (let index = 0; index < dimensions.length; index += 1) {
  const [field, better, worse] = dimensions[index];
  test(`provider value ordering honors ${field} before later dimensions`, () => {
    const earlier = dimensions.slice(0, index);
    const base = { ...COMPLETE };
    for (const [priorField] of earlier) base[priorField] = COMPLETE[priorField];
    const high = adapter('high', { descriptor: { ...base, [field]: better } });
    const low = adapter('low', { descriptor: { ...base, [field]: worse } });
    assert.deepEqual(order([low, high]), ['high', 'low']);
  });
}

test('provider value ordering honors costClass after descriptor dimensions', () => {
  const free = adapter('free', { costClass: 'free' });
  const quota = adapter('quota', { costClass: 'quota' });
  assert.deepEqual(order([quota, free]), ['free', 'quota']);
});

test('tier precedes workflow index after all categorical dimensions tie', () => {
  const providers = [
    adapter('index-zero-tier-three', { tier: 3 }),
    adapter('index-one-tier-one', { tier: 1 }),
    adapter('index-two-tier-one', { tier: 1 }),
  ];
  assert.deepEqual(order(providers), ['index-one-tier-one', 'index-two-tier-one', 'index-zero-tier-three']);
});

test('priority normalization and ranking are deterministic', () => {
  const providers = [adapter('b'), adapter('a', { tier: 2, costClass: 'free' })];
  const first = rankProvidersForExecution({ providers, type: 'ip' });
  const second = rankProvidersForExecution({ providers, type: 'ip' });
  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(second), JSON.stringify(first));
  assert.deepEqual(providerPriority(providers[0], 'ip', 0), providerPriority(providers[0], 'ip', 0));
});

test('absent incomplete and invalid descriptors use legacy fallback ordering', () => {
  const providers = [
    adapter('missing', { descriptor: null, tier: 2 }),
    adapter('incomplete', { descriptor: { authorityClass: 'specialist' }, tier: 1 }),
    adapter('invalid', { descriptor: { ...COMPLETE, pivotValue: 'maximum' }, tier: 1 }),
  ];
  const ranked = rankProvidersForExecution({ providers, type: 'ip' });
  assert.deepEqual(ranked.map(item => item.adapter.name), ['incomplete', 'invalid', 'missing']);
  for (const item of ranked) {
    assert.equal(item.priority.fallback, true);
    assert.equal(item.priority.rationale, 'legacy_priority_fallback');
  }
});

test('valid descriptors always rank before fallback entries', () => {
  const providers = [
    adapter('fallback-tier-one', { descriptor: null, tier: 1 }),
    adapter('valid-contextual', { descriptor: { ...COMPLETE, intelligenceValue: 'contextual' }, tier: 5 }),
    adapter('valid-direct', { tier: 5 }),
    adapter('fallback-tier-two', { descriptor: null, tier: 2 }),
  ];
  assert.deepEqual(order(providers), [
    'valid-direct',
    'valid-contextual',
    'fallback-tier-one',
    'fallback-tier-two',
  ]);
});

test('priority outputs are deeply frozen', () => {
  const ranked = rankProvidersForExecution({ providers: [adapter('p')], type: 'ip' });
  assert.equal(Object.isFrozen(ranked), true);
  assert.equal(Object.isFrozen(ranked[0]), true);
  assert.equal(Object.isFrozen(ranked[0].priority), true);
  assert.equal(Object.isFrozen(ranked[0].priority.descriptor), true);
});
