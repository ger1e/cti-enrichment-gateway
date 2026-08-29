import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const LEGACY_PROJECT = ['cti', 'enrichment', 'gateway'].join('-');

test('public root has a static PARA11AX landing page', () => {
  assert.equal(existsSync('index.html'), true, 'index.html must exist at repository root for Vercel static serving');
});

test('landing page is mobile-first, self-contained, and reduced-motion safe', () => {
  if (!existsSync('index.html')) return assert.fail('index.html is missing');
  const html = read('index.html');
  assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1"/i);
  assert.match(html, /PARA11AX/);
  assert.match(html, /para11ax\.vercel\.app/);
  assert.equal(html.includes(LEGACY_PROJECT), false);
  assert.match(html, /prefers-reduced-motion:\s*reduce/i);
  assert.match(html, /matrix-rain/i);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/i, 'landing page must not depend on external JavaScript');
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(?:js|css)(?:[?"'])/i, 'landing page must not load remote JS/CSS');
});

test('landing page implements the approved tactical hero identity', () => {
  const html = read('index.html');
  assert.match(html, /--phosphor:\s*#39ff14/i);
  assert.match(html, /class="hero-grid"/i);
  assert.match(html, /class="knight-stage"/i);
  assert.match(html, /class="knight"/i);
  assert.match(html, /INTELLIGENCE\.\s*ENRICHED\.\s*<strong>OPERATIONAL\.<\/strong>/i);
  assert.match(html, /ACCESS TERMINAL/i);
  assert.match(html, /@keyframes\s+hud-spin/i);
  assert.match(html, /@keyframes\s+visor-pulse/i);
});

test('landing page has an explicit phone composition instead of desktop shrinkage', () => {
  const html = read('index.html');
  assert.match(html, /@media\s*\(max-width:\s*720px\)/i);
  assert.match(html, /\.hero-grid\s*\{[^}]*grid-template-columns:\s*1fr/i);
  assert.match(html, /\.cta\s*\{[^}]*min-height:\s*44px/i);
  assert.match(html, /\.knight-stage\s*\{[^}]*min-height:\s*clamp\(/i);
  assert.match(html, /\.mobile-signal-bar/i);
});

test('human-facing custom error pages are branded, static, and mobile-safe', () => {
  for (const status of ['403', '404', '500']) {
    const path = `${status}.html`;
    assert.equal(existsSync(path), true, `${path} must exist`);
    const html = read(path);
    assert.match(html, new RegExp(`\\b${status}\\b`));
    assert.match(html, /PARA11AX/);
    assert.match(html, /matrix-rain/i);
    assert.match(html, /prefers-reduced-motion:\s*reduce/i);
    assert.match(html, /href="\/"/i);
    assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/i);
  }
});

test('human-facing custom error pages use the canonical terminal palette with no legacy color escape', () => {
  const required = ['#020403', '#39ff14', '#f7fff6', '#8da391', '#ff2438'];
  const forbidden = ['#050608', '#00e5ff', '#ff1e2d', '#39ff88'];
  for (const status of ['403', '404', '500']) {
    const html = read(`${status}.html`).toLowerCase();
    assert.match(html, /<meta\s+name="theme-color"\s+content="#020403"/i, `${status} theme color must match the terminal`);
    for (const token of required) assert.ok(html.includes(token), `${status} missing canonical palette token ${token}`);
    for (const token of forbidden) assert.equal(html.includes(token), false, `${status} still contains legacy palette token ${token}`);
  }
});

test('static error pages do not expose unsubstituted platform placeholders', () => {
  assert.doesNotMatch(read('500.html'), /::vercel:/i);
});

test('Vercel preserves API routing while mapping branded browser error surfaces', () => {
  const config = JSON.parse(read('vercel.json'));
  assert.equal(config.git?.deploymentEnabled?.['**'], false);
  assert.equal(config.git?.deploymentEnabled?.main, true);
  assert.ok(Array.isArray(config.routes), 'routes must be explicit so the browser catch-all cannot swallow /api/para11ax/*');
  const filesystemIndex = config.routes.findIndex((route) => route.handle === 'filesystem');
  const apiFallbackIndex = config.routes.findIndex((route) => route.src === '/api/para11ax/(.*)' && route.dest === '/api/para11ax/[...path].js');
  const legacyApiFallback = config.routes.find((route) => route.src === '/api/(.*)' || route.dest === '/api/[...path].js');
  const forbiddenIndex = config.routes.findIndex((route) => route.src === '/403' && route.dest === '/403.html' && route.status === 403);
  const failureIndex = config.routes.findIndex((route) => route.src === '/500' && route.dest === '/500.html' && route.status === 500);
  const notFoundIndex = config.routes.findIndex((route) => route.dest === '/404.html' && route.status === 404);
  assert.ok(filesystemIndex >= 0, 'filesystem routing must run before browser fallback');
  assert.ok(apiFallbackIndex > filesystemIndex, 'unknown API routes must reach the API catch-all after named functions');
  assert.equal(legacyApiFallback, undefined, 'the legacy API base must not remain routable');
  assert.ok(apiFallbackIndex < notFoundIndex, 'API catch-all must run before the human-facing 404 fallback');
  assert.ok(forbiddenIndex > filesystemIndex, '/403 must map after filesystem handling');
  assert.ok(failureIndex > filesystemIndex, '/500 must map after filesystem handling');
  assert.ok(notFoundIndex > filesystemIndex, '404 catch-all must run after filesystem/API handling');
});

test('README avoids renderer-fragile mobile typography and Mermaid source fallback', () => {
  const markdown = read('README.md');
  assert.doesNotMatch(markdown, /<sub\b/i, 'GitHub Android renders <sub> near body size');
  assert.doesNotMatch(markdown, /```mermaid/i, 'GitHub Android may expose Mermaid source as overflowing code');
});

test('architecture document uses a responsive static diagram instead of Mermaid', () => {
  const markdown = read('docs/ARCHITECTURE.md');
  assert.doesNotMatch(markdown, /```mermaid/i);
  assert.match(markdown, /assets\/brand\/para11ax-architecture\.svg/);
});
