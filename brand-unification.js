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
}

ensureBrandStylesheet();
syncLogoImages();

if (document.body && typeof MutationObserver === 'function') {
  const observer = new MutationObserver(syncLogoImages);
  observer.observe(document.body, { childList: true, subtree: true });
}

export { LOCKUP_URL, STYLESHEET_URL, ensureBrandStylesheet, syncLogoImages };
