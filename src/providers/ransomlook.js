import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, uniq } from './helpers.js';

const MAX_POSTS = 30;

function pivot(input) {
  if (input.type !== 'url') return input.value;
  try { return new URL(input.value).hostname.toLowerCase(); }
  catch { return input.value; }
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

function dateBound(posts, latest = false) {
  const values = posts.map(post => asIso(post?.discovered)).filter(Boolean).sort();
  return latest ? values.at(-1) ?? null : values[0] ?? null;
}

function postRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.posts)) return raw.posts;
  throw Object.assign(new Error('ransomlook_invalid_response'), { status: 502 });
}

export const ransomlookProvider = Object.freeze({
  name: 'ransomlook',
  types: ['ip', 'domain', 'url', 'hash'],
  cacheTtlMs: 60 * 60 * 1000,
  negativeCacheTtlMs: 30 * 60 * 1000,
  costClass: 'free',
  timeoutMs: 5000,
  parserVersion: '2026-08-22.1',
  async run(input, context = {}) {
    const query = pivot(input);
    const url = `https://www.ransomlook.io/api/search?q=${encodeURIComponent(query)}`;
    const raw = await fetchJson(url, { ...context, maxBytes: 4_000_000 });
    const posts = postRows(raw).slice(0, MAX_POSTS);
    const groups = uniq(posts.map(post => post?.group_name).filter(Boolean)).slice(0, 30);

    return {
      observationType: 'ransomware_post_reference',
      verdict: posts.length ? 'observed' : 'not_listed',
      firstSeen: dateBound(posts),
      lastSeen: dateBound(posts, true),
      tags: posts.length ? ['ransomware', 'adversary-claim'] : [],
      attributes: {
        query,
        postCount: posts.length,
        adversaryClaims: true,
        confirmedCompromise: false,
        groups,
        posts: posts.slice(0, 20).map(post => ({
          group: post?.group_name ?? null,
          title: post?.post_title ?? null,
          discovered: post?.discovered ?? null,
        })),
      },
      relationships: compact(groups.map(group => relation('ransomware_group', group, 'claiming_group'))),
      references: [url],
    };
  },
});
