import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('production landing resolves to the source-finalized one-radar surface with native SVG rain', () => {
  const html = read('index.html');
  const rain = read('assets/brand/para11ax-rain.svg');
  const config = JSON.parse(read('vercel.json'));
  const movingColumns = (rain.match(/<animateTransform\b[^>]*type=["']translate["']/gi) || []).length;
  assert.ok(movingColumns >= 12, `expected at least 12 animated landing rain columns, got ${movingColumns}`);
  assert.match(html, /para11ax-rain\.svg/i);
  assert.match(html, /para11ax-radar\.svg/i);
  assert.match(rain, /dur=["'](?:1[6-9]|2[0-3])(?:\.\d+)?s["']/i);
  assert.match(rain, /prefers-reduced-motion:\s*reduce/i);
  assert.ok(config.routes.some((route) => route.src === '/' && route.dest === '/index.html'));
  assert.ok(config.routes.some((route) => route.src === '/landing-maxx.html' && route.dest === '/index.html'));
});

test('legacy tactical visual layer remains isolated from the active analyst Web UI', () => {
  const main = read('app/terminal-main.js');
  const visual = read('app/visual-maxx.js');
  const css = read('app/tactical-maxx.css');
  assert.doesNotMatch(main, /visual-maxx\.js/i);
  assert.match(visual, /tactical-maxx/i);
  assert.match(visual, /tactical-hud/i);
  assert.match(visual, /sentinel-mark/i);
  assert.match(css, /--phosphor:\s*#39ff14/i);
  assert.match(css, /\.tactical-hud/i);
  assert.match(css, /@keyframes\s+hud-spin/i);
  assert.match(css, /@keyframes\s+visor-pulse/i);
});

test('dormant tactical layer retains its rain implementation without entering the production runtime', () => {
  const visual = read('app/visual-maxx.js');
  const css = read('app/tactical-maxx.css');
  assert.match(visual, /RAIN_COLUMNS_PER_LAYER\s*=\s*8/i);
  assert.match(visual, /matrix-heavy/i);
  assert.match(css, /\.matrix-heavy/i);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/i);
});
