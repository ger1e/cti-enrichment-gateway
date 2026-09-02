import { createIndexedDbCaseStorage } from './indexeddb-case-storage.js';
import { createInvestigationRepository } from './investigation-repository.js';
import { createInvestigationRuntime } from './investigation-runtime.js';
import { buildInvestigationReport } from '../src/report/render-investigation.js';

let repository = null;
let runtime = null;

try {
  repository = createInvestigationRepository({
    storage: createIndexedDbCaseStorage({ indexedDB: globalThis.indexedDB }),
    now: () => new Date().toISOString(),
    uuid: () => crypto.randomUUID(),
  });
} catch {
  repository = null;
}

function safeDownload(text, type, filename) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

function fileInput(id, accept) {
  let input = document.getElementById(id);
  if (input) return input;
  input = document.createElement('input');
  input.id = id;
  input.type = 'file';
  input.accept = accept;
  input.hidden = true;
  document.body.append(input);
  return input;
}

function readFileText(id, accept, errorCode) {
  const input = fileInput(id, accept);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      resolve(value);
    };
    const onCancel = () => finish(null);
    const onChange = async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return finish(null);
      try { finish(await file.text()); } catch { reject(new Error(errorCode)); }
    };
    input.value = '';
    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    input.click();
  });
}

function ensureRuntime() {
  if (runtime) return runtime;
  if (!repository) return null;
  runtime = createInvestigationRuntime({
    investigations: repository,
    readImportText: () => readFileText('investigation-import', '.json,.para11ax-investigation,application/vnd.para11ax.investigation+json', 'INVESTIGATION_BUNDLE_INVALID'),
    readResultText: () => readFileText('investigation-result-import', '.json,.csv,.txt,application/json,text/csv,text/plain', 'INVESTIGATION_RESULT_INVALID'),
    downloadText: safeDownload,
    now: () => new Date().toISOString(),
    buildReport: buildInvestigationReport,
  });
  return runtime;
}

export const investigationShellAdapter = Object.freeze({
  async handle(action) {
    const active = ensureRuntime();
    if (!active) throw new Error('investigation workspace unavailable');
    return active.handle(action);
  },
  async captureEvidence(result) {
    const active = ensureRuntime();
    if (!active) throw new Error('investigation workspace unavailable');
    return active.captureEvidence(result);
  },
  async captureOperator(result) {
    const active = ensureRuntime();
    if (!active) throw new Error('investigation workspace unavailable');
    return active.captureOperator(result);
  },
  reset() { ensureRuntime()?.reset(); },
  state() { return ensureRuntime()?.state() ?? Object.freeze({ activeInvestigationId: null, available: false }); },
});
