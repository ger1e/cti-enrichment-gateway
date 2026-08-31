import assert from 'node:assert/strict';
import test from 'node:test';

import { PIPELINE_LIMITS } from '../app/shell-core/types.js';
import { TRANSFORM_HANDLERS } from '../app/shell-core/transforms.js';

const run = (name, input, args = [], limits = PIPELINE_LIMITS) => TRANSFORM_HANDLERS[name]({ input, args, limits });

const records = [
  { provider: 'virustotal', observation: { confidence: 0.95, verdict: 'malicious' }, rank: 2 },
  { provider: 'greynoise', observation: { confidence: 0.70, verdict: 'unknown' }, rank: 1 },
  { provider: 'virustotal', observation: { confidence: 0.40, verdict: 'unknown' }, rank: 3 },
];

test('where filters records with bounded numeric and string comparisons', () => {
  assert.deepEqual(run('where', { type: 'records', value: records }, ['observation.confidence', '>=', '0.8']).value, [records[0]]);
  assert.deepEqual(run('where', { type: 'records', value: records }, ['provider', '==', 'virustotal']).value, [records[0], records[2]]);
  assert.deepEqual(run('where', { type: 'records', value: records }, ['provider', '!=', 'virustotal']).value, [records[1]]);
});

test('fields select pluck and jsonpath stay structured', () => {
  assert.deepEqual(run('fields', { type: 'records', value: records }, ['provider', 'rank']).value, [
    { provider: 'virustotal', rank: 2 },
    { provider: 'greynoise', rank: 1 },
    { provider: 'virustotal', rank: 3 },
  ]);
  assert.deepEqual(run('select', { type: 'record', value: records[0] }, ['provider', 'observation.verdict']).value, {
    provider: 'virustotal',
    'observation.verdict': 'malicious',
  });
  assert.deepEqual(run('pluck', { type: 'records', value: records }, ['provider']).value, ['virustotal', 'greynoise', 'virustotal']);
  assert.equal(run('jsonpath', { type: 'record', value: { graph: { nodes: [{ id: 'n1' }] } } }, ['graph.nodes.0.id']).value, 'n1');
});

test('sort is stable and supports dotted fields plus descending order', () => {
  const source = [
    { id: 'a', score: 1 },
    { id: 'b', score: 1 },
    { id: 'c', score: 3 },
  ];
  assert.deepEqual(run('sort', { type: 'records', value: source }, ['score', 'desc']).value.map(x => x.id), ['c', 'a', 'b']);
  assert.deepEqual(run('sort', { type: 'records', value: records }, ['observation.confidence', 'asc']).value.map(x => x.provider), ['virustotal', 'greynoise', 'virustotal']);
});

test('unique count and group preserve deterministic typed output', () => {
  const dupes = [{ provider: 'a' }, { provider: 'a' }, { provider: 'b' }];
  assert.deepEqual(run('unique', { type: 'records', value: dupes }).value, [{ provider: 'a' }, { provider: 'b' }]);
  assert.equal(run('count', { type: 'records', value: dupes }).value, 3);
  assert.deepEqual(run('group', { type: 'records', value: records }, ['provider']).value, [
    { key: 'virustotal', count: 2, records: [records[0], records[2]] },
    { key: 'greynoise', count: 1, records: [records[1]] },
  ]);
});

test('head and tail are bounded for records and text', () => {
  assert.deepEqual(run('head', { type: 'records', value: records }, ['2']).value, records.slice(0, 2));
  assert.deepEqual(run('tail', { type: 'records', value: records }, ['2']).value, records.slice(-2));
  assert.equal(run('head', { type: 'text', value: 'a\nb\nc' }, ['2']).value, 'a\nb');
  assert.equal(run('tail', { type: 'text', value: 'a\nb\nc' }, ['2']).value, 'b\nc');
  assert.throws(() => run('head', { type: 'records', value: records }, ['1001']), error => error.code === 'OUTPUT_LIMIT');
});

test('grep wc and uniq are internal text transforms', () => {
  assert.equal(run('grep', { type: 'text', value: 'ok\nmalicious\nclean\nmalicious' }, ['malicious']).value, 'malicious\nmalicious');
  assert.equal(run('wc', { type: 'text', value: 'one two\nthree' }).value, 3);
  assert.equal(run('wc', { type: 'text', value: 'one two\nthree' }, ['-l']).value, 2);
  assert.equal(run('uniq', { type: 'text', value: 'a\na\nb\na' }).value, 'a\nb\na');
});

test('transform validation fails closed on wrong types malformed expressions and unsafe paths', () => {
  assert.throws(() => run('where', { type: 'text', value: 'x' }, ['a', '==', 'x']), error => error.code === 'PIPELINE_TYPE_MISMATCH');
  assert.throws(() => run('where', { type: 'records', value: records }, ['rank', 'contains', '2']), error => error.code === 'INVALID_ARGUMENT');
  assert.throws(() => run('fields', { type: 'records', value: records }, ['__proto__.polluted']), error => error.code === 'INVALID_ARGUMENT');
  assert.throws(() => run('jsonpath', { type: 'record', value: records[0] }, ['observation[confidence]']), error => error.code === 'INVALID_ARGUMENT');
  assert.throws(() => run('grep', { type: 'records', value: records }, ['x']), error => error.code === 'PIPELINE_TYPE_MISMATCH');
});

test('transforms enforce record byte and text-line ceilings', () => {
  const tiny = { ...PIPELINE_LIMITS, records: 1, intermediateBytes: 20, textLines: 1 };
  assert.throws(() => run('head', { type: 'records', value: records }, ['2'], tiny), error => error.code === 'OUTPUT_LIMIT');
  assert.throws(() => run('grep', { type: 'text', value: 'a\na' }, ['a'], tiny), error => error.code === 'OUTPUT_LIMIT');
  assert.throws(() => run('select', { type: 'record', value: { long: 'x'.repeat(50) } }, ['long'], tiny), error => error.code === 'OUTPUT_LIMIT');
});
