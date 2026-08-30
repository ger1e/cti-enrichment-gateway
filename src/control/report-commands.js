import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileReportBundle, REPORT_PRESETS } from '../report/compiler.js';
import { buildReportModel } from '../report/model.js';
import { assertReportQuality } from '../report/quality.js';
import { diffReportModels } from '../report/diff.js';

const MAX_SNAPSHOT_BYTES = 20_000_000;

function readSnapshot(path) {
  if (typeof path !== 'string' || !path || path.startsWith('-')) throw new Error('invalid snapshot path');
  const absolute = resolve(path);
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('snapshot must be a regular file');
  if (stat.size <= 0 || stat.size > MAX_SNAPSHOT_BYTES) throw new Error('snapshot exceeds bounded input size');
  let value;
  try {
    value = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch {
    throw new Error('snapshot is not valid JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('snapshot must be a JSON object');
  return value;
}

function deterministicGeneratedAt(snapshot) {
  const candidates = [snapshot.queriedAt];
  if (Array.isArray(snapshot.evidence)) {
    for (const item of snapshot.evidence.slice(0, 100)) {
      candidates.push(item?.retrievedAt, item?.observation?.firstSeen, item?.observation?.lastSeen);
    }
  }
  const times = candidates.filter(value => typeof value === 'string' && Number.isFinite(Date.parse(value))).map(value => Date.parse(value));
  if (!times.length) throw new Error('snapshot has no deterministic timestamp');
  return new Date(Math.max(...times)).toISOString();
}

function parseFlagPairs(args, allowed) {
  const output = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!allowed.has(flag) || typeof value !== 'string' || value.startsWith('--')) throw new Error(`invalid report option: ${flag ?? 'missing'}`);
    if (Object.hasOwn(output, flag)) throw new Error(`duplicate report option: ${flag}`);
    output[flag] = value;
  }
  return output;
}

export function compileReportCommand(args) {
  if (!Array.isArray(args) || args.length < 3 || args.length % 2 === 0) throw new Error('invalid report compile arguments');
  const snapshotPath = args[0];
  const flags = parseFlagPairs(args.slice(1), new Set(['--out', '--preset', '--generated-at', '--source-sha']));
  if (!flags['--out']) throw new Error('report compile requires --out');
  const preset = flags['--preset'] ?? 'all';
  if (!Object.hasOwn(REPORT_PRESETS, preset)) throw new Error(`unknown report preset: ${preset}`);
  const snapshot = readSnapshot(snapshotPath);
  const generatedAt = flags['--generated-at'] ?? deterministicGeneratedAt(snapshot);
  const sourceSha = flags['--source-sha'] ?? null;
  const result = compileReportBundle(snapshot, { outDir: flags['--out'], preset, generatedAt, sourceSha });
  return { reportId: result.model.reportId, preset, files: result.files.sort((a, b) => a.localeCompare(b)) };
}

export function runReportCompile(args) {
  const summary = compileReportCommand(args);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return 0;
}

export function diffReportCommand(args) {
  if (!Array.isArray(args) || args.length !== 2) throw new Error('report diff requires before.json and after.json');
  const beforeSnapshot = readSnapshot(args[0]);
  const afterSnapshot = readSnapshot(args[1]);
  const before = buildReportModel(beforeSnapshot, { generatedAt: deterministicGeneratedAt(beforeSnapshot), sourceSha: null });
  const after = buildReportModel(afterSnapshot, { generatedAt: deterministicGeneratedAt(afterSnapshot), sourceSha: null });
  assertReportQuality(before);
  assertReportQuality(after);
  return diffReportModels(before, after);
}

export function runReportDiff(args) {
  const diff = diffReportCommand(args);
  process.stdout.write(`${JSON.stringify(diff, null, 2)}\n`);
  return 0;
}