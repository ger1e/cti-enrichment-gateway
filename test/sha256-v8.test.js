import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from '../src/core/sha256.js';

test('browser-safe SHA-256 helper matches canonical vectors used by graph identity', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex('domain\u0000evil.example'), 'bb5a199d7650a1e70b95a35d30708f0972f2ce2dacbc928f59f260f3a251720d');
});
