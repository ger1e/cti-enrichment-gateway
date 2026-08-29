import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EVIDENCE_SCHEMA_VERSION } from '../src/core/version.js';
import { EVIDENCE_GRAPH_SCHEMA_VERSION, buildEvidenceGraph } from '../src/core/evidence-graph.js';
import { GUIDANCE_SCHEMA_VERSION, buildGuidance } from '../src/core/guidance.js';
import { CASE_SCHEMA_VERSION } from '../app/case-model.js';
import { CASE_EVIDENCE_GRAPH_SCHEMA_VERSION } from '../app/case-evidence-graph.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const PURE_TRAIN5_SOURCES = Object.freeze([
  'src/core/sha256.js',
  'src/core/evidence-graph.js',
  'src/core/guidance.js',
  'app/case-evidence-graph.js',
]);

function emptyGraph() {
  return buildEvidenceGraph({
    indicator: 'example.test',
    type: 'domain',
    evidence: [],
    relationships: [],
    correlation: {},
    decision: { attackMappings: [] },
  });
}

test('Train 5 is additive over Evidence v2 and Train 4 case schema', () => {
  assert.equal(EVIDENCE_SCHEMA_VERSION, '2.0');
  assert.equal(CASE_SCHEMA_VERSION, '1.0');
  assert.equal(EVIDENCE_GRAPH_SCHEMA_VERSION, '1.0');
  assert.equal(GUIDANCE_SCHEMA_VERSION, '1.0');
  assert.equal(CASE_EVIDENCE_GRAPH_SCHEMA_VERSION, '1.0');
});

test('Train 5 guidance accepts exactly the existing analyst disposition vocabulary', () => {
  const graph = emptyGraph();
  const allowed = ['hunt_now', 'investigate', 'monitor', 'context_only', 'insufficient'];
  for (const disposition of allowed) {
    const guidance = buildGuidance({
      decision: {
        disposition,
        confidence: 'low',
        reasons: [],
        assessment: { coverageMaterialLoss: false },
        telemetry: { status: 'conditional', requiredTables: [], environmentValidated: false, notes: [] },
        attackMappings: [],
        huntPlan: [],
      },
      correlation: { contradictions: [], limitations: [], freshness: { overall: 'unknown', items: [] } },
      evidenceGraph: graph,
    });
    assert.equal(guidance.disposition, disposition);
  }
  assert.throws(() => buildGuidance({
    decision: { disposition: 'block', confidence: 'high' },
    correlation: {},
    evidenceGraph: graph,
  }), /guidance_decision_invalid/);
});

test('Train 5 introduces no universal score or weighted severity field', () => {
  const graph = emptyGraph();
  const guidance = buildGuidance({
    decision: {
      disposition: 'insufficient', confidence: 'low', reasons: [],
      assessment: { coverageMaterialLoss: false }, telemetry: {}, attackMappings: [], huntPlan: [],
    },
    correlation: { contradictions: [], limitations: [], freshness: { overall: 'unknown', items: [] } },
    evidenceGraph: graph,
  });
  for (const value of [graph, guidance]) {
    const json = JSON.stringify(value).toLowerCase();
    assert.equal(Object.prototype.hasOwnProperty.call(value, 'score'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(value, 'severity'), false);
    assert.equal(json.includes('maliciousness'), false);
    assert.equal(json.includes('risk score'), false);
    assert.equal(json.includes('weighted severity'), false);
  }
});

test('pure Train 5 projection modules add no network credential environment or persistence surface', () => {
  for (const path of PURE_TRAIN5_SOURCES) {
    const source = read(path);
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon\s*\(/, `${path}: network`);
    assert.doesNotMatch(source, /process\.env|Deno\.env|Bun\.env/, `${path}: environment`);
    assert.doesNotMatch(source, /Authorization|PARA11AX_TOKEN|getToken\s*\(/, `${path}: credential`);
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|caches\.open|CacheStorage|FileSystemHandle|showSaveFilePicker/, `${path}: persistence`);
  }
});

test('Train 5 adds no package dependency and leaves certificate Maltego parity for Train 6', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(pkg.dependencies ?? {}, {});
  const init = read('maltego/transforms/__init__.py');
  assert.equal(init.includes('EnrichCertificate'), false);
});

test('gateway integration is additive and does not replace the existing decision field', () => {
  const source = read('src/core/orchestrator.js');
  assert.match(source, /buildDecisionSupport\s*\(/);
  assert.match(source, /buildEvidenceGraph\s*\(/);
  assert.match(source, /buildGuidance\s*\(/);
  assert.match(source, /status, evidence, relationships: correlation\.relationships, correlation, decision, coverage, limitations, failures/);
  assert.match(source, /\.\.\.\(evidenceGraph \? \{ evidenceGraph, guidance \} : \{\}\)/);
});
