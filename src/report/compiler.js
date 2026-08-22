import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildReportModel } from './model.js';
import { assertReportDistribution, assertReportQuality, assertSnapshotQuality } from './quality.js';
import { renderHtml } from './render-html.js';
import { renderText } from './render-text.js';
import { renderObservablesCsv } from './render-csv.js';
import { renderHuntsKql } from './render-kql.js';
import { renderAttackNavigator } from './render-navigator.js';
import { renderPdf } from './render-pdf.js';
import { toStixBundle } from '../export/stix.js';

const ALL_FILES = Object.freeze([
  'attack-navigator.json',
  'evidence.json',
  'hunts.kql',
  'intelligence.stix.json',
  'manifest.json',
  'observables.csv',
  'report.html',
  'report.pdf',
  'report.txt',
]);

export const REPORT_PRESETS = Object.freeze({
  quick: Object.freeze(['manifest.json', 'report.html', 'report.txt']),
  analyst: ALL_FILES,
  case: ALL_FILES,
  soc: Object.freeze(['attack-navigator.json', 'hunts.kql', 'manifest.json', 'observables.csv', 'report.html', 'report.txt']),
  sharing: Object.freeze(['intelligence.stix.json', 'manifest.json', 'observables.csv', 'report.html', 'report.pdf', 'report.txt']),
  evidence: Object.freeze(['evidence.json', 'intelligence.stix.json', 'manifest.json', 'observables.csv']),
  all: ALL_FILES,
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(canonicalize(value), null, 2)}\n`, 'utf8');
}

function utf8(value) {
  return Buffer.from(value, 'utf8');
}

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
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

function renderArtifacts(snapshot, model) {
  const uuid = deterministicUuidFactory(model.reportId);
  const stix = toStixBundle(gatewayShape(model), { now: () => model.generatedAt, uuid });
  return Object.freeze({
    'attack-navigator.json': utf8(renderAttackNavigator(model)),
    'evidence.json': jsonBytes(snapshot),
    'hunts.kql': utf8(renderHuntsKql(model)),
    'intelligence.stix.json': jsonBytes(stix),
    'observables.csv': utf8(renderObservablesCsv(model)),
    'report.html': utf8(renderHtml(model)),
    'report.pdf': renderPdf(model),
    'report.txt': utf8(renderText(model)),
  });
}

function validateOutputDirectory(outDir) {
  if (typeof outDir !== 'string' || outDir.length < 1) throw new TypeError('outDir is required');
  const absolute = resolve(outDir);
  if (existsSync(absolute)) {
    if (lstatSync(absolute).isSymbolicLink()) throw new Error('report output directory must not be a symbolic link');
    if (!lstatSync(absolute).isDirectory()) throw new Error('report output path must be a directory');
    if (readdirSync(absolute).length) throw new Error('report output directory must be empty');
  }
  return absolute;
}

export function compileReportBundle(snapshot, {
  outDir,
  generatedAt,
  sourceSha = null,
  preset = 'all',
} = {}) {
  const files = REPORT_PRESETS[preset];
  if (!files) throw new Error(`unknown report preset: ${preset}`);
  assertSnapshotQuality(snapshot);
  const absolute = validateOutputDirectory(outDir);
  const model = buildReportModel(snapshot, { generatedAt, sourceSha });
  assertReportQuality(model);
  assertReportDistribution(model, preset);

  const artifacts = renderArtifacts(snapshot, model);
  const selected = files.filter(name => name !== 'manifest.json').sort((a, b) => a.localeCompare(b));
  for (const name of selected) if (!artifacts[name]) throw new Error(`unsupported report artifact: ${name}`);
  const manifest = {
    manifestVersion: '1.0',
    reportId: model.reportId,
    reportSchemaVersion: model.reportSchemaVersion,
    preset,
    generatedAt: model.generatedAt,
    snapshotSha256: model.reproducibility.snapshotSha256,
    sourceSha: model.reproducibility.sourceSha,
    files: selected.map(name => ({ name, bytes: artifacts[name].length, sha256: digest(artifacts[name]) })),
  };
  const manifestBytes = jsonBytes(manifest);

  mkdirSync(absolute, { recursive: true });
  for (const name of selected) writeFileSync(resolve(absolute, name), artifacts[name], { flag: 'wx' });
  writeFileSync(resolve(absolute, 'manifest.json'), manifestBytes, { flag: 'wx' });
  return { model, manifest, files: [...selected, 'manifest.json'] };
}
