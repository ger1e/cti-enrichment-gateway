import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('PARA11AX globe renders recognizable continent silhouettes instead of grid-only geometry', async () => {
  const polishJs = await read('app/terminal-polish.js');
  const polishCss = await read('app/shell-polish.css');

  assert.match(polishJs, /GLOBE_LANDMASSES/);
  assert.match(polishJs, /boot-globe-landmass/);
  assert.match(polishJs, /createElementNS\(ns, ['"]path['"]\)/);
  assert.match(polishCss, /\.boot-globe-landmass\{[^}]*fill:/);
  assert.match(polishCss, /\.boot-globe-landmass\{[^}]*stroke:/);
});

test('slow globe rotation remains active on Android reduced-motion while aggressive glitches stay reduced', async () => {
  const baseCss = await read('app/shell.css');
  const polishCss = await read('app/shell-polish.css');

  assert.match(polishCss, /\.boot-globe\{[^}]*animation:globe-spin\s+36s\s+linear\s+infinite!important/);
  assert.match(polishCss, /prefers-reduced-motion:reduce[\s\S]*\.boot-globe\{[^}]*animation:globe-spin\s+36s\s+linear\s+infinite!important/);
  assert.match(baseCss, /prefers-reduced-motion:reduce[\s\S]*\.glitch-[^{]+\{[^}]*animation:none!important/);
});

test('red globe scanner is persistent rather than a one-second glitch afterimage', async () => {
  const polishJs = await read('app/terminal-polish.js');
  const polishCss = await read('app/shell-polish.css');

  assert.match(polishJs, /boot-globe-scanner/);
  assert.match(polishCss, /@keyframes\s+globe-red-scan/);
  assert.match(polishCss, /\.boot-globe-scanner\{[^}]*stroke:var\(--px-red\)[^}]*stroke-opacity:1[^}]*animation:globe-red-scan/);
  assert.match(polishCss, /\.boot-globe\{[^}]*opacity:\.(?:1[8-9]|2\d)!important/, 'standby globe must be visible enough for its landmass and red scanner');
  assert.match(polishCss, /\.boot-running \.boot-globe\{opacity:\.(?:2[4-9]|3\d)!important\}/, 'initialized boot must not fade the globe back into the background');
});
