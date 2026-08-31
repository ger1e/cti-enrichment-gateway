import { createHash } from 'node:crypto';

import { toStixBundle } from '../export/stix.js';
import { REPORT_PRESETS } from '../report/compiler.js';
import { buildReportModel } from '../report/model.js';
import { assertReportQuality, assertSnapshotQuality } from '../report/quality.js';
import { renderObservablesCsv } from '../report/render-csv.js';
import { renderHtml } from '../report/render-html.js';
import { renderHuntsKql } from '../report/render-kql.js';
import { renderAttackNavigator } from '../report/render-navigator.js';
import { renderPdf } from '../report/render-pdf.js';
import { renderText } from '../report/render-text.js';

const FORMAT_META = Object.freeze({
  text: Object.freeze({ filename: 'report.txt', mimeType: 'text/plain;charset=utf-8' }),
  html: Object.freeze({ filename: 'report.html', mimeType: 'text/html;charset=utf-8' }),
  pdf: Object.freeze({ filename: 'report.pdf', mimeType: 'application/pdf' }),
  csv: Object.freeze({ filename: 'observables.csv', mimeType: 'text/csv;charset=utf-8' }),
  kql: Object.freeze({ filename: 'hunts.kql', mimeType: 'text/plain;charset=utf-8' }),
  navigator: Object.freeze({ filename: 'attack-navigator.json', mimeType: 'application/json;charset=utf-8' }),
  stix: Object.freeze({ filename: 'intelligence.stix.json', mimeType: 'application/stix+json;charset=utf-8' }),
  evidence: Object.freeze({ filename: 'evidence.json', mimeType: 'application/json;charset=utf-8' }),
});

const FILE_TO_FORMAT = Object.freeze(Object.fromEntries(Object.entries(FORMAT_META).map(([format, meta]) => [meta.filename, format])));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function deterministicUuidFactory(seed) {
  let counter = 0;
  return () => {
    const chars = createHash('sha256').update(`${seed}:${counter++}`).digest('hex').slice(0, 32).split('');
    chars[12] = '5';
    chars[16] = ['8', '9', 'a', 'b'][Number.parseInt(chars[16], 16) % 4];
    const hex = chars.join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

function gatewayShape(model) {
  return {
    schemaVersion: model.source.evidenceSchemaVersion,
    gatewayVersion: model.source.gatewayVersion,
    requestId: model.source.requestId ?? model.reportId,
    indicator: model.subject.value,
    type: model.subject.type,
    queriedAt: model.source.queriedAt,
    evidence: model.evidence.map(({ id: _id, ...item }) => item),
    relationships: model.relationships,
  };
}

function prepare(snapshot, { generatedAt, sourceSha = null } = {}) {
  assertSnapshotQuality(snapshot);
  const model = buildReportModel(snapshot, { generatedAt, sourceSha });
  assertReportQuality(model);
  return model;
}

function artifact(format, content, encoding = 'utf8') {
  const meta = FORMAT_META[format];
  if (!meta) throw new TypeError(`unsupported report format: ${format}`);
  return Object.freeze({
    filename: meta.filename,
    mimeType: meta.mimeType,
    encoding,
    content,
  });
}

function renderFormat(snapshot, model, format) {
  if (format === 'text') return artifact(format, renderText(model));
  if (format === 'html') return artifact(format, renderHtml(model));
  if (format === 'pdf') return artifact(format, renderPdf(model).toString('base64'), 'base64');
  if (format === 'csv') return artifact(format, renderObservablesCsv(model));
  if (format === 'kql') return artifact(format, renderHuntsKql(model));
  if (format === 'navigator') return artifact(format, renderAttackNavigator(model));
  if (format === 'evidence') return artifact(format, canonicalJson(snapshot));
  if (format === 'stix') {
    const uuid = deterministicUuidFactory(model.reportId);
    const bundle = toStixBundle(gatewayShape(model), { now: () => model.generatedAt, uuid });
    return artifact(format, canonicalJson(bundle));
  }
  throw new TypeError(`unsupported report format: ${format}`);
}

function artifactBytes(value) {
  return Buffer.from(value.content, value.encoding === 'base64' ? 'base64' : 'utf8');
}

export function projectNodeReport(snapshot, format, { generatedAt, sourceSha = null } = {}) {
  const model = prepare(snapshot, { generatedAt, sourceSha });
  return Object.freeze({ model, artifact: renderFormat(snapshot, model, format) });
}

export function inspectNodeReportQuality(snapshot, { generatedAt, sourceSha = null } = {}) {
  const model = prepare(snapshot, { generatedAt, sourceSha });
  return Object.freeze({
    ok: true,
    reportId: model.reportId,
    reportSchemaVersion: model.reportSchemaVersion,
    generatedAt: model.generatedAt,
    evidenceCount: model.evidence.length,
    sourceCount: model.sources.length,
    limitationCount: model.limitations.length,
  });
}

export function buildNodeReportManifest(snapshot, { generatedAt, sourceSha = null, preset = 'all' } = {}) {
  const files = REPORT_PRESETS[preset];
  if (!files) throw new TypeError(`unknown report preset: ${preset}`);
  const model = prepare(snapshot, { generatedAt, sourceSha });
  const selected = files.filter(name => name !== 'manifest.json').sort((a, b) => a.localeCompare(b));
  const artifacts = selected.map(name => {
    const format = FILE_TO_FORMAT[name];
    if (!format) throw new TypeError(`unsupported report artifact: ${name}`);
    const value = renderFormat(snapshot, model, format);
    const bytes = artifactBytes(value);
    return { name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  return Object.freeze({
    manifestVersion: '1.0',
    reportId: model.reportId,
    reportSchemaVersion: model.reportSchemaVersion,
    preset,
    generatedAt: model.generatedAt,
    snapshotSha256: model.reproducibility.snapshotSha256,
    sourceSha: model.reproducibility.sourceSha,
    files: artifacts,
  });
}
