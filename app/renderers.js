function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function printable(value) {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return '[unavailable]'; }
}

export function clear(target) {
  while (target.firstChild) target.removeChild(target.firstChild);
}

export function renderOverview(target, model) {
  clear(target);
  const panel = el('section', `overview tone-${model.tone}`);
  const fields = [
    ['STATUS', model.status], ['TYPE', model.type], ['INDICATOR', model.indicator],
    ['PROFILE', model.profile], ['DURATION', model.durationMs == null ? '—' : `${model.durationMs} ms`],
    ['FRESHNESS', model.freshness], ['HUNTABILITY', model.huntability?.level ?? '—'],
    ['OK', model.providerSummary.ok ?? 0], ['FAILED', model.providerSummary.failed ?? 0],
    ['SKIPPED', model.providerSummary.skipped ?? 0], ['CACHED', model.providerSummary.cached ?? 0],
  ];
  for (const [label, value] of fields) {
    const cell = el('div', 'hud-cell');
    cell.append(el('span', 'hud-label', label), el('strong', 'hud-value', value));
    panel.append(cell);
  }
  if (model.huntability?.rationale) panel.append(el('p', 'hunt-rationale', model.huntability.rationale));
  target.append(panel);
}

export function renderEvidence(target, cards) {
  clear(target);
  if (!cards.length) {
    target.append(el('p', 'empty-state', 'No evidence items returned.'));
    return;
  }
  for (const card of cards) {
    const article = el('article', `signal semantic-${card.semanticClass}`);
    const head = el('header', 'signal-head');
    head.append(el('p', 'signal-provider', card.provider), el('p', 'signal-kind', card.kind));
    article.append(head);
    if (card.verdict !== null) article.append(el('strong', 'signal-verdict', card.verdict));
    if (card.semanticNote) article.append(el('p', 'semantic-note', card.semanticNote));
    if (card.confidence !== null) article.append(el('p', 'signal-meta', `confidence: ${card.confidence}`));
    if (card.firstSeen) article.append(el('p', 'signal-meta', `first seen: ${card.firstSeen}`));
    if (card.lastSeen) article.append(el('p', 'signal-meta', `last seen: ${card.lastSeen}`));
    if (card.malwareFamily) article.append(el('p', 'signal-meta', `malware: ${card.malwareFamily}`));
    if (card.actor) article.append(el('p', 'signal-meta', `actor: ${printable(card.actor)}`));
    if (card.tags.length) article.append(el('p', 'signal-meta', `tags: ${card.tags.map(printable).join(', ')}`));
    if (Object.keys(card.attributes).length) article.append(el('pre', 'signal-attributes', JSON.stringify(card.attributes, null, 2)));

    const details = el('details', 'signal-details');
    details.append(
      el('summary', null, 'TECHNICAL / PROVENANCE'),
      el('p', null, `cache: ${card.cacheState ?? 'unknown'}`),
      el('p', null, `retrieved: ${card.retrievedAt ?? 'unknown'}`),
      el('p', null, `parser: ${card.parserVersion ?? 'unknown'}`),
      el('p', null, `fingerprint: ${card.fingerprint ?? 'unavailable'}`),
    );
    for (const reference of card.references) {
      const line = el('p', 'reference-line');
      const raw = printable(reference);
      let linked = false;
      if (typeof reference === 'string') {
        try {
          const url = new URL(reference);
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
    target.append(article);
  }
}

export function renderCorrelation(target, model) {
  clear(target);
  const section = el('section', 'correlation-grid');
  section.append(
    el('p', 'signal-meta', `freshness: ${model.freshness}`),
    el('p', 'signal-meta', `huntability: ${model.huntability?.level ?? 'unknown'}`),
  );
  if (model.huntability?.rationale) section.append(el('p', 'signal-meta', model.huntability.rationale));
  if (model.attributionConfidence !== null) section.append(el('p', 'signal-meta', `attribution confidence: ${printable(model.attributionConfidence)}`));

  const corroboration = el('section', 'corroboration-list');
  corroboration.append(el('h2', 'view-label', 'CORROBORATION'));
  for (const item of model.corroboration) corroboration.append(el('pre', 'corroboration', JSON.stringify(item, null, 2)));
  if (!model.corroboration.length) corroboration.append(el('p', 'empty-state', 'No corroboration emitted.'));
  section.append(corroboration);

  const contradictions = el('section', 'contradiction-list');
  contradictions.append(el('h2', 'view-label', 'CONTRADICTIONS'));
  for (const item of model.contradictions) contradictions.append(el('pre', 'contradiction', JSON.stringify(item, null, 2)));
  if (!model.contradictions.length) contradictions.append(el('p', 'empty-state', 'No contradictions emitted.'));
  section.append(contradictions);

  const axes = el('section', 'risk-axes');
  axes.append(el('h2', 'view-label', 'CVE RISK AXES'));
  for (const [name, value] of Object.entries(model.riskAxes)) {
    const row = el('div', `risk-axis risk-${name}`);
    row.append(el('strong', null, name.toUpperCase()), el('code', null, value == null ? 'unavailable' : JSON.stringify(value)));
    axes.append(row);
  }
  section.append(axes);
  target.append(section);
}

export function renderRelationships(target, relationships) {
  clear(target);
  const chain = el('div', 'relationship-chain');
  for (const relationship of relationships) chain.append(el('pre', 'relationship', JSON.stringify(relationship, null, 2)));
  if (!relationships.length) chain.append(el('p', 'empty-state', 'No relationships emitted.'));
  target.append(chain);
}

export function renderCoverage(target, model) {
  clear(target);
  const panel = el('section', 'coverage');
  panel.append(el('p', 'coverage-summary', `ok ${model.summary.ok ?? 0} · failed ${model.summary.failed ?? 0} · skipped ${model.summary.skipped ?? 0} · cached ${model.summary.cached ?? 0}`));
  for (const failure of model.failures) panel.append(el('pre', 'coverage-failure', JSON.stringify(failure, null, 2)));
  if (!model.failures.length) panel.append(el('p', 'empty-state', 'No provider failures reported.'));
  target.append(panel);
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
