import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');
const adapter = () => read('landing-terminal-v7.js');
const motion = () => read('landing-radar-motion.css');
const radar = () => read('assets/brand/para11ax-radar.svg');
const rain = () => read('assets/brand/para11ax-rain.svg');
const desktopFit = () => read('landing-desktop-fit.css');

test('production landing is source-finalized, full, and independent of runtime mutation', () => {
  const html = read('index.html');
  const vercel = JSON.parse(read('vercel.json'));
  const root = vercel.routes.find(route => route.src === '/');
  const legacy = vercel.routes.find(route => route.src === '/landing-maxx.html');

  assert.equal(root?.dest, '/index.html');
  assert.equal(legacy?.dest, '/index.html');
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/i, 'production landing must render without JavaScript');
  assert.equal((html.match(/data-radar=["']ppi["']/gi) ?? []).length, 1, 'production hero must contain exactly one radar');
  assert.match(html, /class="wordmark"[^>]*data-wordmark="para11ax-angular-a"/i);
  assert.match(html, /You’ve got to follow the evidence/i);
  assert.match(html, /John Kiriakou/i);
  assert.match(html, /SYSTEM OVERVIEW/i);
  assert.match(html, /CAPABILITIES/i);
  assert.match(html, /LIVE TERMINAL/i);
  assert.match(html, /FIXED SOURCE WORKFLOW/i);
  assert.match(html, /analyst@para11ax:~\$/i);
  assert.match(html, /href="\/app\/"[^>]*>ENTER PARA11AX/i);
});

test('production landing radar uses browser-native rotational PPI motion', () => {
  const html = read('index.html');
  assert.match(html, /@keyframes\s+radar-spin/i);
  assert.match(html, /\.radar-sweep\s*\{[^}]*animation:\s*radar-spin\s+4\.8s/is);
  assert.match(html, /repeating-conic-gradient/i, 'radar must expose azimuth tick geometry');
  assert.match(html, /radial-gradient\(circle at 50% 50%[^;]*79\.3%/is, 'radar must expose multiple range rings');
  assert.match(html, /#ff2438/i, 'radar must retain anomaly returns');
  assert.match(html, /prefers-reduced-motion:\s*reduce[\s\S]*radar-sweep[^}]*animation-duration:\s*24s/is, 'reduced motion must slow, not freeze, the sweep');
  assert.doesNotMatch(html, /<img[^>]+para11ax-radar\.svg/i, 'production radar must not depend on animated external SVG');
});

test('standalone PPI radar remains a real instrument-style moving asset', () => {
  assert.equal(existsSync('assets/brand/para11ax-radar.svg'), true);
  const svg = radar();
  assert.equal((svg.match(/data-radar=["']ppi["']/gi) ?? []).length, 1);
  assert.match(svg, /@keyframes\s+ppi-spin/i);
  assert.match(svg, /\.ppi-sweep[^}]*animation:\s*ppi-spin\s+4\.8s/is);
  for (const bearing of ['000', '090', '180', '270']) assert.match(svg, new RegExp(`>${bearing}<`, 'i'));
  for (const range of ['RNG 25', 'RNG 50', 'RNG 75', 'RNG 100']) assert.match(svg, new RegExp(range, 'i'));
  assert.ok((svg.match(/fill="#39FF14"/gi) ?? []).length >= 4, 'radar must expose multiple fixed returns');
  assert.match(svg, /prefers-reduced-motion:\s*reduce[\s\S]*animation-duration:\s*24s/is);
});

test('dormant legacy landing is fail-open and uses browser-native radar enhancement', () => {
  const css = motion();
  const js = adapter();
  assert.match(js, /MOTION_HREF\s*=\s*['"]\/landing-radar-motion\.css['"]/i);
  const revealIndex = js.indexOf('revealAll();');
  const importIndex = js.indexOf("import('./brand-unification.js')");
  assert.ok(revealIndex >= 0 && importIndex > revealIndex, 'content must reveal before optional branding import');
  assert.match(js, /\.catch\(\(\)\s*=>\s*\{\}\)/i);
  assert.match(css, /\[data-reveal\]\s*\{[^}]*opacity:\s*1!important/is);
  assert.match(css, /@keyframes\s+radar-live-spin/i);
  assert.match(css, /\.hero-ghost>\.ghost-ring[^}]*animation:\s*radar-live-spin\s+4\.8s/is);
  assert.doesNotMatch(css, /background\s*:\s*url\([^)]*para11ax-radar\.svg/i);
  assert.doesNotMatch(js, /enhanceRadar|RADAR_CONTACTS|densifyRain/i);
});

test('landing disables the old full-height scanner and keeps native Matrix rain', () => {
  const css = motion();
  const js = adapter();
  const rainSvg = rain();
  assert.match(css, /\.terminal-hero:before\s*\{[^}]*content:\s*none!important[^}]*animation:\s*none!important/is);
  assert.doesNotMatch(css, /translateY\(588px\)/i);
  assert.match(css, /@keyframes\s+acquisition-pulse/i);
  assert.match(css, /\.session-line[^}]*steps\(/i);
  assert.match(css, /\.matrix-rain[^}]*para11ax-rain\.svg/i);
  assert.ok((rainSvg.match(/<animateTransform\b[^>]*type=["']translate["']/gi) ?? []).length >= 12);
  assert.doesNotMatch(js, /AudioContext|webkitAudioContext|new\s+Audio\s*\(|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/i);
});

test('mobile and reduced-motion contracts preserve content and keep radars moving', () => {
  const html = read('index.html');
  const css = motion();
  const radarSvg = radar();
  const rainSvg = rain();
  assert.match(html, /@media\s*\(max-width:\s*640px\)/i);
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*radar-sweep[^}]*animation-duration:\s*24s/is);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.hero-ghost/is);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*ghost-ring[^}]*animation-duration:\s*24s/is);
  assert.match(radarSvg, /prefers-reduced-motion:\s*reduce/i);
  assert.match(rainSvg, /prefers-reduced-motion:\s*reduce/i);
});

test('medium desktop dormant landing uses an in-flow two-column hero instead of page scaling', () => {
  assert.equal(existsSync('landing-desktop-fit.css'), true);
  const js = adapter();
  const css = desktopFit();
  assert.match(js, /DESKTOP_FIT_HREF\s*=\s*['"]\/landing-desktop-fit\.css['"]/i);
  assert.match(css, /@media\s*\(min-width:\s*901px\)\s*and\s*\(max-width:\s*1600px\)/i);
  assert.match(css, /\.terminal-hero\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:/is);
  assert.match(css, /\.hero-ghost\s*\{[^}]*position:\s*relative!important/is);
  assert.doesNotMatch(css, /transform:\s*scale\(|zoom\s*:/i);
});
