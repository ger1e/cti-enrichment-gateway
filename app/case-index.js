import { observableKey } from './case-model.js';

const MAX_INDEX_ENTRIES = 20000;
const clone = value => structuredClone(value);

function sightingKey(sighting) {
  return [
    sighting.type,
    sighting.value,
    sighting.caseId,
    sighting.source,
    sighting.snapshotId ?? '',
  ].join('\u0000');
}

function compareSightings(a, b) {
  return String(a.caseId).localeCompare(String(b.caseId))
    || String(a.source).localeCompare(String(b.source))
    || String(a.snapshotId ?? '').localeCompare(String(b.snapshotId ?? ''));
}

function addSighting(index, seen, sighting) {
  const dedupeKey = sightingKey(sighting);
  if (seen.has(dedupeKey)) return;
  seen.add(dedupeKey);
  if (seen.size > MAX_INDEX_ENTRIES) throw new Error('case_index_limit');

  const key = observableKey({ type: sighting.type, value: sighting.value });
  const values = index.get(key) ?? [];
  values.push(sighting);
  index.set(key, values);
}

export function buildCaseIndex(cases) {
  const entries = new Map();
  const seen = new Set();

  for (const caseValue of Array.isArray(cases) ? cases : []) {
    const caseId = String(caseValue?.id ?? '');
    const caseTitle = String(caseValue?.title ?? '');
    if (!caseId) continue;

    for (const pin of Array.isArray(caseValue?.pins) ? caseValue.pins : []) {
      if (typeof pin?.type !== 'string' || typeof pin?.value !== 'string' || !pin.type || !pin.value) continue;
      addSighting(entries, seen, {
        type: pin.type,
        value: pin.value,
        caseId,
        caseTitle,
        source: 'pin',
        snapshotId: null,
      });
    }

    for (const snapshot of Array.isArray(caseValue?.snapshots) ? caseValue.snapshots : []) {
      const snapshotId = typeof snapshot?.id === 'string' && snapshot.id ? snapshot.id : null;

      if (typeof snapshot?.type === 'string' && snapshot.type && typeof snapshot?.indicator === 'string' && snapshot.indicator) {
        addSighting(entries, seen, {
          type: snapshot.type,
          value: snapshot.indicator,
          caseId,
          caseTitle,
          source: 'snapshot',
          snapshotId,
        });
      }

      for (const relationship of Array.isArray(snapshot?.evidence?.relationships) ? snapshot.evidence.relationships : []) {
        if (typeof relationship?.targetType !== 'string' || !relationship.targetType) continue;
        if (typeof relationship?.target !== 'string' || !relationship.target) continue;
        addSighting(entries, seen, {
          type: relationship.targetType,
          value: relationship.target,
          caseId,
          caseTitle,
          source: 'relationship',
          snapshotId,
        });
      }

      for (const mapping of Array.isArray(snapshot?.evidence?.decision?.attackMappings) ? snapshot.evidence.decision.attackMappings : []) {
        if (typeof mapping?.id !== 'string' || !mapping.id) continue;
        addSighting(entries, seen, {
          type: 'attack',
          value: mapping.id,
          caseId,
          caseTitle,
          source: 'attack',
          snapshotId,
        });
      }
    }
  }

  for (const values of entries.values()) values.sort(compareSightings);

  return Object.freeze({
    entries,
    total: seen.size,
  });
}

export function findCaseSightings(index, { type, value } = {}) {
  if (typeof type !== 'string' || typeof value !== 'string') return [];
  const values = index?.entries instanceof Map
    ? index.entries.get(observableKey({ type, value }))
    : null;
  return clone(Array.isArray(values) ? values : []);
}

export { MAX_INDEX_ENTRIES };
