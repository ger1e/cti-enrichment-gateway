import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

const LOCKUP = 'assets/brand/para11ax-radar-lockup.svg';
const HERO_RADAR = 'assets/brand/para11ax-radar.svg';
const RAIN = 'assets/brand/para11ax-rain.svg';
const BRAND_RUNTIME = 'brand-unification.js';
const BRAND_CSS = 'brand-unification.css';
const ADAPTER = 'landing-terminal-v7.js';

test('landing and analyst UI resolve the exact same compact radar lockup asset', () => {
  for (const path of [LOCKUP, BRAND_RUNTIME, BRAND_CSS]) assert.equal(existsSync(path), true, `${path} must exist`);
  const runtime = read(BRAND_RUNTIME);
  const landing = read(ADAPTER);
  const app = read('app/terminal-main.js');
  assert.match(runtime, /LOCKUP_URL\s*=\s*['"]\/assets\/brand\/para11ax-radar-lockup\.svg['"]/i);
  assert.match(runtime, /\.terminal-brand/);
  assert.match(runtime, /\.terminal-mark/);
  assert.match(runtime, /\.para11ax-logo/);
  assert.match(landing, /import\s+['"]\.\/brand-unification\.js['"]/i);
  assert.match(app, /await\s+import\(['"]\.\.\/brand-unification\.js['"]\)/i);
});

test('shared compact lockup is one native animated PPI radar plus PARA11AX wordmark', () => {
  const svg = read(LOCKUP);
  assert.equal((svg.match(/data-radar=["']ppi["']/gi) ?? []).length, 1);
  assert.match(svg, /<animateTransform\b[^>]*type=["']rotate["']/i);
  assert.match(svg, /PARA/i);
  assert.match(svg, /11/i);
  assert.match(svg, /AX/i);
  assert.match(svg, /#39FF14/i);
  assert.match(svg, /prefers-reduced-motion:\s*reduce/i);
  assert.doesNotMatch(svg, /sentinel-helmet|helmet/i);
});

test('landing hero radar is self-contained native SVG motion mounted without runtime construction', () => {
  assert.equal(existsSync(HERO_RADAR), true, 'landing hero radar asset must exist');
  const css = read('landing-radar-motion.css');
  const svg = read(HERO_RADAR);
  assert.match(css, /\.hero-ghost[^}]*para11ax-radar\.svg/i);
  assert.match(css, /\.hero-ghost[^}]*opacity:/i);
  assert.equal((svg.match(/data-radar=["']ppi["']/gi) ?? []).length, 1);
  assert.match(svg, /<animateTransform\b[^>]*type=["']rotate["']/i);
  assert.match(svg, /repeatCount=["']indefinite["']/i);
  assert.match(svg, /prefers-reduced-motion:\s*reduce/i);
});

test('landing rain uses staggered native SVG translate animation in PARA11AX colors', () => {
  assert.equal(existsSync(RAIN), true, 'shared landing rain asset must exist');
  const css = read('landing-radar-motion.css');
  const svg = read(RAIN);
  assert.match(css, /\.matrix-rain[^}]*para11ax-rain\.svg/i);
  assert.match(css, /\.matrix-rain\s*>\s*\.rain[^}]*display:\s*none/i);
  const animations = svg.match(/<animateTransform\b[^>]*type=["']translate["'][^>]*>/gi) ?? [];
  assert.ok(animations.length >= 12, `expected at least 12 staggered rain tracks, got ${animations.length}`);
  assert.match(svg, /dur=["'](?:1[6-9]|2[0-3])(?:\.\d+)?s["']/i);
  assert.match(svg, /#39FF14/i);
  assert.match(svg, /#FF2438/i);
  assert.match(svg, /prefers-reduced-motion:\s*reduce/i);
});

test('landing adapter no longer constructs radar or rain layers at runtime', () => {
  const js = read(ADAPTER);
  assert.doesNotMatch(js, /function\s+enhanceRadar\s*\(/i);
  assert.doesNotMatch(js, /RADAR_CONTACTS|EXTRA_RAIN_COLUMNS|densifyRain/i);
  assert.doesNotMatch(js, /['"]radar-sweep['"]|['"]radar-trail['"]|['"]radar-pulse['"]/i);
});

test('dormant landing adapter does not reconstruct the production hero after paint', () => {
  const js = read(ADAPTER);
  assert.doesNotMatch(js, /function\s+mountMinimalHero\s*\(/i);
  assert.doesNotMatch(js, /createElement\(['"]blockquote['"]\)/i);
  assert.doesNotMatch(js, /You’ve got to follow the evidence|John Kiriakou/i);
});

test('shared brand runtime stays visual-only and non-persistent', () => {
  const js = read(BRAND_RUNTIME);
  assert.doesNotMatch(js, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/i);
  assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|document\.cookie/i);
  assert.doesNotMatch(js, /AudioContext|webkitAudioContext|new\s+Audio\s*\(/i);
});

test('reduced motion keeps static rain and radar visible', () => {
  const css = read('landing-radar-motion.css');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /\.matrix-rain[^}]*opacity:/i);
  assert.match(css, /\.hero-ghost[^}]*opacity:/i);
});

test('native SVG owns the only radar sweep without a second CSS overlay', () => {
  const brandCss = read(BRAND_CSS);
  const landingCss = read('landing-radar-motion.css');
  assert.doesNotMatch(brandCss, /para11ax-lockup-radar-spin/i);
  assert.doesNotMatch(brandCss, /\.terminal-brand::after|\.terminal-mark::after|\.shell-brand::after|\.boot-brand-lockup::after/i);
  assert.doesNotMatch(landingCss, /para11ax-hero-radar-spin|para11ax-hero-radar-trail-spin/i);
  assert.match(landingCss, /\.hero-ghost::before,\.hero-ghost::after\{[^}]*content:none!important;[^}]*animation:none!important/i);
});
