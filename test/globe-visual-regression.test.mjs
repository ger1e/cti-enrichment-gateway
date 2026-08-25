import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('PARA11AX globe renders recognizable continent silhouettes instead of grid-only geometry', async () => {
  const entry = await read('app/terminal-entry.js');
  const css = await read('app/shell.css');

  assert.match(entry, /GLOBE_LANDMASSES/);
  assert.match(entry, /boot-globe-landmass/);
  assert.match(entry, /createElementNS\(ns, ['"]path['"]\)/);
  assert.match(css, /\.boot-globe-landmass\{[^}]*fill:/);
  assert.match(css, /\.boot-globe-landmass\{[^}]*stroke:/);
});

test('slow globe rotation remains active on Android reduced-motion while aggressive glitches stay reduced', async () => {
  const css = await read('app/shell.css');

  assert.match(css, /\.boot-globe\{[^}]*animation:globe-spin\s+36s\s+linear\s+infinite/);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*\.boot-globe\{[^}]*animation:globe-spin\s+36s\s+linear\s+infinite!important/);
  assert.doesNotMatch(css, /prefers-reduced-motion:reduce[\s\S]*\.boot-globe\{[^}]*animation:none!important/);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*\.glitch-[^{]+\{[^}]*animation:none!important/);
});

test('red globe scanner is persistent rather than a one-second glitch afterimage', async () => {
  const entry = await read('app/terminal-entry.js');
  const css = await read('app/shell.css');
  const polish = await read('app/shell-polish.css');

  assert.match(entry, /boot-globe-scanner/);
  assert.match(css, /@keyframes\s+globe-red-scan/);
  assert.match(css, /\.boot-globe-scanner\{[^}]*stroke:var\(--px-red\)[^}]*stroke-opacity:1[^}]*animation:globe-red-scan/);
  assert.match(css, /\.boot-globe\{[^}]*opacity:\.(?:1[8-9]|2\d)/, 'standby globe must be visible enough for its landmass and red scanner');
  assert.match(polish, /\.boot-running \.boot-globe\{opacity:\.(?:2[4-9]|3\d)!important\}/, 'initialized boot must not fade the globe back into the background');
});
