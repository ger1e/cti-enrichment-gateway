import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv, uniq } from './helpers.js';

const MAX_VICTIMS = 30;

function hostname(value) {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

function queryHost(input) {
  if (input.type === 'url') {
    try { return new URL(input.value).hostname.replace(/^www\./, '').toLowerCase(); }
    catch { return null; }
  }
  return hostname(input.value);
}

function asIso(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function dateBound(victims, latest = false) {
  const values = victims
    .flatMap(victim => [asIso(victim?.attackdate), asIso(victim?.discovered)])
    .filter(Boolean)
    .sort();
  return latest ? values.at(-1) ?? null : values[0] ?? null;
}

function victimRows(raw) {
  if (Array.isArray(raw)) return raw;
  for (const key of ['victims', 'results', 'data']) {
    if (Array.isArray(raw?.[key])) return raw[key];
  }
  throw Object.assign(new Error('ransomware_live_invalid_response'), { status: 502 });
}

export const ransomwareLiveProvider = Object.freeze({
  name: 'ransomware-live',
  types: ['domain', 'url'],
  requiredEnv: 'RANSOMWARE_LIVE_API_KEY',
  cacheTtlMs: 60 * 60 * 1000,
  negativeCacheTtlMs: 30 * 60 * 1000,
  costClass: 'quota',
  timeoutMs: 5000,
  parserVersion: '2026-08-21.2',
  async run(input, context = {}) {
    const key = requireEnv(context, 'RANSOMWARE_LIVE_API_KEY');
    const host = queryHost(input);
    if (!host) {
      return {
        observationType: 'ransomware_victim_claim',
        verdict: 'no_result',
        attributes: { reason: 'no_queryable_domain', adversaryClaims: true, confirmedCompromise: false },
        relationships: [],
        references: ['https://www.ransomware.live/api'],
      };
    }

    const url = `https://api-pro.ransomware.live/victims/search?q=${encodeURIComponent(host)}`;
    const raw = await fetchJson(url, {
      ...context,
      headers: { 'X-API-KEY': key },
      maxBytes: 4_000_000,
    });
    const rows = victimRows(raw);
    const matches = rows.filter(victim => hostname(victim?.website) === host).slice(0, MAX_VICTIMS);
    const groups = uniq(matches.map(victim => victim?.group).filter(Boolean)).slice(0, 30);

    return {
      observationType: 'ransomware_victim_claim',
      verdict: matches.length ? 'observed' : 'not_listed',
      firstSeen: dateBound(matches),
      lastSeen: dateBound(matches, true),
      tags: matches.length ? ['ransomware', 'adversary-claim'] : [],
      attributes: {
        queryHost: host,
        claimCount: matches.length,
        adversaryClaims: true,
        confirmedCompromise: false,
        groups,
        claims: matches.slice(0, 20).map(victim => ({
          id: victim?.id ?? null,
          victim: victim?.victim ?? null,
          group: victim?.group ?? null,
          country: victim?.country ?? null,
          sector: victim?.sector ?? null,
          website: victim?.website ?? null,
          attackdate: victim?.attackdate ?? null,
          discovered: victim?.discovered ?? null,
          permalink: victim?.permalink ?? null,
        })),
      },
      relationships: compact(groups.map(group => relation('ransomware_group', group, 'claiming_group'))),
      references: uniq([
        url,
        ...matches.map(victim => victim?.permalink).filter(value => typeof value === 'string' && /^https:\/\//i.test(value)),
      ]).slice(0, 20),
    };
  },
});
