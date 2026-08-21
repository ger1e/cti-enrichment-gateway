import { fetchJson } from '../core/fetch-json.js';
import { arr, hashKind, uniq } from './helpers.js';

const MAX_RECORDS = 20;
const MAX_VALUES = 50;

function asIso(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function dateBound(records, field, latest = false) {
  const values = records.map(row => asIso(row?.[field])).filter(Boolean).sort();
  return latest ? values.at(-1) ?? null : values[0] ?? null;
}

function boundedStrings(values, limit = MAX_VALUES) {
  return uniq(values).slice(0, limit);
}

export const tweetfeedProvider = Object.freeze({
  name: 'tweetfeed',
  types: ['ip', 'domain', 'url', 'hash'],
  cacheTtlMs: 30 * 60 * 1000,
  negativeCacheTtlMs: 15 * 60 * 1000,
  costClass: 'free',
  timeoutMs: 5000,
  parserVersion: '2026-08-21',
  async run(input, context = {}) {
    if (input.type === 'hash' && hashKind(input.value) === 'sha1') {
      return {
        observationType: 'community_ioc_report',
        verdict: 'no_result',
        attributes: {
          supported: false,
          reason: 'tweetfeed_documented_hash_types_are_md5_sha256',
          communityReported: true,
          autoBlock: false,
        },
        relationships: [],
        references: ['https://tweetfeed.live/api/'],
      };
    }

    const url = `https://api.tweetfeed.live/v1/ioc?value=${encodeURIComponent(input.value)}`;
    const raw = await fetchJson(url, { ...context, maxBytes: 2_000_000 });
    const records = arr(raw?.records).slice(0, MAX_RECORDS);
    const found = raw?.found === true && records.length > 0;
    const reporters = boundedStrings(records.flatMap(row => arr(row?.users)));
    const tags = boundedStrings(records.flatMap(row => arr(row?.tags)));
    const tweets = boundedStrings(records.flatMap(row => arr(row?.tweets)), 20);
    const reportCount = records.reduce((sum, row) => sum + Math.max(0, Number(row?.count) || 0), 0);

    return {
      observationType: 'community_ioc_report',
      verdict: found ? 'observed' : 'not_listed',
      firstSeen: dateBound(records, 'first_seen'),
      lastSeen: dateBound(records, 'last_seen', true),
      tags,
      attributes: {
        query: raw?.query ?? input.value,
        window: raw?.window ?? '365d',
        recordCount: records.length,
        reportCount,
        reporters,
        communityReported: true,
        autoBlock: false,
      },
      relationships: [],
      references: boundedStrings([url, ...tweets], 20),
    };
  },
});
