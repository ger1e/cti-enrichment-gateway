import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';
export const cloudflareRadarProvider = Object.freeze({
  name: 'cloudflare-radar', types: ['ip'], requiredEnv: 'CLOUDFLARE_RADAR_TOKEN', cacheTtlMs: 86400000, negativeCacheTtlMs: 21600000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const token = requireEnv(context, 'CLOUDFLARE_RADAR_TOKEN'); const url = `https://api.cloudflare.com/client/v4/radar/entities/ip?ip=${encodeURIComponent(input.value)}`;
    const raw = await fetchJson(url, { ...context, headers: { Authorization: `Bearer ${token}` } }); const d = raw?.result ?? {}; const asn = d?.asn ?? d?.asnNumber ?? null;
    const asnValue = asn != null ? `AS${String(asn).replace(/^AS/i, '')}` : null;
    return { observationType: 'network_identity', verdict: 'unknown', attributes: { ip: d?.ip ?? input.value, asn: asnValue, organization: d?.asName ?? d?.asnName ?? null, country: d?.country ?? d?.countryCode ?? null }, relationships: compact([relation('asn', asnValue, 'asn')]), references: ['https://radar.cloudflare.com/'] };
  },
});
