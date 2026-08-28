import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('production landing artifact runs heavy rain density without external assets', () => {
  const html = read('landing-maxx.html');
  const config = JSON.parse(read('vercel.json'));
  const columns = (html.match(/class="rain"/g) || []).length;
  assert.ok(columns >= 40, `expected at least 40 landing rain columns, got ${columns}`);
  assert.match(html, /data-rain-density="heavy"/i);
  assert.match(html, /--rain-opacity-heavy:/i);
  assert.match(html, /prefers-reduced-motion:\s*reduce/i);
  assert.ok(config.routes.some((route) => route.src === '/' && route.dest === '/landing-maxx.html'));
});

test('analyst web UI carries the landing tactical identity through an isolated visual layer', () => {
  const main = read('app/terminal-main.js');
  const visual = read('app/visual-maxx.js');
  const css = read('app/tactical-maxx.css');
  assert.match(main, /visual-maxx\.js/i);
  assert.match(visual, /tactical-maxx/i);
  assert.match(visual, /tactical-hud/i);
  assert.match(visual, /sentinel-mark/i);
  assert.match(css, /--phosphor:\s*#39ff14/i);
  assert.match(css, /\.tactical-hud/i);
  assert.match(css, /@keyframes\s+hud-spin/i);
  assert.match(css, /@keyframes\s+visor-pulse/i);
});

test('analyst UI multiplies rain density at runtime while keeping mobile text clear', () => {
  const visual = read('app/visual-maxx.js');
  const css = read('app/tactical-maxx.css');
  assert.match(visual, /RAIN_COLUMNS_PER_LAYER\s*=\s*8/i);
  assert.match(visual, /matrix-heavy/i);
  assert.match(css, /\.matrix-heavy/i);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/i);
});
