const CONTEXT = new Set([
  'registration', 'routing', 'network_identity', 'internet_exposure',
  'scanner_activity', 'internet_noise', 'tor_exit', 'attack_knowledge',
]);
const CLAIM = new Set(['community_ioc_report', 'ransomware_post_reference', 'ransomware_victim_claim']);

export function buildOverview(envelope) {
  return {
    indicator: envelope.indicator,
    type: envelope.type,
    requestId: envelope.requestId,
    profile: envelope.profile,
    status: envelope.status,
    tone: envelope.status === 'ok' ? 'green' : envelope.status === 'partial' ? 'amber' : 'red',
    durationMs: envelope.durationMs,
    budget: envelope.budget || null,
    providerSummary: envelope.providerSummary || {},
    freshness: envelope.correlation?.freshness || 'unknown',
    huntability: envelope.correlation?.huntability || null,
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
      attributes: item.observation?.attributes ?? {},
      tags: item.observation?.tags ?? [],
      malwareFamily: item.observation?.malwareFamily ?? null,
      actor: item.observation?.actor ?? null,
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
    corroboration: correlation.corroboration || [],
    contradictions: correlation.contradictions || [],
    freshness: correlation.freshness || 'unknown',
    huntability: correlation.huntability || null,
    riskAxes: {
      kev: correlation.riskAxes?.kev ?? null,
      epss: correlation.riskAxes?.epss ?? null,
      cvss: correlation.riskAxes?.cvss ?? null,
    },
    attributionConfidence: correlation.attributionConfidence ?? null,
  };
}

export function buildRelationships(envelope) {
  return envelope.relationships || envelope.correlation?.relationships || [];
}

export function buildCoverage(envelope) {
  return {
    failures: envelope.failures || [],
    summary: envelope.providerSummary || {},
  };
}

export function jsonLines(envelope) {
  return JSON.stringify(envelope, null, 2)
    .split('\n')
    .map((text, index) => ({ number: index + 1, text }));
}
