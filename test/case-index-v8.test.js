import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCaseIndex, findCaseSightings } from '../app/case-index.js';

const baseCase = (id, title) => ({
  schemaVersion: '1.0', id, title, createdAt: '2026-08-28T20:00:00.000Z', updatedAt: '2026-08-28T20:00:00.000Z',
  notes: [], pins: [], snapshots: [], diffs: [],
});

function snapshot(id, type, indicator, { relationships = [], attackMappings = [] } = {}) {
  return {
    id, type, indicator, capturedAt: '2026-08-28T20:00:00.000Z', requestId: `req-${id}`,
    evidence: {
      schemaVersion: '2.0', requestId: `req-${id}`, type, indicator, evidence: [], failures: [],
      relationships,
      decision: { attackMappings },
    },
  };
}

test('index emits exact typed sightings from pins, snapshot subjects, relationships, and ATT&CK mappings', () => {
  const alpha = baseCase('case-a', 'Alpha');
  alpha.pins.push({ type: 'domain', value: 'example.test', addedAt: alpha.createdAt });
  alpha.snapshots.push(snapshot('snap-a', 'ip', '203.0.113.7', {
    relationships: [
      { type: 'resolves_to', targetType: 'domain', target: 'example.test', provider: 'dns' },
      { type: 'related_to', target: 'ignored-without-type.test', provider: 'x' },
    ],
    attackMappings: [{ id: 'T1071.004' }],
  }));

  const beta = baseCase('case-b', 'Beta');
  beta.pins.push({ type: 'domain', value: 'example.test', addedAt: beta.createdAt });
  beta.snapshots.push(snapshot('snap-b', 'domain', 'other.test', {
    relationships: [{ type: 'resolves_to', targetType: 'ip', target: '203.0.113.7', provider: 'dns' }],
    attackMappings: [{ id: 'T1071.004' }],
  }));

  const index = buildCaseIndex([beta, alpha]);
  assert.deepEqual(findCaseSightings(index, { type: 'domain', value: 'example.test' }), [
    { type: 'domain', value: 'example.test', caseId: 'case-a', caseTitle: 'Alpha', source: 'pin', snapshotId: null },
    { type: 'domain', value: 'example.test', caseId: 'case-a', caseTitle: 'Alpha', source: 'relationship', snapshotId: 'snap-a' },
    { type: 'domain', value: 'example.test', caseId: 'case-b', caseTitle: 'Beta', source: 'pin', snapshotId: null },
  ]);
  assert.deepEqual(findCaseSightings(index, { type: 'ip', value: '203.0.113.7' }), [
    { type: 'ip', value: '203.0.113.7', caseId: 'case-a', caseTitle: 'Alpha', source: 'snapshot', snapshotId: 'snap-a' },
    { type: 'ip', value: '203.0.113.7', caseId: 'case-b', caseTitle: 'Beta', source: 'relationship', snapshotId: 'snap-b' },
  ]);
  assert.deepEqual(findCaseSightings(index, { type: 'attack', value: 'T1071.004' }), [
    { type: 'attack', value: 'T1071.004', caseId: 'case-a', caseTitle: 'Alpha', source: 'attack', snapshotId: 'snap-a' },
    { type: 'attack', value: 'T1071.004', caseId: 'case-b', caseTitle: 'Beta', source: 'attack', snapshotId: 'snap-b' },
  ]);
  assert.deepEqual(findCaseSightings(index, { type: 'domain', value: 'ignored-without-type.test' }), []);
});

test('index deduplicates exact sightings and deleted cases disappear on rebuild', () => {
  const alpha = baseCase('case-a', 'Alpha');
  alpha.pins.push({ type: 'domain', value: 'dup.test', addedAt: alpha.createdAt });
  alpha.pins.push({ type: 'domain', value: 'dup.test', addedAt: alpha.createdAt });
  const beta = baseCase('case-b', 'Beta');
  beta.pins.push({ type: 'domain', value: 'dup.test', addedAt: beta.createdAt });

  const withBoth = buildCaseIndex([alpha, beta]);
  assert.equal(findCaseSightings(withBoth, { type: 'domain', value: 'dup.test' }).length, 2);
  const rebuilt = buildCaseIndex([alpha]);
  assert.deepEqual(findCaseSightings(rebuilt, { type: 'domain', value: 'dup.test' }).map(item => item.caseId), ['case-a']);
});

test('index is capped at 20,000 aggregate exact sightings', () => {
  const fixture = baseCase('case-a', 'Alpha');
  fixture.pins = Array.from({ length: 20001 }, (_, i) => ({ type: 'domain', value: `d${i}.test`, addedAt: fixture.createdAt }));
  assert.throws(() => buildCaseIndex([fixture]), /case_index_limit/);
});

test('find is exact on both type and value', () => {
  const fixture = baseCase('case-a', 'Alpha');
  fixture.pins.push({ type: 'domain', value: '203.0.113.7', addedAt: fixture.createdAt });
  const index = buildCaseIndex([fixture]);
  assert.equal(findCaseSightings(index, { type: 'domain', value: '203.0.113.7' }).length, 1);
  assert.equal(findCaseSightings(index, { type: 'ip', value: '203.0.113.7' }).length, 0);
});
