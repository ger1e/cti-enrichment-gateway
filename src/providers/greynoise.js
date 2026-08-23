import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';

export const greynoiseProvider = Object.freeze({
  name: 'greynoise', types: ['ip'], requiredEnv: 'GREYNOISE_API_KEY', cacheTtlMs: 86400000, negativeCacheTtlMs: 21600000, costClass: 'scarce', timeoutMs: 5000, parserVersion: '2026-08-22.1',
  async run(input, context = {}) {
    const key = requireEnv(context, 'GREYNOISE_API_KEY');
    const url = `https://api.greynoise.io/v3/community/${encodeURIComponent(input.value)}`;
    let raw;
    try {
      raw = await fetchJson(url, { ...context, headers: { key } });
    } catch (error) {
      if (error?.status === 404) {
        return {
          observationType: 'internet_noise',
          verdict: 'no_result',
          attributes: { ip: input.value, name: null, noise: false, riot: false, classification: null },
          relationships: [],
          references: ['https://docs.greynoise.io/reference/getcommunityip'],
        };
      }
      throw error;
    }
    const verdict = raw?.classification === 'malicious' ? 'malicious' : raw?.classification === 'benign' ? 'benign' : raw?.noise ? 'internet_noise' : 'unknown';
    return {
      observationType: 'internet_noise',
      verdict,
      lastSeen: raw?.last_seen ?? null,
      tags: compact([raw?.classification, raw?.riot ? 'riot' : null, raw?.noise ? 'noise' : null]),
      attributes: {
        ip: raw?.ip ?? input.value,
        name: raw?.name ?? null,
        noise: Boolean(raw?.noise),
        riot: Boolean(raw?.riot),
        classification: raw?.classification ?? null,
      },
      relationships: compact([relation('url', raw?.link, 'greynoise_profile')]),
      references: compact([raw?.link, 'https://docs.greynoise.io/reference/getcommunityip']),
    };
  },
});
