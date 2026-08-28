const STYLE_URL = '/app/analyst-deck.css';
const PROMPT_TEXT = 'user@para11ax: ~';

function loadDeckStyles() {
  if (document.querySelector(`link[href="${STYLE_URL}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_URL;
  link.dataset.analystDeckStyle = 'v5';
  document.head.append(link);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildIdentity() {
  const identity = element('div', 'analyst-identity');
  const mark = document.createElement('img');
  mark.className = 'analyst-identity-mark';
  mark.src = '/app/para11ax-mark.svg';
  mark.alt = '';
  mark.decoding = 'async';
  const text = element('div', 'analyst-identity-copy');
  text.append(
    element('strong', '', 'EVIDENCE CONTROL PLANE'),
    element('span', '', 'OBSERVE · CORRELATE · PRESERVE PROVENANCE'),
  );
  identity.append(mark, text);
  return identity;
}

function buildTelemetryStrip() {
  const strip = element('footer', 'analyst-telemetry-strip');
  strip.setAttribute('aria-label', 'PARA11AX operational state');

  const title = element('span', 'analyst-telemetry-title', 'OPERATIONAL STATE');
  const auth = element('span', 'analyst-telemetry-state', 'AUTH DOWN');
  auth.dataset.state = 'down';
  const runtime = element('span', 'analyst-telemetry-state', 'READY');
  runtime.dataset.state = 'ready';
  const facts = element('span', 'analyst-telemetry-facts', '37 FIXED SOURCES · EVIDENCE V2 · FIXED EGRESS · READ ONLY · STIX 2.1');
  const doctrine = element('span', 'analyst-telemetry-doctrine', 'OBSERVED ≠ INFERRED ≠ CONTEXTUAL');

  strip.append(title, auth, runtime, facts, doctrine);
  strip._auth = auth;
  strip._runtime = runtime;
  return strip;
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function setState(node, state, value) {
  if (!node) return;
  if (node.dataset.state !== state) node.dataset.state = state;
  setText(node, value);
}

function updateTelemetry(root, strip) {
  const state = root.querySelector('.shell-session-state')?.textContent || '';
  const authenticated = state.includes('AUTH:UP');
  const busy = state.includes('BUSY');
  setState(strip._auth, authenticated ? 'ok' : 'down', authenticated ? 'AUTH UP' : 'AUTH DOWN');
  setState(strip._runtime, busy ? 'active' : 'ready', busy ? 'ENRICHING' : 'READY');
}

function normalizePrompt(root) {
  const label = root.querySelector('.shell-prompt-label');
  const input = root.querySelector('#para11ax-command-input');
  if (!label || !input || input.type === 'password' || label.textContent.trim() === 'BEARER:') return;
  setText(label, PROMPT_TEXT);
}

function syncPassiveChrome(root, header, telemetry) {
  const scanner = root.querySelector('.shell-scanner-track');
  if (scanner && scanner.parentElement !== header) header.append(scanner);
  const footer = root.querySelector('.shell-footer');
  if (footer && footer.parentElement !== telemetry) telemetry.append(footer);
  normalizePrompt(root);
  updateTelemetry(root, telemetry);
}

function decorateAnalystDeck(root) {
  if (!root || root.dataset.analystDeck === 'v5') return Boolean(root);
  const status = root.querySelector('.shell-status');
  const scrollback = root.querySelector('.shell-scrollback');
  const prompt = root.querySelector('.shell-prompt');
  if (!status || !scrollback || !prompt) return false;

  root.classList.add('analyst-deck');
  root.dataset.analystDeck = 'v5';
  document.documentElement.dataset.analystDeck = 'v5';

  const header = element('header', 'analyst-header');
  header.append(status, buildIdentity());

  const launcher = element('section', 'investigation-launcher');
  launcher.setAttribute('aria-label', 'PARA11AX command line');
  launcher.append(prompt);

  const workspace = element('section', 'analyst-workspace');
  const workspaceHead = element('header', 'analyst-workspace-head');
  workspaceHead.append(
    element('strong', '', 'EVIDENCE WORKSPACE'),
    element('span', '', 'PROVENANCE-FIRST · BOUNDED · FAIL CLOSED'),
  );
  workspace.append(workspaceHead, scrollback);

  const telemetry = buildTelemetryStrip();
  root.replaceChildren(header, launcher, workspace, telemetry);
  syncPassiveChrome(root, header, telemetry);

  const sessionState = root.querySelector('.shell-session-state');
  if (sessionState && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => updateTelemetry(root, telemetry));
    observer.observe(sessionState, { childList: true, characterData: true, subtree: true });
  }

  const promptLabel = root.querySelector('.shell-prompt-label');
  if (promptLabel && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => normalizePrompt(root));
    observer.observe(promptLabel, { childList: true, characterData: true, subtree: true });
  }

  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => syncPassiveChrome(root, header, telemetry));
    observer.observe(root, { childList: true, subtree: true });
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

export { PROMPT_TEXT, decorateAnalystDeck, initializeAnalystDeck };
