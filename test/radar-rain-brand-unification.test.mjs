import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

const LANDING = 'landing-maxx.html';
const APP = 'app/index.html';
const LOCKUP = 'assets/brand/para11ax-radar-lockup.svg';
const HERO_RADAR = 'assets/brand/para11ax-radar.svg';
const ADAPTER = 'landing-terminal-v7.js';

test('landing and analyst UI use the exact same compact radar lockup asset', () => {
  assert.equal(existsSync(LOCKUP), true, 'shared radar lockup asset must exist');
  const landing = read(LANDING);
  const app = read(APP);
  for (const html of [landing, app]) {
    assert.match(html, /src=["']\/assets\/brand\/para11ax-radar-lockup\.svg["']/i);
  }
});

test('shared compact lockup is a native animated radar plus PARA11AX wordmark', () => {
  const svg = read(LOCKUP);
  assert.match(svg, /<animateTransform\b[^>]*type=["']rotate["']/i);
  assert.match(svg, /PARA/i);
  assert.match(svg, /11/i);
  assert.match(svg, /AX/i);
  assert.match(svg, /#39FF14/i);
  assert.doesNotMatch(svg, /sentinel-helmet|helmet/i);
});

test('landing hero radar is self-contained native SVG motion', () => {
  assert.equal(existsSync(HERO_RADAR), true, 'landing hero radar asset must exist');
  const landing = read(LANDING);
  const svg = read(HERO_RADAR);
  assert.match(landing, /src=["']\/assets\/brand\/para11ax-radar\.svg["']/i);
  assert.match(svg, /<animateTransform\b[^>]*type=["']rotate["']/i);
  assert.match(svg, /repeatCount=["']indefinite["']/i);
});

test('landing rain uses staggered native SVG translate animation in PARA11AX colors', () => {
  const landing = read(LANDING);
  assert.match(landing, /<svg\b[^>]*class=["'][^"']*matrix-rain[^"']*["']/i);
  const animations = landing.match(/<animateTransform\b[^>]*type=["']translate["'][^>]*>/gi) ?? [];
  assert.ok(animations.length >= 12, `expected at least 12 staggered rain tracks, got ${animations.length}`);
  assert.match(landing, /dur=["'](?:1[6-9]|2[0-3])(?:\.\d+)?s["']/i);
  assert.match(landing, /#39FF14/i);
  assert.match(landing, /#FF2438/i);
  assert.doesNotMatch(landing, /@keyframes\s+matrix-fall/i);
});

test('landing adapter no longer constructs radar layers at runtime', () => {
  const js = read(ADAPTER);
  assert.doesNotMatch(js, /function\s+enhanceRadar\s*\(/i);
  assert.doesNotMatch(js, /RADAR_CONTACTS/i);
  assert.doesNotMatch(js, /['"]radar-sweep['"]|['"]radar-trail['"]|['"]radar-pulse['"]/i);
});

test('reduced motion keeps static rain and radar visible while disabling animation', () => {
  const css = read('landing-radar-motion.css');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /\.matrix-rain[^}]*opacity:/i);
  assert.match(css, /\.hero-radar[^}]*opacity:/i);
});
