import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ALL_PROVIDERS } from '../src/providers/index.js';
import { GATEWAY_VERSION, EVIDENCE_SCHEMA_VERSION } from '../src/core/version.js';

function cleanCommit(value) {
  const text = String(value ?? '').trim();
  return /^[0-9a-f]{40}$/i.test(text) ? text.toLowerCase() : null;
}

function byName(a, b) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export function buildReleaseManifest({ sourceCommit = null } = {}) {
  const providers = [...ALL_PROVIDERS]
    .map(provider => Object.freeze({
      name: provider.name,
      parserVersion: String(provider.parserVersion),
      active: provider.active !== false,
    }))
    .sort(byName);

  return Object.freeze({
    gatewayVersion: GATEWAY_VERSION,
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    sourceCommit: cleanCommit(sourceCommit),
    providers,
  });
}

export function serializeReleaseManifest(options = {}) {
  return `${JSON.stringify(buildReleaseManifest(options), null, 2)}\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const stdout = args.includes('--stdout');
  const sourceIndex = args.indexOf('--source-commit');
  const sourceCommit = sourceIndex >= 0 ? args[sourceIndex + 1] : process.env.SOURCE_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const expected = serializeReleaseManifest({ sourceCommit });
  const path = fileURLToPath(new URL('../release-manifest.json', import.meta.url));

  if (stdout) {
    process.stdout.write(expected);
    return;
  }
  if (check) {
    const current = await readFile(path, 'utf8');
    if (current !== expected) {
      process.stderr.write('release-manifest.json is stale; run node scripts/generate-release-manifest.mjs\n');
      process.exitCode = 2;
    }
    return;
  }
  await writeFile(path, expected, 'utf8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
