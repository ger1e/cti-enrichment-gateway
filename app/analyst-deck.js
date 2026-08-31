const STYLE_HREF = '/app/analyst-deck.css';
const CURSOR_HREF = '/site-cursor.css';
const PROMPT_TEXT = 'analyst@para11ax:~$';
const LEGACY_PROMPTS = ['para11ax@gateway:~$', 'user@para11ax: ~', 'user@para11ax:~$'];
const blockCursorSchedulers = new WeakMap();

function ensureStylesheet(href = STYLE_HREF) {
  if (document.documentElement.dataset.terminalFirst === 'v7') return;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

function wireBlockCursor(prompt) {
  const input = prompt?.querySelector?.('.shell-input');
  if (!input) return;

  const existing = blockCursorSchedulers.get(input);
  if (existing) {
    existing();
    return;
  }

  const inputWrap = document.createElement('span');
  inputWrap.className = 'shell-input-wrap';
  input.replaceWith(inputWrap);

  const cursor = document.createElement('i');
  cursor.className = 'shell-block-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  inputWrap.append(input, cursor);

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  let frame = 0;

  const render = () => {
    frame = 0;
    if (document.activeElement !== input || input.disabled) {
      prompt.dataset.blockCursorActive = 'false';
      return;
    }

    const style = getComputedStyle(input);
    const selectionStart = input.selectionStart ?? input.value.length;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    const caretIndex = selectionStart === selectionEnd || input.selectionDirection === 'backward'
      ? selectionStart
      : selectionEnd;
    const prefixLength = Math.max(0, Math.min(input.value.length, caretIndex));
    const prefix = input.type === 'password'
      ? '•'.repeat(prefixLength)
      : input.value.slice(0, prefixLength);

    let advance = 0;
    if (context) {
      context.font = style.font;
      advance = context.measureText(prefix).width;
    }
    const letterSpacing = Number.parseFloat(style.letterSpacing);
    if (Number.isFinite(letterSpacing) && prefix.length > 1) advance += letterSpacing * (prefix.length - 1);

    const wrapRect = inputWrap.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
    const minLeft = inputRect.left - wrapRect.left + borderLeft + paddingLeft;
    const cursorWidth = cursor.getBoundingClientRect().width;
    const maxLeft = inputRect.right - wrapRect.left - cursorWidth;
    const measuredLeft = minLeft + advance - input.scrollLeft;
    const left = Math.min(Math.max(measuredLeft, minLeft), Math.max(minLeft, maxLeft));

    cursor.style.left = `${left}px`;
    prompt.dataset.blockCursorActive = 'true';
  };

  const schedule = () => {
    if (frame) return;
    if (typeof requestAnimationFrame !== 'function') {
      render();
      return;
    }
    frame = requestAnimationFrame(render);
  };

  const deactivate = () => {
    if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    frame = 0;
    prompt.dataset.blockCursorActive = 'false';
  };

  input.addEventListener('input', schedule);
  input.addEventListener('keyup', schedule);
  input.addEventListener('keydown', schedule);
  input.addEventListener('click', schedule);
  input.addEventListener('select', schedule);
  input.addEventListener('scroll', schedule, { passive: true });
  input.addEventListener('focus', schedule);
  input.addEventListener('blur', deactivate);

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(schedule);
    observer.observe(input);
  } else if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('resize', schedule, { passive: true });
  }

  blockCursorSchedulers.set(input, schedule);
  schedule();
}

const decoratePrompt = prompt => {
  const label = prompt?.querySelector?.('.shell-prompt-label');
  const input = prompt?.querySelector?.('.shell-input');
  if (!label || !input) return;
  const secretPrompt = input.type === 'password' || /^BEARER:/i.test(label.textContent || '');
  if (!secretPrompt && label.textContent !== PROMPT_TEXT) label.textContent = PROMPT_TEXT;
  wireBlockCursor(prompt);
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
