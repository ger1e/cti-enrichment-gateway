import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

const BANNERS = [
  'assets/brand/para11ax-terminal-hero.svg',
  'assets/brand/para11ax-terminal-hero-mobile.svg',
  'assets/brand/para11ax-hero.svg',
  'assets/brand/para11ax-hero-mobile.svg',
];

const FULL_LOGOS = [
  'assets/brand/para11ax-radar-lockup.svg',
  'assets/brand/para11ax-lockup.svg',
];

const ICON_MARKS = [
  'assets/brand/para11ax-mark.svg',
  'app/para11ax-mark.svg',
  'favicon.svg',
];

test('active brand tokens use the canonical terminal palette without legacy cyan or amber', () => {
  const tokens = read('assets/brand/tokens.json');
  assert.match(tokens, /"terminalBg"\s*:\s*"#020403"/i);
  assert.match(tokens, /"phosphor"\s*:\s*"#39FF14"/i);
  assert.match(tokens, /"signalWhite"\s*:\s*"#F7FFF6"/i);
  assert.match(tokens, /"muted"\s*:\s*"#8DA391"/i);
  assert.match(tokens, /"alert"\s*:\s*"#FF2438"/i);
  assert.doesNotMatch(tokens, /#00E5FF|#F6C945|#39FF88/i);
});

test('every logo family uses the same PPI radar visual language and no legacy sentinel geometry', () => {
  for (const path of [...FULL_LOGOS, ...ICON_MARKS]) {
    const svg = read(path);
    assert.match(svg, /#39FF14/i, `${path} missing phosphor`);
    assert.match(svg, /data-radar=["']ppi["']/i, `${path} must identify the canonical PPI radar`);
    assert.ok((svg.match(/<circle\b/gi) ?? []).length >= 3, `${path} must use concentric range rings`);
    assert.match(svg, /crosshair|M[^<]*H[^<]*M[^<]*V/i, `${path} must include radar crosshairs`);
    assert.doesNotMatch(svg, /sentinel|helmet|visor|shield/i, `${path} still contains legacy mark language`);
    assert.doesNotMatch(svg, /#00E5FF|#F6C945|#39FF88/i, `${path} still contains legacy palette`);
  }
});

test('full PARA11AX lockups preserve the angular A wordmark and green 11 split', () => {
  for (const path of FULL_LOGOS) {
    const svg = read(path);
    assert.match(svg, /data-wordmark=["']para11ax-angular-a["']/i, `${path} must use the angular-A wordmark`);
    assert.match(svg, /PARA/i);
    assert.match(svg, /11/i);
    assert.match(svg, /AX/i);
    assert.match(svg, /#F7FFF6/i);
    assert.match(svg, /#39FF14/i);
    assert.doesNotMatch(svg, /CTI|OSINT|GEOINT|FORENSICS|SOURCE|FIREWALL|STIX/i, `${path} must stay logo-only`);
  }
});

test('landing hero wordmark matches the canonical white-green-white lockup split', () => {
  const runtime = read('brand-unification.js');
  const css = read('brand-unification.css');
  const lockup = read('assets/brand/para11ax-radar-lockup.svg');
  assert.match(lockup, /PARA/i);
  assert.match(lockup, /11/i);
  assert.match(lockup, /AX/i);
  assert.match(runtime, /function\s+syncHeroWordmark\s*\(/i);
  assert.match(runtime, /logo-white/i);
  assert.match(runtime, /logo-green/i);
  assert.match(css, /\.ascii-logo \.logo-white\s*\{[^}]*color:\s*#f7fff6/is);
  assert.match(css, /\.ascii-logo \.logo-green\s*\{[^}]*color:\s*#39ff14/is);
});

test('browser surfaces share one simplified phosphor PPI radar favicon', () => {
  assert.equal(existsSync('favicon.svg'), true, 'canonical favicon SVG must exist');
  assert.equal(existsSync('favicon.ico'), true, 'root favicon fallback must exist for browser autodiscovery');

  const favicon = read('favicon.svg');
  assert.match(favicon, /viewBox=["']0 0 64 64["']/i);
  assert.match(favicon, /aria-label=["'][^"']*radar[^"']*["']/i, 'favicon must identify as radar');
  assert.match(favicon, /data-radar=["']ppi["']/i);
  assert.match(favicon, /#020403/i, 'favicon must use the terminal background');
  assert.match(favicon, /#39FF14/i, 'favicon must use phosphor green');
  assert.ok((favicon.match(/<circle\b/gi) ?? []).length >= 3, 'radar favicon must use concentric circles');
  assert.match(favicon, /M8 32H56M32 8V56/i, 'radar favicon must include crosshairs');
  assert.doesNotMatch(favicon, /sentinel|M32 4 54 14/i, 'favicon must not retain the sentinel shield geometry');
  assert.doesNotMatch(favicon, /#FF2438/i, 'favicon must not carry the red anomaly accent');
  assert.doesNotMatch(favicon, /<text|<animate|<filter/i, 'favicon must stay simple and static at tab size');

  const ico = readFileSync('favicon.ico');
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], 'favicon.ico must be a valid ICO container');
  const iconCount = ico.readUInt16LE(4);
  assert.ok(iconCount >= 3, 'favicon.ico must contain 16px, 32px, and 64px radar images');
  const widths = new Set(Array.from({ length: iconCount }, (_, index) => ico[6 + (index * 16)] || 256));
  for (const width of [16, 32, 64]) assert.ok(widths.has(width), `favicon.ico missing ${width}px radar image`);

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

test('all banner assets are minimal: one real PPI radar, PARA11AX, and the Kiriakou quote only', () => {
  const forbidden = /CTI|EVIDENCE GATEWAY|SEMANTIC FIREWALL|FIXED SOURCES|STIX|READ-ONLY|PROVENANCE|OSINT|GEOINT|FORENSICS|analyst@para11ax|OPERATIONAL|STATUS|CAPABILIT/i;
  for (const path of BANNERS) {
    const svg = read(path);
    assert.match(svg, /#020403/i, `${path} missing terminal background`);
    assert.match(svg, /#39FF14/i, `${path} missing phosphor`);
    assert.match(svg, /data-wordmark=["']para11ax-angular-a["']/i, `${path} missing the angular-A wordmark`);
    assert.match(svg, /data-radar=["']ppi["']/i, `${path} missing the canonical PPI radar`);
    assert.equal((svg.match(/data-radar=["']ppi["']/gi) ?? []).length, 1, `${path} must contain exactly one radar`);
    assert.match(svg, /follow[\s\S]{0,120}the evidence/i, `${path} missing Kiriakou quote`);
    assert.match(svg, /doesn.?t make it fact/i, `${path} missing Kiriakou quote conclusion`);
    assert.match(svg, /John Kiriakou/i, `${path} missing quote attribution`);
    assert.match(svg, /<animateTransform\b[^>]*type=["']rotate["']/i, `${path} radar sweep must rotate`);
    assert.match(svg, /prefers-reduced-motion:\s*reduce/i, `${path} must honor reduced motion`);
    assert.doesNotMatch(svg, forbidden, `${path} contains feature or status clutter`);
    assert.doesNotMatch(svg, /#00E5FF|#F6C945|#39FF88/i, `${path} still contains legacy palette`);
  }
});

test('production landing first paint is already the canonical one-radar hero', () => {
  const html = read('landing-maxx.html');
  const runtime = read('landing-terminal-v7.js');
  assert.match(html, /href=["']\/brand-unification\.css["']/i, 'brand lockup CSS must be render-blocking');
  assert.match(html, /href=["']\/landing-radar-motion\.css["']/i, 'hero layout CSS must be render-blocking');
  assert.match(html, /class=["']terminal-brand["'][^>]*>[\s\S]{0,180}para11ax-radar-lockup\.svg/i, 'top-left lockup must exist in source HTML');
  assert.match(html, /data-wordmark=["']para11ax-angular-a["']/i, 'angular hero wordmark must exist in source HTML');
  assert.match(html, /class=["']hero-ghost["'][^>]*aria-hidden=["']true["'][^>]*><\/div>/i, 'source hero must expose one empty radar mount only');
  assert.match(html, /class=["']hero-kiriakou["']/i, 'Kiriakou quote must exist in source HTML');
  assert.match(html, /You’ve got to follow the evidence… That doesn’t make it fact\./i);
  assert.doesNotMatch(html, /hero-kicker|hero-doctrine|hero-actions|ghost-grid|ghost-ring|PROVENANCE-FIRST CTI PLATFORM|EVIDENCE FIRST\.|BOUNDED ALWAYS\.|OPERATIONAL WHEN SUPPORTED\./i, 'legacy hero must not ship in first-paint HTML');
  assert.doesNotMatch(runtime, /mountMinimalHero|createElement\(['"]blockquote['"]\)/i, 'runtime must not reconstruct branding after paint');
});