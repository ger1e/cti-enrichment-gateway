import net from 'node:net';
import { fetchJson } from '../core/fetch-json.js';

const SOURCE_URL = 'https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/';

function schemaInvalid() {
  throw new Error('provider_schema_invalid');
}

function result({ status, authenticatedData, addresses }) {
  return {
    observationType: 'dns_resolution',
    verdict: addresses.length > 0 ? 'observed' : 'no_result',
    attributes: {
      status,
      authenticatedData,
      addresses,
    },
    relationships: addresses.map(address => ({ type: 'resolves_to', target: address, targetType: 'ip' })),
    references: [SOURCE_URL],
  };
}

export const cloudflareDnsProvider = Object.freeze({
  name: 'cloudflare-dns',
  types: ['domain'],
  cacheTtlMs: 300_000,
  negativeCacheTtlMs: 60_000,
  costClass: 'free',
  timeoutMs: 5_000,
  parserVersion: '2026-08-29.1',
  async run(input, context = {}) {
    if (input?.type !== 'domain') throw Object.assign(new Error('unsupported indicator type'), { status: 400 });

    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(input.value)}&type=A`;
    const raw = await fetchJson(url, {
      ...context,
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
      maxBytes: 1_000_000,
    });

    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Number.isInteger(raw.Status)) schemaInvalid();
    if (raw.Answer != null && !Array.isArray(raw.Answer)) schemaInvalid();

    if (raw.Status !== 0) {
      return result({ status: raw.Status, authenticatedData: raw.AD === true, addresses: [] });
    }

    const addresses = [];
    const seen = new Set();
    for (const answer of raw.Answer ?? []) {
      if (!answer || typeof answer !== 'object' || Array.isArray(answer) || answer.type !== 1 || typeof answer.data !== 'string') continue;
      const address = answer.data.trim();
      if (net.isIP(address) !== 4 || seen.has(address)) continue;
      seen.add(address);
      addresses.push(address);
      if (addresses.length >= 100) break;
    }

    return result({ status: raw.Status, authenticatedData: raw.AD === true, addresses });
  },
});
