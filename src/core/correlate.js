const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RELATIONSHIPS = 100;

const REPUTATION_KINDS = new Set([
  'reputation', 'ioc_reputation', 'threat_intelligence', 'malicious_url',
  'malware_distribution', 'phishing_feed', 'phishing_feed_match', 'botnet_c2',
]);

const POSITIVE = new Set(['malicious', 'suspicious', 'phishing', 'associated', 'listed', 'malware_sample', 'known_exploited']);
const NEGATIVE = new Set(['benign', 'clean', 'no_association', 'not_listed']);

function semanticClass(kind) {
  if (REPUTATION_KINDS.has(kind)) return 'reputation';
  if (kind === 'known_exploited') return 'exploitation';
  if (kind === 'exploit_probability') return 'exploit_probability';
  if (kind === 'vulnerability_metadata' || kind === 'vulnerability_catalog' || kind === 'open_source_vulnerability') return 'vulnerability_metadata';
  if (kind === 'attack_knowledge') return 'attack_knowledge';
  if (kind === 'scanner_activity') return 'scanner_activity';
  if (kind === 'tor_exit') return 'tor_exit';
  if (kind === 'network_identity' || kind === 'routing' || kind === 'registration' || kind === 'internet_exposure') return 'network_context';
  return kind || 'unknown';
}

function polarity(verdict) {
  const value = String(verdict ?? '').toLowerCase();
  if (POSITIVE.has(value)) return 'positive';
  if (NEGATIVE.has(value)) return 'negative';
  return 'neutral';
}

function parseDate(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function freshnessClass(ageMs) {
  if (ageMs == null || ageMs < 0) return 'unknown';
  if (ageMs <= 7 * DAY_MS) return 'current';
  if (ageMs <= 30 * DAY_MS) return 'aging';
  return 'stale';
}

function evidenceTime(item) {
  return parseDate(item?.observation?.lastSeen)
    ?? parseDate(item?.observation?.firstSeen)
    ?? parseDate(item?.retrievedAt);
}

function buildFreshness(evidence, now) {
  const nowMs = parseDate(now) ?? Date.now();
  const items = evidence.map(item => {
    const observedMs = evidenceTime(item);
    return {
      provider: item.provider,
      class: freshnessClass(observedMs == null ? null : nowMs - observedMs),
      observedAt: observedMs == null ? null : new Date(observedMs).toISOString(),
    };
  });
  if (!items.length || items.every(item => item.class === 'unknown')) return { overall: 'unknown', items };
  const ranks = { current: 0, aging: 1, stale: 2, unknown: 3 };
  const known = items.filter(item => item.class !== 'unknown');
  const worst = known.sort((a, b) => ranks[b.class] - ranks[a.class])[0]?.class ?? 'unknown';
  return { overall: worst, items };
}

function corroboration(evidence) {
  const groups = new Map();
  for (const item of evidence) {
    const cls = semanticClass(item?.observation?.kind);
    if (cls === 'attack_knowledge' || cls === 'scanner_activity' || cls === 'tor_exit' || cls === 'network_context') continue;
    const p = polarity(item?.observation?.verdict);
    if (p === 'neutral') continue;
    const key = `${cls}:${p}`;
    if (!groups.has(key)) groups.set(key, { semanticClass: cls, polarity: p, providers: new Set() });
    groups.get(key).providers.add(item.provider);
  }
  return [...groups.values()]
    .filter(group => group.providers.size >= 2)
    .map(group => ({ semanticClass: group.semanticClass, polarity: group.polarity, providers: [...group.providers].sort() }));
}

function contradictions(evidence) {
  const byClass = new Map();
  for (const item of evidence) {
    const cls = semanticClass(item?.observation?.kind);
    const p = polarity(item?.observation?.verdict);
    if (p === 'neutral' || cls === 'attack_knowledge' || cls === 'scanner_activity' || cls === 'tor_exit' || cls === 'network_context') continue;
    if (!byClass.has(cls)) byClass.set(cls, { positive: new Set(), negative: new Set() });
    byClass.get(cls)[p].add(item.provider);
  }
  const output = [];
  for (const [cls, group] of byClass) {
    if (group.positive.size && group.negative.size) {
      output.push({
        semanticClass: cls,
        providers: [...new Set([...group.positive, ...group.negative])].sort(),
        positiveProviders: [...group.positive].sort(),
        negativeProviders: [...group.negative].sort(),
      });
    }
  }
  return output;
}

function huntability(type, evidence) {
  if (type === 'attack') return { level: 'medium', reason: 'behavior_or_technique_mapping' };
  if (type === 'cve') return { level: 'medium', reason: 'requires_exposure_or_behavior_telemetry' };
  if (type === 'hash') return { level: 'high', reason: 'direct_file_and_process_search' };
  if (type === 'ip' || type === 'domain' || type === 'url') {
    const hasActionable = evidence.some(item => ['reputation', 'ioc_reputation', 'threat_intelligence', 'malicious_url', 'malware_distribution', 'phishing_feed_match', 'botnet_c2'].includes(item?.observation?.kind));
    return { level: hasActionable ? 'high' : 'medium', reason: hasActionable ? 'direct_network_or_url_search' : 'contextual_network_search' };
  }
  if (type === 'asn' || type === 'cidr') return { level: 'low', reason: 'broad_network_context_requires_narrowing' };
  return { level: 'none', reason: 'no_explicit_hunt_mapping' };
}

function riskAxes(evidence) {
  const kev = evidence.find(item => item?.observation?.kind === 'known_exploited');
  const epss = evidence.find(item => item?.observation?.kind === 'exploit_probability');
  const cvss = evidence.find(item => Number.isFinite(Number(item?.observation?.attributes?.cvss)));
  return {
    kev: kev ? {
      listed: kev.observation.verdict === 'known_exploited' || kev.observation.attributes?.cataloged === true,
      ransomwareUse: kev.observation.attributes?.knownRansomwareCampaignUse ?? null,
      provider: kev.provider,
    } : null,
    epss: epss ? {
      score: Number.isFinite(Number(epss.observation.attributes?.epss)) ? Number(epss.observation.attributes.epss) : null,
      percentile: Number.isFinite(Number(epss.observation.attributes?.percentile)) ? Number(epss.observation.attributes.percentile) : null,
      provider: epss.provider,
    } : null,
    cvss: cvss ? { score: Number(cvss.observation.attributes.cvss), provider: cvss.provider } : null,
  };
}

function dedupeRelationships(relationships) {
  const seen = new Set();
  const output = [];
  for (const rel of Array.isArray(relationships) ? relationships : []) {
    const key = [rel?.type ?? '', rel?.source ?? '', rel?.target ?? '', rel?.provider ?? ''].join('\u0000');
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(rel);
    if (output.length >= MAX_RELATIONSHIPS) break;
  }
  return output;
}

function attributionFromRelationships(relationships) {
  const actors = [...new Set(relationships
    .filter(rel => rel?.targetType === 'actor' || rel?.type === 'attributed_to')
    .map(rel => rel?.target)
    .filter(Boolean))].sort();
  if (!actors.length) return undefined;
  return { basis: 'explicit_relationship', actors };
}

export function correlateEvidence({ indicator, type, evidence = [], relationships = [], now = new Date().toISOString() } = {}) {
  const deduped = dedupeRelationships(relationships);
  const output = {
    indicator,
    type,
    corroboration: corroboration(evidence),
    contradictions: contradictions(evidence),
    freshness: buildFreshness(evidence, now),
    huntability: huntability(type, evidence),
    relationships: deduped,
  };
  if (type === 'cve') output.riskAxes = riskAxes(evidence);
  const attributionConfidence = attributionFromRelationships(deduped);
  if (attributionConfidence) output.attributionConfidence = attributionConfidence;
  return output;
}
