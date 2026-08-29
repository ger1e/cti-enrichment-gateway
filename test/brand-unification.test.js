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

test('browser surfaces share one simplified phosphor PPI radar favicon', () => {
  assert.equal(existsSync('favicon.svg'), true);
  assert.equal(existsSync('favicon.ico'), true);
  const favicon = read('favicon.svg');
  assert.match(favicon, /viewBox=["']0 0 64 64["']/i);
  assert.match(favicon, /data-radar=["']ppi["']/i);
  assert.match(favicon, /#020403/i);
  assert.match(favicon, /#39FF14/i);
  assert.doesNotMatch(favicon, /sentinel|helmet|shield|#00E5FF|#F6C945|#39FF88/i);
});

test('README uses one ger1e-style animated GIF hero and current v3 diagrams', () => {
  const readme = read('README.md');
  const gifPath = 'assets/brand/para11ax-readme-hero-v6.gif';
  assert.match(readme, /<img[^>]+para11ax-readme-hero-v6\.gif/i);
  assert.doesNotMatch(readme, /<picture>/i);
  assert.doesNotMatch(readme, /para11ax-readme-hero-(?:mobile-)?v5\.gif/i);
  assert.doesNotMatch(readme, /para11ax-readme-hero-v4\.gif/i);
  assert.doesNotMatch(readme, /para11ax-readme-hero-(?:mobile-)?v3\.svg/i);
  assert.doesNotMatch(readme, /INTELLIGENCE\.\s*ENRICHED\.\s*OPERATIONAL\./i);
  assert.match(readme, /para11ax-architecture-v3\.svg/i);
  assert.match(readme, /para11ax-semantic-firewall-v3\.svg/i);
  assert.equal(existsSync(gifPath), true, 'README GIF must exist');
  const gif = readFileSync(gifPath);
  assert.equal(gif.subarray(0, 6).toString('ascii'), 'GIF89a');
  assert.match(gif.toString('latin1'), /NETSCAPE2\.0/, 'GIF must declare an infinite animation loop');
  assert.equal(gif.readUInt16LE(6), 720);
  assert.equal(gif.readUInt16LE(8), 360);
  assert.match(readme, /OPERATIONAL CORE/i);
  assert.match(readme, /ANALYST SURFACE/i);
  assert.match(readme, /analyst@para11ax:~\$/i);
  assert.doesNotMatch(readme, /user@para11ax:~\$/i);
});

test('landing content is fail-open and radar motion is browser-native', () => {
  const runtime = read('landing-terminal-v7.js');
  const css = read('landing-radar-motion.css');
  const revealIndex = runtime.indexOf('revealAll();');
  const importIndex = runtime.indexOf("import('./brand-unification.js')");
  assert.ok(revealIndex >= 0, 'landing runtime must reveal critical content');
  assert.ok(importIndex > revealIndex, 'content must reveal before optional branding import');
  assert.match(runtime, /\.catch\(\(\)\s*=>\s*\{\}\)/, 'optional branding import must fail safely');
  assert.match(css, /\[data-reveal\]\s*\{[^}]*opacity:\s*1\s*!important/is, 'motion CSS must never hide critical content');
  assert.match(css, /@keyframes\s+radar-live-spin/i);
  assert.match(css, /ghost-ring[^}]*animation:\s*radar-live-spin\s+4\.8s/is);
  assert.doesNotMatch(css, /background\s*:\s*url\([^)]*para11ax-radar\.svg/i, 'landing radar must not depend on animated external SVG');
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*animation-duration:\s*24s/is, 'reduced motion should slow radar rather than freeze it');
});

test('standalone and logo radars never freeze under reduced motion', () => {
  for (const path of ['assets/brand/para11ax-radar.svg', ...FULL_LOGOS, 'assets/brand/para11ax-mark.svg']) {
    const svg = read(path);
    assert.match(svg, /data-radar=["']ppi["']/i);
    assert.doesNotMatch(svg, /prefers-reduced-motion:\s*reduce[^}]*\.motion\s*\{\s*display:\s*none/is, `${path} must not freeze the sweep`);
  }
  const radar = read('assets/brand/para11ax-radar.svg');
  assert.match(radar, /@keyframes\s+ppi-spin/i);
  assert.match(radar, /prefers-reduced-motion:\s*reduce[\s\S]*animation-duration:\s*24s/is);
});

test('legacy banner assets keep CSS radar keyframes', () => {
  for (const path of BANNERS) {
    const svg = read(path);
    assert.match(svg, /@keyframes\s+radar-spin/i, `${path} needs CSS radar keyframes`);
    assert.match(svg, /\.radar-sweep\s*\{[^}]*animation:\s*radar-spin/is, `${path} must animate the sweep with CSS`);
    assert.match(svg, /prefers-reduced-motion:\s*reduce[\s\S]*animation-duration/is, `${path} must slow rather than eliminate radar motion`);
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
    assert.doesNotMatch(svg, /sentinel|helmet|visor|shield|#00E5FF|#F6C945|#39FF88/i, `${path} contains legacy branding`);
  }
  assert.match(architecture, /38\s+FIXED\s+SOURCES/i);
  assert.doesNotMatch(architecture, /37\s+FIXED\s+SOURCES/i);
});

test('banner SVGs stay visually minimal', () => {
  const forbidden = /CTI|EVIDENCE GATEWAY|SEMANTIC FIREWALL|FIXED SOURCES|STIX|READ-ONLY|PROVENANCE|OSINT|GEOINT|FORENSICS|analyst@para11ax|OPERATIONAL|STATUS|CAPABILIT/i;
  for (const path of BANNERS) {
    const svg = read(path);
    assert.match(svg, /data-wordmark=["']para11ax-angular-a["']/i);
    assert.match(svg, /data-radar=["']ppi["']/i);
    assert.equal((svg.match(/data-radar=["']ppi["']/gi) ?? []).length, 1);
    assert.match(svg, /John Kiriakou/i);
    assert.doesNotMatch(svg, forbidden, `${path} contains feature or status clutter`);
    assert.doesNotMatch(svg, /#00E5FF|#F6C945|#39FF88/i);
  }
});
