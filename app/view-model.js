const CONTEXT = new Set([
  'registration', 'routing', 'network_identity', 'internet_exposure',
  'scanner_activity', 'internet_noise', 'tor_exit', 'attack_knowledge',
]);
const CLAIM = new Set(['community_ioc_report', 'ransomware_post_reference', 'ransomware_victim_claim']);
const SKIPPED_FAILURES = new Set(['provider_call_budget_exhausted', 'request_deadline_exhausted', 'circuit_open']);

function labelize(value) {
  return String(value ?? 'unknown').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

function scalar(value) {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  if (typeof value === 'string') return value || '—';
  return null;
}

export function toFactRows(value, { limit = 24 } = {}) {
  const facts = [];
  const push = (label, item) => {
    if (facts.length >= limit) return;
    const simple = scalar(item);
    if (simple !== null) {
      facts.push({ label: labelize(label), value: simple });
      return;
    }
    if (Array.isArray(item)) {
      const simpleItems = item.map(scalar);
      if (simpleItems.every(entry => entry !== null)) {
        facts.push({ label: labelize(label), value: simpleItems.join(', ') || '—' });
        return;
      }
      item.forEach((entry, index) => push(`${label} ${index + 1}`, entry));
      return;
    }
    if (item && typeof item === 'object') {
      for (const [key, nested] of Object.entries(item)) push(label ? `${label} ${key}` : key, nested);
    }
  };

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) push(key, item);
  } else {
    push('value', value);
  }
  return facts;
}

function riskAxis(name, value) {
  if (value == null) return { display: 'UNAVAILABLE', facts: [] };
  if (name === 'kev' && typeof value?.listed === 'boolean') {
    return { display: value.listed ? 'LISTED' : 'NOT LISTED', facts: toFactRows(value) };
  }
  if (name === 'epss' && value?.score != null) return { display: String(value.score), facts: toFactRows(value) };
  if (name === 'cvss' && value?.score != null) return { display: String(value.score), facts: toFactRows(value) };
  const facts = toFactRows(value);
  return { display: facts[0]?.value ?? 'AVAILABLE', facts };
}

function normalizedCorrelationItem(item, index, kind) {
  const source = item && typeof item === 'object' ? item : { value: item };
  const providers = Array.isArray(source.providers) ? source.providers.filter(Boolean) : [];
  const title = providers.length
    ? `${providers.join(' + ')} // ${labelize(source.kind ?? kind)}`
    : `${kind.toUpperCase()} ${index + 1}`;
  return { title, facts: toFactRows(source) };
}

function failureCopy(reason, status) {
  if (reason === 'timeout') return { label: 'UPSTREAM TIMEOUT', summary: 'Upstream provider timed out before returning evidence.' };
  if (reason === 'http_error') return { label: `UPSTREAM HTTP ${status ?? 'ERROR'}`, summary: 'Upstream provider returned an HTTP error; no evidence was inferred from the failure.' };
  if (reason === 'provider_call_budget_exhausted') return { label: 'NOT RUN / CALL BUDGET', summary: 'Provider was not called because the bounded request call budget was exhausted.' };
  if (reason === 'request_deadline_exhausted') return { label: 'NOT RUN / DEADLINE', summary: 'Provider was not run because the bounded request deadline was exhausted.' };
  if (reason === 'circuit_open') return { label: 'NOT RUN / CIRCUIT OPEN', summary: 'Provider was skipped because its bounded circuit breaker is open after recent upstream failures.' };
  if (reason === 'rate_limited') return { label: 'UPSTREAM RATE LIMITED', summary: 'Upstream provider rejected the request due to rate limiting.' };
  if (reason === 'provider_transport_error') return { label: 'UPSTREAM TRANSPORT ERROR', summary: 'Provider transport failed before a usable evidence response was received.' };
  if (reason === 'provider_error') return { label: 'UPSTREAM PROVIDER ERROR', summary: 'Provider failed without producing usable evidence.' };
  return { label: labelize(reason), summary: 'Provider did not produce usable evidence; the failure remains explicit and is not treated as negative evidence.' };
}

function normalizeFailure(failure) {
  const source = failure && typeof failure === 'object' ? failure : { reason: String(failure ?? 'unknown') };
  const reason = source.reason ?? source.error ?? 'unknown';
  const status = source.status ?? null;
  const copy = failureCopy(reason, status);
  const state = SKIPPED_FAILURES.has(reason) ? 'skipped' : 'failed';
  const details = [];
  if (status != null) details.push({ label: 'HTTP STATUS', value: String(status) });
  if (source.attempts != null) details.push({ label: 'ATTEMPTS', value: String(source.attempts) });
  if (source.retryAfter != null) details.push({ label: 'RETRY AFTER', value: String(source.retryAfter) });
  if (source.retryAfterMs != null) details.push({ label: 'RETRY AFTER', value: `${source.retryAfterMs} ms` });
  if (source.retrievedAt) details.push({ label: 'RECORDED', value: String(source.retrievedAt) });
  return {
    provider: source.provider ?? 'unknown-provider',
    state,
    reason,
    status,
    label: copy.label,
    summary: copy.summary,
    details,
  };
}

export function buildOverview(envelope) {
  const summary = envelope.providerSummary || {};
  const ok = summary.ok ?? 0;
  const failed = summary.failed ?? 0;
  const skipped = summary.skipped ?? 0;
  const coverage = `${ok} succeeded · ${failed} failed · ${skipped} not run · ${summary.cached ?? 0} cached`;
  const limitations = [];
  if (failed) limitations.push(`${failed} provider${failed === 1 ? '' : 's'} failed; treat coverage as incomplete.`);
  if (skipped) limitations.push(`${skipped} provider${skipped === 1 ? '' : 's'} did not run; absence from those sources is unknown.`);
  return {
    indicator: envelope.indicator,
    type: envelope.type,
    requestId: envelope.requestId,
    profile: envelope.profile,
    status: envelope.status,
    tone: envelope.status === 'ok' ? 'green' : envelope.status === 'partial' ? 'amber' : 'red',
    durationMs: envelope.durationMs,
    budget: envelope.budget || null,
    providerSummary: summary,
    coverage,
    limitations,
    freshness: envelope.correlation?.freshness || 'unknown',
    huntability: envelope.correlation?.huntability || null,
    decision: envelope.decision || null,
  };
}

export function buildEvidence(envelope) {
  return (envelope.evidence || []).map((item) => {
    const kind = item.observation?.kind || 'unknown';
    const semanticClass = CONTEXT.has(kind) ? 'context' : CLAIM.has(kind) ? 'claim' : 'evidence';
    return {
      provider: item.provider,
      kind,
      verdict: item.observation?.verdict ?? null,
      semanticClass,
      semanticNote: semanticClass === 'claim' ? 'Reported/claimed evidence; not proof of compromise.' : '',
      confidence: item.observation?.confidence ?? null,
      firstSeen: item.observation?.firstSeen ?? null,
      lastSeen: item.observation?.lastSeen ?? null,
      attributeFacts: toFactRows(item.observation?.attributes ?? {}),
      tags: (item.observation?.tags ?? []).map(value => scalar(value) ?? String(value)),
      malwareFamily: item.observation?.malwareFamily ?? null,
      actorFacts: item.observation?.actor ? toFactRows(item.observation.actor) : [],
      references: item.references ?? [],
      cacheState: item.cacheState ?? null,
      retrievedAt: item.retrievedAt ?? null,
      parserVersion: item.integrity?.parserVersion ?? null,
      fingerprint: item.integrity?.fingerprint ?? null,
    };
  });
}

export function buildCorrelation(envelope) {
  const correlation = envelope.correlation || {};
  return {
    corroboration: (correlation.corroboration || []).map((item, index) => normalizedCorrelationItem(item, index, 'corroboration')),
    contradictions: (correlation.contradictions || []).map((item, index) => normalizedCorrelationItem(item, index, 'contradiction')),
    freshness: correlation.freshness || 'unknown',
    huntability: correlation.huntability || null,
    riskAxes: {
      kev: riskAxis('kev', correlation.riskAxes?.kev ?? null),
      epss: riskAxis('epss', correlation.riskAxes?.epss ?? null),
      cvss: riskAxis('cvss', correlation.riskAxes?.cvss ?? null),
    },
    attributionConfidence: correlation.attributionConfidence ?? null,
  };
}

export function buildRelationships(envelope) {
  return (envelope.relationships || envelope.correlation?.relationships || []).map((item, index) => ({
    title: `RELATIONSHIP ${index + 1}`,
    facts: toFactRows(item),
  }));
}

export function buildCoverage(envelope) {
  const summary = envelope.providerSummary || {};
  const ok = summary.ok ?? 0;
  const failed = summary.failed ?? 0;
  const skipped = summary.skipped ?? 0;
  const cached = summary.cached ?? 0;
  return {
    failures: (envelope.failures || []).map(normalizeFailure),
    summary,
    summaryText: `${ok} succeeded · ${failed} failed · ${skipped} not run · ${cached} cached`,
  };
}

const IP_SECTION_DEFS = Object.freeze([
  Object.freeze({ id: 'identity', title: 'IDENTITY & ASN' }),
  Object.freeze({ id: 'registration-routing', title: 'REGISTRATION / ROUTING' }),
  Object.freeze({ id: 'geo-network', title: 'GEO / NETWORK CONTEXT' }),
  Object.freeze({ id: 'exposure', title: 'EXPOSURE & SERVICES' }),
  Object.freeze({ id: 'reputation-abuse', title: 'REPUTATION / ABUSE' }),
  Object.freeze({ id: 'malware-c2-ransomware', title: 'MALWARE / C2 / RANSOMWARE' }),
  Object.freeze({ id: 'tor-scanner', title: 'TOR / SCANNER ACTIVITY' }),
  Object.freeze({ id: 'related-infrastructure', title: 'RELATED INFRASTRUCTURE' }),
  Object.freeze({ id: 'correlation', title: 'CORROBORATION / CONTRADICTIONS' }),
  Object.freeze({ id: 'huntability', title: 'HUNTABILITY' }),
  Object.freeze({ id: 'coverage', title: 'COVERAGE / LIMITATIONS' }),
]);

const IP_SECTION_KINDS = Object.freeze({
  identity: new Set(['network_identity', 'routing']),
  'registration-routing': new Set(['registration', 'routing']),
  exposure: new Set(['internet_exposure']),
  'reputation-abuse': new Set(['reputation', 'abuse_reports', 'drop_netblock', 'community_ioc_report', 'web_intelligence']),
  'malware-c2-ransomware': new Set(['botnet_c2', 'malware_association', 'threat_context', 'misp_feed_hit', 'ransomware_post_reference', 'ransomware_victim_claim']),
  'tor-scanner': new Set(['tor_exit', 'scanner_activity', 'internet_noise']),
});

const IP_SECTION_FACT_LABELS = Object.freeze({
  identity: /^(IP|ASN|ORGANIZATION|AS NAME|ASNAME|HOLDER|DOMAIN)$/,
  'registration-routing': /^(PREFIX|CIDR|CIDR0(?: .*)?|NETWORK|HANDLE|NAME|START ADDRESS|END ADDRESS|START AUTNUM|END AUTNUM|ANNOUNCED|ASNS|BLOCK(?: .*)?)$/,
  'geo-network': /^(COUNTRY|CONTINENT|CITY|REGION|LOCATION|LATITUDE|LONGITUDE|TIMEZONE)$/,
  exposure: /(PORT|SERVICE|HOSTNAME|PROTOCOL|BANNER|PRODUCT|VERSION|CERT|TLS|HTTP|SSH|DNS)/,
  'reputation-abuse': /(ABUSE|REPORT|CLASSIFICATION|LISTED|RISK|SCORE|MALICIOUS|SUSPICIOUS|REPUTATION|CATEGORY|USAGE|ISP)/,
  'malware-c2-ransomware': /(MALWARE|BOTNET|C2|FAMILY|IOC|CAMPAIGN|ACTOR|THREAT|RANSOM|SIGNATURE|TAGS?)/,
  'tor-scanner': /(TOR|NOISE|RIOT|CLASSIFICATION|ATTACK|REPORT|SCANNER|LAST SEEN|FIRST SEEN)/,
});

const IP_THREAT_KINDS = new Set([
  'reputation', 'abuse_reports', 'drop_netblock', 'community_ioc_report', 'botnet_c2',
  'malware_association', 'threat_context', 'misp_feed_hit', 'ransomware_post_reference',
  'ransomware_victim_claim', 'internet_noise',
]);
const IP_POSITIVE_VERDICTS = new Set(['malicious', 'observed', 'listed', 'suspicious', 'abusive', 'malware', 'botnet', 'c2']);
const IP_NO_RESULT_VERDICTS = new Set(['no_result']);

function meaningfulFact(fact) {
  const value = String(fact?.value ?? '').trim();
  return value && value !== '—' && value.toLowerCase() !== 'null' && value.toLowerCase() !== 'undefined';
}

function sourcedFacts(cards, sectionId, limit = 40) {
  const matcher = IP_SECTION_FACT_LABELS[sectionId];
  if (!matcher) return [];
  const merged = new Map();
  for (const card of cards) {
    for (const fact of card.attributeFacts || []) {
      if (!matcher.test(fact.label) || !meaningfulFact(fact)) continue;
      const key = `${fact.label}\u0000${fact.value}`;
      const current = merged.get(key) ?? { label: fact.label, value: String(fact.value), sources: new Set() };
      if (card.provider) current.sources.add(card.provider);
      merged.set(key, current);
    }
  }
  return [...merged.values()]
    .map(fact => ({ ...fact, sources: [...fact.sources].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value))
    .slice(0, limit);
}

function reportItem(card) {
  const facts = [];
  if (card.confidence !== null) facts.push({ label: 'CONFIDENCE', value: String(card.confidence) });
  if (card.firstSeen) facts.push({ label: 'FIRST SEEN', value: card.firstSeen });
  if (card.lastSeen) facts.push({ label: 'LAST SEEN', value: card.lastSeen });
  if (card.malwareFamily) facts.push({ label: 'MALWARE', value: card.malwareFamily });
  if (card.tags?.length) facts.push({ label: 'TAGS', value: card.tags.join(', ') });
  return {
    provider: card.provider,
    kind: labelize(card.kind),
    verdict: labelize(card.verdict ?? 'unknown'),
    semanticClass: card.semanticClass,
    semanticNote: card.semanticNote,
    facts,
  };
}

function reportItems(cards, kinds) {
  return cards
    .filter(card => kinds.has(card.kind) && !IP_NO_RESULT_VERDICTS.has(String(card.verdict ?? '').toLowerCase()))
    .map(reportItem)
    .slice(0, 32);
}

function firstFact(sections, label) {
  for (const section of sections) {
    const fact = section.facts?.find(item => item.label === label && meaningfulFact(item));
    if (fact) return fact.value;
  }
  return null;
}

function buildIpAssessment({ overview, evidence, correlation, sections }) {
  const threatProviders = new Set();
  for (const card of evidence) {
    const verdict = String(card.verdict ?? '').toLowerCase();
    if (IP_THREAT_KINDS.has(card.kind) && IP_POSITIVE_VERDICTS.has(verdict) && card.provider) threatProviders.add(card.provider);
  }
  const exposureProviders = new Set(evidence.filter(card => card.kind === 'internet_exposure' && !IP_NO_RESULT_VERDICTS.has(String(card.verdict ?? '').toLowerCase())).map(card => card.provider).filter(Boolean));
  const corroborated = correlation.corroboration?.length ?? 0;
  const threatCount = threatProviders.size;
  const state = threatCount >= 2 ? 'ACTIONABLE THREAT EVIDENCE' : threatCount === 1 ? 'SINGLE-SOURCE THREAT SIGNAL' : 'NO ACTIONABLE THREAT EVIDENCE OBSERVED';
  const confidence = threatCount >= 3 || (threatCount >= 2 && corroborated > 0) ? 'HIGH' : threatCount >= 2 ? 'MEDIUM' : threatCount === 1 ? 'LOW' : 'INFORMATIONAL';
  const asn = firstFact(sections, 'ASN');
  const organization = firstFact(sections, 'ORGANIZATION') ?? firstFact(sections, 'AS NAME') ?? firstFact(sections, 'ASNAME') ?? firstFact(sections, 'HOLDER');
  const identity = [asn, organization].filter(Boolean).join(' / ');
  const subject = identity ? `${overview.indicator} is associated with ${identity}.` : `${overview.indicator} was enriched as an IP observable.`;
  const threatSentence = threatCount
    ? `${threatCount} independent provider${threatCount === 1 ? '' : 's'} reported threat-relevant observations.`
    : 'No provider returned a threat-relevant positive observation; this is not a benign verdict.';
  const exposureSentence = exposureProviders.size
    ? `${exposureProviders.size} provider${exposureProviders.size === 1 ? '' : 's'} returned exposure/service context.`
    : 'No exposure/service context was returned.';
  return {
    state,
    confidence,
    summary: `${subject} ${threatSentence} ${exposureSentence} Coverage: ${overview.coverage}. Failed or absent sources remain unknown rather than benign.`,
    facts: [
      { label: 'DISPOSITION', value: state },
      { label: 'CONFIDENCE', value: confidence },
      { label: 'THREAT SIGNAL SOURCES', value: threatProviders.size ? [...threatProviders].sort().join(', ') : 'NONE OBSERVED' },
      { label: 'EXPOSURE SOURCES', value: exposureProviders.size ? [...exposureProviders].sort().join(', ') : 'NONE OBSERVED' },
      { label: 'HUNTABILITY', value: correlation.huntability?.level ? labelize(correlation.huntability.level) : 'UNKNOWN' },
    ],
  };
}

export function buildIpAnalystReport({ overview, evidence, correlation, relationships, coverage }) {
  if (!overview || overview.type !== 'ip') throw new TypeError('IP report requires an IP overview');
  const cards = Array.isArray(evidence) ? evidence : [];
  const sections = IP_SECTION_DEFS.map(definition => ({ id: definition.id, title: definition.title, facts: [], items: [] }));
  const byId = new Map(sections.map(section => [section.id, section]));

  for (const id of ['identity', 'registration-routing', 'geo-network', 'exposure', 'reputation-abuse', 'malware-c2-ransomware', 'tor-scanner']) {
    byId.get(id).facts = sourcedFacts(cards, id);
  }
  for (const [id, kinds] of Object.entries(IP_SECTION_KINDS)) byId.get(id).items = reportItems(cards, kinds);

  byId.get('related-infrastructure').items = (relationships || []).slice(0, 64);
  byId.get('correlation').facts = [
    { label: 'FRESHNESS', value: correlation?.freshness ?? 'unknown' },
    { label: 'CORROBORATION GROUPS', value: String(correlation?.corroboration?.length ?? 0) },
    { label: 'CONTRADICTIONS', value: String(correlation?.contradictions?.length ?? 0) },
  ];
  byId.get('correlation').items = [
    ...(correlation?.corroboration || []).map(item => ({ ...item, tone: 'corroboration' })),
    ...(correlation?.contradictions || []).map(item => ({ ...item, tone: 'contradiction' })),
  ].slice(0, 32);
  byId.get('huntability').facts = [
    { label: 'LEVEL', value: labelize(correlation?.huntability?.level ?? 'unknown') },
    { label: 'RATIONALE', value: correlation?.huntability?.rationale ?? 'No huntability rationale emitted.' },
  ];
  byId.get('coverage').summary = coverage?.summaryText ?? overview.coverage;
  byId.get('coverage').failures = (coverage?.failures || []).slice(0, 32);
  byId.get('coverage').facts = (overview.limitations || []).map((value, index) => ({ label: `LIMITATION ${index + 1}`, value }));

  const assessment = buildIpAssessment({ overview, evidence: cards, correlation: correlation || {}, sections });
  return {
    title: `IP INTELLIGENCE REPORT // ${overview.indicator}`,
    indicator: overview.indicator,
    status: overview.status,
    profile: overview.profile,
    durationMs: overview.durationMs,
    assessment,
    sections,
  };
}

function textFact(fact, prefix = '') {
  const sources = fact?.sources?.length ? ` [${fact.sources.join(' + ')}]` : '';
  return `${prefix}${fact?.label ?? 'FACT'}: ${fact?.value ?? '—'}${sources}`;
}

function textSection(title, lines) {
  const body = lines.filter(Boolean);
  return [title, '-'.repeat(title.length), ...(body.length ? body : ['No reportable observations.']), ''];
}

export function renderIpAnalystReportText(report) {
  if (!report || typeof report !== 'object' || !String(report.title || '').startsWith('IP INTELLIGENCE REPORT //')) {
    throw new TypeError('valid IP analyst report required');
  }
  const out = [
    report.title,
    `STATUS: ${labelize(report.status ?? 'unknown')}`,
    `PROFILE: ${labelize(report.profile ?? 'unknown')}`,
    `DURATION: ${report.durationMs == null ? '—' : `${report.durationMs} ms`}`,
    '',
    ...textSection('EXECUTIVE ASSESSMENT', [
      `DISPOSITION: ${report.assessment?.state ?? 'UNKNOWN'}`,
      `CONFIDENCE: ${report.assessment?.confidence ?? 'UNKNOWN'}`,
      report.assessment?.summary ?? '',
      ...(report.assessment?.facts || []).filter(fact => !['DISPOSITION', 'CONFIDENCE'].includes(fact.label)).map(fact => textFact(fact)),
    ]),
  ];

  for (const section of report.sections || []) {
    const lines = [];
    if (section.summary) lines.push(section.summary);
    for (const fact of section.facts || []) lines.push(textFact(fact));
    for (const item of section.items || []) {
      if (item.provider) {
        lines.push(`${item.provider}: ${item.verdict ?? item.kind ?? 'OBSERVED'}${item.kind ? ` // ${item.kind}` : ''}`);
        if (item.semanticNote) lines.push(`  ${item.semanticNote}`);
        for (const fact of item.facts || []) lines.push(textFact(fact, '  '));
      } else {
        if (item.title) lines.push(item.title);
        for (const fact of item.facts || []) lines.push(textFact(fact, '  '));
      }
    }
    for (const failure of section.failures || []) {
      lines.push(`${failure.provider}: ${failure.label}`);
      if (failure.summary) lines.push(`  ${failure.summary}`);
      for (const fact of failure.details || []) lines.push(textFact(fact, '  '));
    }
    out.push(...textSection(section.title, lines));
  }

  return `${out.join('\n').trimEnd()}\n`;
}

export function jsonLines(envelope) {
  return JSON.stringify(envelope, null, 2)
    .split('\n')
    .map((text, index) => ({ number: index + 1, text }));
}
