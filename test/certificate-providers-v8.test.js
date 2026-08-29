import test from 'node:test';
import assert from 'node:assert/strict';
import { censysProvider } from '../src/providers/censys.js';
import { virustotalProvider } from '../src/providers/virustotal.js';
import { PROBE_SAMPLE_BY_TYPE } from '../src/control/provider-probe.js';

const FP = 'a'.repeat(64);
const INPUT = Object.freeze({ type: 'certificate', value: `cert-sha256:${FP}` });

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function oversized() {
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'content-length': '3000001' } });
}

test('certificate observable has a canonical harmless provider-probe sample', () => {
  assert.match(PROBE_SAMPLE_BY_TYPE.certificate, /^cert-sha256:[a-f0-9]{64}$/);
});

test('Censys certificate lookup uses the fixed v3 certificate endpoint and returns contextual metadata', async () => {
  let request;
  const output = await censysProvider.run(INPUT, {
    env: { CENSYS_PAT: 'test-pat' },
    fetchImpl: async (url, init) => {
      request = { url: String(url), init };
      return json({ result: { resource: {
        fingerprint_sha256: FP,
        names: ['example.com'],
        subject_dn: 'CN=example.com',
        issuer_dn: 'CN=Example Issuer',
        validity: { start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z' },
      } } });
    },
  });
  const url = new URL(request.url);
  assert.equal(url.hostname, 'api.platform.censys.io');
  assert.equal(url.pathname, `/v3/global/asset/certificate/${FP}`);
  assert.equal(request.init.method, 'GET');
  assert.equal(request.init.headers.Authorization, 'Bearer test-pat');
  assert.equal(output.observationType, 'certificate_metadata');
  assert.equal(output.verdict, 'observed');
  assert.equal(output.attributes.sha256, FP);
  assert.deepEqual(output.attributes.names, ['example.com']);
  assert.equal(output.attributes.subject, 'CN=example.com');
  assert.equal(output.attributes.issuer, 'CN=Example Issuer');
});

test('Censys certificate 404 is neutral absence', async () => {
  const output = await censysProvider.run(INPUT, {
    env: { CENSYS_PAT: 'test-pat' },
    fetchImpl: async () => json({ detail: 'not found' }, 404),
  });
  assert.equal(output.observationType, 'certificate_metadata');
  assert.equal(output.verdict, 'no_result');
  assert.equal(output.attributes.sha256, FP);
  assert.deepEqual(output.relationships, []);
});

test('Censys certificate successful schema drift and fingerprint conflicts fail closed', async () => {
  for (const body of [
    { result: {} },
    { result: { resource: { fingerprint_sha256: 'b'.repeat(64), names: ['example.com'] } } },
    { result: { resource: { fingerprint_sha256: FP, names: 'example.com' } } },
    { result: { resource: {} } },
  ]) {
    await assert.rejects(
      () => censysProvider.run(INPUT, { env: { CENSYS_PAT: 'test-pat' }, fetchImpl: async () => json(body) }),
      /provider_schema_invalid/,
    );
  }
});

test('Censys certificate response cap is enforced before parsing', async () => {
  await assert.rejects(
    () => censysProvider.run(INPUT, { env: { CENSYS_PAT: 'test-pat' }, fetchImpl: async () => oversized() }),
    /provider response too large/,
  );
});

test('VirusTotal certificate lookup uses ssl_certs and returns contextual metadata', async () => {
  let request;
  const output = await virustotalProvider.run(INPUT, {
    env: { VIRUSTOTAL_API_KEY: 'test-key' },
    fetchImpl: async (url, init) => {
      request = { url: String(url), init };
      return json({ data: {
        id: FP,
        type: 'ssl_cert',
        attributes: {
          thumbprint_sha256: FP,
          subject: { CN: 'example.com' },
          issuer: { CN: 'Example Issuer' },
          extensions: { subject_alternative_name: ['example.com', 'www.example.com'] },
          validity: { not_before: '2026-01-01T00:00:00Z', not_after: '2027-01-01T00:00:00Z' },
        },
      } });
    },
  });
  const url = new URL(request.url);
  assert.equal(url.hostname, 'www.virustotal.com');
  assert.equal(url.pathname, `/api/v3/ssl_certs/${FP}`);
  assert.equal(request.init.method, 'GET');
  assert.equal(request.init.headers['x-apikey'], 'test-key');
  assert.equal(output.observationType, 'certificate_metadata');
  assert.equal(output.verdict, 'observed');
  assert.equal(output.attributes.sha256, FP);
  assert.deepEqual(output.attributes.names, ['example.com', 'www.example.com']);
});

test('VirusTotal certificate 404 is neutral absence', async () => {
  const output = await virustotalProvider.run(INPUT, {
    env: { VIRUSTOTAL_API_KEY: 'test-key' },
    fetchImpl: async () => json({ error: { code: 'NotFoundError', message: 'not found' } }, 404),
  });
  assert.equal(output.observationType, 'certificate_metadata');
  assert.equal(output.verdict, 'no_result');
  assert.equal(output.attributes.sha256, FP);
  assert.deepEqual(output.relationships, []);
});

test('VirusTotal certificate successful schema drift and fingerprint conflicts fail closed', async () => {
  for (const body of [
    {},
    { data: [] },
    { data: { id: FP, type: 'file', attributes: {} } },
    { data: { id: 'b'.repeat(64), type: 'ssl_cert', attributes: {} } },
    { data: { id: FP, type: 'ssl_cert' } },
  ]) {
    await assert.rejects(
      () => virustotalProvider.run(INPUT, { env: { VIRUSTOTAL_API_KEY: 'test-key' }, fetchImpl: async () => json(body) }),
      /provider_schema_invalid/,
    );
  }
});

test('VirusTotal certificate response cap is enforced before parsing', async () => {
  await assert.rejects(
    () => virustotalProvider.run(INPUT, { env: { VIRUSTOTAL_API_KEY: 'test-key' }, fetchImpl: async () => oversized() }),
    /provider response too large/,
  );
});
