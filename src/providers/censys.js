import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';

export const censysProvider = Object.freeze({
  name: 'censys', types: ['ip'], requiredEnv: 'CENSYS_PAT', cacheTtlMs: 86400000, negativeCacheTtlMs: 21600000, costClass: 'scarce', timeoutMs: 7000, parserVersion: 'v3-2026-08-22.1',
  async run(input, context = {}) {
    const token = requireEnv(context, 'CENSYS_PAT');
    const url = `https://api.platform.censys.io/v3/global/asset/host/${encodeURIComponent(input.value)}`;
    let raw;
    try {
      raw = await fetchJson(url, { ...context, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.censys.api.v3.host.v1+json' }, maxBytes: 3_000_000 });
    } catch (error) {
      if (error?.status === 404) {
        return { observationType: 'internet_exposure', verdict: 'no_result', attributes: { ip: input.value, asn: null, organization: null, country: null, services: [], serviceCount: 0 }, relationships: [], references: [`https://search.censys.io/hosts/${encodeURIComponent(input.value)}`] };
      }
      throw error;
    }
    const d = raw?.result?.resource ?? raw?.result ?? {};
    const asn = d?.autonomous_system?.asn;
    const services = Array.isArray(d?.services) ? d.services : [];
    return { observationType: 'internet_exposure', verdict: 'observed', attributes: { ip: d?.ip ?? input.value, asn: asn != null ? `AS${asn}` : null, organization: d?.autonomous_system?.name ?? null, country: d?.location?.country ?? d?.location?.country_code ?? null, services: services.slice(0, 100).map(s => ({ port: s?.port ?? null, service: s?.service_name ?? s?.service?.name ?? null })), serviceCount: services.length }, relationships: compact([relation('asn', asn != null ? `AS${asn}` : null, 'asn')]), references: [`https://search.censys.io/hosts/${encodeURIComponent(input.value)}`] };
  },
});
