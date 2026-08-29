const STYLE_HREF = '/app/analyst-deck.css';
const CURSOR_HREF = '/site-cursor.css';
const PROMPT_TEXT = 'analyst@para11ax:~$';
const LEGACY_PROMPTS = ['para11ax@gateway:~$', 'user@para11ax: ~', 'user@para11ax:~$'];

function ensureStylesheet(href = STYLE_HREF) {
  if (document.documentElement.dataset.terminalFirst === 'v7') return;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

const decoratePrompt = prompt => {
  const label = prompt?.querySelector?.('.shell-prompt-label');
  const input = prompt?.querySelector?.('.shell-input');
  if (!label || !input) return;
  const secretPrompt = input.type === 'password' || /^BEARER:/i.test(label.textContent || '');
  if (!secretPrompt && label.textContent !== PROMPT_TEXT) label.textContent = PROMPT_TEXT;
};

const normalizeTranscriptNode = node => {
  if (!node || node.nodeType !== 1) return;
  const normalize = line => {
    const value = line.textContent || '';
    const legacy = LEGACY_PROMPTS.find(prompt => value.startsWith(prompt));
    if (legacy) line.textContent = `${PROMPT_TEXT}${value.slice(legacy.length)}`;
  };
  if (node.matches?.('.shell-line')) normalize(node);
  node.querySelectorAll?.('.shell-line').forEach(normalize);
};

const wireTerminalFocus = root => {
  if (!root || root.dataset.terminalFocus === 'ready') return;
  root.dataset.terminalFocus = 'ready';
  root.addEventListener('click', event => {
    const target = event.target;
    if (target?.closest?.('a,button,input,textarea,select,[contenteditable="true"]')) return;
    const selection = globalThis.getSelection ? globalThis.getSelection() : null;
    if (selection && !selection.isCollapsed) return;
    root.querySelector('.shell-input')?.focus({ preventScroll: true });
  });
};

const decorateTerminal = root => {
  if (!root || !root.matches?.('.unix-shell')) return;
  root.dataset.terminalPlane = 'true';
  root.querySelectorAll('.shell-prompt').forEach(decoratePrompt);
  normalizeTranscriptNode(root);
  wireTerminalFocus(root);
};

function observeTerminal() {
  const workspace = document.querySelector('#workspace');
  if (!workspace) return;
  decorateTerminal(workspace.querySelector('.unix-shell'));
  if (typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes || []) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('.shell-prompt')) decoratePrompt(node);
        node.querySelectorAll?.('.shell-prompt').forEach(decoratePrompt);
        normalizeTranscriptNode(node);
        const terminal = node.matches?.('.unix-shell') ? node : node.querySelector?.('.unix-shell');
        if (terminal) decorateTerminal(terminal);
      }
      if (record.type === 'characterData') {
        decoratePrompt(record.target.parentElement?.closest?.('.shell-prompt'));
        normalizeTranscriptNode(record.target.parentElement?.closest?.('.shell-line'));
      }
      if (record.type === 'attributes') decoratePrompt(record.target.closest?.('.shell-prompt'));
    }
  });
  observer.observe(workspace, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['type'],
  });
}

ensureStylesheet();
ensureStylesheet(CURSOR_HREF);
document.documentElement.dataset.terminalFirst = 'v7';
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeTerminal, { once: true });
else observeTerminal();
