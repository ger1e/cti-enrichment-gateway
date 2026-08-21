import test from 'node:test';
import assert from 'node:assert/strict';
import { tweetfeedProvider } from '../src/providers/tweetfeed.js';
import { ransomlookProvider } from '../src/providers/ransomlook.js';
import { ransomwareLiveProvider } from '../src/providers/ransomware-live.js';
import { normalizeEvidence } from '../src/core/normalize.js';
import { correlateEvidence } from '../src/core/correlate.js';

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('TweetFeed performs no-auth exact IOC enrichment and never emits a malicious verdict', async () => {
  let request;
  const output = await tweetfeedProvider.run(
    { type: 'domain', value: 'evil.example' },
    {
      fetchImpl: async (url, init) => {
        request = { url, init };
        return jsonResponse({
          found: true,
          query: 'evil.example',
          window: '365d',
          records: [{
            type: 'domain', value: 'evil.example', first_seen: '2026-08-20 10:00:00', last_seen: '2026-08-21 08:00:00', count: 2,
            users: ['researcher1', 'researcher2'], tags: ['#phishing'], tweets: ['https://x.com/researcher1/status/1'],
          }],
        });
      },
    },
  );

  assert.match(request.url, /^https:\/\/api\.tweetfeed\.live\/v1\/ioc\?value=/);
  assert.equal(Object.keys(request.init.headers).some(name => name.toLowerCase() === 'authorization'), false);
  assert.equal(output.observationType, 'community_ioc_report');
  assert.equal(output.verdict, 'observed');
  assert.equal(output.attributes.communityReported, true);
  assert.equal(output.attributes.autoBlock, false);
  assert.equal(output.attributes.reportCount, 2);
  assert.equal(output.references.includes('https://x.com/researcher1/status/1'), true);
});

test('TweetFeed treats SHA-1 as unsupported instead of manufacturing a negative IOC result', async () => {
  let calls = 0;
  const output = await tweetfeedProvider.run(
    { type: 'hash', value: 'a'.repeat(40) },
    { fetchImpl: async () => { calls += 1; return jsonResponse({}); } },
  );
  assert.equal(calls, 0);
  assert.equal(output.verdict, 'no_result');
  assert.equal(output.attributes.supported, false);
});

test('RansomLook uses the documented query parameter and direct-array response while preserving adversary-claim semantics', async () => {
  let request;
  const output = await ransomlookProvider.run(
    { type: 'url', value: 'https://victim.example/login' },
    {
      fetchImpl: async (url, init) => {
        request = { url, init };
        return jsonResponse([
          { group_name: 'example-group', post_title: 'Victim Example', discovered: '2026-08-20 11:22:33' },
        ]);
      },
    },
  );

  assert.equal(request.url, 'https://www.ransomlook.io/api/search?query=victim.example');
  assert.equal(Object.keys(request.init.headers).some(name => name.toLowerCase() === 'authorization'), false);
  assert.equal(output.observationType, 'ransomware_post_reference');
  assert.equal(output.verdict, 'observed');
  assert.equal(output.attributes.postCount, 1);
  assert.equal(output.attributes.adversaryClaims, true);
  assert.equal(output.attributes.confirmedCompromise, false);
  assert.deepEqual(output.relationships, [{ targetType: 'ransomware_group', target: 'example-group', relationship: 'claiming_group' }]);
});

test('ransomware.live sends X-API-KEY and rejects fuzzy victim-name hits whose website does not exactly match', async () => {
  let request;
  const output = await ransomwareLiveProvider.run(
    { type: 'url', value: 'https://www.acme.example/path' },
    {
      env: { RANSOMWARE_LIVE_API_KEY: 'test-key-not-secret' },
      fetchImpl: async (url, init) => {
        request = { url, init };
        return jsonResponse([
          { id: 'wrong', victim: 'Acme Example Holdings', group: 'wrong-group', website: 'https://other.example', discovered: '2026-08-20 01:00:00' },
          { id: 'right', victim: 'Acme', group: 'right-group', website: 'https://acme.example', country: 'HU', sector: 'Technology', discovered: '2026-08-21 01:00:00', permalink: 'https://www.ransomware.live/id/right' },
        ]);
      },
    },
  );

  assert.equal(request.url, 'https://api-pro.ransomware.live/victims/search?q=acme.example');
  assert.equal(request.init.headers['X-API-KEY'], 'test-key-not-secret');
  assert.equal(output.observationType, 'ransomware_victim_claim');
  assert.equal(output.verdict, 'observed');
  assert.equal(output.attributes.claimCount, 1);
  assert.equal(output.attributes.claims[0].id, 'right');
  assert.deepEqual(output.attributes.groups, ['right-group']);
  assert.equal(output.attributes.adversaryClaims, true);
  assert.equal(output.attributes.confirmedCompromise, false);
});

test('community reports and ransomware claims do not become reputation corroboration', () => {
  const evidence = [
    normalizeEvidence('tweetfeed', 'evil.example', 'domain', { observationType: 'community_ioc_report', verdict: 'observed' }),
    normalizeEvidence('ransomlook', 'evil.example', 'domain', { observationType: 'ransomware_post_reference', verdict: 'observed' }),
    normalizeEvidence('ransomware-live', 'evil.example', 'domain', { observationType: 'ransomware_victim_claim', verdict: 'observed' }),
  ];
  const correlation = correlateEvidence({ indicator: 'evil.example', type: 'domain', evidence });
  assert.deepEqual(correlation.corroboration, []);
  assert.deepEqual(correlation.contradictions, []);
});
