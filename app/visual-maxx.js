const RAIN_COLUMNS_PER_LAYER = 8;

function addStylesheet() {
  if (document.querySelector('link[data-para11ax-tactical]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/app/tactical-maxx.css';
  link.dataset.para11axTactical = 'true';
  document.head.append(link);
}

function densifyRain() {
  for (const layer of document.querySelectorAll('.matrix')) {
    layer.classList.add('matrix-heavy');
    const originals = [...layer.querySelectorAll('.rain-col')];
    if (!originals.length) continue;
    let index = originals.length;
    while (index < RAIN_COLUMNS_PER_LAYER) {
      const source = originals[index % originals.length];
      const clone = source.cloneNode(true);
      clone.dataset.rainClone = String(index + 1);
      clone.textContent = `${source.textContent}11AX`;
      layer.append(clone);
      index += 1;
    }
  }
}

function buildHud() {
  if (document.querySelector('.tactical-hud')) return;
  const hud = document.createElement('div');
  hud.className = 'tactical-hud';
  hud.setAttribute('aria-hidden', 'true');

  const cross = document.createElement('div');
  cross.className = 'hud-cross';
  const sentinel = document.createElement('div');
  sentinel.className = 'sentinel-mark';
  hud.append(cross, sentinel);
  document.body.append(hud);

  const readout = document.createElement('div');
  readout.className = 'tactical-readout';
  readout.setAttribute('aria-hidden', 'true');
  const label = document.createElement('b');
  label.textContent = 'PARA11AX // TACTICAL';
  readout.append(label, document.createTextNode('EVIDENCE v2 · FIXED EGRESS · READ ONLY'));
  document.body.append(readout);
}

function initializeVisualMaxx() {
  document.documentElement.dataset.visual = 'tactical-maxx';
  addStylesheet();
  densifyRain();
  buildHud();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeVisualMaxx, { once: true });
  else initializeVisualMaxx();
}

export { RAIN_COLUMNS_PER_LAYER, initializeVisualMaxx };
