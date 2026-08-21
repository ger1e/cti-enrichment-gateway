import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIndicator } from '../src/core/validate.js';
import { ALL_PROVIDERS } from '../src/providers/index.js';

function prng(seed = 0x6d2b79f5) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17; state >>>= 0;
    state ^= state << 5; state >>>= 0;
    return state / 0x100000000;
  };
}

function generatedStrings(count) {
  const random = prng();
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_:/?#@%+[]'\\ \t\nüé";
  const output = [];
  for (let i = 0; i < count; i += 1) {
    const length = Math.floor(random() * 96);
    let value = '';
    for (let j = 0; j < length; j += 1) value += alphabet[Math.floor(random() * alphabet.length)];
    output.push(value);
  }
  return output;
}

const TYPES = new Set(['ip','domain','url','hash','cve','attack','asn','cidr']);

test('1000 deterministic arbitrary strings either reject cleanly or canonicalize idempotently', () => {
  for (const value of generatedStrings(1000)) {
    try {
      const first = classifyIndicator(value);
      assert.ok(TYPES.has(first.type));
      assert.equal(typeof first.value, 'string');
      const second = classifyIndicator(first.value);
      assert.deepEqual(second, first, `non-idempotent classification for ${JSON.stringify(value)}`);
    } catch (error) {
      assert.ok(error instanceof TypeError || error instanceof RangeError, `unexpected error class for ${JSON.stringify(value)}: ${error}`);
    }
  }
});

test('canonicalization corpus covers IDNA URL hash CVE ATT&CK ASN and CIDR boundaries', () => {
  assert.deepEqual(classifyIndicator('bücher.example'), { value: 'xn--bcher-kva.example', type: 'domain' });
  assert.deepEqual(classifyIndicator('https://bücher.example/a#fragment'), { value: 'https://xn--bcher-kva.example/a', type: 'url' });
  assert.deepEqual(classifyIndicator('A'.repeat(64)), { value: 'a'.repeat(64), type: 'hash' });
  assert.deepEqual(classifyIndicator('cve-2026-12345'), { value: 'CVE-2026-12345', type: 'cve' });
  assert.deepEqual(classifyIndicator('t1059.001'), { value: 'T1059.001', type: 'attack' });
  assert.deepEqual(classifyIndicator('as4294967295'), { value: 'AS4294967295', type: 'asn' });
  assert.deepEqual(classifyIndicator('2001:0db8::/32'), { value: '2001:db8::/32', type: 'cidr' });
});

test('malformed boundary corpus rejects credentials invalid networks prefixes ASN overflow and ambiguous slash input', () => {
  const malformed = [
    'https://user:pass@example.com/', 'AS0', 'AS4294967296', 'AS0001', '192.0.2.1/24', '192.0.2.0/33',
    '2001:db8::1/32', '2001:db8::/129', '192.0.2.0/024', 'not/a/network', 'CVE-2026-123', 'T99999',
    `${'a'.repeat(64)}g`, `${'a'.repeat(4097)}`,
  ];
  for (const value of malformed) {
    assert.throws(() => classifyIndicator(value), error => error instanceof TypeError || error instanceof RangeError);
  }
});

function provider(name) {
  const item = ALL_PROVIDERS.find(candidate => candidate.name === name);
  assert.ok(item, `missing provider ${name}`);
  return item;
}
function text(value) { return new Response(value, { status: 200, headers: { 'content-type': 'text/plain' } }); }

test('deterministic malformed MISP hash-cache corpus fails closed', async () => {
  const p = provider('misp-circl-osint');
  const corpus = [
    '', '\n# comment only\n', '<html>oops</html>', 'not-md5,11111111-2222-4333-8444-555555555555\n',
    `${'a'.repeat(32)},not-a-uuid\n`, `${'a'.repeat(31)},11111111-2222-4333-8444-555555555555\n`,
    `${'a'.repeat(32)},11111111-2222-4333-8444-555555555555,extra\n`,
  ];
  for (const body of corpus) {
    await assert.rejects(() => p.run({ value: 'evil.example', type: 'domain' }, {
      signal: new AbortController().signal, feedCache: new Map(), nowMs: () => 1_787_248_000_000,
      fetchImpl: async () => text(body),
    }));
  }
});
