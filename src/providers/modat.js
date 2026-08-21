import { fetchJson } from '../core/fetch-json.js';
import { arr, compact, relation, requireEnv, uniq } from './helpers.js';

const API_ROOT = 'https://api.magnify.modat.io';
const MAX_RELATIONSHIPS = 250;
const MAX_VALUES = 100;

function bounded(values, limit = MAX_VALUES) {
  return uniq(values).slice(0, limit);
}

function asnValue(raw) {
  const value = raw?.asn;
  if (value && typeof value === 'object') {
    const number = value.number ?? value.asn ?? value.id;
    if (number !== undefined && number !== null && String(number).trim()) {
      const text = String(number).trim().toUpperCase();
      return text.startsWith('AS') ? text : `AS${text}`;
    }
  }
  if (value !== undefined && value !== null && String(value).trim()) {
    const text = String(value).trim().toUpperCase();
    return text.startsWith('AS') ? text : `AS${text}`;
  }
  const fallback = raw?.autonomous_system?.asn ?? raw?.autonomous_system?.number;
  if (fallback === undefined || fallback === null || !String(fallback).trim()) return null;
  const text = String(fallback).trim().toUpperCase();
  return text.startsWith('AS') ? text : `AS${text}`;
}

function asnOrganization(raw) {
  const value = raw?.asn;
  if (value && typeof value === 'object') return value.organization ?? value.name ?? null;
  return raw?.autonomous_system?.organization ?? raw?.autonomous_system?.name ?? null;
}

function hostnames(raw) {
  return bounded([
    ...arr(raw?.fqdns),
    ...arr(raw?.hostnames),
    ...arr(raw?.names),
  ]);
}

function serviceValues(raw) {
  const services = arr(raw?.services).slice(0, MAX_VALUES);
  const ports = bounded(services.map(item => item?.port).filter(value => Number.isInteger(Number(value))).map(Number));
  const tags = bounded(services.flatMap(item => arr(item?.tags)));
  const cves = bounded(services.flatMap(item => arr(item?.cves).map(cve => typeof cve === 'string' ? cve : cve?.id ?? cve?.cve)));
  return { services, ports, tags, cves };
}

function recordValues(records, names) {
  const groups = names.flatMap(name => arr(records?.[name] ?? records?.[name.toLowerCase()]));
  return groups.slice(0, MAX_VALUES).map(record => ({
    value: typeof record === 'string' ? record : record?.value ?? record?.address ?? record?.target ?? record?.exchange ?? null,
    firstSeen: typeof record === 'object' ? record?.first_seen ?? record?.firstSeen ?? null : null,
    lastSeen: typeof record === 'object' ? record?.last_seen ?? record?.lastSeen ?? null : null,
  })).filter(item => item.value !== null && item.value !== undefined && String(item.value).trim());
}

function latestTimestamp(values) {
  const timestamps = values
    .map(value => value?.lastSeen)
    .filter(Boolean)
    .map(value => Date.parse(value))
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

async function runIp(input, context, key) {
  const url = `${API_ROOT}/host/${encodeURIComponent(input.value)}/v1`;
  const raw = await fetchJson(url, {
    ...context,
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
    maxBytes: 4_000_000,
  });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Object.assign(new Error('invalid Modat host response'), { status: 502 });

  const names = hostnames(raw);
  const asn = asnValue(raw);
  const { services, ports, tags, cves } = serviceValues(raw);
  const relationships = compact([
    ...names.map(name => relation('domain', name, 'hostname')),
    asn ? relation('asn', asn, 'asn') : null,
  ]).slice(0, MAX_RELATIONSHIPS);

  return {
    observationType: 'internet_exposure',
    verdict: 'observed',
    lastSeen: raw?.last_seen ?? raw?.lastSeen ?? null,
    tags,
    attributes: {
      ip: raw?.ip ?? input.value,
      asn,
      organization: asnOrganization(raw),
      country: raw?.geo?.country_code ?? raw?.geo?.country ?? raw?.country_code ?? null,
      hostnames: names,
      ports,
      serviceCount: services.length,
      serviceTags: tags,
      cves,
    },
    relationships,
    references: ['https://api.magnify.modat.io/docs'],
  };
}

async function runDomain(input, context, key) {
  const url = `${API_ROOT}/dns/zones/${encodeURIComponent(input.value)}/v1`;
  const raw = await fetchJson(url, {
    ...context,
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
    maxBytes: 4_000_000,
  });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Object.assign(new Error('invalid Modat DNS response'), { status: 502 });

  const records = raw?.records && typeof raw.records === 'object' ? raw.records : {};
  const addresses = recordValues(records, ['A', 'AAAA']);
  const aliases = recordValues(records, ['CNAME']);
  const nameservers = recordValues(records, ['NS']);
  const mail = recordValues(records, ['MX']);
  const all = [...addresses, ...aliases, ...nameservers, ...mail];
  const relationships = compact([
    ...addresses.map(item => relation('ip', item.value, 'resolves_to')),
    ...aliases.map(item => relation('domain', item.value, 'cname')),
    ...nameservers.map(item => relation('domain', item.value, 'nameserver')),
    ...mail.map(item => relation('domain', item.value, 'mail_exchanger')),
  ]).slice(0, MAX_RELATIONSHIPS);

  return {
    observationType: 'passive_dns',
    verdict: 'observed',
    lastSeen: raw?.last_seen ?? raw?.lastSeen ?? latestTimestamp(all),
    tags: [],
    attributes: {
      fqdn: raw?.fqdn ?? input.value,
      recordTypes: Object.keys(records).filter(keyName => Array.isArray(records[keyName]) && records[keyName].length).slice(0, 20),
      addressCount: addresses.length,
      aliasCount: aliases.length,
      nameserverCount: nameservers.length,
      mailExchangerCount: mail.length,
    },
    relationships,
    references: ['https://api.magnify.modat.io/docs'],
  };
}

export const modatProvider = Object.freeze({
  name: 'modat',
  types: ['ip', 'domain'],
  requiredEnv: 'MODAT_API_KEY',
  cacheTtlMs: 21_600_000,
  negativeCacheTtlMs: 3_600_000,
  costClass: 'quota',
  timeoutMs: 7_000,
  parserVersion: '2026-08-21.1',
  async run(input, context = {}) {
    const key = requireEnv(context, 'MODAT_API_KEY');
    if (input?.type === 'ip') return runIp(input, context, key);
    if (input?.type === 'domain') return runDomain(input, context, key);
    throw Object.assign(new Error('unsupported Modat indicator type'), { status: 400 });
  },
});
