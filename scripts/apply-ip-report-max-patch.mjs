import { readFileSync, writeFileSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, value) { writeFileSync(path, value); }
function replaceOne(text, pattern, replacement, label) {
  const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one match, got ${matches.length}`);
  return text.replace(pattern, replacement);
}
function appendOnce(text, marker, addition) {
  if (text.includes(marker)) return text;
  return `${text.trimEnd()}\n\n${addition.trim()}\n`;
}

let vm = read('app/view-model.js');

vm = replaceOne(vm, /function labelize\(value\) \{[\s\S]*?\n\}/, `function labelize(value) {
  return String(value ?? 'unknown')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim()
    .toUpperCase();
}`, 'labelize');

vm = replaceOne(vm, /export function buildOverview\(envelope\) \{[\s\S]*?\n\}\n\nexport function buildEvidence/, `export function buildOverview(envelope) {
  const summary = envelope.providerSummary || {};
  const ok = summary.ok ?? 0;
  const failed = summary.failed ?? 0;
  const skipped = summary.skipped ?? 0;
  const coverage = \`${'${ok}'} succeeded · ${'${failed}'} failed · ${'${skipped}'} not run · ${'${summary.cached ?? 0}'} cached\`;
  const limitations = [];
  if (failed) limitations.push(\`${'${failed}'} provider${'${failed === 1 ? \'\' : \'s\'}'} failed; treat coverage as incomplete.\`);
  if (skipped) limitations.push(\`${'${skipped}'} provider${'${skipped === 1 ? \'\' : \'s\'}'} did not run; absence from those sources is unknown.\`);
  return {
    indicator: envelope.indicator,
    type: envelope.type,
    requestId: envelope.requestId,
    profile: envelope.profile,
    status: envelope.status,
    tone: envelope.status === 'ok' ? 'green' : envelope.status === 'partial' ? 'amber' : 'red',
    durationMs: envelope.durationMs,
    queriedAt: envelope.queriedAt ?? null,
    budget: envelope.budget || null,
    providerSummary: summary,
    coverage,
    limitations,
    freshness: envelope.correlation?.freshness || 'unknown',
    huntability: envelope.correlation?.huntability || null,
    decision: envelope.decision || null,
    guidance: envelope.guidance || null,
    correlationLimitations: envelope.correlation?.limitations || [],
  };
}

export function buildEvidence`, 'buildOverview');

vm = replaceOne(vm, /export function buildCorrelation\(envelope\) \{[\s\S]*?\n\}\n\nexport function buildRelationships/, `export function buildCorrelation(envelope) {
  const correlation = envelope.correlation || {};
  return {
    corroboration: (correlation.corroboration || []).map((item, index) => normalizedCorrelationItem(item, index, 'corroboration')),
    contradictions: (correlation.contradictions || []).map((item, index) => normalizedCorrelationItem(item, index, 'contradiction')),
    freshness: correlation.freshness || 'unknown',
    evidenceQuality: correlation.evidenceQuality || null,
    threatAssessment: correlation.threatAssessment || null,
    limitations: correlation.limitations || [],
    infrastructureContext: correlation.infrastructureContext || null,
    huntability: correlation.huntability || null,
    riskAxes: {
      kev: riskAxis('kev', correlation.riskAxes?.kev ?? null),
      epss: riskAxis('epss', correlation.riskAxes?.epss ?? null),
      cvss: riskAxis('cvss', correlation.riskAxes?.cvss ?? null),
    },
    attributionConfidence: correlation.attributionConfidence ?? null,
  };
}

export function buildRelationships`, 'buildCorrelation');

vm = replaceOne(vm, /const IP_SECTION_DEFS = Object\.freeze\(\[[\s\S]*?\]\);/, `const IP_SECTION_DEFS = Object.freeze([
  Object.freeze({ id: 'identity', title: 'IDENTITY & ASN' }),
  Object.freeze({ id: 'registration-routing', title: 'REGISTRATION / ROUTING' }),
  Object.freeze({ id: 'geo-network', title: 'GEO / NETWORK CONTEXT' }),
  Object.freeze({ id: 'exposure', title: 'EXPOSURE & SERVICES' }),
  Object.freeze({ id: 'reputation-abuse', title: 'REPUTATION / ABUSE' }),
  Object.freeze({ id: 'malware-c2-ransomware', title: 'MALWARE / C2 / RANSOMWARE' }),
  Object.freeze({ id: 'tor-scanner', title: 'TOR / SCANNER ACTIVITY' }),
  Object.freeze({ id: 'related-infrastructure', title: 'RELATED INFRASTRUCTURE' }),
  Object.freeze({ id: 'correlation', title: 'CORROBORATION / CONTRADICTIONS' }),
  Object.freeze({ id: 'temporal-context', title: 'TEMPORAL CONTEXT' }),
  Object.freeze({ id: 'attack-behavior', title: 'ATT&CK / BEHAVIOR' }),
  Object.freeze({ id: 'analyst-actions', title: 'ANALYST NEXT ACTIONS' }),
  Object.freeze({ id: 'huntability', title: 'HUNTABILITY' }),
  Object.freeze({ id: 'coverage', title: 'COVERAGE / LIMITATIONS' }),
]);`, 'IP section defs');

vm = replaceOne(vm, /function sourcedFacts\(cards, sectionId, limit = 40\) \{[\s\S]*?\n\}\n\nfunction reportItem/, `function sourcedFacts(cards, sectionId, limit = 40) {
  const matcher = IP_SECTION_FACT_LABELS[sectionId];
  if (!matcher) return [];
  const allowedKinds = IP_SECTION_KINDS[sectionId] ?? null;
  const merged = new Map();
  for (const card of cards) {
    if (allowedKinds && !allowedKinds.has(card.kind)) continue;
    for (const fact of card.attributeFacts || []) {
      if (!matcher.test(fact.label) || !meaningfulFact(fact)) continue;
      const key = \`${'${fact.label}'}\\u0000${'${fact.value}'}\`;
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

function reportItem`, 'sourcedFacts');

vm = vm.replace(`function firstFact(sections, label) {`, `function humanizeToken(value) {
  return String(value ?? '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\\s+/g, ' ').trim().toLowerCase();
}

function humanizeList(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(value => value !== null && value !== undefined && String(value).trim()).map(humanizeToken))].join(', ');
}

function freshnessDisplay(value) {
  if (typeof value === 'string') return labelize(value);
  if (value && typeof value === 'object' && value.overall) return labelize(value.overall);
  return 'UNKNOWN';
}

function temporalFacts(decision, cards) {
  const temporal = decision?.temporal || null;
  const firstSeen = temporal?.firstSeen ?? cards.map(card => card.firstSeen).filter(Boolean).sort()[0] ?? null;
  const lastSeen = temporal?.lastSeen ?? cards.map(card => card.lastSeen).filter(Boolean).sort().at(-1) ?? null;
  const facts = [];
  if (firstSeen) facts.push({ label: 'FIRST SEEN', value: firstSeen });
  if (lastSeen) facts.push({ label: 'LAST SEEN', value: lastSeen });
  if (temporal?.ageDays != null) facts.push({ label: 'AGE', value: \`${'${temporal.ageDays}'} day${'${temporal.ageDays === 1 ? \'\' : \'s\'}'}\` });
  if (temporal?.activeSpanDays != null) facts.push({ label: 'ACTIVE SPAN', value: \`${'${temporal.activeSpanDays}'} day${'${temporal.activeSpanDays === 1 ? \'\' : \'s\'}'}\` });
  return facts;
}

function attackItems(decision, guidance) {
  const mappings = decision?.attackMappings?.length ? decision.attackMappings : (guidance?.attackMappings || []);
  return mappings.slice(0, 32).map(mapping => ({
    title: String(mapping.id || 'ATT&CK MAPPING').toUpperCase(),
    facts: [
      { label: 'BASIS', value: humanizeList(mapping.bases) || 'unknown' },
      { label: 'PROVIDERS', value: (mapping.providers || []).join(', ') || 'none' },
      { label: 'EVIDENCE LINKS', value: String(mapping.evidenceFingerprints?.length ?? 0) },
    ],
  }));
}

function actionItems(decision, guidance) {
  const hunts = decision?.huntPlan?.length ? decision.huntPlan : (guidance?.hunts || []);
  return hunts.slice(0, 8).map(hunt => ({
    title: \`${'${labelize(hunt.priority ?? \'medium\')}'} // ${'${labelize(hunt.id ?? \'hunt\')}'}\`,
    facts: [
      { label: 'HYPOTHESIS', value: hunt.hypothesis ?? 'No explicit hypothesis emitted.' },
      { label: 'TELEMETRY', value: (hunt.telemetry || []).join(', ') || 'none specified' },
    ],
    detailFacts: [
      { label: 'FALSE POSITIVES', value: humanizeList(hunt.falsePositives) || 'none specified' },
      { label: 'TUNING', value: humanizeList(hunt.tuning) || 'none specified' },
      { label: 'EVIDENCE LINKS', value: String(hunt.evidenceFingerprints?.length ?? 0) },
      ...(hunt.kql ? [{ label: 'KQL', value: hunt.kql }] : []),
    ],
  }));
}

function firstFact(sections, label) {`);

vm = replaceOne(vm, /function buildIpAssessment\(\{ overview, evidence, correlation, sections \}\) \{[\s\S]*?\n\}\n\nexport function buildIpAnalystReport/, `function buildIpAssessment({ overview, evidence, correlation, sections }) {
  const decision = overview.decision || null;
  const threatBasis = correlation?.threatAssessment?.assessmentBasis?.providers || [];
  const threatProviders = new Set(threatBasis);
  if (!threatProviders.size) {
    for (const card of evidence) {
      const verdict = String(card.verdict ?? '').toLowerCase();
      if (IP_THREAT_KINDS.has(card.kind) && IP_POSITIVE_VERDICTS.has(verdict) && card.provider) threatProviders.add(card.provider);
    }
  }
  const exposureProviders = new Set(evidence.filter(card => card.kind === 'internet_exposure' && !IP_NO_RESULT_VERDICTS.has(String(card.verdict ?? '').toLowerCase())).map(card => card.provider).filter(Boolean));
  const asn = firstFact(sections, 'ASN');
  const organization = firstFact(sections, 'ORGANIZATION') ?? firstFact(sections, 'AS NAME') ?? firstFact(sections, 'ASNAME') ?? firstFact(sections, 'HOLDER');
  const identity = [asn, organization].filter(Boolean).join(' / ');
  const subject = identity ? \`${'${overview.indicator}'} is associated with ${'${identity}'}.\` : \`${'${overview.indicator}'} was enriched as an IP observable.\`;

  if (decision?.disposition) {
    const state = labelize(decision.disposition);
    const confidence = labelize(decision.confidence ?? decision.assessment?.confidence ?? 'unknown');
    const threatState = labelize(decision.assessment?.threatState ?? correlation?.threatAssessment?.state ?? 'insufficient');
    const evidenceQuality = labelize(decision.assessment?.evidenceQuality ?? correlation?.evidenceQuality?.level ?? 'none');
    const freshness = labelize(decision.assessment?.freshness ?? freshnessDisplay(correlation?.freshness));
    const huntability = labelize(decision.assessment?.huntability ?? correlation?.huntability?.level ?? 'none');
    const reasons = decision.reasons?.length ? decision.reasons : (decision.assessment?.reasons || []);
    const basis = threatBasis.length ? threatBasis.join(' + ') : 'no independent reputation basis emitted';
    return {
      state,
      confidence,
      decisionSource: \`DECISION SUPPORT V${'${decision.version || \'1.0\'}'}\`,
      summary: \`${'${subject}'} Decision support recommends ${'${state}'} with ${'${confidence}'} confidence. Threat state is ${'${threatState}'}${'${threatBasis.length ? ` across ${basis}` : \'\'}'}. Evidence quality is ${'${evidenceQuality}'} and freshness is ${'${freshness}'}. Coverage: ${'${overview.coverage}'}. Failed or absent sources remain unknown rather than benign.\`,
      facts: [
        { label: 'DECISION SOURCE', value: \`DECISION SUPPORT V${'${decision.version || \'1.0\'}'}\` },
        { label: 'DISPOSITION', value: state },
        { label: 'CONFIDENCE', value: confidence },
        { label: 'THREAT STATE', value: threatState },
        { label: 'THREAT BASIS', value: threatBasis.length ? threatBasis.join(', ') : 'NONE EMITTED' },
        { label: 'EVIDENCE QUALITY', value: evidenceQuality },
        { label: 'FRESHNESS', value: freshness },
        { label: 'HUNTABILITY', value: huntability },
        { label: 'DECISION REASONS', value: humanizeList(reasons) || 'none emitted' },
        { label: 'EXPOSURE SOURCES', value: exposureProviders.size ? [...exposureProviders].sort().join(', ') : 'NONE OBSERVED' },
      ],
    };
  }

  const corroborated = correlation.corroboration?.length ?? 0;
  const threatCount = threatProviders.size;
  const state = threatCount >= 2 ? 'ACTIONABLE THREAT EVIDENCE' : threatCount === 1 ? 'SINGLE-SOURCE THREAT SIGNAL' : 'NO ACTIONABLE THREAT EVIDENCE OBSERVED';
  const confidence = threatCount >= 3 || (threatCount >= 2 && corroborated > 0) ? 'HIGH' : threatCount >= 2 ? 'MEDIUM' : threatCount === 1 ? 'LOW' : 'INFORMATIONAL';
  const threatSentence = threatCount
    ? \`${'${threatCount}'} independent provider${'${threatCount === 1 ? \'\' : \'s\'}'} reported threat-relevant observations.\`
    : 'No provider returned a threat-relevant positive observation; this is not a benign verdict.';
  const exposureSentence = exposureProviders.size
    ? \`${'${exposureProviders.size}'} provider${'${exposureProviders.size === 1 ? \'\' : \'s\'}'} returned exposure/service context.\`
    : 'No exposure/service context was returned.';
  return {
    state,
    confidence,
    decisionSource: 'REPORT FALLBACK',
    summary: \`${'${subject}'} ${'${threatSentence}'} ${'${exposureSentence}'} Coverage: ${'${overview.coverage}'}. Failed or absent sources remain unknown rather than benign.\`,
    facts: [
      { label: 'DISPOSITION', value: state },
      { label: 'CONFIDENCE', value: confidence },
      { label: 'THREAT SIGNAL SOURCES', value: threatProviders.size ? [...threatProviders].sort().join(', ') : 'NONE OBSERVED' },
      { label: 'EXPOSURE SOURCES', value: exposureProviders.size ? [...exposureProviders].sort().join(', ') : 'NONE OBSERVED' },
      { label: 'HUNTABILITY', value: correlation.huntability?.level ? labelize(correlation.huntability.level) : 'UNKNOWN' },
    ],
  };
}

export function buildIpAnalystReport`, 'buildIpAssessment');

vm = replaceOne(vm, /export function buildIpAnalystReport\(\{ overview, evidence, correlation, relationships, coverage \}\) \{[\s\S]*?\n\}\n\nfunction textFact/, `export function buildIpAnalystReport({ overview, evidence, correlation, relationships, coverage }) {
  if (!overview || overview.type !== 'ip') throw new TypeError('IP report requires an IP overview');
  const cards = Array.isArray(evidence) ? evidence : [];
  const decision = overview.decision || null;
  const guidance = overview.guidance || null;
  const sections = IP_SECTION_DEFS.map(definition => ({ id: definition.id, title: definition.title, facts: [], items: [] }));
  const byId = new Map(sections.map(section => [section.id, section]));

  for (const id of ['identity', 'registration-routing', 'geo-network', 'exposure', 'reputation-abuse', 'malware-c2-ransomware', 'tor-scanner']) {
    byId.get(id).facts = sourcedFacts(cards, id);
  }
  for (const [id, kinds] of Object.entries(IP_SECTION_KINDS)) byId.get(id).items = reportItems(cards, kinds);

  byId.get('related-infrastructure').items = (relationships || []).slice(0, 64);
  const quality = correlation?.evidenceQuality || {};
  const threat = correlation?.threatAssessment || {};
  const threatProviders = threat?.assessmentBasis?.providers || [];
  byId.get('correlation').facts = [
    { label: 'FRESHNESS', value: freshnessDisplay(correlation?.freshness) },
    { label: 'THREAT STATE', value: labelize(threat?.state ?? decision?.assessment?.threatState ?? 'unknown') },
    { label: 'THREAT BASIS', value: threatProviders.length ? threatProviders.join(', ') : 'NONE EMITTED' },
    { label: 'EVIDENCE QUALITY', value: labelize(quality?.level ?? decision?.assessment?.evidenceQuality ?? 'none') },
    { label: 'EVIDENCE ITEMS', value: String(quality?.evidenceCount ?? cards.length) },
    { label: 'EVIDENCE PROVIDERS', value: String(quality?.providerCount ?? new Set(cards.map(card => card.provider).filter(Boolean)).size) },
    { label: 'CURRENT / AGING / STALE / UNKNOWN', value: \`${'${quality?.currentCount ?? 0}'} / ${'${quality?.agingCount ?? 0}'} / ${'${quality?.staleCount ?? 0}'} / ${'${quality?.unknownFreshnessCount ?? 0}'}\` },
    { label: 'CORROBORATION GROUPS', value: String(correlation?.corroboration?.length ?? 0) },
    { label: 'CONTRADICTIONS', value: String(correlation?.contradictions?.length ?? 0) },
  ];
  byId.get('correlation').items = [
    ...(correlation?.corroboration || []).map(item => ({ ...item, tone: 'corroboration' })),
    ...(correlation?.contradictions || []).map(item => ({ ...item, tone: 'contradiction' })),
  ].slice(0, 32);

  byId.get('temporal-context').facts = temporalFacts(decision, cards);
  byId.get('attack-behavior').items = attackItems(decision, guidance);
  byId.get('analyst-actions').items = actionItems(decision, guidance);
  byId.get('analyst-actions').summary = byId.get('analyst-actions').items.length
    ? 'Prioritized deterministic hunt guidance derived from existing Decision/Guidance output; validate telemetry availability before execution.'
    : 'No deterministic hunt plan was emitted for this result.';

  byId.get('huntability').facts = [
    { label: 'LEVEL', value: labelize(correlation?.huntability?.level ?? decision?.assessment?.huntability ?? 'unknown') },
    { label: 'RATIONALE', value: correlation?.huntability?.rationale ?? humanizeToken(correlation?.huntability?.reason) ?? 'No huntability rationale emitted.' },
    { label: 'TELEMETRY READINESS', value: labelize(decision?.telemetry?.status ?? guidance?.telemetry?.status ?? 'unknown') },
    { label: 'REQUIRED TABLES', value: (decision?.telemetry?.requiredTables ?? guidance?.telemetry?.requiredTables ?? []).join(', ') || 'none specified' },
    { label: 'ENVIRONMENT VALIDATED', value: (decision?.telemetry?.environmentValidated ?? guidance?.telemetry?.environmentValidated) === true ? 'YES' : 'NO' },
  ];

  const limitationValues = [...new Set([
    ...(overview.limitations || []),
    ...(overview.correlationLimitations || []),
    ...(correlation?.limitations || []),
    ...(guidance?.limitations || []),
  ].filter(Boolean).map(value => String(value).includes(' ') ? String(value) : humanizeToken(value)))];
  byId.get('coverage').summary = coverage?.summaryText ?? overview.coverage;
  byId.get('coverage').failures = (coverage?.failures || []).slice(0, 32);
  byId.get('coverage').facts = limitationValues.map((value, index) => ({ label: \`LIMITATION ${'${index + 1}'}\`, value }));

  const assessment = buildIpAssessment({ overview, evidence: cards, correlation: correlation || {}, sections });
  return {
    title: \`IP INTELLIGENCE REPORT // ${'${overview.indicator}'}\`,
    indicator: overview.indicator,
    status: overview.status,
    profile: overview.profile,
    durationMs: overview.durationMs,
    assessment,
    sections,
  };
}

function textFact`, 'buildIpAnalystReport');

vm = vm.replace(`        for (const fact of item.facts || []) lines.push(textFact(fact, '  '));\n      } else {`, `        for (const fact of item.facts || []) lines.push(textFact(fact, '  '));\n        for (const fact of item.detailFacts || []) lines.push(textFact(fact, '  '));\n      } else {`);
vm = vm.replace(`        for (const fact of item.facts || []) lines.push(textFact(fact, '  '));\n      }\n    }`, `        for (const fact of item.facts || []) lines.push(textFact(fact, '  '));\n        for (const fact of item.detailFacts || []) lines.push(textFact(fact, '  '));\n      }\n    }`);
write('app/view-model.js', vm);

let renderers = read('app/renderers.js');
renderers = replaceOne(renderers, /function ipSignalLine\(item\) \{[\s\S]*?\n\}/, `function ipSignalLine(item) {
  const details = el('details', \`fact-card ip-source-line ip-source-details semantic-${'${item.semanticClass || \'evidence\'}'}\`);
  const summary = el('summary', 'ip-source-summary');
  summary.append(
    el('strong', 'signal-provider', item.provider),
    el('span', 'signal-kind', item.kind),
    el('strong', 'signal-verdict', item.verdict),
  );
  details.append(summary);
  if (item.semanticNote) details.append(el('p', 'semantic-note', item.semanticNote));
  appendFacts(details, item.facts || []);
  return details;
}`, 'ipSignalLine');

renderers = renderers.replace(`function compactFailureLine(failure) {`, `function ipActionLine(item) {
  const article = el('article', 'fact-card ip-action-line');
  if (item.title) article.append(el('h3', 'fact-title ip-action-title', item.title));
  appendFacts(article, item.facts || []);
  const details = el('details', 'ip-action-details');
  details.append(el('summary', null, 'HUNT DETAIL / TUNING / KQL'));
  appendFacts(details, item.detailFacts || []);
  article.append(details);
  return article;
}

function compactFailureLine(failure) {`);

renderers = renderers.replace(`  const assessment = el('section', 'brief-section ip-report-assessment');`, `  const assessment = el('section', 'brief-section ip-report-assessment ip-at-a-glance');`);

renderers = renderers.replace(`    if (section.id === 'related-infrastructure' || section.id === 'correlation') {`, `    if (section.id === 'analyst-actions') {
      if (!section.items?.length) block.append(el('p', 'empty-state', 'No deterministic analyst actions emitted.'));
      for (const item of section.items || []) block.append(ipActionLine(item));
      root.append(block);
      continue;
    }

    if (section.id === 'related-infrastructure' || section.id === 'correlation' || section.id === 'attack-behavior') {`);
write('app/renderers.js', renderers);

let css = read('app/analyst-facts.css');
css = appendOnce(css, '.ip-at-a-glance{', `.ip-at-a-glance{position:relative}
.ip-at-a-glance>.fact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:2px 10px}
.ip-source-details{display:block;margin:3px 0;padding:0;overflow:hidden}
.ip-source-details>summary{display:grid;grid-template-columns:minmax(90px,1fr) minmax(110px,1.2fr) auto;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;list-style:none}
.ip-source-details>summary::-webkit-details-marker{display:none}
.ip-source-details[open]>summary{border-bottom:1px dotted var(--terminal-line)}
.ip-source-details>.fact-grid,.ip-source-details>.semantic-note{margin:6px 8px 8px}
.ip-action-line{margin:5px 0;padding:8px 10px}
.ip-action-title{margin-bottom:5px}
.ip-action-details{margin-top:6px;padding-top:5px;border-top:1px dotted var(--terminal-line)}
.ip-action-details>summary{color:var(--terminal-muted);font-size:9px;letter-spacing:.06em;cursor:pointer}
.ip-action-details .fact-value{white-space:pre-wrap;overflow-wrap:anywhere}
@media(max-width:430px){.ip-at-a-glance>.fact-grid{grid-template-columns:1fr}.ip-source-details>summary{grid-template-columns:minmax(74px,1fr) minmax(82px,1fr);gap:5px;padding:5px 6px}.ip-source-details>summary .signal-verdict{grid-column:1/-1;font-size:9px}.ip-action-line{padding:6px}.ip-action-details>summary{font-size:8.5px}}`);
write('app/analyst-facts.css', css);

let oldTest = read('test/ip-report-max.test.mjs');
oldTest = oldTest.replace(`    'correlation', 'huntability', 'coverage',`, `    'correlation', 'temporal-context', 'attack-behavior', 'analyst-actions', 'huntability', 'coverage',`);
write('test/ip-report-max.test.mjs', oldTest);

console.log('Applied deterministic IP report MAX depth/UX patch.');
