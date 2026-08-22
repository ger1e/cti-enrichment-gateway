const MAX_ITEMS = 512;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function stable(value) {
  return JSON.stringify(canonical(value));
}

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
}

function primitiveDiff(before, after) {
  const left = new Set(before);
  const right = new Set(after);
  return {
    added: sortedUnique([...right].filter(value => !left.has(value))),
    removed: sortedUnique([...left].filter(value => !right.has(value))),
  };
}

function objectDiff(before, after, key = stable) {
  const left = new Map(before.map(item => [key(item), item]));
  const right = new Map(after.map(item => [key(item), item]));
  return {
    added: [...right.entries()].filter(([id]) => !left.has(id)).map(([, item]) => canonical(item)).sort((a, b) => stable(a).localeCompare(stable(b))),
    removed: [...left.entries()].filter(([id]) => !right.has(id)).map(([, item]) => canonical(item)).sort((a, b) => stable(a).localeCompare(stable(b))),
  };
}

function bounded(items, field) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) throw new TypeError(`invalid or oversized ${field}`);
  return items;
}

function evidenceProviders(model) {
  return sortedUnique(bounded(model.evidence ?? [], 'evidence').map(item => item.provider).filter(Boolean));
}

function verdictMap(model) {
  const grouped = new Map();
  for (const item of bounded(model.evidence ?? [], 'evidence')) {
    const provider = String(item?.provider ?? '');
    const kind = String(item?.observation?.kind ?? '');
    const verdict = String(item?.observation?.verdict ?? 'unknown');
    if (!provider || !kind) continue;
    const key = `${provider}\u0000${kind}`;
    const current = grouped.get(key) ?? { provider, kind, verdicts: [] };
    current.verdicts.push(verdict);
    grouped.set(key, current);
  }
  return new Map([...grouped.entries()].map(([key, value]) => [key, {
    provider: value.provider,
    kind: value.kind,
    verdict: sortedUnique(value.verdicts).length === 1 ? sortedUnique(value.verdicts)[0] : sortedUnique(value.verdicts),
  }]));
}

function verdictChanges(before, after) {
  const left = verdictMap(before);
  const right = verdictMap(after);
  const changes = [];
  for (const key of sortedUnique([...left.keys()].filter(id => right.has(id)))) {
    const a = left.get(key);
    const b = right.get(key);
    if (stable(a.verdict) !== stable(b.verdict)) changes.push({ provider: a.provider, kind: a.kind, before: a.verdict, after: b.verdict });
  }
  return changes;
}

function relationShape(item) {
  return {
    provider: item?.provider ?? null,
    relationship: item?.relationship ?? null,
    type: item?.type ?? null,
    value: item?.value ?? item?.target ?? null,
  };
}

function attackDiff(before, after) {
  const left = new Map(bounded(before.frameworks?.attack ?? [], 'attack').map(item => [item.id, item]));
  const right = new Map(bounded(after.frameworks?.attack ?? [], 'attack').map(item => [item.id, item]));
  const added = [...right.entries()].filter(([id]) => !left.has(id)).map(([, item]) => canonical(item)).sort((a, b) => a.id.localeCompare(b.id));
  const removed = [...left.entries()].filter(([id]) => !right.has(id)).map(([, item]) => canonical(item)).sort((a, b) => a.id.localeCompare(b.id));
  const changed = [];
  for (const id of sortedUnique([...left.keys()].filter(key => right.has(key)))) {
    const a = left.get(id);
    const b = right.get(id);
    if (a.mappingState !== b.mappingState) changed.push({ id, before: a.mappingState, after: b.mappingState });
  }
  return { added, removed, changed };
}

function huntDiff(before, after) {
  const left = new Map(bounded(before.huntOpportunities ?? [], 'hunts').map(item => [item.id, item]));
  const right = new Map(bounded(after.huntOpportunities ?? [], 'hunts').map(item => [item.id, item]));
  const added = [...right.entries()].filter(([id]) => !left.has(id)).map(([, item]) => canonical(item)).sort((a, b) => a.id.localeCompare(b.id));
  const removed = [...left.entries()].filter(([id]) => !right.has(id)).map(([, item]) => canonical(item)).sort((a, b) => a.id.localeCompare(b.id));
  const changed = [];
  for (const id of sortedUnique([...left.keys()].filter(key => right.has(key)))) {
    const a = canonical(left.get(id));
    const b = canonical(right.get(id));
    if (stable(a) !== stable(b)) changed.push({ id, before: a, after: b });
  }
  return { added, removed, changed };
}

function sameSubject(before, after) {
  return String(before?.subject?.type ?? '').toLowerCase() === String(after?.subject?.type ?? '').toLowerCase() &&
    String(before?.subject?.value ?? '') === String(after?.subject?.value ?? '');
}

export function diffReportModels(before, after) {
  if (!before || typeof before !== 'object' || !after || typeof after !== 'object') throw new TypeError('two ReportModels are required');
  if (!sameSubject(before, after)) throw new Error('report diff requires the same subject');

  const observables = objectDiff(
    bounded(before.observables ?? [], 'observables'),
    bounded(after.observables ?? [], 'observables'),
    item => `${String(item.type).toLowerCase()}\u0000${String(item.value)}`,
  );
  const relationships = objectDiff(
    bounded(before.relationships ?? [], 'relationships').map(relationShape),
    bounded(after.relationships ?? [], 'relationships').map(relationShape),
  );
  const providers = primitiveDiff(evidenceProviders(before), evidenceProviders(after));
  const evidence = primitiveDiff(
    bounded(before.evidence ?? [], 'evidence').map(item => item.id),
    bounded(after.evidence ?? [], 'evidence').map(item => item.id),
  );
  const limitations = primitiveDiff(
    bounded(before.limitations ?? [], 'limitations').map(String),
    bounded(after.limitations ?? [], 'limitations').map(String),
  );

  return canonical({
    diffVersion: '1.0',
    subject: { type: String(before.subject.type).toLowerCase(), value: String(before.subject.value) },
    before: { reportId: before.reportId, snapshotSha256: before.reproducibility?.snapshotSha256 ?? null },
    after: { reportId: after.reportId, snapshotSha256: after.reproducibility?.snapshotSha256 ?? null },
    status: {
      before: before.source?.status ?? null,
      after: after.source?.status ?? null,
      changed: (before.source?.status ?? null) !== (after.source?.status ?? null),
    },
    evidence,
    observables,
    providers,
    verdictChanges: verdictChanges(before, after),
    relationships,
    attack: attackDiff(before, after),
    hunts: huntDiff(before, after),
    limitations,
  });
}
