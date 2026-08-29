import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCase, addPin, appendSnapshot } from '../app/case-model.js';
import { buildCaseEvidenceGraph } from '../app/case-evidence-graph.js';

const A = 'a'.repeat(64);

function buildCaseFixture() {
  let caseValue = createCase({
    title: 'Operation Example',
    now: () => '2026-08-29T12:00:00.000Z',
    uuid: () => 'case-1',
  });
  caseValue = addPin(caseValue, { type: 'domain', value: 'evil.example' }, { now: () => '2026-08-29T12:01:00.000Z' });
  caseValue = addPin(caseValue, { type: 'ip', value: '198.51.100.7' }, { now: () => '2026-08-29T12:02:00.000Z' });
  caseValue = appendSnapshot(caseValue, {
    schemaVersion: '2.0',
    gatewayVersion: '2.0.0',
    requestId: 'req-1',
    status: 'ok',
    indicator: 'evil.example',
    type: 'domain',
    evidence: [{
      provider: 'provider-a',
      indicator: 'evil.example',
      type: 'domain',
      observation: { kind: 'threat_intelligence', verdict: 'malicious', actor: 'Explicit Actor', malwareFamily: null, attributes: { attackIds: ['T1105'] } },
      integrity: { fingerprint: A },
    }],
    relationships: [{ type: 'resolves_to', source: 'evil.example', target: '198.51.100.7', targetType: 'ip', provider: 'provider-a' }],
    correlation: { contradictions: [], limitations: [] },
    decision: { disposition: 'hunt_now', confidence: 'high', reasons: ['supported_threat_evidence'], attackMappings: [{ id: 'T1105', evidenceFingerprints: [A] }], huntPlan: [], telemetry: {}, assessment: { coverageMaterialLoss: false } },
  }, {
    now: () => '2026-08-29T12:03:00.000Z',
    uuid: (() => {
      const values = ['snapshot-1'];
      return () => values.shift();
    })(),
  });
  return caseValue;
}

test('case graph is deterministic and projects case pins snapshots and core Evidence v2 facts', () => {
  const value = buildCaseFixture();
  const sightings = [{
    type: 'domain', value: 'evil.example', caseId: 'case-2', caseTitle: 'Other Case', source: 'pin', snapshotId: null,
  }];
  const graph = buildCaseEvidenceGraph(value, { sightings });
  const reordered = buildCaseEvidenceGraph({ ...value, pins: [...value.pins].reverse(), snapshots: [...value.snapshots].reverse() }, { sightings: [...sightings].reverse() });

  assert.deepEqual(graph, reordered);
  assert.equal(graph.schemaVersion, '1.0');
  assert.equal(graph.rootId, 'case:case-1');
  assert.equal(graph.truncated, false);
  assert.equal(graph.counts.nodes, graph.nodes.length);
  assert.equal(graph.counts.edges, graph.edges.length);
  assert.ok(graph.nodes.some(node => node.id === 'case:case-1' && node.type === 'case' && node.title === 'Operation Example'));
  assert.ok(graph.nodes.some(node => node.id === 'snapshot:snapshot-1' && node.type === 'snapshot'));
  assert.ok(graph.nodes.some(node => node.type === 'observable' && node.observableType === 'domain' && node.value === 'evil.example'));
  assert.ok(graph.nodes.some(node => node.id === `evidence:${A}`));
  assert.ok(graph.nodes.some(node => node.id === 'provider:provider-a'));
  assert.ok(graph.nodes.some(node => node.id === 'attack:T1105'));
  assert.ok(graph.nodes.some(node => node.type === 'actor' && node.name === 'Explicit Actor'));
  assert.ok(graph.edges.some(edge => edge.type === 'case_contains' && edge.source === 'case:case-1'));
  assert.ok(graph.edges.some(edge => edge.type === 'case_snapshot' && edge.source === 'case:case-1' && edge.target === 'snapshot:snapshot-1'));
  assert.ok(graph.edges.some(edge => edge.type === 'snapshot_subject' && edge.source === 'snapshot:snapshot-1'));
  assert.ok(graph.edges.some(edge => edge.type === 'has_evidence'));
  assert.ok(graph.edges.some(edge => edge.type === 'cross_case_sighting' && edge.target === 'case:case-2'));
  assert.equal(Object.isFrozen(graph), true);
  assert.equal(Object.isFrozen(graph.nodes), true);
  assert.equal(Object.isFrozen(graph.edges), true);
});

test('cross-case sightings require exact local type and value and disappear on rebuild', () => {
  const value = buildCaseFixture();
  const sightings = [
    { type: 'domain', value: 'evil.example', caseId: 'case-2', caseTitle: 'Exact', source: 'pin', snapshotId: null },
    { type: 'ip', value: 'evil.example', caseId: 'case-3', caseTitle: 'Wrong type', source: 'pin', snapshotId: null },
    { type: 'domain', value: 'other.example', caseId: 'case-4', caseTitle: 'Wrong value', source: 'pin', snapshotId: null },
  ];
  const graph = buildCaseEvidenceGraph(value, { sightings });
  assert.equal(graph.edges.filter(edge => edge.type === 'cross_case_sighting').length, 1);
  assert.ok(graph.nodes.some(node => node.id === 'case:case-2'));
  assert.equal(graph.nodes.some(node => node.id === 'case:case-3'), false);
  assert.equal(graph.nodes.some(node => node.id === 'case:case-4'), false);

  const rebuilt = buildCaseEvidenceGraph(value, { sightings: [] });
  assert.equal(rebuilt.edges.some(edge => edge.type === 'cross_case_sighting'), false);
  assert.equal(rebuilt.nodes.some(node => node.id === 'case:case-2'), false);
});

test('case notes and semantic diff prose are never parsed into graph entities', () => {
  const value = buildCaseFixture();
  value.notes.push({ id: 'note-1', text: 'Actor Ghost Malware Phantom 203.0.113.99 T9999', addedAt: '2026-08-29T12:04:00.000Z' });
  value.diffs.push({ id: 'diff-1', type: 'domain', indicator: 'evil.example', capturedAt: '2026-08-29T12:05:00.000Z', fromSnapshotId: 'a', toSnapshotId: 'b', diff: { changes: [{ category: 'semantic_claim_changed', explanation: 'Actor DiffGhost T8888' }] } });
  const graph = buildCaseEvidenceGraph(value);
  const json = JSON.stringify(graph);
  for (const forbidden of ['Actor Ghost', 'Malware Phantom', '203.0.113.99', 'T9999', 'DiffGhost', 'T8888']) assert.equal(json.includes(forbidden), false, forbidden);
});

test('shared evidence graph implementation is browser-loadable without Node-only imports', () => {
  const source = readFileSync(new URL('../src/core/evidence-graph.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]node:|require\s*\(['"]node:/);
});
