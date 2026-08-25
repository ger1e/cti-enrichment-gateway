import { createGatewayClient, GatewayHttpError } from './api-client.js';
import { createSession } from './session.js';
import { createAudioEngine } from './audio.js';
import {
  buildOverview,
  buildEvidence,
  buildCorrelation,
  buildRelationships,
  buildCoverage,
  jsonLines,
} from './view-model.js';
import {
  clear,
  renderOverview,
  renderEvidence,
  renderCorrelation,
  renderRelationships,
  renderCoverage,
  renderRaw,
} from './renderers.js';

export const VIEWS = Object.freeze(['overview', 'evidence', 'correlation', 'relationships', 'coverage', 'raw']);
export const serializeJson = (value) => JSON.stringify(value, null, 2);

function safeFilename(indicator, suffix) {
  const stem = String(indicator || 'indicator')
    .replace(/[^a-z0-9._-]+/gi, '_')
    .slice(0, 80) || 'indicator';
  return `${stem}.${suffix}`;
}

function downloadText(text, type, filename) {
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

async function copyText(value) {
  await navigator.clipboard.writeText(String(value));
}

if (typeof document !== 'undefined') bootstrap();

function bootstrap() {
  const session = createSession();
  const audio = createAudioEngine();
  const client = createGatewayClient({ getToken: session.getToken });
  const byId = (id) => document.getElementById(id);

  const accessPanel = byId('access-panel');
  const accessForm = byId('access-form');
  const tokenInput = byId('token');
  const workspace = byId('workspace');
  const pivotForm = byId('pivot-form');
  const indicatorInput = byId('indicator');
  const profile = byId('profile');
  const enrichButton = byId('enrich');
  const disconnectButton = byId('disconnect');
  const hud = byId('result-status');
  const tabs = byId('tabs');
  const actions = byId('result-actions');
  const view = byId('view');
  const live = byId('live-status');
  const rawSearch = byId('raw-search');
  const rawSearchLabel = byId('raw-search-label');
  const stixButton = byId('download-stix');
  const resetButton = byId('reset');

  let activeView = 'overview';
  let currentResult = null;
  let contradictionCueRequestId = null;
  let operationController = null;
  let busy = false;

  const announce = (text) => { live.textContent = text; };
  const setLocked = (locked) => {
    accessPanel.hidden = !locked;
    workspace.hidden = locked;
  };

  function setBusy(value) {
    busy = Boolean(value);
    document.body.classList.toggle('is-busy', busy);
    enrichButton.disabled = busy;
    stixButton.disabled = busy;
    resetButton.disabled = busy;
    indicatorInput.disabled = busy;
    profile.disabled = busy;
  }

  function abortOperation() {
    if (operationController && !operationController.signal.aborted) operationController.abort();
    operationController = null;
  }

  function clearResult() {
    currentResult = null;
    contradictionCueRequestId = null;
    activeView = 'overview';
    clear(hud);
    clear(tabs);
    clear(view);
    hud.hidden = true;
    tabs.hidden = true;
    actions.hidden = true;
    rawSearch.hidden = true;
    rawSearchLabel.hidden = true;
    rawSearch.value = '';
  }

  function lockSession(message) {
    abortOperation();
    setBusy(false);
    session.disconnect();
    clearResult();
    indicatorInput.value = '';
    tokenInput.value = '';
    setLocked(true);
    announce(message);
  }

  accessForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await audio.enable();
    session.setToken(tokenInput.value);
    try {
      await client.health();
      session.unlock();
      audio.play('access-ok');
      setLocked(false);
      tokenInput.value = '';
      indicatorInput.focus();
      announce('Session established.');
    } catch (error) {
      audio.play('access-denied');
      lockSession(error instanceof GatewayHttpError && error.status === 401 ? 'Unauthorized token.' : 'Gateway unavailable.');
    }
  });

  indicatorInput.addEventListener('input', () => audio.typing('pivot'));

  byId('sound-toggle').addEventListener('click', () => {
    const muted = !audio.state().muted;
    audio.mute(muted);
    byId('sound-toggle').setAttribute('aria-pressed', String(!muted));
    byId('sound-toggle').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  });

  byId('volume').addEventListener('input', (event) => audio.setVolume(event.currentTarget.value));

  function renderTabs() {
    clear(tabs);
    for (const name of VIEWS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name.toUpperCase();
      button.dataset.view = name;
      button.setAttribute('aria-pressed', String(name === activeView));
      button.addEventListener('click', () => {
        activeView = name;
        audio.play('tab');
        renderTabs();
        renderActiveView();
      });
      tabs.append(button);
    }
  }

  function renderActiveView() {
    if (!currentResult) return;
    rawSearch.hidden = activeView !== 'raw';
    rawSearchLabel.hidden = activeView !== 'raw';

    if (activeView === 'overview') return renderOverview(view, buildOverview(currentResult));
    if (activeView === 'evidence') return renderEvidence(view, buildEvidence(currentResult));
    if (activeView === 'correlation') {
      const model = buildCorrelation(currentResult);
      renderCorrelation(view, model);
      if (model.contradictions.length && contradictionCueRequestId !== currentResult.requestId) {
        audio.play('contradiction');
        contradictionCueRequestId = currentResult.requestId;
      }
      return;
    }
    if (activeView === 'relationships') return renderRelationships(view, buildRelationships(currentResult));
    if (activeView === 'coverage') return renderCoverage(view, buildCoverage(currentResult));
    renderRaw(view, jsonLines(currentResult), rawSearch.value);
  }

  rawSearch.addEventListener('input', () => {
    if (currentResult && activeView === 'raw') renderActiveView();
  });

  function renderResult() {
    activeView = 'overview';
    renderOverview(hud, buildOverview(currentResult));
    hud.hidden = false;
    tabs.hidden = false;
    actions.hidden = false;
    renderTabs();
    renderActiveView();
  }

  pivotForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;

    const controller = new AbortController();
    operationController = controller;
    setBusy(true);
    try {
      session.startRequest(controller);
      audio.play('scan');
      document.body.classList.add('is-scanning');
      announce('Enrichment running.');
      const result = await client.enrich(indicatorInput.value, profile.value, controller.signal);
      currentResult = result;
      session.finishRequest(result);
      operationController = null;
      renderResult();
      audio.play(result.status === 'ok' ? 'result-ok' : result.status === 'partial' ? 'result-partial' : 'result-error');
      announce(`Enrichment complete: ${result.status}.`);
    } catch (error) {
      operationController = null;
      if (error?.name === 'AbortError') return;
      if (error instanceof GatewayHttpError && error.status === 401) {
        audio.play('access-denied');
        lockSession('Session unauthorized.');
        return;
      }
      session.reset();
      audio.play('result-error');
      announce(error instanceof GatewayHttpError ? `Gateway error: ${error.code}.` : 'Request failed.');
    } finally {
      document.body.classList.remove('is-scanning');
      setBusy(false);
    }
  });

  async function copyWithCue(value, successMessage) {
    try {
      await copyText(value);
      audio.play('copy');
      announce(successMessage);
    } catch {
      announce('Clipboard access unavailable.');
    }
  }

  byId('copy-ioc').addEventListener('click', () => {
    if (currentResult) void copyWithCue(currentResult.indicator, 'Observable copied.');
  });
  byId('copy-json').addEventListener('click', () => {
    if (currentResult) void copyWithCue(serializeJson(currentResult), 'JSON copied.');
  });
  byId('download-json').addEventListener('click', () => {
    if (!currentResult) return;
    downloadText(serializeJson(currentResult), 'application/json', safeFilename(currentResult.indicator, 'evidence.json'));
    announce('Evidence JSON downloaded.');
  });

  stixButton.addEventListener('click', async () => {
    if (!currentResult || busy) return;

    const controller = new AbortController();
    operationController = controller;
    setBusy(true);
    audio.play('stix-start');
    announce('Packaging STIX 2.1.');
    try {
      const bundle = await client.stix(currentResult.indicator, currentResult.profile, controller.signal);
      operationController = null;
      downloadText(serializeJson(bundle), 'application/stix+json', safeFilename(currentResult.indicator, 'stix.json'));
      audio.play('stix-ok');
      announce('STIX 2.1 bundle downloaded.');
    } catch (error) {
      operationController = null;
      if (error?.name === 'AbortError') return;
      if (error instanceof GatewayHttpError && error.status === 401) {
        audio.play('access-denied');
        lockSession('Session unauthorized.');
        return;
      }
      audio.play('result-error');
      announce(error instanceof GatewayHttpError ? `STIX export failed: ${error.code}.` : 'STIX export failed.');
    } finally {
      setBusy(false);
    }
  });

  resetButton.addEventListener('click', () => {
    if (busy) return;
    session.reset();
    clearResult();
    indicatorInput.value = '';
    indicatorInput.focus();
    announce('Result cleared.');
  });

  disconnectButton.addEventListener('click', () => {
    audio.play('disconnect');
    lockSession('Disconnected.');
  });
}
