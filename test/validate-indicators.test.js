import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIndicator } from '../src/core/validate.js';

test('classifies and canonicalizes domains', () => {
  assert.deepEqual(classifyIndicator('ExAmPle.COM'), { value: 'example.com', type: 'domain' });
  assert.deepEqual(classifyIndicator('täst.de'), { value: 'xn--tst-qla.de', type: 'domain' });
});

test('classifies HTTP(S) URLs and rejects other schemes', () => {
  assert.equal(classifyIndicator('HTTPS://Example.COM/a?x=1').type, 'url');
  assert.match(classifyIndicator('HTTPS://Example.COM/a?x=1').value, /^https:\/\/example\.com\/a\?x=1$/);
  assert.throws(() => classifyIndicator('file:///etc/passwd'), /unsupported/i);
  assert.throws(() => classifyIndicator('javascript:alert(1)'), /unsupported/i);
});

test('classifies MD5 SHA1 and SHA256 hashes', () => {
  assert.deepEqual(classifyIndicator('A'.repeat(32)), { value: 'a'.repeat(32), type: 'hash' });
  assert.deepEqual(classifyIndicator('B'.repeat(40)), { value: 'b'.repeat(40), type: 'hash' });
  assert.deepEqual(classifyIndicator('C'.repeat(64)), { value: 'c'.repeat(64), type: 'hash' });
});

test('rejects malformed hostnames', () => {
  for (const value of ['bad_domain.com', '-bad.example', 'bad-.example', 'no dot', '.example.com', 'example..com']) {
    assert.throws(() => classifyIndicator(value), /unsupported/i);
  }
});
