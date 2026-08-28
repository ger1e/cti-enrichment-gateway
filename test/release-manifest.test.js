import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReleaseManifest } from '../scripts/generate-release-manifest.mjs';
import { ALL_PROVIDERS } from '../src/providers/index.js';

const path = new URL('../release-manifest.json', import.meta.url);

function committedText() {
  return readFileSync(path, 'utf8');
}
function committed() {
  return JSON.parse(committedText());
}

test('committed release manifest exactly matches deterministic registry projection', () => {
  assert.deepEqual(committed(), buildReleaseManifest({ sourceCommit: null }));
});

test('release manifest includes every provider and parser version exactly once', () => {
  const manifest = committed();
  assert.equal(manifest.providers.length, ALL_PROVIDERS.length);
  assert.deepEqual(manifest.providers.map(item => item.name), [...ALL_PROVIDERS].map(item => item.name).sort());
  assert.ok(manifest.providers.every(item => typeof item.parserVersion === 'string' && item.parserVersion.length > 0));
  assert.ok(manifest.providers.every(item => item.active === true));
});

test('source commit is accepted only as an exact SHA-1 and no environment values enter the manifest', () => {
  const sha = 'a'.repeat(40);
  assert.equal(buildReleaseManifest({ sourceCommit: sha }).sourceCommit, sha);
  assert.equal(buildReleaseManifest({ sourceCommit: 'refs/heads/main' }).sourceCommit, null);
  const text = committedText();
  for (const forbidden of ['PARA11AX_TOKEN', 'API_KEY', 'API_TOKEN', 'CENSYS_PAT', 'SENTRY_AUTH_TOKEN', 'process.env']) assert.equal(text.includes(forbidden), false);
});

test('release manifest has no timestamps or nondeterministic identifiers', () => {
  const manifest = committed();
  assert.deepEqual(Object.keys(manifest).sort(), ['gatewayVersion', 'providers', 'schemaVersion', 'sourceCommit']);
  assert.equal(JSON.stringify(manifest).includes('generatedAt'), false);
});
