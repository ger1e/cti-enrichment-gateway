const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
const reduced = Boolean(media?.matches);

document.documentElement.dataset.terminalMotion = 'v7';

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

export { clearMotionTimers };
