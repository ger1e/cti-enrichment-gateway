import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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

test('browser surfaces share one simplified phosphor sentinel favicon', () => {
  assert.equal(existsSync('favicon.svg'), true, 'canonical favicon SVG must exist');
  assert.equal(existsSync('favicon.ico'), true, 'root favicon fallback must exist for browser autodiscovery');

  const favicon = read('favicon.svg');
  assert.match(favicon, /viewBox=["']0 0 64 64["']/i);
  assert.match(favicon, /#020403/i, 'favicon must use the terminal background');
  assert.match(favicon, /#39FF14/i, 'favicon must use phosphor green');
  assert.doesNotMatch(favicon, /#FF2438/i, 'favicon must not carry the red anomaly accent');
  assert.doesNotMatch(favicon, /<text|<animate|<filter/i, 'favicon must stay simple at tab size');

  const ico = readFileSync('favicon.ico');
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], 'favicon.ico must be a valid ICO container');
  assert.ok(ico.length > 128, 'favicon.ico must contain actual raster icon data');

  for (const path of ['landing-maxx.html', 'app/index.html', '403.html', '404.html', '500.html']) {
    const html = read(path);
    const declaredIcons = html.match(/<link\b[^>]*\brel=["'][^"']*icon[^"']*["'][^>]*>/gi) ?? [];
    for (const icon of declaredIcons) {
      assert.match(icon, /href=["']\/favicon\.(?:svg|ico)["']/i, `${path} must not override the shared root favicon`);
    }
  }
});

test('README uses the unified terminal hero and operational hierarchy', () => {
  const readme = read('README.md');
  assert.match(readme, /para11ax-terminal-hero\.svg/i);
  assert.match(readme, /para11ax-terminal-hero-mobile\.svg/i);
  assert.match(readme, /OPERATIONAL CORE/i);
  assert.match(readme, /SEMANTIC FIREWALL/i);
  assert.match(readme, /ANALYST SURFACE/i);
  assert.match(readme, /analyst@para11ax:~\$/i);
  assert.doesNotMatch(readme, /user@para11ax:~\$/i);
  assert.match(readme, /https:\/\/para11ax\.vercel\.app\/app\//i);
  assert.match(readme, /<details>/i);
});

test('README hero assets use the phosphor terminal identity and reject legacy palette drift', () => {
  for (const path of ['assets/brand/para11ax-terminal-hero.svg', 'assets/brand/para11ax-terminal-hero-mobile.svg']) {
    const svg = read(path);
    assert.match(svg, /#020403/i, `${path} missing terminal background`);
    assert.match(svg, /#39FF14/i, `${path} missing phosphor`);
    assert.match(svg, /analyst@para11ax:~\$/i, `${path} missing analyst terminal prompt`);
    assert.doesNotMatch(svg, /user@para11ax:~\$/i, `${path} still contains retired prompt identity`);
    assert.doesNotMatch(svg, /#00E5FF|#F6C945|#39FF88/i, `${path} still contains legacy palette`);
  }
});
