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

test('README serves one ger1e-style mobile-normalized animated hero', async () => {
  const [readme, hero] = await Promise.all([
    read('README.md'),
    readBytes('assets/brand/para11ax-readme-hero-v6.gif'),
  ]);

  assert.match(readme, /<img\s+src="assets\/brand\/para11ax-readme-hero-v6\.gif"/i);
  assert.doesNotMatch(readme, /<picture>/i);
  assert.doesNotMatch(readme, /para11ax-readme-hero-(?:mobile-)?v5\.gif/i);
  assert.doesNotMatch(readme, /INTELLIGENCE\.\s*ENRICHED\.\s*OPERATIONAL\./i);

  assert.deepEqual(gifDimensions(hero), { width: 720, height: 360 });
  assert.ok(hero.length > 8_000, 'v6 GIF must contain real animation/image data');
  assert.match(hero.toString('latin1'), /NETSCAPE2\.0/, 'v6 GIF must loop');
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
  assert.match(earthJs, /animateTransform/);
  assert.match(earthJs, /setAttribute\(['"]to['"], ['"]-720 0['"]\)/);
  assert.doesNotMatch(earthCss, /\.boot-earth-track\{[^}]*animation:/);
  assert.doesNotMatch(brandCss, /\.shell-brand::before|\.terminal-mark::before/);
  assert.match(brandCss, /\.crt\{[\s\S]*repeating-linear-gradient/);
});

test('canonical SVG radar keeps moving while reduced-motion only disables CRT flicker', async () => {
  const [brandCss, lockup] = await Promise.all([
    read('app/brand-final.css'),
    read('assets/brand/para11ax-radar-lockup.svg'),
  ]);

  assert.match(lockup, /data-radar=["']ppi["']/i);
  assert.match(lockup, /<animateTransform\b[^>]*type=["']rotate["']/i);
  assert.doesNotMatch(brandCss, /ppi-sweep-angle|\.shell-brand::before|\.terminal-mark::before/);
  assert.match(brandCss, /prefers-reduced-motion:reduce[\s\S]*\.crt\{animation:none!important\}/);
});
