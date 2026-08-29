import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('README ends with the canonical PARA11AX radar lockup', () => {
  const readme = read('README.md');
  assert.match(readme, /<img[^>]+assets\/brand\/para11ax-radar-lockup\.svg[^>]+alt="PARA11AX"[^>]*>/i);
});
