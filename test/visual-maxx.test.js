import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('landing page runs heavy rain density without external assets', () => {
  const html = read('index.html');
  const columns = (html.match(/class="rain"/g) || []).length;
  assert.ok(columns >= 36, `expected at least 36 landing rain columns, got ${columns}`);
  assert.match(html, /data-rain-density="heavy"/i);
  assert.match(html, /--rain-opacity-heavy:/i);
  assert.match(html, /prefers-reduced-motion:\s*reduce/i);
});

test('analyst web UI carries the landing tactical identity', () => {
  const html = read('app/index.html');
  const css = read('app/app.css');
  assert.match(html, /data-visual="tactical-maxx"/i);
  assert.match(html, /class="tactical-hud"/i);
  assert.match(html, /class="sentinel-mark"/i);
  assert.match(css, /--phosphor:\s*#39ff14/i);
  assert.match(css, /\.tactical-hud/i);
  assert.match(css, /@keyframes\s+hud-spin/i);
  assert.match(css, /@keyframes\s+visor-pulse/i);
});

test('analyst UI uses heavier multi-depth rain while keeping mobile text clear', () => {
  const html = read('app/index.html');
  const css = read('app/app.css');
  const cols = (html.match(/class="rain-col"/g) || []).length;
  assert.ok(cols >= 36, `expected at least 36 app rain columns, got ${cols}`);
  assert.match(html, /matrix-heavy/i);
  assert.match(css, /\.matrix-heavy/i);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/i);
});
