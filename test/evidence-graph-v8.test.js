import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceGraph, EVIDENCE_GRAPH_SCHEMA_VERSION } from '../src/core/evidence-graph.js';

const fp = ch => ch.repeat(64);

function evidence(provider, fingerprint, {
  kind = 'threat_intelligence',
  verdict = 'malicious',
  actor = null,
  malwareFamily = null,
  attackIds = [],
} = {}) {
  return {
    provider,
    indicator: 'evil.example',
    type: 'domain',
    observation: {
      kind,
      verdict,
      actor,
      malwareFamily,
      attributes: { attackIds },
    },
    integrity: { fingerprint },
  };
}

function baseInput() {
  return {
    indicator: 'evil.example',
    type: 'domain',
    evidence: [
      evidence('provider-b', fp('b'), { attackIds: ['T1105'] }),
      evidence('provider-a', fp('a'), { actor: 'Example Actor', malwareFamily: 'ExampleRAT', attackIds: ['T1059.001'] }),
    ],
    relationships: [
      { type: 'resolves_to', source: 'evil.example', target: '198.51.100.7', targetType: 'ip', provider: 'provider-a' },
      { type: 'hostname', source: 'evil.example', target: 'pivot.example', provider: 'provider-b' },
    ],
    correlation: {},
    decision: {
      attackMappings: [{ id: 'T1105', evidenceFingerprints: [fp('b')] }],
    },
  };
}

function assertDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true, 'all returned graph objects/arrays must be frozen');
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

function node(graph, predicate) {
  return graph.nodes.find(predicate);
}

function edge(graph, predicate) {
  return graph.edges.find(predicate);
}

test('evidence graph schema and stable explicit graph facts are deterministic', () => {
  const input = baseInput();
  const graph = buildEvidenceGraph(input);
  const reordered = buildEvidenceGraph({
    ...input,
    evidence: [...input.evidence].reverse(),
    relationships: [...input.relationships].reverse(),
    decision: { attackMappings: [...input.decision.attackMappings].reverse() },
  });

  assert.equal(EVIDENCE_GRAPH_SCHEMA_VERSION, '1.0');
  assert.equal(graph.schemaVersion, '1.0');
  assert.equal(graph.truncated, false);
  assert.equal(graph.counts.nodes, graph.nodes.length);
  assert.equal(graph.counts.edges, graph.edges.length);
  assert.deepEqual(graph, reordered, 'set-like input ordering must not change graph bytes');
  assertDeepFrozen(graph);

  const root = node(graph, item => item.id === graph.rootId);
  assert.deepEqual(
    { type: root.type, observableType: root.observableType, value: root.value },
    { type: 'observable', observableType: 'domain', value: 'evil.example' },
  );
  assert.match(graph.rootId, /^observable:domain:[0-9a-f]{24}$/);

  for (const provider of ['provider-a', 'provider-b']) {
    assert.ok(node(graph, item => item.id === `provider:${provider}` && item.type === 'provider'));
  }
  for (const fingerprint of [fp('a'), fp('b')]) {
    const evidenceNode = node(graph, item => item.id === `evidence:${fingerprint}`);
    assert.equal(evidenceNode.type, 'evidence');
    assert.equal(evidenceNode.fingerprint, fingerprint);
    assert.ok(edge(graph, item => item.type === 'has_evidence' && item.source === graph.rootId && item.target === evidenceNode.id));
    assert.ok(edge(graph, item => item.type === 'reported_by' && item.source === evidenceNode.id && item.target === `provider:${evidenceNode.provider}`));
  }

  assert.ok(node(graph, item => item.id === 'attack:T1059.001' && item.attackId === 'T1059.001'));
  assert.ok(node(graph, item => item.id === 'attack:T1105' && item.attackId === 'T1105'));
  assert.ok(edge(graph, item => item.type === 'mapped_to_attack' && item.target === 'attack:T1059.001'));
  assert.ok(node(graph, item => item.type === 'actor' && item.name === 'Example Actor'));
  assert.ok(node(graph, item => item.type === 'malware' && item.name === 'ExampleRAT'));
  assert.ok(edge(graph, item => item.type === 'reported_actor_context'));
  assert.ok(edge(graph, item => item.type === 'reported_malware_context'));

  const ip = node(graph, item => item.type === 'observable' && item.observableType === 'ip' && item.value === '198.51.100.7');
  assert.ok(ip);
  assert.ok(edge(graph, item => item.type === 'related_to' && item.source === graph.rootId && item.target === ip.id && item.data?.relationshipType === 'resolves_to' && item.data?.provider === 'provider-a'));

  const domain = node(graph, item => item.type === 'observable' && item.observableType === 'domain' && item.value === 'pivot.example');
  assert.ok(domain, 'normalized hostname relationship may map deterministically to domain');
  assert.equal('score' in graph, false);
  assert.equal(JSON.stringify(graph).toLowerCase().includes('risk score'), false);
});

test('duplicate facts collapse by exact stable identity', () => {
  const input = baseInput();
  input.evidence.push(structuredClone(input.evidence[0]));
  input.relationships.push(structuredClone(input.relationships[0]));
  const graph = buildEvidenceGraph(input);

  assert.equal(graph.nodes.filter(item => item.id === `evidence:${fp('b')}`).length, 1);
  const related = graph.edges.filter(item => item.type === 'related_to' && item.data?.relationshipType === 'resolves_to');
  assert.equal(related.length, 1);
});

test('graph does not infer entities from arbitrary relationship target strings', () => {
  const graph = buildEvidenceGraph({
    indicator: 'evil.example',
    type: 'domain',
    evidence: [evidence('provider-a', fp('a'))],
    relationships: [
      { type: 'mentions', source: 'evil.example', target: 'T9999', provider: 'provider-a' },
      { type: 'mentions', source: 'evil.example', target: '198.51.100.99', provider: 'provider-a' },
    ],
    correlation: {},
    decision: { attackMappings: [] },
  });

  assert.equal(graph.nodes.some(item => item.type === 'attack' && item.attackId === 'T9999'), false);
  assert.equal(graph.nodes.some(item => item.type === 'observable' && item.value === '198.51.100.99'), false);
  assert.equal(graph.edges.some(item => item.data?.relationshipType === 'mentions'), false, 'untyped arbitrary relationship targets must not be projected');
});

test('invalid evidence fingerprints fail closed', () => {
  assert.throws(() => buildEvidenceGraph({
    indicator: 'evil.example', type: 'domain',
    evidence: [evidence('provider-a', 'not-a-fingerprint')],
    relationships: [], correlation: {}, decision: {},
  }), /evidence_graph_fingerprint_invalid/);
});

test('hard evidence actor attack and edge limits fail closed without truncation', () => {
  assert.throws(() => buildEvidenceGraph({
    indicator: 'evil.example', type: 'domain',
    evidence: Array.from({ length: 101 }, (_, i) => evidence(`p${i}`, i.toString(16).padStart(64, '0'))),
    relationships: [], correlation: {}, decision: {},
  }), /evidence_graph_evidence_limit/);

  assert.throws(() => buildEvidenceGraph({
    indicator: 'evil.example', type: 'domain',
    evidence: Array.from({ length: 33 }, (_, i) => evidence(`p${i}`, (i + 1).toString(16).padStart(64, '0'), { actor: `actor-${i}` })),
    relationships: [], correlation: {}, decision: {},
  }), /evidence_graph_actor_limit/);

  assert.throws(() => buildEvidenceGraph({
    indicator: 'evil.example', type: 'domain',
    evidence: [evidence('provider-a', fp('a'), { attackIds: Array.from({ length: 65 }, (_, i) => `T${String(1000 + i).padStart(4, '0')}`) })],
    relationships: [], correlation: {}, decision: {},
  }), /evidence_graph_attack_limit/);

  assert.throws(() => buildEvidenceGraph({
    indicator: 'evil.example', type: 'domain',
    evidence: [evidence('provider-a', fp('a'))],
    relationships: Array.from({ length: 513 }, (_, i) => ({
      type: `explicit-${i}`,
      source: 'evil.example',
      target: '198.51.100.7',
      targetType: 'ip',
      provider: 'provider-a',
    })),
    correlation: {}, decision: {},
  }), /evidence_graph_edge_limit/);
});

test('kernel-derived intelligence cannot manufacture evidence nodes or alter fingerprint topology', () => {
  const input = baseInput();
  const baseline = buildEvidenceGraph(input);
  const withIntelligence = buildEvidenceGraph({
    ...input,
    intelligence: {
      schemaVersion: '1.0', type: 'domain',
      evidenceStrength: { level: 'strong', evidenceFingerprints: [fp('c')] },
      analystPriority: { level: 'immediate' },
      pivotCandidates: [{ type: 'domain', value: 'kernel-only.example', evidenceFingerprints: [fp('c')] }],
      relationshipValue: [{ targetType: 'ip', target: '198.51.100.200', evidenceFingerprints: [fp('c')] }],
    },
  });

  assert.deepEqual(withIntelligence, baseline);
  assert.equal(withIntelligence.nodes.some(item => item.id === `evidence:${fp('c')}`), false);
  assert.equal(withIntelligence.nodes.some(item => item.value === 'kernel-only.example'), false);
  assert.equal(withIntelligence.nodes.some(item => item.value === '198.51.100.200'), false);
});
