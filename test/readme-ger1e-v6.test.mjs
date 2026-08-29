import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');

test('README uses one self-contained ger1e-style SVG hero without raster fallback or slogan wall', () => {
  const readme = read('README.md');
  const hero = 'assets/brand/para11ax-readme-hero-v7.svg';

  assert.match(readme, /<img[^>]+para11ax-readme-hero-v7\.svg/i);
  assert.doesNotMatch(readme, /<picture>/i);
  assert.doesNotMatch(readme, /para11ax-readme-hero-(?:mobile-)?v5\.gif|para11ax-readme-hero-v6\.gif/i);
  assert.doesNotMatch(readme, /INTELLIGENCE\.\s*ENRICHED\.\s*OPERATIONAL\./i);

  assert.equal(existsSync(hero), true, `${hero} must exist`);
  const svg = read(hero);
  assert.match(svg, /<svg[^>]+viewBox=["']0 0 720 360["']/i);
  assert.match(svg, /data-radar=["']ppi["']/i);
  assert.match(svg, /PARA11AX/i);
  assert.match(svg, /CTI ENRICHMENT\s*\/\/\s*ANALYST OPERATIONS/i);
  assert.match(svg, /follow the evidence/i);
  assert.match(svg, /John Kiriakou/i);
  assert.match(svg, /@keyframes\s+ppi-spin/i);
  assert.doesNotMatch(svg, /(?:href|xlink:href)=["']https?:\/\//i, 'hero must not reference external assets');
  assert.doesNotMatch(svg, /url\(\s*["']?https?:\/\//i, 'hero CSS must not reference external assets');
  assert.doesNotMatch(svg, /FIXED SOURCES|EVIDENCE V2|STIX|READ-ONLY|FIXED EGRESS/i);

  assert.match(readme, /Tooling smoke/i);
  assert.match(readme, /CodeQL/i);
  assert.match(readme, /ENTER ANALYST UI/i);
  assert.match(readme, /analyst@para11ax:~\$/i);
});
