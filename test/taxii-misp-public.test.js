import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ALL_PROVIDERS } from '../src/providers/index.js';
import { WORKFLOWS } from '../src/workflows.js';
import { classifyIndicator } from '../src/core/validate.js';

function provider(name) {
  const item = ALL_PROVIDERS.find(p => p.name === name);
  assert.ok(item, `${name} provider must be registered`);
  return item;
}

function text(value, status = 200, headers = {}) {
  return new Response(value, { status, headers: { 'content-type': 'text/plain', ...headers } });
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function context(fetchImpl, feedCache = new Map()) {
  return { fetchImpl, feedCache, signal: new AbortController().signal, nowMs: () => 1_787_248_000_000 };
}

function md5(value) {
  return createHash('md5').update(value, 'utf8').digest('hex');
}

test('public TAXII and MISP sources are registered without credentials', () => {
  for (const name of ['attack-taxii', 'misp-circl-osint', 'misp-botvrij-osint']) {
    const p = provider(name);
    assert.equal(p.requiredEnv, undefined);
    assert.equal(p.optionalEnv, undefined);
    assert.equal(p.costClass, 'free');
  }
});

test('CIRCL MISP OSINT uses the fixed MISP hash cache and verifies the exact event attribute', async () => {
  const p = provider('misp-circl-osint');
  const eventUuid = '11111111-2222-4333-8444-555555555555';
  let calls = 0;
  const data = await p.run({ value: 'evil.example', type: 'domain' }, context(async (url, init) => {
    calls += 1;
    assert.equal(init.method, 'GET');
    if (calls === 1) {
      assert.equal(String(url), 'https://www.circl.lu/doc/misp/feed-osint/hashes.csv');
      return text(`${md5('evil.example')},${eventUuid}\n`);
    }
    assert.equal(String(url), `https://www.circl.lu/doc/misp/feed-osint/${eventUuid}.json`);
    return json({ Event: {
      uuid: eventUuid,
      info: 'CIRCL OSINT demo event',
      date: '2026-08-20',
      threat_level_id: '2',
      Tag: [{ name: 'tlp:clear' }],
      Attribute: [{ uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', type: 'domain', category: 'Network activity', value: 'evil.example', to_ids: true, timestamp: '1787248000' }],
      Object: [],
    } });
  }));
  assert.equal(calls, 2);
  assert.equal(data.observationType, 'misp_feed_hit');
  assert.equal(data.verdict, 'listed');
  assert.equal(data.attributes.feed, 'CIRCL OSINT Feed');
  assert.equal(data.attributes.eventCount, 1);
  assert.equal(data.attributes.matchedAttributeCount, 1);
  assert.equal(data.attributes.toIds, true);
  assert.ok(data.tags.includes('tlp:clear'));
  assert.ok(data.references.includes(`https://www.circl.lu/doc/misp/feed-osint/${eventUuid}.json`));
});

test('MISP OSINT negative correlation does not fetch event bodies', async () => {
  const p = provider('misp-botvrij-osint');
  let calls = 0;
  const data = await p.run({ value: '198.51.100.44', type: 'ip' }, context(async (url) => {
    calls += 1;
    assert.equal(String(url), 'https://www.botvrij.eu/data/feed-osint/hashes.csv');
    return text(`${md5('203.0.113.10')},22222222-3333-4444-8555-666666666666\n`);
  }));
  assert.equal(calls, 1);
  assert.equal(data.observationType, 'misp_feed_hit');
  assert.equal(data.verdict, 'not_listed');
  assert.equal(data.attributes.feed, 'Botvrij.eu OSINT Feed');
});

test('malformed MISP hash caches fail closed instead of manufacturing not-listed results', async () => {
  const p = provider('misp-circl-osint');
  await assert.rejects(() => p.run(
    { value: 'evil.example', type: 'domain' },
    context(async () => text('<html>upstream error</html>')),
  ));
});

test('ATT&CK TAXII resolves ATT&CK IDs from fixed read-only TAXII 2.1 collections', async () => {
  const p = provider('attack-taxii');
  let calls = 0;
  const data = await p.run({ value: 'T1059.001', type: 'attack' }, context(async (url, init) => {
    calls += 1;
    assert.equal(String(url), 'https://attack-taxii.mitre.org/api/v21/collections/x-mitre-collection--1f5f1533-f617-4ca8-9ab4-6a02367fa019/objects/?match%5Btype%5D=attack-pattern');
    assert.equal(init.method, 'GET');
    assert.equal(init.headers.accept, 'application/taxii+json;version=2.1');
    return json({ more: false, objects: [{
      type: 'attack-pattern',
      spec_version: '2.1',
      id: 'attack-pattern--970a3432-3237-47ad-bcca-7d8cbb217736',
      name: 'PowerShell',
      description: 'PowerShell technique.',
      created: '2020-03-09T14:00:00.000Z',
      modified: '2026-05-12T14:00:00.000Z',
      x_mitre_version: '1.5',
      x_mitre_platforms: ['Windows'],
      kill_chain_phases: [{ kill_chain_name: 'mitre-attack', phase_name: 'execution' }],
      external_references: [{ source_name: 'mitre-attack', external_id: 'T1059.001', url: 'https://attack.mitre.org/techniques/T1059/001/' }],
    }] });
  }));
  assert.equal(calls, 1);
  assert.equal(data.observationType, 'attack_knowledge');
  assert.equal(data.verdict, 'cataloged');
  assert.equal(data.attributes.attackId, 'T1059.001');
  assert.equal(data.attributes.name, 'PowerShell');
  assert.deepEqual(data.attributes.platforms, ['Windows']);
  assert.deepEqual(data.attributes.tactics, ['execution']);
  assert.ok(data.references.includes('https://attack.mitre.org/techniques/T1059/001/'));
});

test('ATT&CK identifiers classify deterministically and use a dedicated workflow', () => {
  assert.deepEqual(classifyIndicator('t1059.001'), { value: 'T1059.001', type: 'attack' });
  assert.deepEqual(classifyIndicator('G0007'), { value: 'G0007', type: 'attack' });
  assert.deepEqual(classifyIndicator('DS0029'), { value: 'DS0029', type: 'attack' });
  assert.deepEqual(WORKFLOWS.attack, ['attack-taxii']);
});

test('MISP OSINT is placed in IOC workflows as context before scarce credentialed enrichment', () => {
  for (const type of ['ip', 'domain', 'url', 'hash', 'cve']) {
    assert.ok(WORKFLOWS[type].includes('misp-circl-osint'), `${type} must include CIRCL MISP OSINT`);
    assert.ok(WORKFLOWS[type].includes('misp-botvrij-osint'), `${type} must include Botvrij MISP OSINT`);
  }
  assert.ok(WORKFLOWS.ip.indexOf('misp-botvrij-osint') < WORKFLOWS.ip.indexOf('greynoise'));
  assert.ok(WORKFLOWS.domain.indexOf('misp-botvrij-osint') < WORKFLOWS.domain.indexOf('urlscan'));
  assert.ok(WORKFLOWS.hash.indexOf('misp-botvrij-osint') < WORKFLOWS.hash.indexOf('malwarebazaar'));
  assert.ok(WORKFLOWS.cve.indexOf('misp-botvrij-osint') < WORKFLOWS.cve.indexOf('nvd'));
});

test('Maltego exposes ATT&CK Phrase enrichment through the same bounded gateway client', () => {
  const transform = readFileSync(new URL('../maltego/transforms/EnrichATTACK.py', import.meta.url), 'utf8');
  const transformInit = readFileSync(new URL('../maltego/transforms/__init__.py', import.meta.url), 'utf8');
  assert.match(transform, /input_entity=['"]maltego\.Phrase['"]/);
  assert.match(transform, /execute_gateway_transform\(request, response, ['"]attack['"]\)/);
  assert.match(transformInit, /from \.EnrichATTACK import EnrichATTACK/);
});
