import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('app browser theme color matches the canonical terminal background', () => {
  const html = readFileSync('app/index.html', 'utf8');
  assert.match(html, /<meta\s+name="theme-color"\s+content="#020403">/i);
  assert.doesNotMatch(html, /<meta\s+name="theme-color"\s+content="#050608">/i);
});
