import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';

function certificateFingerprint(value) {
  return typeof value === 'string' && /^cert-sha256:[a-f0-9]{64}$/.test(value)
    ? value.slice('cert-sha256:'.length)
    : null;
}

function schemaInvalid() {
  throw new Error('provider_schema_invalid');
}

function certificateResult(input, raw) {
  const requested = certificateFingerprint(input.value);
  if (!requested) throw Object.assign(new Error('unsupported indicator type'), { status: 400 });
  const resource = raw?.result?.resource;
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) schemaInvalid();

  const returned = resource.fingerprint_sha256 ?? resource.sha256 ?? resource.fingerprint?.sha256 ?? null;
  if (returned != null && (typeof returned !== 'string' || returned.toLowerCase() !== requested)) schemaInvalid();
  if (resource.names != null && !Array.isArray(resource.names)) schemaInvalid();

  const names = Array.isArray(resource.names)
    ? resource.names.filter(value => typeof value === 'string' && value.length > 0).slice(0, 100)
    : [];
  const subject = typeof resource.subject_dn === 'string' ? resource.subject_dn : null;
  const issuer = typeof resource.issuer_dn === 'string' ? resource.issuer_dn : null;
  const validity = resource.validity && typeof resource.validity === 'object' && !Array.isArray(resource.validity)
    ? {
        notBefore: resource.validity.start ?? resource.validity.not_before ?? null,
        notAfter: resource.validity.end ?? resource.validity.not_after ?? null,
      }
    : null;
  if (!returned && names.length === 0 && !subject && !issuer && !validity) schemaInvalid();

  return {
    observationType: 'certificate_metadata',
    verdict: 'observed',
    attributes: { sha256: requested, names, subject, issuer, validity },
    relationships: names.map(name => relation('domain', name, 'certificate_name')).filter(Boolean),
    references: [`https://search.censys.io/certificates/${requested}`],
  };
}

export const censysProvider = Object.freeze({
  name: 'censys', types: ['ip', 'certificate'], requiredEnv: 'CENSYS_PAT', cacheTtlMs: 86400000, negativeCacheTtlMs: 21600000, costClass: 'scarce', timeoutMs: 7000, parserVersion: 'v3-2026-08-29.1',
  async run(input, context = {}) {
    const token = requireEnv(context, 'CENSYS_PAT');
    if (input.type === 'certificate') {
      const fingerprint = certificateFingerprint(input.value);
      if (!fingerprint) throw Object.assign(new Error('unsupported indicator type'), { status: 400 });
      let raw;
      try {
        raw = await fetchJson(`https://api.platform.censys.io/v3/global/asset/certificate/${fingerprint}`, {
          ...context,
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.censys.api.v3.certificate.v1+json' },
          maxBytes: 3_000_000,
        });
      } catch (error) {
        if (error?.status === 404) {
          return { observationType: 'certificate_metadata', verdict: 'no_result', attributes: { sha256: fingerprint, names: [], subject: null, issuer: null, validity: null }, relationships: [], references: [`https://search.censys.io/certificates/${fingerprint}`] };
        }
        throw error;
      }
      return certificateResult(input, raw);
    }

    if (input.type !== 'ip') throw Object.assign(new Error('unsupported indicator type'), { status: 400 });
    const url = `https://api.platform.censys.io/v3/global/asset/host/${encodeURIComponent(input.value)}`;
    let raw;
    try {
      raw = await fetchJson(url, { ...context, method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.censys.api.v3.host.v1+json' }, maxBytes: 3_000_000 });
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
