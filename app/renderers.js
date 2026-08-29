if (typeof document !== 'undefined' && !document.querySelector('link[href="/app/analyst-facts.css"]')) {
  const styles = document.createElement('link');
  styles.rel = 'stylesheet';
  styles.href = '/app/analyst-facts.css';
  document.head.append(styles);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function inline(value) {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(inline).join(', ');
  if (typeof value === 'object') {
    if (typeof value.url === 'string') return value.url;
    return Object.entries(value).map(([key, item]) => `${key}=${inline(item)}`).join(' · ');
  }
  return String(value);
}

function appendFacts(target, facts, empty = '') {
  if (!facts?.length) {
    if (empty) target.append(el('p', 'empty-state', empty));
    return;
  }
  const grid = el('dl', 'fact-grid');
  for (const fact of facts) {
    const row = el('div', 'fact-row');
    row.append(el('dt', 'fact-label', fact.label), el('dd', 'fact-value', fact.value));
    grid.append(row);
  }
  target.append(grid);
}

function factCard(item, className = 'fact-card') {
  const card = el('article', className);
  if (item.title) card.append(el('h3', 'fact-title', item.title));
  appendFacts(card, item.facts || []);
  return card;
}

function sectionLabel(title) {
  return el('h2', 'view-label analyst-section-label', title);
}

function overviewContent(model) {
  const panel = el('section', `overview tone-${model.tone}`);
  const fields = [
    ['STATUS', String(model.status || 'unknown').toUpperCase()], ['TYPE', model.type], ['INDICATOR', model.indicator],
    ['PROFILE', model.profile], ['DURATION', model.durationMs == null ? '—' : `${model.durationMs} ms`],
    ['FRESHNESS', model.freshness], ['HUNTABILITY', model.huntability?.level ?? '—'],
    ['OK', model.providerSummary.ok ?? 0], ['FAILED', model.providerSummary.failed ?? 0],
    ['NOT RUN', model.providerSummary.skipped ?? 0], ['CACHED', model.providerSummary.cached ?? 0],
  ];
  for (const [label, value] of fields) {
    const cell = el('div', 'hud-cell');
    cell.append(el('span', 'hud-label', label), el('strong', 'hud-value', value));
    panel.append(cell);
  }
  panel.append(el('p', 'coverage-line', `COVERAGE // ${model.coverage}`));
  if (model.huntability?.rationale) panel.append(el('p', 'hunt-rationale', model.huntability.rationale));
  if (model.limitations?.length) {
    const limits = el('div', 'analyst-limitations');
    limits.append(el('strong', 'analyst-limitations-label', 'LIMITATIONS'));
    for (const limitation of model.limitations) limits.append(el('p', 'signal-meta', limitation));
    panel.append(limits);
  }
  return panel;
}

function evidenceContent(cards) {
  const wrap = el('section', 'evidence-list');
  if (!cards.length) {
    wrap.append(el('p', 'empty-state', 'No evidence items returned. Absence of evidence is not a benign verdict.'));
    return wrap;
  }
  for (const card of cards) {
    const article = el('article', `signal semantic-${card.semanticClass}`);
    const head = el('header', 'signal-head');
    head.append(el('p', 'signal-provider', card.provider), el('p', 'signal-kind', card.kind));
    article.append(head);
    if (card.verdict !== null) article.append(el('strong', 'signal-verdict', String(card.verdict).toUpperCase()));
    if (card.semanticNote) article.append(el('p', 'semantic-note', card.semanticNote));

    const primary = [];
    if (card.confidence !== null) primary.push({ label: 'CONFIDENCE', value: card.confidence });
    if (card.firstSeen) primary.push({ label: 'FIRST SEEN', value: card.firstSeen });
    if (card.lastSeen) primary.push({ label: 'LAST SEEN', value: card.lastSeen });
    if (card.malwareFamily) primary.push({ label: 'MALWARE', value: card.malwareFamily });
    if (card.tags.length) primary.push({ label: 'TAGS', value: card.tags.join(', ') });
    appendFacts(article, primary);

    if (card.actorFacts.length) {
      article.append(el('h3', 'fact-subtitle', 'ACTOR / ATTRIBUTION FACTS'));
      appendFacts(article, card.actorFacts);
    }
    if (card.attributeFacts.length) {
      article.append(el('h3', 'fact-subtitle', 'OBSERVED FACTS'));
      appendFacts(article, card.attributeFacts);
    }

    const details = el('details', 'signal-details');
    details.append(el('summary', null, 'TECHNICAL / PROVENANCE'));
    appendFacts(details, [
      { label: 'CACHE', value: card.cacheState ?? 'unknown' },
      { label: 'RETRIEVED', value: card.retrievedAt ?? 'unknown' },
      { label: 'PARSER', value: card.parserVersion ?? 'unknown' },
      { label: 'FINGERPRINT', value: card.fingerprint ?? 'unavailable' },
    ]);
    for (const reference of card.references) {
      const line = el('p', 'reference-line');
      const raw = inline(reference);
      let linked = false;
      const candidate = typeof reference === 'string' ? reference : reference?.url;
      if (typeof candidate === 'string') {
        try {
          const url = new URL(candidate);
          if (url.protocol === 'https:') {
            const link = el('a', 'reference', raw);
            link.href = url.href;
            link.rel = 'noopener noreferrer';
            link.target = '_blank';
            line.append(link);
            linked = true;
          }
        } catch {}
      }
      if (!linked) line.append(el('span', 'reference', raw));
      details.append(line);
    }
    article.append(details);
    wrap.append(article);
  }
  return wrap;
}

function correlationContent(model) {
  const section = el('section', 'correlation-grid');
  appendFacts(section, [
    { label: 'FRESHNESS', value: model.freshness },
    { label: 'HUNTABILITY', value: model.huntability?.level ?? 'unknown' },
    ...(model.attributionConfidence !== null ? [{ label: 'ATTRIBUTION CONFIDENCE', value: inline(model.attributionConfidence) }] : []),
  ]);
  if (model.huntability?.rationale) section.append(el('p', 'signal-meta', model.huntability.rationale));

  const corroboration = el('section', 'corroboration-list');
  corroboration.append(sectionLabel('CORROBORATION'));
  for (const item of model.corroboration) corroboration.append(factCard(item, 'fact-card corroboration'));
  if (!model.corroboration.length) corroboration.append(el('p', 'empty-state', 'No independent same-class corroboration emitted.'));
  section.append(corroboration);

  const contradictions = el('section', 'contradiction-list');
  contradictions.append(sectionLabel('CONTRADICTIONS'));
  for (const item of model.contradictions) contradictions.append(factCard(item, 'fact-card contradiction'));
  if (!model.contradictions.length) contradictions.append(el('p', 'empty-state', 'No contradictions emitted.'));
  section.append(contradictions);

  const axes = el('section', 'risk-axes');
  axes.append(sectionLabel('CVE RISK AXES'));
  for (const [name, value] of Object.entries(model.riskAxes)) {
    const row = el('div', `risk-axis risk-${name}`);
    row.append(el('strong', 'risk-axis-label', name.toUpperCase()), el('code', 'risk-axis-value', value.display));
    axes.append(row);
  }
  section.append(axes);
  return section;
}

function relationshipsContent(relationships) {
  const chain = el('section', 'relationship-chain');
  for (const relationship of relationships) chain.append(factCard(relationship, 'fact-card relationship'));
  if (!relationships.length) chain.append(el('p', 'empty-state', 'No explicit relationships emitted.'));
  return chain;
}

function coverageContent(model) {
  const panel = el('section', 'coverage');
  panel.append(el('p', 'coverage-summary', model.summaryText));
  if (!model.failures.length) {
    panel.append(el('p', 'empty-state', 'No provider failures reported.'));
    return panel;
  }
  for (const failure of model.failures) {
    const card = el('article', `coverage-failure failure-${failure.state}`);
    const header = el('header', 'failure-head');
    header.append(
      el('strong', 'failure-provider', failure.provider),
      el('span', 'failure-state', failure.state.toUpperCase()),
    );
    card.append(header, el('strong', 'failure-label', failure.label), el('p', 'failure-summary', failure.summary));
    appendFacts(card, failure.details);
    panel.append(card);
  }
  return panel;
}

export function clear(target) {
  while (target.firstChild) target.removeChild(target.firstChild);
}

export function renderOverview(target, model) {
  clear(target);
  target.append(overviewContent(model));
}

export function renderEvidence(target, cards) {
  clear(target);
  target.append(evidenceContent(cards));
}

export function renderCorrelation(target, model) {
  clear(target);
  target.append(correlationContent(model));
}

export function renderRelationships(target, relationships) {
  clear(target);
  target.append(relationshipsContent(relationships));
}

export function renderCoverage(target, model) {
  clear(target);
  target.append(coverageContent(model));
}

export function renderFacts(target, title, facts, tone = '') {
  clear(target);
  const section = el('section', `fact-section${tone ? ` fact-${tone}` : ''}`);
  section.append(sectionLabel(title));
  appendFacts(section, facts, 'No facts available.');
  target.append(section);
}

export function renderBrief(target, { overview, evidence, correlation, relationships, coverage }) {
  clear(target);
  const brief = el('section', 'analyst-brief');

  const summarySection = el('section', 'brief-section brief-summary');
  summarySection.append(sectionLabel('SUMMARY'), overviewContent(overview));
  brief.append(summarySection);

  const evidenceSection = el('section', 'brief-section brief-evidence');
  evidenceSection.append(sectionLabel('EVIDENCE'), evidenceContent(evidence));
  brief.append(evidenceSection);

  const correlationSection = el('section', 'brief-section brief-correlation');
  correlationSection.append(sectionLabel('CORRELATION / RISK'), correlationContent(correlation));
  brief.append(correlationSection);

  const relationshipSection = el('section', 'brief-section brief-relationships');
  relationshipSection.append(sectionLabel('RELATIONSHIPS'), relationshipsContent(relationships));
  brief.append(relationshipSection);

  const coverageSection = el('section', 'brief-section brief-coverage');
  coverageSection.append(sectionLabel('FAILURES / COVERAGE'), coverageContent(coverage));
  brief.append(coverageSection);

  target.append(brief);
}

export function renderRaw(target, lines, query = '') {
  clear(target);
  const needle = String(query).toLowerCase();
  const pre = el('pre', 'raw-console');
  for (const line of lines) {
    if (needle && !line.text.toLowerCase().includes(needle)) continue;
    const row = el('span', 'code-line');
    row.append(el('span', 'line-number', line.number), el('span', 'line-text', line.text));
    pre.append(row);
  }
  target.append(pre);
}
