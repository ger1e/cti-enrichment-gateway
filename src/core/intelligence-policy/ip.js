export const IP_INTELLIGENCE_POLICY_VERSION = '1.0';

const evidenceKinds = Object.freeze({
  directThreat: Object.freeze([
    'reputation',
    'ioc_reputation',
    'abuse_reports',
    'drop_netblock',
    'botnet_c2',
    'malware_association',
    'misp_feed_hit',
  ]),
  supportingThreat: Object.freeze([
    'threat_context',
    'community_ioc_report',
    'web_intelligence',
    'ransomware_post_reference',
  ]),
  scannerNoise: Object.freeze(['scanner_activity', 'internet_noise']),
  torProxy: Object.freeze(['tor_exit']),
  infrastructure: Object.freeze(['network_identity', 'registration', 'routing', 'passive_dns']),
  exposure: Object.freeze(['internet_exposure', 'web_scan_history']),
});

const relationshipTypes = Object.freeze({
  direct: Object.freeze(['c2', 'malware', 'resolves_to', 'communicates_with']),
  supporting: Object.freeze(['hostname', 'domain', 'certificate', 'passive_dns', 'dns_resolution']),
  contextual: Object.freeze(['asn', 'cidr', 'netblock', 'registration', 'nameserver', 'mx', 'ownership']),
});

const pivotTargetTypes = Object.freeze(['ip', 'domain', 'url', 'hash', 'cve']);

export const IP_INTELLIGENCE_POLICY = Object.freeze({
  type: 'ip',
  version: IP_INTELLIGENCE_POLICY_VERSION,
  evidenceKinds,
  relationshipTypes,
  pivotTargetTypes,
});

const DIRECT_THREAT_KINDS = new Set(evidenceKinds.directThreat);
const SUPPORTING_THREAT_KINDS = new Set(evidenceKinds.supportingThreat);
const SCANNER_NOISE_KINDS = new Set(evidenceKinds.scannerNoise);
const TOR_PROXY_KINDS = new Set(evidenceKinds.torProxy);
const INFRASTRUCTURE_KINDS = new Set(evidenceKinds.infrastructure);
const EXPOSURE_KINDS = new Set(evidenceKinds.exposure);
const DIRECT_RELATIONSHIP_TYPES = new Set(relationshipTypes.direct);
const SUPPORTING_RELATIONSHIP_TYPES = new Set(relationshipTypes.supporting);
const CONTEXTUAL_RELATIONSHIP_TYPES = new Set(relationshipTypes.contextual);
const PIVOT_TARGET_TYPES = new Set(pivotTargetTypes);

export function ipEvidenceCategory(kind) {
  if (DIRECT_THREAT_KINDS.has(kind)) return 'direct_threat';
  if (SUPPORTING_THREAT_KINDS.has(kind)) return 'supporting_threat';
  if (SCANNER_NOISE_KINDS.has(kind)) return 'scanner_noise';
  if (TOR_PROXY_KINDS.has(kind)) return 'tor_proxy';
  if (INFRASTRUCTURE_KINDS.has(kind)) return 'infrastructure';
  if (EXPOSURE_KINDS.has(kind)) return 'exposure';
  return 'other';
}

export function ipRelationshipClass(relationship) {
  const type = typeof relationship?.type === 'string' ? relationship.type : '';
  if (DIRECT_RELATIONSHIP_TYPES.has(type)) return 'direct';
  if (SUPPORTING_RELATIONSHIP_TYPES.has(type)) return 'supporting';
  if (CONTEXTUAL_RELATIONSHIP_TYPES.has(type)) return 'contextual';
  return 'low_value';
}

export function ipPivotPriority(relationship) {
  const target = relationship?.target ?? relationship?.value;
  const targetType = typeof relationship?.targetType === 'string' ? relationship.targetType : '';
  if ((typeof target !== 'string' && typeof target !== 'number') || String(target).length === 0 || !PIVOT_TARGET_TYPES.has(targetType)) return 'none';

  const relationshipClass = ipRelationshipClass(relationship);
  if (relationshipClass === 'direct') return 'high';
  if (relationshipClass === 'supporting') return 'medium';
  return 'low';
}
