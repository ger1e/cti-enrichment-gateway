import { createCaseRepository } from './case-repository.js';
import { createCaseRuntime } from './case-runtime.js';
import { createIndexedDbCaseStorage } from './indexeddb-case-storage.js';
import { addGatewayEnrichmentObserver, getLatestGatewayClient } from './api-client.js';
import { interpretCommand } from './shell.js';

const CASE_ACTIONS = new Set([
  'case-new',
  'case-open',
  'case-close',
  'case-list',
  'case-show',
  'case-refresh',
  'case-export',
  'case-import',
  'case-find',
  'case-pin',
  'case-unpin',
  'case-note',
  'case-diff',
]);

const client = getLatestGatewayClient();
let cases = null;
let latestResult = null;
let activeProfile = 'standard';

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

function appendPre(value, tone = '') {
  const target = shellScrollback();
  if (!target) return;
  const pre = document.createElement('pre');
  pre.className = `shell-pre${tone ? ` shell-${tone}` : ''}`;
  pre.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  target.append(pre);
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

const runtime = client ? createCaseRuntime({
  cases,
  client,
  now: () => new Date(),
  downloadText: safeDownload,
  readImportText,
}) : null;

function renderCaseOutcome(action, outcome) {
  if (action.action === 'case-new' || action.action === 'case-open' || action.action === 'case-import') {
    const value = outcome?.case;
    appendLine(`[ CASE ] ${value?.title ?? 'case'} // ${value?.id ?? 'unknown'}`, 'green');
    return;
  }
  if (action.action === 'case-close') {
    appendLine('[ CASE ] active case closed', 'green');
    return;
  }
  if (action.action === 'case-list') {
    const values = outcome?.cases ?? [];
    appendPre(values.length
      ? values.map(value => `${value.id}  ${value.title}  ${value.updatedAt}`).join('\n')
      : '(no local cases)');
    return;
  }
  if (action.action === 'case-show') {
    appendPre(outcome?.case ?? '(no active case)');
    return;
  }
  if (action.action === 'case-pin') {
    appendLine('[ CASE ] current observable pinned', 'green');
    return;
  }
  if (action.action === 'case-unpin') {
    appendLine(`[ CASE ] unpinned ${action.observable.type}:${action.observable.value}`, 'green');
    return;
  }
  if (action.action === 'case-note') {
    appendLine('[ CASE ] note appended', 'green');
    return;
  }
  if (action.action === 'case-diff') {
    appendPre(outcome?.diff ?? '(no semantic diff)');
    return;
  }
  if (action.action === 'case-find') {
    const sightings = outcome?.sightings ?? [];
    appendPre(sightings.length ? sightings : '(no exact local sightings)');
    return;
  }
  if (action.action === 'case-refresh') {
    appendLine(`[ CASE ] refresh selected=${outcome?.selected ?? 0} captured=${outcome?.captured ?? 0} failures=${outcome?.failures?.length ?? 0}`,
      outcome?.failures?.length ? 'amber' : 'green');
    if (outcome?.failures?.length) appendPre(outcome.failures, 'amber');
    return;
  }
  if (action.action === 'case-export') {
    appendLine(`[ CASE ] exported ${outcome?.filename ?? 'case.para11ax'}`, 'green');
  }
}

if (runtime) {
  addGatewayEnrichmentObserver(async result => {
    latestResult = result;
    activeProfile = result?.profile || activeProfile;
    const capture = await runtime.captureResult(result);
    if (capture.warning === 'case capture failed; enrichment result remains valid') {
      appendLine('case capture failed; enrichment result remains valid', 'amber');
    }
  });
}

document.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.matches('.shell-prompt')) return;
  const input = form.querySelector('#para11ax-command-input');
  if (!(input instanceof HTMLInputElement)) return;

  const line = input.value;
  const action = interpretCommand(line, { authenticated: false, profile: activeProfile });

  if (action.action === 'set-profile') activeProfile = action.profile;
  if (action.action === 'disconnect' || action.action === 'reboot') runtime?.reset();
  if (!CASE_ACTIONS.has(action.action)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  input.value = '';
  if (line.trim()) appendLine(`analyst@para11ax:~$ ${line}`);

  if (!runtime) {
    appendLine('workspace unavailable', 'red');
    return;
  }

  void runtime.handle(action, { currentResult: latestResult, profile: activeProfile })
    .then(outcome => renderCaseOutcome(action, outcome))
    .catch(error => appendLine(error?.message || 'workspace unavailable', 'red'))
    .finally(() => input.focus({ preventScroll: true }));
}, true);
