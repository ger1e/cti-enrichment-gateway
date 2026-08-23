import { fetchJson } from '../core/fetch-json.js';
import { compact, hashKind, relation } from './helpers.js';

export const circlHashlookupProvider = Object.freeze({
  name: 'circl-hashlookup', types: ['hash'], cacheTtlMs: 30 * 86400000, negativeCacheTtlMs: 86400000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-22.1',
  async run(input, context = {}) {
    const kind = hashKind(input.value);
    if (!kind) throw Object.assign(new Error('unsupported hash'), { status: 400 });
    const url = `https://hashlookup.circl.lu/lookup/${kind}/${encodeURIComponent(input.value)}`;
    let raw;
    try {
      raw = await fetchJson(url, { ...context, maxBytes: 1_000_000 });
    } catch (error) {
      if (error?.status === 404) {
        return { observationType: 'known_file_lookup', verdict: 'no_result', attributes: { fileName: null, source: null }, relationships: [], references: ['https://hashlookup.circl.lu/'] };
      }
      throw error;
    }
    return {
      observationType: 'known_file_lookup',
      verdict: raw ? 'known' : 'no_result',
      attributes: { fileName: raw?.FileName ?? raw?.FileNames ?? null, source: raw?.source ?? null },
      relationships: compact([
        relation('hash', raw?.MD5, 'same_file_md5'),
        relation('hash', raw?.['SHA-1'] ?? raw?.SHA1, 'same_file_sha1'),
        relation('hash', raw?.['SHA-256'] ?? raw?.SHA256, 'same_file_sha256'),
      ]),
      references: ['https://hashlookup.circl.lu/'],
    };
  },
});
