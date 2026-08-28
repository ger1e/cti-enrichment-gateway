import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFile(url(path), 'utf8');

test('boot globe uses generated Natural Earth coastline geometry instead of hand-drawn polygons', async () => {
  const geometryExists = await access(url('app/earth-geometry.js')).then(() => true, () => false);
  const rendererExists = await access(url('app/earth-globe.js')).then(() => true, () => false);
  assert.equal(geometryExists, true, 'generated local Earth geometry module must exist');
  assert.equal(rendererExists, true, 'dedicated Earth renderer must exist');
  const geometry = await read('app/earth-geometry.js');
  const renderer = await read('app/earth-globe.js');
  assert.match(geometry, /Natural Earth/i);
  assert.match(geometry, /public domain/i);
  assert.match(geometry, /NATURAL_EARTH_LAND_PATHS/);
  assert.ok((geometry.match(/\bM\s*[\d.-]+/g) || []).length >= 20, 'coastline geometry must contain many real land polygons');
  assert.match(renderer, /NATURAL_EARTH_LAND_PATHS/);
  assert.match(renderer, /boot-globe-landmasses/);
  assert.match(renderer, /\.remove\(\)/, 'renderer must remove the superseded fake landmass layer');
});

test('Earth layer rotates longitudinally inside the globe instead of spinning like a flat disc', async () => {
  const renderer = await read('app/earth-globe.js');
  const css = await read('app/earth-globe.css');
  const main = await read('app/terminal-main.js');
  assert.match(main, /earth-globe\.js/);
  assert.match(renderer, /boot-earth-window/);
  assert.match(renderer, /boot-earth-track/);
  assert.match(renderer, /boot-earth-copy/);
  assert.match(css, /\.boot-earth-window\{/);
  assert.match(css, /\.boot-earth-track\{[^}]*animation:\s*earth-longitude\s+36s\s+linear\s+infinite/);
  assert.match(css, /@keyframes earth-longitude\{[\s\S]*?translateX\(-50%\)[\s\S]*?\}/);
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
