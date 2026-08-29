import './brand-unification.js';

const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
const reduced = Boolean(media?.matches);
const CURSOR_HREF = '/site-cursor.css';
const MOTION_HREF = '/landing-radar-motion.css';
const DESKTOP_FIT_HREF = '/landing-desktop-fit.css';
const PROMPT_TEXT = 'analyst@para11ax:~$';
const LEGACY_PROMPTS = ['user@para11ax:~$', 'user@para11ax: ~', 'para11ax@gateway:~$'];

document.documentElement.dataset.terminalMotion = 'v7';

function ensureStylesheet(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

function ensureCursorStylesheet() {
  ensureStylesheet(CURSOR_HREF);
}

function ensureMotionStylesheet() {
  ensureStylesheet(MOTION_HREF);
}

function ensureDesktopFitStylesheet() {
  ensureStylesheet(DESKTOP_FIT_HREF);
}

function normalizePromptIdentity() {
  for (const node of document.querySelectorAll('.terminal-session .session-line')) {
    let value = node.textContent || '';
    for (const legacy of LEGACY_PROMPTS) value = value.replaceAll(legacy, PROMPT_TEXT);
    node.textContent = value;
  }
}

ensureCursorStylesheet();
ensureMotionStylesheet();
ensureDesktopFitStylesheet();
normalizePromptIdentity();

const reveal = (node) => node?.classList.add('is-visible');
const sections = [...document.querySelectorAll('[data-reveal]')];

if (reduced || typeof IntersectionObserver !== 'function') {
  sections.forEach(reveal);
} else {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveal(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  sections.forEach((node) => observer.observe(node));
}

const hero = document.querySelector('.terminal-hero');
let glitchTimer = null;
let resetTimer = null;

function scheduleGlitch() {
  if (reduced || !hero) return;
  glitchTimer = globalThis.setTimeout(() => {
    hero.classList.add('is-glitching');
    resetTimer = globalThis.setTimeout(() => {
      hero.classList.remove('is-glitching');
      scheduleGlitch();
    }, 280);
  }, 6800 + Math.floor(Math.random() * 4200));
}

scheduleGlitch();

function clearMotionTimers() {
  if (glitchTimer != null) globalThis.clearTimeout(glitchTimer);
  if (resetTimer != null) globalThis.clearTimeout(resetTimer);
  glitchTimer = null;
  resetTimer = null;
  hero?.classList.remove('is-glitching');
}

media?.addEventListener?.('change', (event) => {
  if (event.matches) clearMotionTimers();
  else if (!glitchTimer && !resetTimer) scheduleGlitch();
});

export {
  clearMotionTimers,
  ensureCursorStylesheet,
  ensureDesktopFitStylesheet,
  ensureMotionStylesheet,
  normalizePromptIdentity,
};
