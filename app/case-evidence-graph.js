import { validateCaseValue } from './case-model.js';
import { buildEvidenceGraph } from '../src/core/evidence-graph.js';
import { sha256Hex } from '../src/core/sha256.js';

export const CASE_EVIDENCE_GRAPH_SCHEMA_VERSION = '1.0';

const LIMITS = Object.freeze({ nodes: 4096, edges: 8192 });
const fail = code => { throw new Error(code); };

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function caseNode(caseId, title = '') {
  return { id: `case:${caseId}`, type: 'case', caseId, title: String(title ?? '') };
}

function snapshotNode(snapshot) {
  return {
    id: `snapshot:${snapshot.id}`,
    type: 'snapshot',
    snapshotId: snapshot.id,
    capturedAt: snapshot.capturedAt ?? null,
    requestId: snapshot.requestId ?? null,
  };
}

function edgeId(type, source, target, data = {}) {
  return `edge:${sha256Hex(`${type}\u0000${source}\u0000${target}\u0000${stableJson(data)}`).slice(0, 24)}`;
}

function emptySubjectGraph(type, value) {
  return buildEvidenceGraph({
    indicator: value,
    type,
    evidence: [],
    relationships: [],
    correlation: {},
    decision: { attackMappings: [] },
  });
}

export function buildCaseEvidenceGraph(caseValue, { sightings = [] } = {}) {
  validateCaseValue(caseValue);
  if (!Array.isArray(sightings)) fail('case_evidence_graph_sightings_invalid');

  const nodes = new Map();
  const edges = new Map();
  const exactTypedNodes = new Map();

  function rememberTypedNode(node) {
    let type = null;
    let value = null;
    if (node.type === 'observable') {
      type = node.observableType;
      value = node.value;
    } else if (node.type === 'attack') {
      type = 'attack';
      value = node.attackId;
    } else if (node.type === 'actor') {
      type = 'actor';
      value = node.name;
    } else if (node.type === 'malware') {
      type = 'malware';
      value = node.name;
    }
    if (!type || value == null || value === '') return;
    const key = `${String(type)}\u0000${String(value)}`;
    if (!exactTypedNodes.has(key)) exactTypedNodes.set(key, node.id);
  }

  function addNode(node) {
    if (!node?.id || !node?.type) fail('case_evidence_graph_node_invalid');
    if (nodes.has(node.id)) return node.id;
    if (nodes.size >= LIMITS.nodes) fail('case_evidence_graph_node_limit');
    const detached = structuredClone(node);
    nodes.set(detached.id, detached);
    rememberTypedNode(detached);
    return detached.id;
  }

  function addEdge(type, source, target, data = {}) {
    if (!nodes.has(source) || !nodes.has(target)) return null;
    const cleanData = canonicalize(Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== '')));
    const id = edgeId(type, source, target, cleanData);
    if (edges.has(id)) return id;
    if (edges.size >= LIMITS.edges) fail('case_evidence_graph_edge_limit');
    edges.set(id, { id, type, source, target, data: cleanData });
    return id;
  }

  function mergeCoreGraph(graph) {
    for (const node of graph.nodes) addNode(node);
    for (const edge of graph.edges) {
      if (edges.has(edge.id)) continue;
      if (edges.size >= LIMITS.edges) fail('case_evidence_graph_edge_limit');
      edges.set(edge.id, structuredClone(edge));
    }
  }

  const rootId = addNode(caseNode(caseValue.id, caseValue.title));

  const pins = [...caseValue.pins].sort((a, b) => String(a.type).localeCompare(String(b.type)) || String(a.value).localeCompare(String(b.value)));
  for (const pin of pins) {
    const subjectGraph = emptySubjectGraph(pin.type, pin.value);
    mergeCoreGraph(subjectGraph);
    addEdge('case_contains', rootId, subjectGraph.rootId, { type: pin.type, value: pin.value });
  }

  const snapshots = [...caseValue.snapshots].sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')));
  for (const snapshot of snapshots) {
    if (typeof snapshot?.id !== 'string' || !snapshot.id) fail('case_evidence_graph_snapshot_invalid');
    const snapshotId = addNode(snapshotNode(snapshot));
    addEdge('case_snapshot', rootId, snapshotId);

    const enrichment = snapshot.evidence;
    if (!enrichment || typeof enrichment.indicator !== 'string' || typeof enrichment.type !== 'string') fail('case_evidence_graph_snapshot_invalid');
    const graph = buildEvidenceGraph({
      indicator: enrichment.indicator,
      type: enrichment.type,
      evidence: Array.isArray(enrichment.evidence) ? enrichment.evidence : [],
      relationships: Array.isArray(enrichment.relationships) ? enrichment.relationships : [],
      correlation: enrichment.correlation ?? {},
      decision: enrichment.decision ?? {},
    });
    mergeCoreGraph(graph);
    addEdge('snapshot_subject', snapshotId, graph.rootId, { type: enrichment.type, value: enrichment.indicator });
  }

  const orderedSightings = [...sightings].sort((a, b) => String(a?.type ?? '').localeCompare(String(b?.type ?? ''))
    || String(a?.value ?? '').localeCompare(String(b?.value ?? ''))
    || String(a?.caseId ?? '').localeCompare(String(b?.caseId ?? ''))
    || String(a?.source ?? '').localeCompare(String(b?.source ?? ''))
    || String(a?.snapshotId ?? '').localeCompare(String(b?.snapshotId ?? '')));

  for (const sighting of orderedSightings) {
    if (typeof sighting?.type !== 'string' || typeof sighting?.value !== 'string' || typeof sighting?.caseId !== 'string') continue;
    if (!sighting.type || !sighting.value || !sighting.caseId || sighting.caseId === caseValue.id) continue;
    const localNodeId = exactTypedNodes.get(`${sighting.type}\u0000${sighting.value}`);
    if (!localNodeId) continue;
    const otherCaseId = addNode(caseNode(sighting.caseId, sighting.caseTitle ?? ''));
    addEdge('cross_case_sighting', localNodeId, otherCaseId, {
      source: sighting.source ?? null,
      snapshotId: sighting.snapshotId ?? null,
      type: sighting.type,
      value: sighting.value,
    });
  }

  return deepFreeze({
    schemaVersion: CASE_EVIDENCE_GRAPH_SCHEMA_VERSION,
    rootId,
    nodes: [...nodes.values()].sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id)),
    edges: [...edges.values()].sort((a, b) => a.type.localeCompare(b.type)
      || a.source.localeCompare(b.source)
      || a.target.localeCompare(b.target)
      || stableJson(a.data).localeCompare(stableJson(b.data))
      || a.id.localeCompare(b.id)),
    counts: { nodes: nodes.size, edges: edges.size },
    truncated: false,
  });
}

export const CASE_EVIDENCE_GRAPH_LIMITS = LIMITS;
