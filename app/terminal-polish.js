const LOGO_URL = '/app/para11ax-mark.svg';

if (!document.querySelector('link[href="/app/shell-polish.css"]')) {
  const styles = document.createElement('link');
  styles.rel = 'stylesheet';
  styles.href = '/app/shell-polish.css';
  document.head.append(styles);
}

function createLogo(className = '') {
  const logo = document.createElement('img');
  logo.className = `para11ax-logo${className ? ` ${className}` : ''}`;
  logo.src = LOGO_URL;
  logo.alt = 'PARA11AX';
  logo.decoding = 'async';
  return logo;
}

function decorateBootBrand() {
  const standby = document.querySelector('.boot-standby');
  if (!standby || standby.querySelector('.boot-brand-lockup')) return;
  const legacyLabel = standby.querySelector('span:last-child');
  const lockup = document.createElement('span');
  lockup.className = 'boot-brand-lockup';
  const meta = document.createElement('span');
  meta.className = 'boot-brand-meta';
  meta.textContent = 'GATEWAY // COLD START';
  lockup.append(createLogo(), meta);
  legacyLabel?.replaceWith(lockup);
  if (!lockup.isConnected) standby.append(lockup);
}

function decorateShellBrand() {
  const brand = document.querySelector('.shell-brand');
  if (!brand || brand.querySelector('.shell-logo')) return;
  const version = brand.textContent.match(/\b\d+\.\d+\.\d+\b/)?.[0] || '2.0.0';
  const label = document.createElement('span');
  label.className = 'shell-brand-label';
  label.textContent = `Gateway Terminal ${version}`;
  brand.replaceChildren(createLogo('shell-logo'), label);
}

function endBootGlobe() {
  document.body.classList.remove('boot-running');
}

const initialize = document.getElementById('boot-initialize');
initialize?.addEventListener('click', () => {
  document.body.classList.add('boot-running');
}, { capture: true });

const bootPanel = document.getElementById('boot-panel');
if (bootPanel && typeof MutationObserver === 'function') {
  const bootObserver = new MutationObserver(() => {
    if (bootPanel.hidden) endBootGlobe();
  });
  bootObserver.observe(bootPanel, { attributes: true, attributeFilter: ['hidden'] });
}

const workspace = document.getElementById('workspace');
if (workspace && typeof MutationObserver === 'function') {
  const shellObserver = new MutationObserver(() => decorateShellBrand());
  shellObserver.observe(workspace, { childList: true, subtree: true });
}

decorateBootBrand();
decorateShellBrand();
