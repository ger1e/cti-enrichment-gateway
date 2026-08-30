const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REASONS = 16;
const MAX_ATTACK_MAPPINGS = 32;
const MAX_GRAPH_NODES = 100;
const MAX_GRAPH_EDGES = 100;
const MAX_HUNTS = 8;
const ATTACK_ID = /^T\d{4}(?:\.\d{3})?$/i;
const FINGERPRINT = /^[0-9a-f]{64}$/i;

const TELEMETRY = {
  ip: ['DeviceNetworkEvents', 'CommonSecurityLog'],
  domain: ['DeviceNetworkEvents', 'EmailUrlInfo', 'UrlClickEvents'],
  url: ['DeviceNetworkEvents', 'EmailUrlInfo', 'UrlClickEvents'],
  hash: ['DeviceProcessEvents', 'DeviceFileEvents'],
  cve: ['DeviceTvmSoftwareVulnerabilities'],
  attack: [],
  asn: ['DeviceNetworkEvents', 'CommonSecurityLog'],
  cidr: ['DeviceNetworkEvents', 'CommonSecurityLog'],
};

const INTELLIGENCE_DISPOSITION = Object.freeze({
  immediate: 'hunt_now',
  investigate: 'investigate',
  monitor: 'monitor',
  contextual: 'context_only',
  insufficient: 'insufficient',
});

const INTELLIGENCE_CONFIDENCE = Object.freeze({
  strong: 'high',
  moderate: 'medium',
  weak: 'low',
  none: 'low',
});

function uniqueSorted(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.length > 0))].sort((a, b) => a.localeCompare(b));
}

function parseIso(value) {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function downgrade(level) {
  if (level === 'high') return 'medium';
  return 'low';
}

function kqlString(value) {
  return JSON.stringify(String(value ?? ''));
}

function safeFingerprint(item) {
  const value = item?.integrity?.fingerprint;
  return typeof value === 'string' && FINGERPRINT.test(value) ? value.toLowerCase() : null;
}

function telemetryReadiness(type) {
  const requiredTables = TELEMETRY[type] ?? [];
  const hasTemplate = ['ip', 'domain', 'url', 'hash', 'cve'].includes(type);
  return {
    status: hasTemplate ? 'ready' : 'conditional',
    requiredTables,
    environmentValidated: false,
    notes: hasTemplate
      ? ['schema_level_template_only', 'verify_table_availability_and_retention_before_execution']
      : ['requires_environment_or_technique_specific_telemetry_mapping'],
  };
}

function temporalSummary(evidence, now) {
  const first = evidence.map(item => parseIso(item?.observation?.firstSeen)).filter(Boolean).sort();
  const last = evidence.map(item => parseIso(item?.observation?.lastSeen)).filter(Boolean).sort();
  const firstSeen = first[0] ?? null;
  const lastSeen = last.at(-1) ?? null;
  const nowMs = Date.parse(now ?? '');
  const lastMs = lastSeen ? Date.parse(lastSeen) : NaN;
  const ageDays = Number.isFinite(nowMs) && Number.isFinite(lastMs) ? Math.max(0, Math.floor((nowMs - lastMs) / DAY_MS)) : null;
  const firstMs = firstSeen ? Date.parse(firstSeen) : NaN;
  const activeSpanDays = Number.isFinite(firstMs) && Number.isFinite(lastMs) ? Math.max(0, Math.floor((lastMs - firstMs) / DAY_MS)) : null;
  return { firstSeen, lastSeen, ageDays, activeSpanDays };
}

function attackMappings(type, indicator, evidence) {
  const mappings = new Map();
  const add = (id, basis, provider = null, fingerprint = null) => {
    const normalized = String(id ?? '').toUpperCase();
    if (!ATTACK_ID.test(normalized)) return;
    if (!mappings.has(normalized)) mappings.set(normalized, { id: normalized, bases: new Set(), providers: new Set(), evidenceFingerprints: new Set() });
    const item = mappings.get(normalized);
    item.bases.add(basis);
    if (provider) item.providers.add(provider);
    if (fingerprint) item.evidenceFingerprints.add(fingerprint);
  };

  if (type === 'attack') add(indicator, 'subject');
  for (const item of evidence) {
    const ids = Array.isArray(item?.observation?.attributes?.attackIds) ? item.observation.attributes.attackIds : [];
    const fingerprint = safeFingerprint(item);
    for (const id of ids) add(id, 'evidence', item?.provider ?? null, fingerprint);
  }

  return [...mappings.values()]
    .map(item => ({
      id: item.id,
      bases: [...item.bases].sort(),
      providers: [...item.providers].sort(),
      evidenceFingerprints: [...item.evidenceFingerprints].sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, MAX_ATTACK_MAPPINGS);
}

function inferTargetType(relationType, target) {
  const explicit = String(relationType ?? '').toLowerCase();
  if (['ip', 'domain', 'url', 'hash', 'cve', 'asn', 'cidr', 'actor', 'malware', 'ransomware_group'].includes(explicit)) return explicit;
  if (explicit === 'hostname' || explicit === 'nameserver' || explicit === 'mx') return 'domain';
  const value = String(target ?? '');
  if (/^CVE-\d{4}-\d{4,}$/i.test(value)) return 'cve';
  if (ATTACK_ID.test(value)) return 'attack';
  if (/^(?:[0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value)) return 'hash';
  return 'entity';
}

function entityGraph(indicator, type, evidence, relationships) {
  const nodes = new Map();
  const edges = [];
  const addNode = (nodeType, value, source = null) => {
    if (value == null || value === '' || nodes.size >= MAX_GRAPH_NODES) return null;
    const normalizedType = String(nodeType || 'entity').toLowerCase();
    const normalizedValue = String(value);
    const id = `${normalizedType}:${normalizedValue}`;
    if (!nodes.has(id)) nodes.set(id, { id, type: normalizedType, value: normalizedValue, sources: new Set() });
    if (source) nodes.get(id).sources.add(source);
    return id;
  };

  const subjectId = addNode(type, indicator, 'subject');
  for (const item of evidence) {
    const provider = item?.provider ?? null;
    if (item?.observation?.actor) {
      const actorId = addNode('actor', item.observation.actor, provider);
      if (actorId && subjectId && edges.length < MAX_GRAPH_EDGES) edges.push({ type: 'reported_actor_context', source: subjectId, target: actorId, provider });
    }
    if (item?.observation?.malwareFamily) {
      const malwareId = addNode('malware', item.observation.malwareFamily, provider);
      if (malwareId && subjectId && edges.length < MAX_GRAPH_EDGES) edges.push({ type: 'reported_malware_context', source: subjectId, target: malwareId, provider });
    }
  }

  for (const rel of Array.isArray(relationships) ? relationships : []) {
    if (edges.length >= MAX_GRAPH_EDGES) break;
    const targetValue = rel?.target ?? rel?.value;
    if (targetValue == null || targetValue === '') continue;
    const sourceValue = rel?.source ?? indicator;
    const sourceType = String(sourceValue) === String(indicator) ? type : 'entity';
    const targetType = rel?.targetType ?? inferTargetType(rel?.type, targetValue);
    const sourceId = addNode(sourceType, sourceValue, rel?.provider ?? null);
    const targetId = addNode(targetType, targetValue, rel?.provider ?? null);
    if (!sourceId || !targetId) continue;
    const key = `${rel?.type ?? 'related_to'}\u0000${sourceId}\u0000${targetId}\u0000${rel?.provider ?? ''}`;
    if (edges.some(edge => edge._key === key)) continue;
    edges.push({ _key: key, type: rel?.type ?? 'related_to', source: sourceId, target: targetId, provider: rel?.provider ?? null });
  }

  return {
    nodes: [...nodes.values()].map(node => ({ ...node, sources: [...node.sources].sort() })),
    edges: edges.map(({ _key, ...edge }) => edge),
  };
}

function subjectKql(type, indicator) {
  const literal = kqlString(indicator);
  if (type === 'ip') return `let IOC = ${literal};\nunion isfuzzy=true\n(DeviceNetworkEvents\n | where RemoteIP == IOC\n | project EventTime=Timestamp, SourceTable="DeviceNetworkEvents", Device=DeviceName, SourceIP="", DestinationIP=RemoteIP, DestinationPort=RemotePort, Context=InitiatingProcessCommandLine),\n(CommonSecurityLog\n | where SourceIP == IOC or DestinationIP == IOC\n | project EventTime=TimeGenerated, SourceTable="CommonSecurityLog", Device=DeviceName, SourceIP, DestinationIP, DestinationPort, Context=Activity)\n| sort by EventTime desc`;
  if (type === 'domain') return `let IOC = ${literal};\nunion isfuzzy=true\n(DeviceNetworkEvents\n | where RemoteUrl =~ IOC or RemoteUrl endswith strcat(".", IOC)\n | project EventTime=Timestamp, SourceTable="DeviceNetworkEvents", Device=DeviceName, Account=InitiatingProcessAccountUpn, Url=RemoteUrl, Context=InitiatingProcessCommandLine),\n(EmailUrlInfo\n | where Url has IOC\n | project EventTime=Timestamp, SourceTable="EmailUrlInfo", Device="", Account="", Url, Context=NetworkMessageId),\n(UrlClickEvents\n | where Url has IOC\n | project EventTime=Timestamp, SourceTable="UrlClickEvents", Device="", Account=AccountUpn, Url, Context=ActionType)\n| sort by EventTime desc`;
  if (type === 'url') return `let IOC = ${literal};\nunion isfuzzy=true\n(DeviceNetworkEvents\n | where RemoteUrl == IOC or RemoteUrl startswith IOC\n | project EventTime=Timestamp, SourceTable="DeviceNetworkEvents", Device=DeviceName, Account=InitiatingProcessAccountUpn, Url=RemoteUrl, Context=InitiatingProcessCommandLine),\n(EmailUrlInfo\n | where Url == IOC\n | project EventTime=Timestamp, SourceTable="EmailUrlInfo", Device="", Account="", Url, Context=NetworkMessageId),\n(UrlClickEvents\n | where Url == IOC\n | project EventTime=Timestamp, SourceTable="UrlClickEvents", Device="", Account=AccountUpn, Url, Context=ActionType)\n| sort by EventTime desc`;
  if (type === 'hash') {
    const column = String(indicator).length === 64 ? 'SHA256' : String(indicator).length === 40 ? 'SHA1' : 'MD5';
    return `let IOC = ${literal};\nunion isfuzzy=true\n(DeviceProcessEvents\n | where ${column} == IOC\n | project EventTime=Timestamp, SourceTable="DeviceProcessEvents", Device=DeviceName, Artifact=FileName, Path=FolderPath, Context=ProcessCommandLine),\n(DeviceFileEvents\n | where ${column} == IOC\n | project EventTime=Timestamp, SourceTable="DeviceFileEvents", Device=DeviceName, Artifact=FileName, Path=FolderPath, Context=InitiatingProcessCommandLine)\n| sort by EventTime desc`;
  }
  if (type === 'cve') return `let IOC = ${literal};\nDeviceTvmSoftwareVulnerabilities\n| where CveId =~ IOC\n| project DeviceName, OSPlatform, SoftwareVendor, SoftwareName, SoftwareVersion, CveId\n| order by DeviceName asc`;
  return null;
}

function tuningFor(type) {
  if (type === 'ip') return { falsePositives: ['shared_hosting', 'cdn_or_proxy_egress', 'security_scanner_traffic'], tuning: ['separate_inbound_from_outbound', 'correlate_with_process_and_identity_context', 'exclude_known_internal_testing_infrastructure'] };
  if (type === 'domain' || type === 'url') return { falsePositives: ['security_tool_reputation_checks', 'email_rewriting_or_sandbox_access', 'shared_or_compromised_hosting'], tuning: ['separate_user_clicks_from_scanner_fetches', 'correlate_with_process_and_signin_context', 'preserve_exact_url_and_parent_domain_distinction'] };
  if (type === 'hash') return { falsePositives: ['dual_use_tooling', 'signed_but_abused_binaries', 'lab_or_ir_collections'], tuning: ['validate_signature_and_prevalence', 'correlate_with_parent_process_and_path', 'exclude_authorized_red_team_or_lab_assets'] };
  if (type === 'cve') return { falsePositives: ['inventory_without_reachable_exposure', 'patched_or_mitigated_assets', 'non_exploitable_product_configuration'], tuning: ['validate_product_and_version_overlap', 'confirm_exposure_and_attack_path', 'correlate_with_exploitation_behavior_telemetry'] };
  return { falsePositives: [], tuning: [] };
}

function huntPlan(type, indicator, evidence, relationships, disposition) {
  if (!evidence.length || disposition === 'insufficient') return [];
  const output = [];
  const add = (huntType, value, basis, provider = null) => {
    if (output.length >= MAX_HUNTS) return;
    const kql = subjectKql(huntType, value);
    if (!kql) return;
    const evidenceFingerprints = uniqueSorted(evidence
      .filter(item => !provider || item?.provider === provider)
      .map(safeFingerprint)
      .filter(Boolean));
    const tuning = tuningFor(huntType);
    output.push({
      id: `${basis}-${huntType}-${output.length + 1}`,
      priority: disposition === 'hunt_now' && output.length === 0 ? 'high' : 'medium',
      hypothesis: basis === 'subject'
        ? `Look for direct enterprise telemetry matching the enriched ${huntType} subject.`
        : `Look for direct enterprise telemetry matching a provider-supported ${huntType} relationship pivot.`,
      telemetry: TELEMETRY[huntType] ?? [],
      evidenceFingerprints,
      kql,
      falsePositives: tuning.falsePositives,
      tuning: tuning.tuning,
    });
  };

  add(type, indicator, 'subject');
  for (const rel of Array.isArray(relationships) ? relationships : []) {
    if (output.length >= MAX_HUNTS) break;
    const target = rel?.target ?? rel?.value;
    if (target == null || target === '') continue;
    const targetType = rel?.targetType ?? inferTargetType(rel?.type, target);
    if (!['ip', 'domain', 'url', 'hash', 'cve'].includes(targetType)) continue;
    add(targetType, target, 'pivot', rel?.provider ?? null);
  }
  return output;
}

function dispositionFor(type, evidence, correlation, limitations) {
  const threat = correlation?.threatAssessment?.state ?? 'insufficient';
  const freshness = correlation?.freshness?.overall ?? 'unknown';
  const huntability = correlation?.huntability?.level ?? 'none';
  const infraOnly = limitations.includes('infrastructure_only_evidence');
  if (!evidence.length) return 'insufficient';
  if (infraOnly && threat === 'insufficient') return 'context_only';
  if (type === 'cve') return 'investigate';
  if (type === 'attack') return 'investigate';
  if (threat === 'contradicted') return 'investigate';
  if (threat === 'supported') {
    if ((freshness === 'current' || freshness === 'aging') && huntability === 'high') return 'hunt_now';
    return 'investigate';
  }
  if (threat === 'negative') return 'monitor';
  if (threat === 'insufficient' && (correlation?.threatAssessment?.assessmentBasis?.providers?.length ?? 0) > 0) return 'investigate';
  return huntability === 'high' ? 'monitor' : 'context_only';
}

function confidenceFor(correlation, coverage, limitations) {
  const quality = correlation?.evidenceQuality?.level;
  let confidence = quality === 'high' ? 'high' : quality === 'medium' ? 'medium' : 'low';
  if ((correlation?.contradictions?.length ?? 0) > 0) confidence = downgrade(confidence);
  if (correlation?.freshness?.overall === 'stale') confidence = downgrade(confidence);
  if (coverage?.materialLoss || limitations.includes('material_coverage_loss')) confidence = downgrade(confidence);
  if (correlation?.freshness?.overall === 'unknown' && confidence === 'high') confidence = 'medium';
  return confidence;
}

function decisionReasons(type, correlation, coverage, limitations) {
  const reasons = new Set(limitations);
  const threat = correlation?.threatAssessment?.state;
  if (threat === 'supported') reasons.add('supported_threat_evidence');
  if (threat === 'contradicted') reasons.add('contradictory_threat_evidence');
  if (threat === 'negative') reasons.add('explicit_negative_reputation_evidence');
  if (correlation?.freshness?.overall === 'stale') reasons.add('stale_evidence');
  if (coverage?.materialLoss) reasons.add('material_coverage_loss');
  if (type === 'cve' && correlation?.riskAxes?.kev?.listed) reasons.add('known_exploited_cve');
  if (type === 'attack') reasons.add('attack_knowledge_subject');
  return [...reasons].sort().slice(0, MAX_REASONS);
}

function isCompatibleIntelligence(intelligence, type) {
  if (!intelligence || typeof intelligence !== 'object' || Array.isArray(intelligence)) return false;
  if (intelligence.schemaVersion !== '1.0' || intelligence.type !== type) return false;
  if (!intelligence.policy || intelligence.policy.type !== type || typeof intelligence.policy.version !== 'string' || intelligence.policy.version.length === 0) return false;
  const priority = intelligence.analystPriority;
  const strength = intelligence.evidenceStrength;
  if (!priority || !Object.hasOwn(INTELLIGENCE_DISPOSITION, priority.level) || !Array.isArray(priority.reasons)) return false;
  if (!strength || !Object.hasOwn(INTELLIGENCE_CONFIDENCE, strength.level) || !Array.isArray(strength.reasons)) return false;
  if (!Array.isArray(intelligence.limitations)) return false;
  return true;
}

export function buildDecisionSupport({
  indicator,
  type,
  evidence = [],
  relationships = [],
  correlation = {},
  coverage = {},
  limitations = [],
  intelligence = null,
  now = new Date().toISOString(),
} = {}) {
  const kernel = isCompatibleIntelligence(intelligence, type) ? intelligence : null;
  const mergedLimitations = uniqueSorted([
    ...(Array.isArray(limitations) ? limitations : []),
    ...(Array.isArray(correlation?.limitations) ? correlation.limitations : []),
    ...(kernel ? kernel.limitations : []),
  ]);
  const disposition = kernel
    ? INTELLIGENCE_DISPOSITION[kernel.analystPriority.level]
    : dispositionFor(type, evidence, correlation, mergedLimitations);
  const confidence = kernel
    ? INTELLIGENCE_CONFIDENCE[kernel.evidenceStrength.level]
    : confidenceFor(correlation, coverage, mergedLimitations);
  const reasons = kernel
    ? uniqueSorted([
      ...kernel.analystPriority.reasons,
      ...kernel.evidenceStrength.reasons,
      ...mergedLimitations,
    ]).slice(0, MAX_REASONS)
    : decisionReasons(type, correlation, coverage, mergedLimitations);
  const telemetry = telemetryReadiness(type);
  const mappings = attackMappings(type, indicator, evidence);
  const temporal = temporalSummary(evidence, now);
  const graph = entityGraph(indicator, type, evidence, relationships);
  const hunts = huntPlan(type, indicator, evidence, relationships, disposition);
  const riskAxes = type === 'cve' ? (correlation?.riskAxes ?? { kev: null, epss: null, cvss: null }) : undefined;
  const assessment = {
    disposition,
    confidence,
    reasons,
    evidenceQuality: correlation?.evidenceQuality?.level ?? 'none',
    threatState: correlation?.threatAssessment?.state ?? 'insufficient',
    freshness: correlation?.freshness?.overall ?? 'unknown',
    huntability: correlation?.huntability?.level ?? 'none',
    coverageMaterialLoss: Boolean(coverage?.materialLoss),
    ...(kernel ? {
      intelligenceVersion: kernel.schemaVersion,
      intelligencePolicyVersion: kernel.policy.version,
    } : {}),
  };

  return {
    version: '1.0',
    disposition,
    confidence,
    reasons,
    assessment,
    telemetry,
    temporal,
    attackMappings: mappings,
    entityGraph: graph,
    huntPlan: hunts,
    ...(riskAxes ? { riskAxes } : {}),
  };
}
