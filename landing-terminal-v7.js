const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
const reduced = Boolean(media?.matches);
const EXTRA_RAIN_COLUMNS = 16;
const CURSOR_HREF = '/site-cursor.css';

document.documentElement.dataset.terminalMotion = 'v7';

function ensureCursorStylesheet() {
  if (document.querySelector(`link[href="${CURSOR_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CURSOR_HREF;
  document.head.append(link);
}

function densifyRain() {
  const rain = document.querySelector('.matrix-rain');
  if (!rain || rain.dataset.dense === 'v7') return;
  rain.dataset.dense = 'v7';
  const glyphs = [
    'PARA11AX001101', 'PROVENANCE1100', 'EVIDENCEV20011', 'FIXEDEGRESS1011',
    'OBSERVED110011', 'INFERRED001101', 'CONTEXTUAL1100', 'FAILCLOSED0011',
  ];
  for (let index = 0; index < EXTRA_RAIN_COLUMNS; index += 1) {
    const column = document.createElement('span');
    column.className = 'rain';
    column.textContent = glyphs[index % glyphs.length];
    column.style.left = `${2 + ((index * 6.1) % 96)}%`;
    column.style.setProperty('--d', `${3.1 + ((index * 0.41) % 3.8)}s`);
    column.style.setProperty('--delay', `${-0.6 - ((index * 0.57) % 5.2)}s`);
    rain.append(column);
  }
}

ensureCursorStylesheet();
densifyRain();

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

export { EXTRA_RAIN_COLUMNS, clearMotionTimers, densifyRain, ensureCursorStylesheet };
