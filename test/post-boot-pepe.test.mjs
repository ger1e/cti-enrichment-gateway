import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('Pepe remains a boot-only artifact and is never injected into analyst scrollback', () => {
  const entry = read('app/terminal-entry.js');
  const html = read('app/index.html');

  assert.match(html, /id="pepe-ascii"/);
  assert.match(entry, /stage === 'pepe'/);
  assert.doesNotMatch(entry, /restorePepeSignature\s*\(/);
  assert.doesNotMatch(entry, /shell-boot-pepe/);
  assert.doesNotMatch(entry, /scrollback\.prepend\(node\)/);
});
