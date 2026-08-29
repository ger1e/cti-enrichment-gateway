import { latestSnapshot } from './case-model.js';
import { buildCaseIndex, findCaseSightings } from './case-index.js';
import { CASE_BUNDLE_MEDIA_TYPE, parseCaseBundle, serializeCaseBundle } from './case-bundle.js';
import { toGatewayIndicator } from './observable-input.js';

const MAX_REFRESH_OBSERVABLES = 100;
const REFRESH_CHUNK_SIZE = 20;
const STALE_AFTER_MS = 86_400_000;
const CAPTURE_WARNING = 'case capture failed; enrichment result remains valid';
const clone = value => structuredClone(value);

function safeCaseFilename(caseValue) {
  const stem = String(caseValue?.title || caseValue?.id || 'case')
    .replace(/[^a-z0-9._-]+/gi, '_')
    .slice(0, 80) || 'case';
  return `${stem}.para11ax`;
}

function workspaceUnavailable() {
  return new Error('workspace unavailable');
}

function isStorageFailure(error) {
  return error?.message === 'workspace_storage_failed';
}

export function createCaseRuntime({
  cases = null,
  client,
  now = () => new Date(),
  downloadText = () => {},
  readImportText = null,
} = {}) {
  if (!client || typeof client.batch !== 'function') throw new TypeError('case runtime client required');
  let activeCaseId = null;

  function requireWorkspace() {
    if (!cases) throw workspaceUnavailable();
  }

  async function repositoryCall(operation) {
    requireWorkspace();
    try {
      return await operation();
    } catch (error) {
      if (isStorageFailure(error)) throw workspaceUnavailable();
      throw error;
    }
  }

  async function requireActiveCaseTarget() {
    requireWorkspace();
    const caseId = activeCaseId;
    if (!caseId) throw new Error('no active case');
    const value = await repositoryCall(() => cases.get(caseId));
    if (!value) {
      if (activeCaseId === caseId) activeCaseId = null;
      throw new Error('case_not_found');
    }
    return { caseId, value };
  }

  function reset() {
    activeCaseId = null;
  }

  async function captureResult(result) {
    if (!activeCaseId || !result || !['ok', 'partial'].includes(result.status)) {
      return { captured: false, warning: null };
    }
    if (!cases) return { captured: false, warning: CAPTURE_WARNING };
    const targetCaseId = activeCaseId;
    try {
      await cases.capture(targetCaseId, clone(result));
      return { captured: true, warning: null };
    } catch {
      return { captured: false, warning: CAPTURE_WARNING };
    }
  }

  async function importText(text) {
    requireWorkspace();
    const imported = parseCaseBundle(text);
    const existing = await repositoryCall(() => cases.get(imported.id));
    if (existing) throw new Error('case_import_conflict');
    const saved = await repositoryCall(() => cases.save(imported));
    activeCaseId = saved.id;
    return { case: clone(saved) };
  }

  async function refreshCase(action, { profile = 'standard', signal } = {}) {
    const { caseId: targetCaseId, value: caseValue } = await requireActiveCaseTarget();
    const threshold = now().getTime() - STALE_AFTER_MS;
    const selected = action.staleOnly
      ? caseValue.pins.filter(pin => {
        const snapshot = latestSnapshot(caseValue, pin);
        if (!snapshot) return true;
        const captured = Date.parse(snapshot.capturedAt);
        return !Number.isFinite(captured) || captured < threshold;
      })
      : [...caseValue.pins];

    if (selected.length > MAX_REFRESH_OBSERVABLES) throw new Error('case refresh limit is 100 observables');
    if (!selected.length) return { selected: 0, captured: 0, batches: [], failures: [] };

    const batches = [];
    const failures = [];
    let captured = 0;

    for (let offset = 0; offset < selected.length; offset += REFRESH_CHUNK_SIZE) {
      const pins = selected.slice(offset, offset + REFRESH_CHUNK_SIZE);
      const indicators = pins.map(pin => toGatewayIndicator(pin));
      const batch = await client.batch(indicators, profile, signal);
      batches.push(clone(batch));
      for (const item of Array.isArray(batch?.results) ? batch.results : []) {
        const enrichment = item?.enrichment;
        if (!enrichment || !['ok', 'partial'].includes(enrichment.status)) {
          failures.push(clone(item));
          continue;
        }
        try {
          await repositoryCall(() => cases.capture(targetCaseId, clone(enrichment)));
          captured += 1;
        } catch (error) {
          failures.push({ index: item.index, input: item.input, status: 'error', reason: error?.message || 'case_capture_failed' });
        }
      }
    }

    return { selected: selected.length, captured, batches, failures };
  }

  async function handle(action, { currentResult = null, profile = 'standard', signal } = {}) {
    const name = action?.action;
    if (name === 'case-new') {
      const created = await repositoryCall(() => cases.create(action.title));
      activeCaseId = created.id;
      return { case: clone(created) };
    }
    if (name === 'case-open') {
      const value = await repositoryCall(() => cases.get(action.caseId));
      if (!value) throw new Error('case_not_found');
      activeCaseId = value.id;
      return { case: clone(value) };
    }
    if (name === 'case-close') {
      reset();
      return { closed: true };
    }
    if (name === 'case-list') {
      return { cases: clone(await repositoryCall(() => cases.list())) };
    }
    if (name === 'case-show') {
      const { value } = await requireActiveCaseTarget();
      return { case: clone(value) };
    }
    if (name === 'case-pin') {
      if (!currentResult || typeof currentResult.type !== 'string' || typeof currentResult.indicator !== 'string') throw new Error('no enrichment result loaded');
      const { caseId } = await requireActiveCaseTarget();
      const value = await repositoryCall(() => cases.addPin(caseId, { type: currentResult.type, value: currentResult.indicator }));
      return { case: clone(value) };
    }
    if (name === 'case-unpin') {
      const { caseId } = await requireActiveCaseTarget();
      const value = await repositoryCall(() => cases.removePin(caseId, action.observable));
      return { case: clone(value) };
    }
    if (name === 'case-note') {
      const { caseId } = await requireActiveCaseTarget();
      const value = await repositoryCall(() => cases.addNote(caseId, action.text));
      return { case: clone(value) };
    }
    if (name === 'case-diff') {
      const { value } = await requireActiveCaseTarget();
      const candidates = currentResult
        ? value.diffs.filter(diff => diff?.type === currentResult.type && diff?.indicator === currentResult.indicator)
        : value.diffs;
      const diff = candidates.length ? candidates[candidates.length - 1] : null;
      return { diff: clone(diff) };
    }
    if (name === 'case-find') {
      const allCases = await repositoryCall(() => cases.list());
      const index = buildCaseIndex(allCases);
      return { sightings: findCaseSightings(index, action.observable) };
    }
    if (name === 'case-refresh') return refreshCase(action, { profile, signal });
    if (name === 'case-export') {
      const { value } = await requireActiveCaseTarget();
      const text = serializeCaseBundle(value, { now: () => now().toISOString() });
      const filename = safeCaseFilename(value);
      downloadText(text, CASE_BUNDLE_MEDIA_TYPE, filename);
      return { filename, bytes: new TextEncoder().encode(text).byteLength };
    }
    if (name === 'case-import') {
      requireWorkspace();
      if (typeof readImportText !== 'function') throw new Error('case import unavailable');
      const text = await readImportText();
      if (text == null) return { cancelled: true };
      return importText(text);
    }
    throw new Error('unsupported case action');
  }

  return Object.freeze({
    handle,
    captureResult,
    importText,
    reset,
    state: () => Object.freeze({ activeCaseId, available: Boolean(cases) }),
  });
}

export const CASE_RUNTIME_LIMITS = Object.freeze({
  refreshObservables: MAX_REFRESH_OBSERVABLES,
  refreshChunkSize: REFRESH_CHUNK_SIZE,
  staleAfterMs: STALE_AFTER_MS,
});