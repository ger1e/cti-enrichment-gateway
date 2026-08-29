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

test('Natural Earth owns the boot globe before legacy polish can add fallback geography', async () => {
  const [main, polish, earth] = await Promise.all([
    read('app/terminal-main.js'),
    read('app/terminal-polish.js'),
    read('app/earth-globe.js'),
  ]);

  assert.ok(
    main.indexOf("await import('./earth-globe.js')") < main.indexOf("await import('./terminal-polish.js')"),
    'real Earth renderer must claim the globe before terminal polish runs'
  );
  assert.match(polish, /globe\.dataset\.enhanced === ['"]true['"]/,
    'legacy fallback must retain a guard that the real renderer can trip');
  assert.match(earth, /globe\.dataset\.enhanced = ['"]true['"]/,
    'real renderer must block fallback landmasses before polish executes');
  assert.match(earth, /NATURAL_EARTH_LAND_PATHS/);
});

test('Natural Earth is reprojected as a rotating orthographic sphere instead of sliding a flat map', async () => {
  const [earth, earthCss] = await Promise.all([
    read('app/earth-globe.js'),
    read('app/earth-globe.css'),
  ]);

  assert.match(earth, /function\s+parseEquirectangularPath/,
    'renderer must recover geographic coordinates from the generated equirectangular source');
  assert.match(earth, /function\s+projectOrthographic/,
    'renderer must use an orthographic sphere projection');
  assert.match(earth, /requestAnimationFrame/,
    'longitude rotation must be driven by browser-native animation frames');
  assert.match(earth, /Math\.cos\(lat\)\s*\*\s*Math\.cos\(deltaLon\)/,
    'renderer must perform front-hemisphere visibility testing');
  assert.doesNotMatch(earth, /animateTransform|translate\(-?720|createEarthCopy\(720\)/,
    'flat-map translation is not globe rotation');
  assert.doesNotMatch(earthCss, /boot-earth-track/,
    'the orthographic renderer does not need a sliding track');
  assert.match(earthCss, /\.boot-globe\{[^}]*animation:none!important/s,
    'the SVG frame itself must stay fixed while geography rotates');
});
