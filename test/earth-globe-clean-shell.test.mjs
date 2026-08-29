import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFile(url(path), 'utf8');

test('boot globe uses generated Natural Earth coastline geometry instead of painted hand-drawn fallback', async () => {
  const geometryExists = await access(url('app/earth-geometry.js')).then(() => true, () => false);
  const rendererExists = await access(url('app/earth-globe.js')).then(() => true, () => false);
  assert.equal(geometryExists, true, 'generated local Earth geometry module must exist');
  assert.equal(rendererExists, true, 'dedicated Earth renderer must exist');
  const geometry = await read('app/earth-geometry.js');
  const renderer = await read('app/earth-globe.js');
  const css = await read('app/earth-globe.css');
  assert.match(geometry, /Natural Earth/i);
  assert.match(geometry, /public domain/i);
  assert.match(geometry, /NATURAL_EARTH_LAND_PATHS/);
  assert.ok((geometry.match(/\bM\s*[\d.-]+/g) || []).length >= 20, 'coastline geometry must contain many real land polygons');
  assert.match(renderer, /NATURAL_EARTH_LAND_PATHS/);
  assert.match(renderer, /boot-globe-landmasses/);
  assert.match(renderer, /\.remove\(\)/, 'renderer must remove any superseded fake landmass layer');
  assert.match(css, /boot-globe-landmasses[^}]*display:none!important/,
    'coarse fallback must stay hidden even if legacy code attempts to add it');
});

test('Earth layer is orthographically reprojected and rotates by longitude while the globe frame stays fixed', async () => {
  const renderer = await read('app/earth-globe.js');
  const css = await read('app/earth-globe.css');
  const main = await read('app/terminal-main.js');
  assert.match(main, /earth-globe\.js/);
  assert.match(renderer, /parseEquirectangularPath/);
  assert.match(renderer, /projectOrthographic/);
  assert.match(renderer, /Math\.cos\(lat\)\s*\*\s*Math\.cos\(deltaLon\)/);
  assert.match(renderer, /requestAnimationFrame/);
  assert.match(renderer, /ROTATION_MS\s*=\s*36_000/);
  assert.doesNotMatch(renderer, /animateTransform|boot-earth-track|createEarthCopy\(720\)/);
  assert.match(css, /\.boot-earth-layer\{/);
  assert.doesNotMatch(css, /boot-earth-track/);
  assert.match(css, /\.boot-globe\{[^}]*animation:\s*none!important/);
});

test('operational shell drops all boot artwork after the ready handoff', async () => {
  const entry = await read('app/terminal-entry.js');
  assert.doesNotMatch(entry, /boot transcript retained/);
  assert.doesNotMatch(entry, /function restoreBootTranscript/);
  assert.doesNotMatch(entry, /remember\(\{ kind: 'line'/);
  assert.match(entry, /pepe\.hidden = false/);
  assert.match(entry, /mountAnalystShell/);
  assert.doesNotMatch(entry, /pepeSignature|restorePepeSignature|shell-boot-pepe/);
});
