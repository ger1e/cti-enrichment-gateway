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

test('boot globe never paints placeholder continent blobs before Natural Earth geometry', async () => {
  const [polish, earth] = await Promise.all([
    read('app/terminal-polish.js'),
    read('app/earth-globe.js'),
  ]);

  assert.doesNotMatch(polish, /GLOBE_LANDMASSES/);
  assert.doesNotMatch(polish, /boot-globe-landmass/);
  assert.match(earth, /NATURAL_EARTH_LAND_PATHS/);
});

test('Natural Earth globe uses coordinate-based SVG motion and is loaded before polish layers', async () => {
  const [main, earth, earthCss] = await Promise.all([
    read('app/terminal-main.js'),
    read('app/earth-globe.js'),
    read('app/earth-globe.css'),
  ]);

  assert.ok(
    main.indexOf("await import('./earth-globe.js')") < main.indexOf("await import('./terminal-polish.js')"),
    'Earth renderer must run immediately after the terminal creates the globe, before polish layers'
  );
  assert.match(earth, /createElementNS\(NS, ['"]animateTransform['"]\)/);
  assert.match(earth, /setAttribute\(['"]type['"], ['"]translate['"]\)/);
  assert.match(earth, /setAttribute\(['"]from['"], ['"]0 0['"]\)/);
  assert.match(earth, /setAttribute\(['"]to['"], ['"]-720 0['"]\)/);
  assert.match(earth, /setAttribute\(['"]dur['"], ['"]36s['"]\)/);
  assert.match(earth, /setAttribute\(['"]repeatCount['"], ['"]indefinite['"]\)/);
  assert.doesNotMatch(earthCss, /\.boot-earth-track\{[^}]*animation:/,
    'CSS percentage transforms on SVG groups are not the motion source on mobile');
});
