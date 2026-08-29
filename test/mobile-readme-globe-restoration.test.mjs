import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFile(url(path), 'utf8');

test('README serves one complete self-contained SVG hero', async () => {
  const [readme, hero] = await Promise.all([
    read('README.md'),
    read('assets/brand/para11ax-readme-hero-v7.svg'),
  ]);

  assert.match(readme, /<img\s+src="assets\/brand\/para11ax-readme-hero-v7\.svg"/i);
  assert.doesNotMatch(readme, /<picture>/i);
  assert.doesNotMatch(readme, /para11ax-readme-hero-(?:mobile-)?v5\.gif|para11ax-readme-hero-v6\.gif/i);
  assert.doesNotMatch(readme, /INTELLIGENCE\.\s*ENRICHED\.\s*OPERATIONAL\./i);
  assert.match(hero, /viewBox="0 0 720 360"/i);
  assert.match(hero, /data-radar="ppi"/i);
  assert.match(hero, /PARA11AX/i);
  assert.match(hero, /CTI ENRICHMENT \/\/ ANALYST OPERATIONS/i);
  assert.doesNotMatch(hero, /(?:href|xlink:href)=["']https?:\/\//i);
  assert.doesNotMatch(hero, /url\(\s*["']?https?:\/\//i);
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
