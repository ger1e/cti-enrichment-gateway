const STYLE_URL = '/app/analyst-deck.css';
const PROMPT_TEXT = 'user@para11ax: ~';

function loadTerminalStyles() {
  if (document.querySelector(`link[href="${STYLE_URL}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_URL;
  link.dataset.terminalFirstStyle = 'v6';
  document.head.append(link);
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function normalizePrompt(root) {
  const label = root?.querySelector('.shell-prompt-label');
  const input = root?.querySelector('#para11ax-command-input');
  if (!label || !input || input.type === 'password' || label.textContent.trim() === 'BEARER:') return;
  setText(label, PROMPT_TEXT);
}

function decorateTerminal(root) {
  if (!root) return false;
  const scrollback = root.querySelector('.shell-scrollback');
  const prompt = root.querySelector('.shell-prompt');
  if (!scrollback || !prompt) return false;

  root.dataset.terminalFirst = 'v6';
  document.documentElement.dataset.terminalFirst = 'v6';
  normalizePrompt(root);

  const label = root.querySelector('.shell-prompt-label');
  if (label && typeof MutationObserver === 'function' && label.dataset.promptObserver !== 'v6') {
    label.dataset.promptObserver = 'v6';
    const observer = new MutationObserver(() => normalizePrompt(root));
    observer.observe(label, { childList: true, characterData: true, subtree: true });
  }
  return true;
}

function initializeTerminalFirst() {
  loadTerminalStyles();
  const workspace = document.getElementById('workspace');
  const apply = () => decorateTerminal(workspace?.querySelector('.unix-shell'));
  apply();
  if (workspace && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => apply());
    observer.observe(workspace, { childList: true, subtree: true });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeTerminalFirst, { once: true });
  else initializeTerminalFirst();
}

export { PROMPT_TEXT, decorateTerminal, initializeTerminalFirst };
