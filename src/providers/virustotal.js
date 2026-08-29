import { fetchJson } from '../core/fetch-json.js';
import { compact, isoFromUnix, requireEnv, vtVerdict } from './helpers.js';

const COVERAGE_OBSERVATION_TYPES = Object.freeze({
  ip: Object.freeze(['multi_engine_reputation']),
  domain: Object.freeze(['multi_engine_reputation']),
  url: Object.freeze(['multi_engine_reputation']),
  hash: Object.freeze(['multi_engine_reputation']),
  certificate: Object.freeze(['certificate_metadata']),
});

function certificateFingerprint(value) {
  return typeof value === 'string' && /^cert-sha256:[a-f0-9]{64}$/.test(value)
    ? value.slice('cert-sha256:'.length)
    : null;
}

function vtPath(input) {
  if (input.type === 'ip') return `ip_addresses/${encodeURIComponent(input.value)}`;
  if (input.type === 'domain') return `domains/${encodeURIComponent(input.value)}`;
  if (input.type === 'hash') return `files/${encodeURIComponent(input.value)}`;
  if (input.type === 'url') return `urls/${Buffer.from(input.value).toString('base64url').replace(/=+$/, '')}`;
  if (input.type === 'certificate') {
    const fingerprint = certificateFingerprint(input.value);
    if (fingerprint) return `ssl_certs/${fingerprint}`;
  }
  throw Object.assign(new Error('unsupported indicator type'), { status: 400 });
}

function noResult(input) {
  if (input?.type === 'certificate') {
    const fingerprint = certificateFingerprint(input.value);
    return {
      observationType: 'certificate_metadata',
      verdict: 'no_result',
      lastSeen: null,
      tags: [],
      attributes: { sha256: fingerprint, names: [], subject: null, issuer: null, validity: null },
      relationships: [],
      references: ['https://www.virustotal.com/gui/home/search'],
    };
  }
  return {
    observationType: 'multi_engine_reputation',
    verdict: 'no_result',
    lastSeen: null,
    tags: [],
    attributes: {
      reputation: null,
      lastAnalysisStats: {},
      typeDescription: null,
      meaningfulName: null,
    },
    relationships: [],
    references: ['https://www.virustotal.com/gui/home/search'],
  };
}

function schemaInvalid() {
  throw new Error('provider_schema_invalid');
}

function certificateResult(input, raw) {
  const requested = certificateFingerprint(input.value);
  if (!requested) throw Object.assign(new Error('unsupported indicator type'), { status: 400 });
  const data = raw?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) schemaInvalid();
  if (data.type != null && data.type !== 'ssl_cert') schemaInvalid();
  const attributes = data.attributes;
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) schemaInvalid();

  for (const returned of [data.id, attributes.thumbprint_sha256, attributes.sha256, attributes.fingerprint_sha256]) {
    if (returned != null && (typeof returned !== 'string' || returned.toLowerCase() !== requested)) schemaInvalid();
  }

  const san = attributes.extensions?.subject_alternative_name ?? attributes.subject_alternative_name ?? [];
  if (san != null && !Array.isArray(san)) schemaInvalid();
  const names = Array.isArray(san) ? san.filter(value => typeof value === 'string' && value.length > 0).slice(0, 100) : [];
  const subject = attributes.subject && typeof attributes.subject === 'object' && !Array.isArray(attributes.subject)
    ? attributes.subject.CN ?? attributes.subject.common_name ?? null
    : null;
  const issuer = attributes.issuer && typeof attributes.issuer === 'object' && !Array.isArray(attributes.issuer)
    ? attributes.issuer.CN ?? attributes.issuer.common_name ?? null
    : null;
  const validity = attributes.validity && typeof attributes.validity === 'object' && !Array.isArray(attributes.validity)
    ? { notBefore: attributes.validity.not_before ?? null, notAfter: attributes.validity.not_after ?? null }
    : null;

  return {
    observationType: 'certificate_metadata',
    verdict: 'observed',
    lastSeen: null,
    tags: [],
    attributes: { sha256: requested, names, subject, issuer, validity },
    relationships: [],
    references: ['https://www.virustotal.com/gui/home/search'],
  };
}

export const virustotalProvider = Object.freeze({
  name: 'virustotal', types: ['ip', 'domain', 'url', 'hash', 'certificate'], requiredEnv: 'VIRUSTOTAL_API_KEY', cacheTtlMs: 21600000, negativeCacheTtlMs: 3600000, costClass: 'scarce', timeoutMs: 7000, parserVersion: 'v3-2026-08-29.1',
  coverageObservationTypesByType: COVERAGE_OBSERVATION_TYPES,
  async run(input, context = {}) {
    const key = requireEnv(context, 'VIRUSTOTAL_API_KEY');
    let raw;
    try {
      raw = await fetchJson(`https://www.virustotal.com/api/v3/${vtPath(input)}`, {
        ...context,
        method: 'GET',
        headers: { 'x-apikey': key },
        maxBytes: 3_000_000,
      });
    } catch (error) {
      if (error?.status === 404) return noResult(input);
      throw error;
    }
    if (input.type === 'certificate') return certificateResult(input, raw);
    const a = raw?.data?.attributes ?? {};
    const stats = a.last_analysis_stats ?? {};
    return {
      observationType: 'multi_engine_reputation',
      verdict: vtVerdict(stats),
      lastSeen: isoFromUnix(a.last_analysis_date),
      tags: compact(a.tags),
      attributes: {
        reputation: a.reputation ?? null,
        lastAnalysisStats: stats,
        typeDescription: a.type_description ?? null,
        meaningfulName: a.meaningful_name ?? null,
      },
      relationships: [],
      references: ['https://www.virustotal.com/gui/home/search'],
    };
  },
});
