import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('active brand tokens use the canonical terminal palette without legacy cyan or amber', () => {
  const tokens = read('assets/brand/tokens.json');
  assert.match(tokens, /"terminalBg"\s*:\s*"#020403"/i);
  assert.match(tokens, /"phosphor"\s*:\s*"#39FF14"/i);
  assert.match(tokens, /"signalWhite"\s*:\s*"#F7FFF6"/i);
  assert.match(tokens, /"muted"\s*:\s*"#8DA391"/i);
  assert.match(tokens, /"alert"\s*:\s*"#FF2438"/i);
  assert.doesNotMatch(tokens, /#00E5FF|#F6C945|#39FF88/i);
});

test('shared compact logo assets remain compatible secondary marks', () => {
  for (const path of ['assets/brand/para11ax-mark.svg', 'assets/brand/para11ax-lockup.svg', 'app/para11ax-mark.svg']) {
    const svg = read(path);
    assert.match(svg, /#39FF14/i, `${path} missing phosphor`);
    assert.doesNotMatch(svg, /#00E5FF/i, `${path} still contains legacy cyan`);
  }
});

test('README uses the unified terminal hero and operational hierarchy', () => {
  const readme = read('README.md');
  assert.match(readme, /para11ax-terminal-hero\.svg/i);
  assert.match(readme, /para11ax-terminal-hero-mobile\.svg/i);
  assert.match(readme, /OPERATIONAL CORE/i);
  assert.match(readme, /SEMANTIC FIREWALL/i);
  assert.match(readme, /ANALYST SURFACE/i);
  assert.match(readme, /user@para11ax:~\$/i);
  assert.match(readme, /https:\/\/para11ax\.vercel\.app\/app\//i);
  assert.match(readme, /<details>/i);
});

test('README hero assets use the phosphor terminal identity and reject legacy palette drift', () => {
  for (const path of ['assets/brand/para11ax-terminal-hero.svg', 'assets/brand/para11ax-terminal-hero-mobile.svg']) {
    const svg = read(path);
    assert.match(svg, /#020403/i, `${path} missing terminal background`);
    assert.match(svg, /#39FF14/i, `${path} missing phosphor`);
    assert.match(svg, /user@para11ax:~\$/i, `${path} missing terminal prompt`);
    assert.doesNotMatch(svg, /#00E5FF|#F6C945|#39FF88/i, `${path} still contains legacy palette`);
  }
});
