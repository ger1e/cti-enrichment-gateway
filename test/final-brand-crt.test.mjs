import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('production terminal boots directly into the final PPI + CRT brand layer', async () => {
  const [prepaint, main, brandCss, brandJs, boot] = await Promise.all([
    read('app/prepaint-v7.css'),
    read('app/terminal-main.js'),
    read('app/brand-final.css'),
    read('app/brand-final.js'),
    read('app/boot.js'),
  ]);

  assert.match(prepaint, /@import url\('\/app\/brand-final\.css'\);/);
  assert.ok(
    prepaint.indexOf("@import url('/app/brand-final.css');") > prepaint.indexOf("@import url('/site-cursor.css');"),
    'final brand CSS must win the compatibility cascade before first paint',
  );
  assert.match(main, /await import\('\.\/brand-final\.js'\);/);

  assert.match(brandCss, /\.boot-globe\{[\s\S]*conic-gradient\(from var\(--ppi-angle\)/);
  assert.match(brandCss, /\.shell-brand::before/);
  assert.match(brandCss, /\.crt\{[\s\S]*repeating-linear-gradient/);
  assert.match(brandCss, /@keyframes crt-phosphor-flicker/);
  assert.match(brandCss, /@media\(prefers-reduced-motion:reduce\)\{[^}]*animation:none!important/);
  assert.match(brandCss, /#pepe-ascii,\.boot-pepe\{display:none!important\}/);

  for (const banned of ['#00E5FF', '#39FF88', '#F6C945']) {
    assert.doesNotMatch(brandCss, new RegExp(banned, 'i'));
  }

  for (const canonical of ['#020403', '#39FF14', '#F7FFF6', '#8DA391', '#FF2438']) {
    assert.match(brandJs, new RegExp(canonical, 'i'));
  }
  assert.match(boot, /provider-registry\]: 38 sources registered/);
  assert.doesNotMatch(boot, /provider-registry\]: 37 sources registered/);
});
