import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';

function noResult(input) {
  return {
    observationType: 'network_identity',
    verdict: 'no_result',
    attributes: { ip: input.value, asn: null, organization: null, domain: null, country: null, continent: null },
    relationships: [],
    references: ['https://ipinfo.io/products/ipinfo-lite'],
  };
}

export const ipinfoProvider = Object.freeze({
  name: 'ipinfo', types: ['ip'], requiredEnv: 'IPINFO_TOKEN', cacheTtlMs: 7 * 86400000, negativeCacheTtlMs: 3600000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-22.1',
  async run(input, context = {}) {
    const token = requireEnv(context, 'IPINFO_TOKEN');
    const url = `https://api.ipinfo.io/lite/${encodeURIComponent(input.value)}`;
    let raw;
    try {
      raw = await fetchJson(url, { ...context, headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      if (error?.status === 404) return noResult(input);
      throw error;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !raw.ip) return noResult(input);
    return {
      observationType: 'network_identity',
      verdict: 'unknown',
      attributes: {
        ip: raw.ip,
        asn: raw?.asn ?? null,
        organization: raw?.as_name ?? null,
        domain: raw?.as_domain ?? null,
        country: raw?.country_code ?? null,
        continent: raw?.continent_code ?? null,
      },
      relationships: compact([
        relation('asn', raw?.asn, 'announced_by'),
        relation('domain', raw?.as_domain, 'organization_domain'),
      ]),
      references: ['https://ipinfo.io/products/ipinfo-lite'],
    };
  },
});
