import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');

const assets = [
  ['assets/brand/para11ax-readme-hero-v8.svg', '720 360'],
  ['assets/brand/para11ax-readme-architecture-v4.svg', '720 760'],
  ['assets/brand/para11ax-readme-semantics-v4.svg', '720 820'],
];

test('README uses the normalized GER1E-style PARA11AX SVG family', () => {
  const readme = read('README.md');
  for (const [path] of assets) {
    assert.equal(existsSync(path), true, `${path} must exist`);
    assert.match(readme, new RegExp(path.replaceAll('/', '\\/').replaceAll('.', '\\.'), 'i'));
  }
  assert.doesNotMatch(readme, /para11ax-readme-hero-v7\.svg|para11ax-architecture-v3\.svg|para11ax-semantic-firewall-v3\.svg/i);
});

test('README SVGs preserve PARA11AX identity inside GER1E-normalized geometry', () => {
  for (const [path, viewBox] of assets) {
    const svg = read(path);
    assert.match(svg, new RegExp(`viewBox=["']0 0 ${viewBox}["']`, 'i'));
    assert.match(svg, /rx=["']12["']/i, `${path} must use GER1E-style rounded outer framing`);
    assert.match(svg, /ui-monospace|SFMono-Regular|Menlo|Consolas/i, `${path} must use the normalized mono stack`);
    assert.match(svg, /#020403/i, `${path} must preserve terminal black`);
    assert.match(svg, /#39FF14/i, `${path} must preserve phosphor green`);
    assert.match(svg, /#F7FFF6/i, `${path} must preserve signal white`);
    assert.doesNotMatch(svg, /#00E5FF|#F6C945|#39FF88/i, `${path} must not reintroduce legacy colors`);
  }
});

test('README adopts GER1E-style numbered information hierarchy without losing core contracts', () => {
  const readme = read('README.md');
  for (const section of [
    '01 // SYSTEM PROFILE',
    '02 // REQUEST PATH',
    '03 // ANALYST SURFACE',
    '04 // SEMANTIC FIREWALL',
    '05 // PROVIDER FABRIC',
    '06 // SECURITY & VERIFICATION',
    '07 // DEEP DOCS',
  ]) assert.match(readme, new RegExp(section.replace('/', '\\/'), 'i'));

  assert.match(readme, /Evidence v2/i);
  assert.match(readme, /Evidence Graph v1\.0/i);
  assert.match(readme, /Guidance v1\.0/i);
  assert.match(readme, /safeFetch/i);
  assert.match(readme, /38\s+(?:configured\s+)?sources/i);
  assert.match(readme, /OBSERVED ≠ INFERRED ≠ CONTEXTUAL/i);
  assert.match(readme, /No universal maliciousness score/i);
});
