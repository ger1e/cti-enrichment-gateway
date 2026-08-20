import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';
export const abuseipdbProvider = Object.freeze({
  name: 'abuseipdb', types: ['ip'], requiredEnv: 'ABUSEIPDB_API_KEY', cacheTtlMs: 21600000, negativeCacheTtlMs: 3600000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const key = requireEnv(context, 'ABUSEIPDB_API_KEY'); const url = `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(input.value)}&maxAgeInDays=90`;
    const raw = await fetchJson(url, { ...context, headers: { Key: key, Accept: 'application/json' } }); const d = raw?.data ?? {};
    const score = Number(d.abuseConfidenceScore); const verdict = score >= 75 ? 'malicious' : score >= 25 ? 'suspicious' : Number.isFinite(score) ? 'low_reported_abuse' : 'unknown';
    return { observationType: 'reported_abuse', verdict, confidence: Number.isFinite(score) ? score : null, lastSeen: d.lastReportedAt ?? null, attributes: { ip: d.ipAddress ?? input.value, country: d.countryCode ?? null, organization: d.isp ?? null, domain: d.domain ?? null, usageType: d.usageType ?? null, totalReports: d.totalReports ?? null, abuseConfidenceScore: d.abuseConfidenceScore ?? null }, relationships: compact([relation('domain', d.domain, 'reported_domain')]), references: [`https://www.abuseipdb.com/check/${encodeURIComponent(input.value)}`] };
  },
});
