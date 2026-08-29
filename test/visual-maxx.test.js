import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('production landing resolves to the source-finalized one-radar surface with native CSS motion', () => {
  const html = read('index.html');
  const config = JSON.parse(read('vercel.json'));
  assert.equal((html.match(/data-radar=["']ppi["']/gi) ?? []).length, 1, 'production landing must expose exactly one PPI radar');
  assert.match(html, /@keyframes\s+radar-spin/i);
  assert.match(html, /\.radar-sweep[^}]*animation:\s*radar-spin\s+4\.8s/is);
  assert.match(html, /@keyframes\s+fall/i);
  assert.ok((html.match(/class="rain"/gi) ?? []).length >= 12, 'production landing must expose dense native Matrix rain');
  assert.match(html, /prefers-reduced-motion:\s*reduce[\s\S]*radar-sweep[^}]*animation-duration:\s*24s/is);
  assert.doesNotMatch(html, /<img[^>]+para11ax-radar\.svg/i, 'production radar must not depend on external SVG animation');
  assert.ok(config.routes.some(route => route.src === '/' && route.dest === '/index.html'));
  assert.ok(config.routes.some(route => route.src === '/landing-maxx.html' && route.dest === '/index.html'));
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
