import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');

test('WebUI runtime pins the same canonical SVG favicon as landing', () => {
  const landing = read('index.html');
  const runtime = read('app/terminal-main.js');
  assert.match(landing, /rel=["']icon["'][^>]*href=["']\/favicon\.svg["']/i);
  assert.match(runtime, /favicon\.href\s*=\s*['"]\/favicon\.svg['"]/i);
  assert.match(runtime, /favicon\.rel\s*=\s*['"]icon['"]/i);
  assert.match(runtime, /favicon\.type\s*=\s*['"]image\/svg\+xml['"]/i);
});

test('live landing rain is substantially denser without changing its speed', () => {
  const landing = read('index.html');
  const columns = [...landing.matchAll(/<span class="rain" style="left:/g)];
  assert.ok(columns.length >= 28, `expected at least 28 live landing rain columns, got ${columns.length}`);
  assert.match(landing, /\.rain\{[^}]*animation:fall var\(--d,6s\) linear infinite/is);
  assert.doesNotMatch(landing, /landing-radar-motion\.css/i);
});
