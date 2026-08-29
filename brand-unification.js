const LOCKUP_URL = '/assets/brand/para11ax-radar-lockup.svg';
const STYLESHEET_URL = '/brand-unification.css';

function ensureBrandStylesheet() {
  if (document.querySelector(`link[href="${STYLESHEET_URL}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLESHEET_URL;
  document.head.append(link);
}

function createLockup() {
  const logo = document.createElement('img');
  logo.className = 'shared-radar-lockup';
  logo.src = LOCKUP_URL;
  logo.alt = 'PARA11AX';
  logo.decoding = 'async';
  return logo;
}

function createWordmarkSpan(text, className) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function syncHeroWordmark() {
  for (const wordmark of document.querySelectorAll('.ascii-logo')) {
    if (wordmark.dataset.brandSplit === 'true') continue;
    const value = (wordmark.textContent || '').replace(/\s+/g, '').toUpperCase();
    if (value !== 'PARA11AX') continue;
    wordmark.replaceChildren(
      createWordmarkSpan('PARA', 'logo-white'),
      createWordmarkSpan('11', 'logo-green'),
      createWordmarkSpan('AX', 'logo-white'),
    );
    wordmark.dataset.brandSplit = 'true';
  }
}

function replaceTextBrand(selector) {
  for (const brand of document.querySelectorAll(selector)) {
    if (brand.querySelector('.shared-radar-lockup')) continue;
    brand.replaceChildren(createLockup());
  }
}

function syncLogoImages() {
  for (const logo of document.querySelectorAll('.para11ax-logo')) {
    if (logo.getAttribute('src') !== LOCKUP_URL) logo.setAttribute('src', LOCKUP_URL);
    logo.alt = 'PARA11AX';
  }
  replaceTextBrand('.terminal-brand');
  replaceTextBrand('.terminal-mark');
  syncHeroWordmark();
}

ensureBrandStylesheet();
syncLogoImages();

if (document.body && typeof MutationObserver === 'function') {
  const observer = new MutationObserver(syncLogoImages);
  observer.observe(document.body, { childList: true, subtree: true });
}

export { LOCKUP_URL, STYLESHEET_URL, ensureBrandStylesheet, syncHeroWordmark, syncLogoImages };
