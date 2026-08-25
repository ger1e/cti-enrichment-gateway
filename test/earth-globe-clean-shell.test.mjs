import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFile(url(path), 'utf8');

test('boot globe uses generated Natural Earth coastline geometry instead of hand-drawn polygons', async () => {
  const exists = await access(url('app/earth-geometry.js')).then(() => true, () => false);
  assert.equal(exists, true, 'generated local Earth geometry module must exist');
  const geometry = await read('app/earth-geometry.js');
  const polish = await read('app/terminal-polish.js');
  assert.match(geometry, /Natural Earth/i);
  assert.match(geometry, /public domain/i);
  assert.match(geometry, /NATURAL_EARTH_LAND_PATHS/);
  assert.ok((geometry.match(/\bM\s*[\d.-]+/g) || []).length >= 20, 'coastline geometry must contain many real land polygons');
  assert.match(polish, /NATURAL_EARTH_LAND_PATHS/);
  assert.doesNotMatch(polish, /GLOBE_LANDMASSES/);
});

test('Earth layer rotates longitudinally inside the globe instead of spinning like a flat disc', async () => {
  const polish = await read('app/terminal-polish.js');
  const css = await read('app/shell-polish.css');
  assert.match(polish, /boot-earth-window/);
  assert.match(polish, /boot-earth-track/);
  assert.match(polish, /boot-earth-copy/);
  assert.match(css, /\.boot-earth-window\{/);
  assert.match(css, /\.boot-earth-track\{[^}]*animation:\s*earth-longitude\s+36s\s+linear\s+infinite/);
  assert.match(css, /@keyframes earth-longitude\{[^}]*translateX\(-50%\)/);
  assert.match(css, /\.boot-globe\{[^}]*animation:\s*none!important/);
});

test('operational shell drops the retained boot wall but keeps Pepe as the sole boot artifact', async () => {
  const entry = await read('app/terminal-entry.js');
  assert.doesNotMatch(entry, /boot transcript retained/);
  assert.doesNotMatch(entry, /function restoreBootTranscript/);
  assert.doesNotMatch(entry, /remember\(\{ kind: 'line'/);
  assert.match(entry, /shell-boot-pepe/);
  assert.match(entry, /restorePepeSignature/);
  assert.match(entry, /restorePepeSignature\(\)/);
});
