import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';
export const ipinfoProvider = Object.freeze({
  name: 'ipinfo', types: ['ip'], requiredEnv: 'IPINFO_TOKEN', cacheTtlMs: 7 * 86400000, negativeCacheTtlMs: 3600000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const token = requireEnv(context, 'IPINFO_TOKEN');
    const url = `https://api.ipinfo.io/lite/${encodeURIComponent(input.value)}?token=${encodeURIComponent(token)}`;
    const raw = await fetchJson(url, context);
    return { observationType: 'network_identity', verdict: 'unknown', attributes: { ip: raw?.ip ?? input.value, asn: raw?.asn ?? null, organization: raw?.as_name ?? null, domain: raw?.as_domain ?? null, country: raw?.country_code ?? null, continent: raw?.continent_code ?? null }, relationships: compact([relation('asn', raw?.asn, 'announced_by'), relation('domain', raw?.as_domain, 'organization_domain')]), references: ['https://ipinfo.io/products/ipinfo-lite'] };
  },
});
