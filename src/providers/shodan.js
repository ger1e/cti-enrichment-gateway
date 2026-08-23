import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';

function noResult(input) {
  return {
    observationType: 'internet_exposure',
    verdict: 'no_result',
    attributes: {
      ip: input.value,
      asn: null,
      organization: null,
      country: null,
      hostnames: [],
      ports: [],
      serviceCount: 0,
    },
    relationships: [],
    references: [`https://www.shodan.io/host/${encodeURIComponent(input.value)}`],
  };
}

export const shodanProvider = Object.freeze({
  name: 'shodan', types: ['ip'], requiredEnv: 'SHODAN_API_KEY', cacheTtlMs: 86400000, negativeCacheTtlMs: 21600000, costClass: 'scarce', timeoutMs: 7000, parserVersion: '2026-08-22.1',
  async run(input, context = {}) {
    const key = requireEnv(context, 'SHODAN_API_KEY');
    const url = `https://api.shodan.io/shodan/host/${encodeURIComponent(input.value)}?key=${encodeURIComponent(key)}&minify=false`;
    let raw;
    try {
      raw = await fetchJson(url, { ...context, maxBytes: 3_000_000 });
    } catch (error) {
      if (error?.status === 404) return noResult(input);
      throw error;
    }
    const hosts = Array.isArray(raw?.hostnames) ? raw.hostnames : [];
    const rels = hosts.map(x => relation('domain', x, 'hostname'));
    if (raw?.asn) rels.push(relation('asn', raw.asn, 'asn'));
    return {
      observationType: 'internet_exposure',
      verdict: 'observed',
      lastSeen: raw?.last_update ?? null,
      tags: compact(raw?.tags),
      attributes: {
        ip: raw?.ip_str ?? input.value,
        asn: raw?.asn ?? null,
        organization: raw?.org ?? null,
        country: raw?.country_code ?? null,
        hostnames: hosts,
        ports: Array.isArray(raw?.ports) ? raw.ports : [],
        serviceCount: Array.isArray(raw?.data) ? raw.data.length : 0,
      },
      relationships: compact(rels),
      references: [`https://www.shodan.io/host/${encodeURIComponent(input.value)}`],
    };
  },
});
