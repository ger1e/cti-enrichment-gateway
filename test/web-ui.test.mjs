import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const forbiddenStorage = /localStorage|sessionStorage|indexedDB|document\.cookie/i;

test('analyst app assets exist and shell is accessible', () => {
  for (const path of ['app/index.html', 'app/app.css', 'app/app.js']) assert.equal(existsSync(path), true, `${path} must exist`);
  const html = read('app/index.html');
  assert.match(html, /name="viewport"\s+content="width=device-width,\s*initial-scale=1"/i);
  assert.match(html, /id="token"[^>]*type="password"/i);
  assert.match(html, /id="live-status"[^>]*aria-live="polite"/i);
  assert.match(html, /TOKEN HELD IN MEMORY ONLY/i);
  assert.match(html, /matrix-far/); assert.match(html, /matrix-mid/); assert.match(html, /matrix-front/);
  assert.ok((html.match(/class="rain-col"/g) || []).length >= 24, 'glyph rain needs bounded static columns');
});

test('browser surface has no auth persistence or third-party runtime assets', () => {
  const source = ['app/index.html', 'app/app.css', 'app/app.js'].map(read).join('\n');
  assert.doesNotMatch(source, forbiddenStorage);
  assert.doesNotMatch(source, /eval\s*\(|new\s+Function\s*\(/);
  assert.doesNotMatch(source, /https?:\/\/[^"')\s]+\.(?:js|css|mp3|wav|ogg|woff2?)/i);
});

test('landing page exposes ENTER PARA11AX', () => {
  assert.match(read('index.html'), /href="\/app\/?"[^>]*>[^<]*ENTER PARA11AX/i);
});

test('Vercel app route precedes API catch-all and human fallback', () => {
  const routes = JSON.parse(read('vercel.json')).routes;
  const fs = routes.findIndex((r) => r.handle === 'filesystem');
  const app = routes.findIndex((r) => r.src === '/app/?' && r.dest === '/app/index.html');
  const api = routes.findIndex((r) => r.src === '/api/(.*)' && r.dest === '/api/[...path].js');
  const human404 = routes.findIndex((r) => r.dest === '/404.html' && r.status === 404);
  assert.ok(fs >= 0 && app > fs && api > app && human404 > api);
});

test('mobile and reduced-motion contracts exist', () => {
  const css = read('app/app.css');
  assert.match(css, /overflow-x:\s*hidden/i);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/i);
});

test('renderer uses safe DOM APIs only', () => {
  const source = read('app/renderers.js');
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML/);
  assert.match(source, /createElement/);
  assert.match(source, /textContent/);
  assert.match(source, /query/i);
});

test('audio engine contains no network/media loading or persistence', () => {
  const source = read('app/audio.js');
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|new\s+Audio\s*\(|\.mp3|\.wav|\.ogg/i);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie/i);
});

test('controller exposes approved views, raw filter, and no provider override', () => {
  const source = read('app/app.js');
  for (const view of ['overview', 'evidence', 'correlation', 'relationships', 'coverage', 'raw']) {
    assert.match(source, new RegExp(`['"]${view}['"]`));
  }
  assert.match(source, /raw-search/);
  assert.doesNotMatch(source, /providerOverride|providers\s*:/i);
  assert.doesNotMatch(source, /token[^\n]{0,120}typing\s*\(/i);
});

test('maximum design contains semantic palette and three rain depths', () => {
  const css = read('app/app.css').toLowerCase();
  for (const token of ['#050608', '#0b0f12', '#00e5ff', '#ff1e2d', '#39ff88', '#f6c945', 'matrix-far', 'matrix-mid', 'matrix-front', 'semantic-context', 'semantic-claim', 'tone-amber', 'coverage-failure', 'code-line']) {
    assert.match(css, new RegExp(token));
  }
});

test('boot terminal contains explicit initialize, skip, diagnostics, and Unicode Pepe', () => {
  const html = read('app/index.html');
  assert.match(html, /id="boot-panel"/i);
  assert.match(html, /id="boot-initialize"[^>]*>\s*INITIALIZE\s*</i);
  assert.match(html, /id="boot-skip"[^>]*>\s*SKIP\s*</i);
  assert.match(html, /id="boot-log"/i);
  assert.match(html, /id="pepe-ascii"/i);
  assert.match(html, /⢀⣠⡶⠶⠿⠛⠛⠛⠛⠛⠻⠷⠶⢶⣤⣀/);
  assert.match(html, /⣙⡻⠷⠾⣿/);
  assert.match(html, /id="access-panel"[^>]*hidden/i);
});

test('boot uses the exact user-supplied 39-line Pepe payload', () => {
  const html = read('app/index.html');
  const match = html.match(/<pre id="pepe-ascii"[^>]*>([\s\S]*?)<\/pre>/i);
  assert.ok(match, 'Pepe pre block must exist');
  assert.equal(match[1].split('\n').length, 39);
  const digest = createHash('sha256').update(match[1], 'utf8').digest('hex');
  assert.equal(digest, 'c5bfc1050351ec985e48aa49008fe395d31ebf0dd76da148322add68028a1288');
});

test('boot presentation is viewport-safe and reduced-motion aware', () => {
  const css = read('app/app.css');
  assert.match(css, /\.boot-panel/);
  assert.match(css, /\.boot-pepe/);
  assert.match(css, /\.boot-log/);
  assert.match(css, /\.boot-glitch/);
  assert.match(css, /\.boot-pepe[^}]*overflow:\s*auto/is);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*boot/is);
});

test('boot implementation never persists completion state', () => {
  const source = read('app/app.js');
  assert.doesNotMatch(source, forbiddenStorage);
  assert.doesNotMatch(source, /boot[^\n]{0,100}(cookie|storage)/i);
});
