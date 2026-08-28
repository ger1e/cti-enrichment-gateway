const STYLE_URL = '/app/analyst-deck.css';
const VIEW_COMMANDS = Object.freeze([
  ['OVERVIEW', 'overview'],
  ['EVIDENCE', 'evidence'],
  ['CORRELATION', 'correlation'],
  ['RELATIONSHIPS', 'relationships'],
  ['COVERAGE', 'coverage'],
  ['RAW', 'raw'],
]);
const ACTION_COMMANDS = Object.freeze([
  ['HELP', 'help'],
  ['META', 'meta'],
  ['STATUS', 'status'],
  ['JSON', 'json'],
  ['STIX', 'stix'],
  ['CLEAR', 'clear'],
]);

function loadDeckStyles() {
  if (document.querySelector(`link[href="${STYLE_URL}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_URL;
  link.dataset.analystDeckStyle = 'v4';
  document.head.append(link);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function submitExistingCommand(root, command) {
  const input = root.querySelector('#para11ax-command-input');
  const form = input?.closest('form');
  if (!input || !form || input.type === 'password') return false;
  input.value = command;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  if (typeof form.requestSubmit === 'function') form.requestSubmit();
  else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  return true;
}

function commandButton(root, label, command, className = '') {
  const button = element('button', `analyst-command${className ? ` ${className}` : ''}`, label);
  button.type = 'button';
  button.dataset.command = command;
  button.addEventListener('click', () => {
    if (submitExistingCommand(root, command)) button.dataset.lastRun = 'true';
  });
  return button;
}

function buildSentinelStage() {
  const stage = element('aside', 'analyst-sentinel-stage');
  stage.setAttribute('aria-label', 'PARA11AX evidence control plane');
  const orbit = element('div', 'analyst-sentinel-orbit');
  orbit.setAttribute('aria-hidden', 'true');
  const logo = document.createElement('img');
  logo.className = 'analyst-sentinel-logo';
  logo.src = '/app/para11ax-mark.svg';
  logo.alt = '';
  logo.decoding = 'async';
  orbit.append(logo);
  const copy = element('div', 'analyst-sentinel-copy');
  copy.append(
    element('strong', '', 'EVIDENCE CONTROL PLANE'),
    element('span', '', 'OBSERVE · CORRELATE · PRESERVE PROVENANCE'),
  );
  stage.append(orbit, copy);
  return stage;
}

function buildStatusRail() {
  const rail = element('aside', 'analyst-status-rail');
  rail.setAttribute('aria-label', 'PARA11AX operational status');
  const title = element('div', 'analyst-rail-title', 'OPERATIONAL STATE');
  const facts = element('div', 'analyst-facts');
  for (const [label, value] of [
    ['SOURCES', '37 FIXED'],
    ['SCHEMA', 'EVIDENCE V2'],
    ['EGRESS', 'FIXED'],
    ['MODE', 'READ ONLY'],
    ['EXPORT', 'STIX 2.1'],
  ]) {
    const row = element('div', 'analyst-fact');
    row.append(element('span', '', label), element('strong', '', value));
    facts.append(row);
  }
  const live = element('div', 'analyst-live-state');
  const auth = element('span', 'analyst-state-pill');
  auth.dataset.state = 'down';
  auth.textContent = 'AUTH DOWN';
  const runtime = element('span', 'analyst-state-pill');
  runtime.dataset.state = 'ready';
  runtime.textContent = 'READY';
  live.append(auth, runtime);
  const doctrine = element('p', 'analyst-doctrine', 'OBSERVED ≠ INFERRED ≠ CONTEXTUAL');
  rail.append(title, facts, live, doctrine);
  rail._authPill = auth;
  rail._runtimePill = runtime;
  return rail;
}

function buildRail(root, commands, className, label) {
  const nav = element('nav', className);
  nav.setAttribute('aria-label', label);
  for (const [text, command] of commands) nav.append(commandButton(root, text, command));
  return nav;
}

function updateLiveState(root, statusRail) {
  const text = root.querySelector('.shell-session-state')?.textContent || '';
  const authenticated = text.includes('AUTH:UP');
  const busy = text.includes('BUSY');
  if (statusRail._authPill) {
    statusRail._authPill.dataset.state = authenticated ? 'ok' : 'down';
    statusRail._authPill.textContent = authenticated ? 'AUTH UP' : 'AUTH DOWN';
  }
  if (statusRail._runtimePill) {
    statusRail._runtimePill.dataset.state = busy ? 'active' : 'ready';
    statusRail._runtimePill.textContent = busy ? 'ENRICHING' : 'READY';
  }
}

function syncLegacyChrome(root, commandDeck, statusRail) {
  const scanner = root.querySelector('.shell-scanner-track');
  if (scanner && scanner.parentElement !== commandDeck) commandDeck.append(scanner);
  const footer = root.querySelector('.shell-footer');
  if (footer && footer.parentElement !== statusRail) statusRail.append(footer);
  updateLiveState(root, statusRail);
}

function decorateAnalystDeck(root) {
  if (!root || root.dataset.analystDeck === 'v4') return Boolean(root);
  const status = root.querySelector('.shell-status');
  const scrollback = root.querySelector('.shell-scrollback');
  const prompt = root.querySelector('.shell-prompt');
  if (!status || !scrollback || !prompt) return false;

  root.classList.add('analyst-deck');
  root.dataset.analystDeck = 'v4';
  document.documentElement.dataset.analystDeck = 'v4';

  const commandDeck = element('section', 'analyst-command-deck');
  commandDeck.append(status, buildSentinelStage());

  const statusRail = buildStatusRail();

  const launcher = element('section', 'investigation-launcher');
  const launcherHead = element('header', 'investigation-launcher-head');
  launcherHead.append(
    element('span', 'investigation-kicker', 'INVESTIGATION LAUNCHER'),
    element('span', 'investigation-hint', 'enrich <observable> · batch <observables> · profile fast|standard|full'),
  );
  launcher.append(launcherHead, prompt);

  const viewRail = buildRail(root, VIEW_COMMANDS, 'analyst-view-rail', 'Evidence views');

  const workspace = element('section', 'analyst-workspace');
  const workspaceHead = element('header', 'analyst-workspace-head');
  workspaceHead.append(
    element('strong', '', 'EVIDENCE WORKSPACE'),
    element('span', '', 'PROVENANCE-FIRST · BOUNDED · FAIL CLOSED'),
  );
  workspace.append(workspaceHead, scrollback);

  const actions = buildRail(root, ACTION_COMMANDS, 'analyst-action-rail', 'Bounded analyst actions');

  root.replaceChildren(commandDeck, launcher, viewRail, workspace, statusRail, actions);
  syncLegacyChrome(root, commandDeck, statusRail);

  const sessionState = root.querySelector('.shell-session-state');
  if (sessionState && typeof MutationObserver === 'function') {
    const stateObserver = new MutationObserver(() => updateLiveState(root, statusRail));
    stateObserver.observe(sessionState, { childList: true, characterData: true, subtree: true });
  }

  if (typeof MutationObserver === 'function') {
    const chromeObserver = new MutationObserver(() => syncLegacyChrome(root, commandDeck, statusRail));
    chromeObserver.observe(root, { childList: true, subtree: true });
  }

  return true;
}

function initializeAnalystDeck() {
  loadDeckStyles();
  const workspace = document.getElementById('workspace');
  const tryDecorate = () => decorateAnalystDeck(workspace?.querySelector('.unix-shell'));
  tryDecorate();
  if (workspace && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => tryDecorate());
    observer.observe(workspace, { childList: true, subtree: true });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeAnalystDeck, { once: true });
  else initializeAnalystDeck();
}

export { ACTION_COMMANDS, VIEW_COMMANDS, decorateAnalystDeck, initializeAnalystDeck, submitExistingCommand };
