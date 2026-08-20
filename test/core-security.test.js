import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIndicator } from '../src/core/validate.js';
import { requireGatewayAuth } from '../src/core/auth.js';
import { securityHeaders } from '../src/core/http.js';

test('classifies IPv4 and IPv6 indicators', () => {
  assert.equal(classifyIndicator('8.8.8.8').type, 'ip');
  assert.equal(classifyIndicator('2001:4860:4860::8888').type, 'ip');
});

test('classifies normalized CVE identifiers', () => {
  assert.deepEqual(classifyIndicator(' cve-2026-12345 '), { value: 'CVE-2026-12345', type: 'cve' });
});

test('rejects malformed or unbounded indicators', () => {
  assert.throws(() => classifyIndicator('not an indicator'), /unsupported indicator/i);
  assert.throws(() => classifyIndicator('A'.repeat(4097)), /too long/i);
});

test('requires matching bearer token without returning the secret', () => {
  const ok = requireGatewayAuth({ headers: { authorization: 'Bearer correct-horse' } }, 'correct-horse');
  assert.equal(ok, true);
  assert.equal(requireGatewayAuth({ headers: { authorization: 'Bearer wrong' } }, 'correct-horse'), false);
  assert.equal(requireGatewayAuth({ headers: {} }, 'correct-horse'), false);
  assert.equal(requireGatewayAuth({ headers: { authorization: 'Bearer correct-horse' } }, ''), false);
});

test('security headers disable sniffing, framing and response caching', () => {
  const headers = securityHeaders();
  assert.equal(headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(headers['cache-control'], 'no-store');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.match(headers['content-security-policy'], /default-src 'none'/);
});
