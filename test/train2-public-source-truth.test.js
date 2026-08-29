import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = path => JSON.parse(text(path));

const providerCount = Object.keys(json('config/providers.json')).length;

test('public landing provider count follows the canonical provider registry', () => {
  const landing = text('landing-maxx.html');
  assert.ok(landing.includes(`<span class="metric-value">${providerCount}</span>`), 'landing source-count metric drift');
  assert.ok(landing.includes(`${providerCount} FIXED SOURCES // READ-ONLY // FIXED EGRESS`), 'landing footer source-count drift');
});

test('README provider count and supported inputs follow Train 2 source truth', () => {
  const readme = text('README.md');
  assert.ok(readme.includes(`\`${providerCount} FIXED SOURCES\``), 'README source-count badge drift');
  assert.ok(readme.includes(`<summary><strong>${providerCount} upstream APIs and feeds</strong></summary>`), 'README provider-summary count drift');
  assert.match(readme, /\*\*Inputs:\*\*[^\n]*certificate/i, 'README must expose the certificate observable');
});
