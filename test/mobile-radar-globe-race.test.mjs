import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('analyst shell renders exactly one radar lockup with no CSS pseudo-radar beside it', async () => {
  const [brandCss, brandRuntime, polish] = await Promise.all([
    read('app/brand-final.css'),
    read('brand-unification.js'),
    read('app/terminal-polish.js'),
  ]);

  assert.match(brandRuntime, /para11ax-radar-lockup\.svg/);
  assert.match(polish, /shell-logo/);
  assert.doesNotMatch(brandCss, /\.shell-brand::before/,
    'shell already contains the canonical radar lockup; a ::before radar duplicates it');
  assert.doesNotMatch(brandCss, /\.terminal-mark::before/,
    'legacy terminal mark must not prepend a second radar to the canonical lockup');
});

test('boot globe has one renderer and no hand-drawn fallback geometry', async () => {
  const [polish, earth] = await Promise.all([
    read('app/terminal-polish.js'),
    read('app/earth-globe.js'),
  ]);

  assert.doesNotMatch(polish, /GLOBE_LANDMASSES|enhanceBootGlobe|boot-globe-landmasses/,
    'terminal polish must not create a second fake geography layer');
  assert.match(earth, /NATURAL_EARTH_LAND_PATHS/);
});

test('Natural Earth is reprojected as a rotating orthographic sphere instead of sliding a flat map', async () => {
  const [earth, earthCss, shell, polishCss] = await Promise.all([
    read('app/earth-globe.js'),
    read('app/earth-globe.css'),
    read('app/shell.css'),
    read('app/shell-polish.css'),
  ]);

  assert.match(earth, /function\s+parseEquirectangularPath/,
    'renderer must recover geographic coordinates from the generated equirectangular source');
  assert.match(earth, /function\s+projectOrthographic/,
    'renderer must use an orthographic sphere projection');
  assert.match(earth, /requestAnimationFrame/,
    'longitude rotation must be driven by browser-native animation frames');
  assert.match(earth, /Math\.cos\(lat\).*Math\.cos\(deltaLon\)/s,
    'renderer must perform front-hemisphere visibility testing');
  assert.doesNotMatch(earth, /animateTransform|translate\(-?720|createEarthCopy\(720\)/,
    'flat-map translation is not globe rotation');
  assert.doesNotMatch(earthCss, /boot-earth-track/,
    'the orthographic renderer does not need a sliding track');
  assert.doesNotMatch(shell, /\.boot-globe\{[^}]*animation:globe-spin/s,
    'the SVG frame itself must never spin like a flat disc');
  assert.doesNotMatch(polishCss, /\.boot-globe\{[^}]*animation:globe-spin/s,
    'polish must not reintroduce whole-disc rotation');
});
