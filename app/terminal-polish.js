const LOGO_URL = '/app/para11ax-mark.svg';

const GLOBE_LANDMASSES = Object.freeze([
  'M58 73 L72 62 L88 60 L100 67 L97 78 L107 88 L101 98 L91 96 L84 107 L74 102 L69 91 L58 86 L51 78 Z',
  'M96 108 L108 112 L117 124 L114 139 L108 149 L105 164 L98 178 L91 167 L89 150 L84 136 L88 121 Z',
  'M93 50 L105 46 L113 53 L109 64 L98 67 L90 58 Z',
  'M126 75 L138 70 L148 75 L145 84 L153 91 L149 103 L157 113 L153 129 L145 143 L137 160 L128 153 L124 135 L117 121 L120 107 L115 95 L121 86 Z',
  'M145 72 L160 66 L179 68 L193 76 L201 88 L193 99 L181 102 L173 114 L159 110 L151 99 L141 94 L147 84 Z',
  'M171 145 L184 140 L197 147 L194 159 L182 166 L169 160 L164 151 Z',
]);

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

function enhanceBootGlobe() {
  const globe = document.querySelector('.boot-globe');
  if (!globe || globe.dataset.enhanced === 'true') return;
  const ns = 'http://www.w3.org/2000/svg';
  const grid = globe.querySelector('.boot-globe-grid');

  const landmasses = document.createElementNS(ns, 'g');
  landmasses.classList.add('boot-globe-landmasses');
  for (const pathData of GLOBE_LANDMASSES) {
    const landmass = document.createElementNS(ns, 'path');
    landmass.setAttribute('d', pathData);
    landmass.classList.add('boot-globe-landmass');
    landmasses.append(landmass);
  }

  if (grid) grid.prepend(landmasses);
  else globe.prepend(landmasses);

  const scanner = document.createElementNS(ns, 'ellipse');
  scanner.setAttribute('cx', '120');
  scanner.setAttribute('cy', '120');
  scanner.setAttribute('rx', '38');
  scanner.setAttribute('ry', '88');
  scanner.classList.add('boot-globe-scanner');
  (grid || globe).append(scanner);

  globe.dataset.enhanced = 'true';
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

enhanceBootGlobe();
decorateBootBrand();
decorateShellBrand();
