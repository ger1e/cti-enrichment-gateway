import {
  deriveInvestigationStatus,
  exportInvestigation,
  importInvestigation,
} from '../src/core/investigation/index.js';

const MEDIA_TYPE = 'application/vnd.para11ax.investigation+json';
const OPERATOR_KINDS = new Set(['shodan', 'user-scanner']);
const MUTATIONS = new Set([
  'SCOPE_SET', 'OBSERVABLE_ADD', 'OBSERVABLE_REMOVE', 'EVIDENCE_CAPTURE', 'OPERATOR_CAPTURE',
  'RELEVANCE_BUILD', 'HUNT_BUILD', 'KQL_VALIDATE', 'RESULT_SET', 'DISPOSITION_SET',
  'REPORT_BUILD', 'SERVICENOW_BUILD', 'NOTE_ADD',
]);
const clone = value => structuredClone(value);

function safeFilename(value) {
  const stem = String(value.title || value.id || 'investigation').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'investigation';
  return `${stem}.para11ax-investigation.json`;
}

function fail(code) {
  throw new Error(code);
}

export function createInvestigationRuntime({
  investigations,
  readImportText = null,
  readResultText = null,
  downloadText = () => {},
  now = () => new Date().toISOString(),
  buildReport,
} = {}) {
  if (!investigations || ['create', 'get', 'list', 'save', 'remove', 'mutate'].some(name => typeof investigations[name] !== 'function')) {
    throw new TypeError('investigation repository required');
  }
  let activeInvestigationId = null;
  let activePhase = null;

  function activate(investigation) {
    activeInvestigationId = investigation.id;
    activePhase = deriveInvestigationStatus(investigation).phase;
  }

  async function requireActive() {
    if (!activeInvestigationId) fail('INVESTIGATION_REQUIRED');
    const id = activeInvestigationId;
    const value = await investigations.get(id);
    if (!value) {
      if (activeInvestigationId === id) activeInvestigationId = null;
      activePhase = null;
      fail('INVESTIGATION_NOT_FOUND');
    }
    return value;
  }

  async function mutate(action) {
    const current = await requireActive();
    const before = new Set(current.freshness.stale.map(item => item.artifact));
    const investigation = await investigations.mutate(current.id, action, { buildReport });
    activate(investigation);
    const invalidated = investigation.freshness.stale.map(item => item.artifact).filter(artifact => !before.has(artifact));
    return { investigation: clone(investigation), action: action.type, invalidated };
  }

  async function captureEvidence(result) {
    if (!result || result.schemaVersion !== '2.0' || !['ok', 'partial'].includes(result.status)) fail('compatible current evidence required');
    return mutate({ type: 'EVIDENCE_CAPTURE', value: clone(result) });
  }

  async function captureOperator(result) {
    if (!result || !OPERATOR_KINDS.has(result.kind) || typeof result.summary !== 'string') fail('compatible current operator result required');
    return mutate({ type: 'OPERATOR_CAPTURE', value: clone(result) });
  }

  async function importText(text) {
    const imported = importInvestigation(text);
    if (await investigations.get(imported.id)) fail('INVESTIGATION_IMPORT_CONFLICT');
    const saved = await investigations.save(imported);
    activate(saved);
    return { investigation: clone(saved) };
  }

  async function handle(action) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) fail('INVESTIGATION_ACTION_INVALID');
    if (action.type === 'NEW') {
      const investigation = await investigations.create(action.title);
      activate(investigation);
      return { investigation: clone(investigation) };
    }
    if (action.type === 'OPEN') {
      const investigation = await investigations.get(action.id);
      if (!investigation) fail('INVESTIGATION_NOT_FOUND');
      activate(investigation);
      return { investigation: clone(investigation) };
    }
    if (action.type === 'CLOSE') {
      activeInvestigationId = null;
      activePhase = null;
      return { closed: true };
    }
    if (action.type === 'LIST') return { investigations: clone(await investigations.list()) };
    if (action.type === 'SHOW') return { investigation: clone(await requireActive()) };
    if (action.type === 'STATUS') {
      const investigation = await requireActive();
      return { status: clone(deriveInvestigationStatus(investigation)), investigation: clone(investigation) };
    }
    if (action.type === 'TIMELINE') return { timeline: clone((await requireActive()).timeline) };
    if (action.type === 'CLEAR') {
      const investigation = await requireActive();
      await investigations.remove(investigation.id);
      activeInvestigationId = null;
      activePhase = null;
      return { cleared: true, investigation: clone(investigation), action: 'CLEAR', invalidated: [] };
    }
    if (action.type === 'EXPORT') {
      const investigation = await requireActive();
      const text = exportInvestigation(investigation);
      const filename = safeFilename(investigation);
      downloadText(text, MEDIA_TYPE, filename);
      return { text, filename, investigation: clone(investigation) };
    }
    if (action.type === 'IMPORT') {
      if (typeof action.text === 'string') return importText(action.text);
      if (typeof readImportText !== 'function') fail('INVESTIGATION_IMPORT_UNAVAILABLE');
      const text = await readImportText();
      return text == null ? { cancelled: true } : importText(text);
    }
    if (action.type === 'RESULT_IMPORT') {
      if (typeof action.text === 'string') return mutate({ type: 'RESULT_SET', value: action.text });
      if (typeof readResultText !== 'function') fail('INVESTIGATION_RESULT_IMPORT_UNAVAILABLE');
      const text = await readResultText();
      return text == null ? { cancelled: true } : mutate({ type: 'RESULT_SET', value: text });
    }
    if (MUTATIONS.has(action.type)) return mutate(action);
    fail('INVESTIGATION_ACTION_UNSUPPORTED');
  }

  return Object.freeze({
    handle,
    captureEvidence,
    captureOperator,
    importText,
    reset() { activeInvestigationId = null; activePhase = null; },
    state: () => Object.freeze({ activeInvestigationId, phase: activePhase, available: true }),
  });
}

export const INVESTIGATION_MEDIA_TYPE = MEDIA_TYPE;
