import { fetchJson } from '../core/fetch-json.js';
import { compact, hashKind, relation, requireEnv } from './helpers.js';
export const malpediaProvider = Object.freeze({
  name: 'malpedia', types: ['hash'], requiredEnv: 'MALPEDIA_API_TOKEN', cacheTtlMs: 86400000, negativeCacheTtlMs: 3600000, costClass: 'free', timeoutMs: 7000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const kind = hashKind(input.value); if (!['md5', 'sha256'].includes(kind)) return { observationType: 'malware_knowledge', verdict: 'unsupported_hash_algorithm', attributes: { hashAlgorithm: kind }, relationships: [], references: ['https://malpedia.caad.fkie.fraunhofer.de/usage/api'] };
    const token = requireEnv(context, 'MALPEDIA_API_TOKEN'); const raw = await fetchJson(`https://malpedia.caad.fkie.fraunhofer.de/api/get/sample/${encodeURIComponent(input.value)}/info`, { ...context, headers: { Authorization: `apitoken ${token}` }, maxBytes: 2_000_000 });
    const family = raw?.family ?? raw?.family_name ?? (Array.isArray(raw?.families) ? raw.families[0] : null);
    return { observationType: 'malware_knowledge', verdict: raw ? 'known_sample' : 'no_result', malwareFamily: family ?? null, tags: compact(raw?.tags), attributes: { family: family ?? null }, relationships: compact([relation('hash', raw?.md5, 'same_sample_md5'), relation('hash', raw?.sha256, 'same_sample_sha256'), relation('malware', family, 'family')]), references: ['https://malpedia.caad.fkie.fraunhofer.de/'] };
  },
});
