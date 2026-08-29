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

const README_BANNERS = [
  'assets/brand/para11ax-readme-hero-v3.svg',
  'assets/brand/para11ax-readme-hero-mobile-v3.svg',
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

test('README uses cache-busted v3 hero and diagram assets', () => {
  const readme = read('README.md');
  assert.match(readme, /para11ax-readme-hero-v3\.svg/i);
  assert.match(readme, /para11ax-readme-hero-mobile-v3\.svg/i);
  assert.match(readme, /para11ax-architecture-v3\.svg/i);
  assert.match(readme, /para11ax-semantic-firewall-v3\.svg/i);
  assert.doesNotMatch(readme, /assets\/brand\/para11ax-terminal-hero(?:-mobile)?\.svg/i);
  assert.doesNotMatch(readme, /assets\/brand\/para11ax-(?:architecture|semantic-firewall)\.svg/i);
  assert.match(readme, /OPERATIONAL CORE/i);
  assert.match(readme, /SEMANTIC FIREWALL/i);
  assert.match(readme, /ANALYST SURFACE/i);
  assert.match(readme, /analyst@para11ax:~\$/i);
  assert.doesNotMatch(readme, /user@para11ax:~\$/i);
  assert.match(readme, /https:\/\/para11ax\.vercel\.app\/app\//i);
  assert.match(readme, /<details>/i);
});

test('legacy banner assets keep CSS radar keyframes', () => {
  for (const path of BANNERS) {
    const svg = read(path);
    assert.match(svg, /@keyframes\s+radar-spin/i, `${path} needs CSS radar keyframes`);
    assert.match(svg, /\.radar-sweep\s*\{[^}]*animation:\s*radar-spin/is, `${path} must animate the sweep with CSS`);
    assert.match(svg, /class=["']radar-sweep["']/i, `${path} missing the animated sweep group`);
    assert.doesNotMatch(svg, /<animateTransform\b[^>]*type=["']rotate["']/i, `${path} must not depend on SMIL rotation`);
    assert.match(svg, /prefers-reduced-motion:\s*reduce[\s\S]*radar-sweep[\s\S]*animation-duration/is, `${path} must reduce rather than eliminate radar motion`);
  }
});

test('README v3 hero has exactly one PPI radar and redundant CSS plus SMIL motion', () => {
  for (const path of README_BANNERS) {
    const svg = read(path);
    assert.equal((svg.match(/data-radar=["']ppi["']/gi) ?? []).length, 1, `${path} must contain exactly one radar`);
    assert.match(svg, /data-wordmark=["']para11ax-angular-a["']/i, `${path} missing current angular wordmark`);
    assert.match(svg, /\.radar-css\s*\{[^}]*animation:\s*radar-spin/is, `${path} missing CSS radar motion`);
    assert.match(svg, /<animateTransform\b[^>]*type=["']rotate["'][^>]*repeatCount=["']indefinite["']/i, `${path} missing SMIL fallback motion`);
    assert.match(svg, /prefers-reduced-motion:\s*reduce/i, `${path} must honor reduced motion`);
    assert.doesNotMatch(svg, /sentinel|helmet|visor|shield|#00E5FF|#F6C945|#39FF88/i, `${path} contains legacy branding`);
  }
});

test('README v3 diagrams use only the current angular wordmark and current provider count', () => {
  const architecture = read('assets/brand/para11ax-architecture-v3.svg');
  const firewall = read('assets/brand/para11ax-semantic-firewall-v3.svg');
  for (const [path, svg] of [
    ['assets/brand/para11ax-architecture-v3.svg', architecture],
    ['assets/brand/para11ax-semantic-firewall-v3.svg', firewall],
  ]) {
    assert.match(svg, /data-wordmark=["']para11ax-angular-a["']/i, `${path} missing current angular wordmark`);
    assert.doesNotMatch(svg, /data-radar=["']ppi["']/i, `${path} must not add another README radar`);
    assert.doesNotMatch(svg, />\s*PARA11AX\s*\/\//i, `${path} still renders the legacy plain-text logo`);
    assert.doesNotMatch(svg, /sentinel|helmet|visor|shield|#00E5FF|#F6C945|#39FF88/i, `${path} contains legacy branding`);
  }
  assert.match(architecture, /38\s+FIXED\s+SOURCES/i, 'architecture provider count must be current');
  assert.doesNotMatch(architecture, /37\s+FIXED\s+SOURCES/i, 'architecture must not show the stale provider count');
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
    assert.match(svg, /\.radar-sweep\s*\{[^}]*animation:\s*radar-spin/is, `${path} radar sweep must rotate`);
    assert.match(svg, /prefers-reduced-motion:\s*reduce/i, `${path} must honor reduced motion`);
    assert.doesNotMatch(svg, forbidden, `${path} contains feature or status clutter`);
    assert.doesNotMatch(svg, /#00E5FF|#F6C945|#39FF88/i, `${path} still contains legacy palette`);
  }
});
