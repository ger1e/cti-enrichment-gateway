import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFile(url(path), 'utf8');
const readBytes = path => readFile(url(path));

function gifDimensions(bytes) {
  assert.equal(bytes.subarray(0, 6).toString('ascii'), 'GIF89a');
  return {
    width: bytes.readUInt16LE(6),
    height: bytes.readUInt16LE(8),
  };
}

test('README serves a dedicated animated mobile hero instead of shrinking the desktop banner', async () => {
  const [readme, desktop, mobile] = await Promise.all([
    read('README.md'),
    readBytes('assets/brand/para11ax-readme-hero-v5.gif'),
    readBytes('assets/brand/para11ax-readme-hero-mobile-v5.gif'),
  ]);

  assert.match(readme, /<picture>/i);
  assert.match(readme, /<source\s+media="\(max-width:\s*720px\)"\s+srcset="assets\/brand\/para11ax-readme-hero-mobile-v5\.gif"/i);
  assert.match(readme, /<img\s+src="assets\/brand\/para11ax-readme-hero-v5\.gif"[^>]*alt="PARA11AX — animated PPI radar"/i);
  assert.doesNotMatch(readme, /para11ax-readme-hero-v4\.gif/);

  assert.deepEqual(gifDimensions(desktop), { width: 960, height: 347 });
  assert.deepEqual(gifDimensions(mobile), { width: 480, height: 520 });
  assert.ok(desktop.length > 8_000, 'desktop GIF must contain real animation/image data');
  assert.ok(mobile.length > 8_000, 'mobile GIF must contain real animation/image data');
});

test('final CRT branding preserves the Natural Earth globe instead of replacing it with a radar disc', async () => {
  const [brandCss, earthCss, earthJs] = await Promise.all([
    read('app/brand-final.css'),
    read('app/earth-globe.css'),
    read('app/earth-globe.js'),
  ]);

  assert.doesNotMatch(brandCss, /\.boot-globe>\*\{display:none!important\}/);
  assert.doesNotMatch(brandCss, /\.boot-globe\{[\s\S]*?conic-gradient\(from var\(--ppi-angle\)/);
  assert.match(earthJs, /boot-earth-window/);
  assert.match(earthJs, /boot-earth-track/);
  assert.match(earthCss, /\.boot-earth-track\{[^}]*animation:\s*earth-longitude\s+36s\s+linear\s+infinite/);
  assert.match(brandCss, /\.shell-brand::before/);
  assert.match(brandCss, /\.crt\{[\s\S]*repeating-linear-gradient/);
});

test('radar lockups keep moving while reduced-motion only disables CRT flicker', async () => {
  const brandCss = await read('app/brand-final.css');
  assert.match(brandCss, /\.terminal-mark::before,\.shell-brand::before\{[\s\S]*animation:ppi-sweep-angle\s+4\.8s\s+linear\s+infinite/);
  assert.match(brandCss, /prefers-reduced-motion:reduce[\s\S]*\.terminal-mark::before,\.shell-brand::before\{animation:ppi-sweep-angle\s+24s\s+linear\s+infinite!important\}/);
  assert.match(brandCss, /prefers-reduced-motion:reduce[\s\S]*\.crt\{animation:none!important\}/);
});
