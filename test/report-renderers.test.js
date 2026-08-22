import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReportModel } from '../src/report/model.js';
import { renderHtml } from '../src/report/render-html.js';
import { renderText } from '../src/report/render-text.js';
import { renderObservablesCsv } from '../src/report/render-csv.js';
import { renderHuntsKql } from '../src/report/render-kql.js';
import { renderAttackNavigator } from '../src/report/render-navigator.js';
import { renderPdf } from '../src/report/render-pdf.js';

const snapshot = JSON.parse(readFileSync(new URL('./fixtures/report/enrichment.json', import.meta.url), 'utf8'));
const model = buildReportModel(snapshot, { generatedAt: '2026-08-22T08:30:00.000Z', sourceSha: '0123456789abcdef0123456789abcdef01234567' });

test('HTML and text renderers preserve report section semantics and behavior-state labels', () => {
  const html = renderHtml(model);
  const text = renderText(model);
  for (const heading of ['Executive Summary', 'Key Findings', 'Suspicious Behavior to Look Out For', 'Indicators & Observables', 'Threat Context', 'Timeline', 'Analytical Frameworks', 'Hunt Opportunities', 'Confidence & Limitations', 'Sources & Evidence Provenance', 'Reproducibility / Integrity']) {
    assert.match(html, new RegExp(heading.replace(/[&/]/g, '.')));
    assert.match(text, new RegExp(heading.replace(/[&/]/g, '.').toUpperCase()));
  }
  for (const state of ['OBSERVED', 'LOOK_FOR_NEXT', 'CONTEXTUAL_NOT_OBSERVED']) {
    assert.match(html, new RegExp(state));
    assert.match(text, new RegExp(state));
  }
  assert.match(html, /TLP:CLEAR/);
  assert.doesNotMatch(html, /<script\b/i);
});

test('CSV, KQL, and ATT&CK Navigator exports are deterministic and bounded', () => {
  const csv = renderObservablesCsv(model);
  assert.equal(csv, 'type,value\ndomain,c2.example.test\nip,203.0.113.10\n');

  const kql = renderHuntsKql(model);
  assert.match(kql, /hunt-related-domain/);
  assert.match(kql, /DeviceNetworkEvents \| where RemoteUrl =~ "c2\.example\.test"/);
  assert.doesNotMatch(kql, /undefined|null/);

  const navigator = JSON.parse(renderAttackNavigator(model));
  assert.equal(navigator.domain, 'enterprise-attack');
  assert.deepEqual(navigator.techniques.map(item => item.techniqueID), ['T1071.001']);
  assert.equal(navigator.techniques[0].comment.includes('OBSERVED'), true);
});

test('PDF renderer emits stable self-contained PDF bytes without network or wall-clock access', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('network must not be used by PDF renderer'); };
  try {
    const first = renderPdf(model);
    const second = renderPdf(model);
    assert.ok(Buffer.isBuffer(first));
    assert.deepEqual(first, second);
    assert.equal(first.subarray(0, 8).toString('ascii'), '%PDF-1.4');
    assert.match(first.toString('latin1'), /%%EOF\s*$/);
    assert.match(first.toString('latin1'), /CTI Enrichment Gateway/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
