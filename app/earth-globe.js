import { NATURAL_EARTH_LAND_PATHS } from './earth-geometry.js';

const STYLE_URL = '/app/earth-globe.css';
const NS = 'http://www.w3.org/2000/svg';
const SOURCE_WIDTH = 720;
const SOURCE_HEIGHT = 360;
const CX = 120;
const CY = 120;
const RADIUS = 84;
const TAU = Math.PI * 2;
const BASE_LONGITUDE = 10 * Math.PI / 180;
const ROTATION_MS = 36_000;
const FRAME_MS = 1000 / 24;

if (
  document.documentElement.dataset.terminalFirst !== 'v7'
  && !document.querySelector(`link[href="${STYLE_URL}"]`)
) {
  const styles = document.createElement('link');
  styles.rel = 'stylesheet';
  styles.href = STYLE_URL;
  document.head.append(styles);
}

function svgNode(name, className = '') {
  const node = document.createElementNS(NS, name);
  if (className) node.setAttribute('class', className);
  return node;
}

function parseEquirectangularPath(pathData) {
  const points = [];
  const command = /([ML])\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/g;
  let match;

  while ((match = command.exec(pathData))) {
    const x = Number(match[2]);
    const y = Number(match[3]);
    points.push({
      lon: (x / SOURCE_WIDTH) * TAU - Math.PI,
      lat: Math.PI / 2 - (y / SOURCE_HEIGHT) * Math.PI,
      move: match[1] === 'M',
    });
  }

  return points;
}

function normalizeLongitude(value) {
  let normalized = value;
  while (normalized > Math.PI) normalized -= TAU;
  while (normalized < -Math.PI) normalized += TAU;
  return normalized;
}

function projectOrthographic(point, centerLon) {
  const lat = point.lat;
  const deltaLon = normalizeLongitude(point.lon - centerLon);
  const visibility = Math.cos(lat) * Math.cos(deltaLon);
  if (visibility <= 0) return null;

  return {
    x: CX + RADIUS * Math.cos(lat) * Math.sin(deltaLon),
    y: CY - RADIUS * Math.sin(lat),
  };
}

function renderProjectedPath(points, centerLon) {
  let d = '';
  let drawing = false;

  for (const point of points) {
    const projected = projectOrthographic(point, centerLon);
    if (!projected) {
      drawing = false;
      continue;
    }

    const command = !drawing || point.move ? 'M' : 'L';
    d += `${command}${projected.x.toFixed(1)} ${projected.y.toFixed(1)} `;
    drawing = true;
  }

  return d.trim();
}

function createEarthLayer() {
  const layer = svgNode('g', 'boot-earth-layer');
  const entries = NATURAL_EARTH_LAND_PATHS.map(pathData => {
    const path = svgNode('path', 'boot-earth-land');
    layer.append(path);
    return { path, points: parseEquirectangularPath(pathData) };
  });
  return { layer, entries };
}

function animateEarth(entries) {
  const startedAt = performance.now();
  let lastPaint = -Infinity;

  const frame = now => {
    if (now - lastPaint >= FRAME_MS) {
      const phase = ((now - startedAt) % ROTATION_MS) / ROTATION_MS;
      const centerLon = BASE_LONGITUDE + phase * TAU;
      for (const entry of entries) {
        entry.path.setAttribute('d', renderProjectedPath(entry.points, centerLon));
      }
      lastPaint = now;
    }
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

function renderNaturalEarthGlobe() {
  const globe = document.querySelector('.boot-globe');
  if (!globe || globe.dataset.earth === 'true') return false;

  // Claim the boot globe before terminal-polish runs. Its guarded fallback then
  // becomes a no-op, so no hand-drawn continent layer can flash before Earth.
  globe.dataset.enhanced = 'true';
  globe.querySelector('.boot-globe-landmasses')?.remove();
  globe.querySelector('.boot-globe-scanner')?.remove();

  const { layer, entries } = createEarthLayer();
  const grid = globe.querySelector('.boot-globe-grid');
  if (grid) globe.insertBefore(layer, grid);
  else globe.append(layer);

  globe.dataset.earth = 'true';

  // Draw a correct first frame synchronously, then rotate the geographic
  // longitude through a real orthographic projection. The SVG frame stays put.
  for (const entry of entries) {
    entry.path.setAttribute('d', renderProjectedPath(entry.points, BASE_LONGITUDE));
  }
  animateEarth(entries);
  return true;
}

if (!renderNaturalEarthGlobe() && typeof MutationObserver === 'function') {
  const observer = new MutationObserver(() => {
    if (renderNaturalEarthGlobe()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
