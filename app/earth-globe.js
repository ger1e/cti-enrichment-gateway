import { NATURAL_EARTH_LAND_PATHS } from './earth-geometry.js';

const STYLE_URL = '/app/earth-globe.css';
const NS = 'http://www.w3.org/2000/svg';

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

function createEarthCopy(offset = 0) {
  const copy = svgNode('g', 'boot-earth-copy');
  if (offset) copy.setAttribute('transform', `translate(${offset} 0)`);
  for (const pathData of NATURAL_EARTH_LAND_PATHS) {
    const path = svgNode('path', 'boot-earth-land');
    path.setAttribute('d', pathData);
    copy.append(path);
  }
  return copy;
}

function createLongitudeMotion() {
  const motion = document.createElementNS(NS, 'animateTransform');
  motion.setAttribute('attributeName', 'transform');
  motion.setAttribute('type', 'translate');
  motion.setAttribute('from', '0 0');
  motion.setAttribute('to', '-720 0');
  motion.setAttribute('dur', '36s');
  motion.setAttribute('repeatCount', 'indefinite');
  return motion;
}

function renderNaturalEarthGlobe() {
  const globe = document.querySelector('.boot-globe');
  if (!globe || globe.dataset.earth === 'true') return;

  // The prepaint stylesheet hides the superseded hand-drawn fallback before it
  // can flash; remove it completely once the real local Natural Earth data lands.
  globe.querySelector('.boot-globe-landmasses')?.remove();

  const defs = svgNode('defs');
  const clip = svgNode('clipPath');
  clip.id = 'boot-earth-clip';
  const clipCircle = svgNode('circle');
  clipCircle.setAttribute('cx', '120');
  clipCircle.setAttribute('cy', '120');
  clipCircle.setAttribute('r', '84');
  clip.append(clipCircle);
  defs.append(clip);

  const windowGroup = svgNode('g', 'boot-earth-window');
  windowGroup.setAttribute('clip-path', 'url(#boot-earth-clip)');

  const stage = svgNode('g', 'boot-earth-stage');
  stage.setAttribute('transform', 'translate(32 32) scale(0.4888889)');

  const track = svgNode('g', 'boot-earth-track');
  track.append(createEarthCopy(0), createEarthCopy(720), createLongitudeMotion());
  stage.append(track);
  windowGroup.append(stage);

  const grid = globe.querySelector('.boot-globe-grid');
  globe.prepend(defs);
  if (grid) globe.insertBefore(windowGroup, grid);
  else globe.append(windowGroup);
  globe.dataset.earth = 'true';
}

renderNaturalEarthGlobe();
