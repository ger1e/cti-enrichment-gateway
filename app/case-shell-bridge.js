import { createCaseRepository } from './case-repository.js';
import { createCaseRuntime } from './case-runtime.js';
import { createIndexedDbCaseStorage } from './indexeddb-case-storage.js';
import { addGatewayEnrichmentObserver, getLatestGatewayClient } from './api-client.js';

let cases = null;
let runtime = null;

try {
  const storage = createIndexedDbCaseStorage({ indexedDB: globalThis.indexedDB });
  cases = createCaseRepository({
    storage,
    now: () => new Date().toISOString(),
    uuid: () => crypto.randomUUID(),
  });
} catch {
  cases = null;
}

function shellScrollback() {
  return document.querySelector('.shell-scrollback');
}

function appendLine(text, tone = '') {
  const target = shellScrollback();
  if (!target) return;
  const line = document.createElement('div');
  line.className = `shell-line${tone ? ` shell-${tone}` : ''}`;
  line.textContent = String(text);
  target.append(line);
  target.scrollTop = target.scrollHeight;
}

function safeDownload(text, type, filename) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
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

function importInput() {
  let input = document.getElementById('case-import');
  if (input) return input;
  input = document.createElement('input');
  input.id = 'case-import';
  input.type = 'file';
  input.accept = '.para11ax,application/vnd.para11ax.case+json';
  input.hidden = true;
  document.body.append(input);
  return input;
}

function readImportText() {
  const input = importInput();
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
      if (!file) { finish(null); return; }
      try { finish(await file.text()); }
      catch { reject(new Error('case_bundle_invalid')); }
    };
    input.value = '';
    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    input.click();
  });
}

function ensureRuntime() {
  if (runtime) return runtime;
  const client = getLatestGatewayClient();
  if (!client) return null;
  runtime = createCaseRuntime({
    cases,
    client,
    now: () => new Date(),
    downloadText: safeDownload,
    readImportText,
  });
  return runtime;
}

export function getCaseShellRuntime() {
  return ensureRuntime();
}

export const caseShellAdapter = Object.freeze({
  async handle(action, context) {
    const active = ensureRuntime();
    if (!active) throw new Error('workspace unavailable');
    return active.handle(action, context);
  },
  reset() {
    ensureRuntime()?.reset();
  },
  state() {
    return ensureRuntime()?.state() ?? Object.freeze({ activeCaseId: null, available: false });
  },
});

addGatewayEnrichmentObserver(async result => {
  const active = ensureRuntime();
  if (!active) return;
  const capture = await active.captureResult(result);
  if (capture.warning === 'case capture failed; enrichment result remains valid') {
    appendLine('case capture failed; enrichment result remains valid', 'amber');
  }
});
