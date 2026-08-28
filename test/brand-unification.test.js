import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('active brand tokens use phosphor tactical palette without legacy cyan', () => {
  const tokens = read('assets/brand/tokens.json');
  assert.match(tokens, /"phosphor"\s*:\s*"#39FF14"/i);
  assert.match(tokens, /"signalWhite"\s*:\s*"#F7FFF6"/i);
  assert.doesNotMatch(tokens, /#00E5FF/i);
});

test('shared and app logo assets use the sentinel phosphor identity', () => {
  for (const path of ['assets/brand/para11ax-mark.svg', 'assets/brand/para11ax-lockup.svg', 'app/para11ax-mark.svg']) {
    const svg = read(path);
    assert.match(svg, /#39FF14/i, `${path} missing phosphor`);
    assert.match(svg, /sentinel|helmet|visor/i, `${path} missing sentinel semantics`);
    assert.doesNotMatch(svg, /#00E5FF/i, `${path} still contains legacy cyan`);
  }
});

test('README uses the unified tactical hero and fast operational hierarchy', () => {
  const readme = read('README.md');
  assert.match(readme, /para11ax-hero\.svg/i);
  assert.match(readme, /para11ax-hero-mobile\.svg/i);
  assert.match(readme, /OPERATIONAL CORE/i);
  assert.match(readme, /SEMANTIC FIREWALL/i);
  assert.match(readme, /ANALYST SURFACE/i);
  assert.match(readme, /https:\/\/para11ax\.vercel\.app\/app\//i);
  assert.match(readme, /<details>/i);
});

test('README hero assets share phosphor sentinel palette and reject cyan drift', () => {
  for (const path of ['assets/brand/para11ax-hero.svg', 'assets/brand/para11ax-hero-mobile.svg']) {
    const svg = read(path);
    assert.match(svg, /#39FF14/i, `${path} missing phosphor`);
    assert.match(svg, /sentinel|helmet|visor/i, `${path} missing sentinel visual`);
    assert.doesNotMatch(svg, /#00E5FF/i, `${path} still contains legacy cyan`);
  }
});
