import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');
const LEGACY_PROJECT = ['cti', 'enrichment', 'gateway'].join('-');

test('public root has a static PARA11AX landing page', () => {
  assert.equal(existsSync('index.html'), true, 'index.html must exist at repository root for Vercel static serving');
});

test('landing page is mobile-first, self-contained, and reduced-motion safe', () => {
  const html = read('index.html');
  assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1"/i);
  assert.match(html, /PΛRΛ11ΛX|PARA11AX/i);
  assert.match(html, /para11ax\.vercel\.app/i);
  assert.equal(html.includes(LEGACY_PROJECT), false);
  assert.match(html, /prefers-reduced-motion:\s*reduce/i);
  assert.match(html, /class="matrix"/i);
  assert.match(html, /@keyframes\s+fall/i);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/i, 'landing page must not depend on external JavaScript');
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(?:js|css)(?:[?"'])/i, 'landing page must not load remote JS/CSS');
});

test('landing page implements the approved one-radar PARA11AX hero identity', () => {
  const html = read('index.html');
  assert.match(html, /--green:\s*#39ff14/i);
  assert.match(html, /class="hero"/i);
  assert.match(html, /class="radar"[^>]*data-radar="ppi"/i);
  assert.equal((html.match(/data-radar=["']ppi["']/gi) ?? []).length, 1, 'landing must mount exactly one radar');
  assert.match(html, /@keyframes\s+radar-spin/i);
  assert.match(html, /data-wordmark="para11ax-angular-a"/i);
  assert.match(html, /PΛRΛ/i);
  assert.match(html, />11</i);
  assert.match(html, /ΛX/i);
  assert.match(html, /You’ve got to follow the evidence/i);
  assert.match(html, /That doesn’t make it fact/i);
  assert.match(html, /John Kiriakou/i);
  assert.match(html, /href="\/app\/?"[^>]*>[^<]*ENTER PARA11AX/i);
  assert.doesNotMatch(html, /knight-stage|class="knight"|sentinel|helmet|visor/i);
});

test('landing page has an explicit phone composition instead of desktop shrinkage', () => {
  const html = read('index.html');
  assert.match(html, /@media\s*\(max-width:\s*640px\)/i);
  assert.match(html, /\.hero\s*\{[^}]*grid-template-columns:\s*1fr/i);
  assert.match(html, /\.radar\s*\{[^}]*grid-row:\s*2/i);
  assert.match(html, /\.hero \.enter\s*\{[^}]*width:\s*min\(100%,320px\)/i);
  assert.match(html, /\.metrics\s*\{[^}]*grid-template-columns:\s*1fr/i);
  assert.doesNotMatch(html, /transform:\s*scale\(|zoom\s*:/i);
});

test('restored landing keeps full operational content below the minimal hero', () => {
  const html = read('index.html');
  assert.match(html, /SYSTEM OVERVIEW/i);
  assert.match(html, /CAPABILITIES/i);
  assert.match(html, /LIVE TERMINAL/i);
  assert.match(html, /FIXED SOURCE WORKFLOW/i);
  assert.match(html, /analyst@para11ax:~\$/i);
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

test('static error pages do not expose unsubstituted platform placeholders', () => {
  assert.doesNotMatch(read('500.html'), /::vercel:/i);
});

test('Vercel preserves API routing while mapping branded browser error surfaces', () => {
  const config = JSON.parse(read('vercel.json'));
  assert.equal(config.git?.deploymentEnabled?.['**'], false);
  assert.equal(config.git?.deploymentEnabled?.main, true);
  assert.ok(Array.isArray(config.routes), 'routes must be explicit so the browser catch-all cannot swallow /api/para11ax/*');
  const filesystemIndex = config.routes.findIndex(route => route.handle === 'filesystem');
  const apiFallbackIndex = config.routes.findIndex(route => route.src === '/api/para11ax/(.*)' && route.dest === '/api/para11ax/[...path].js');
  const legacyApiFallback = config.routes.find(route => route.src === '/api/(.*)' || route.dest === '/api/[...path].js');
  const forbiddenIndex = config.routes.findIndex(route => route.src === '/403' && route.dest === '/403.html' && route.status === 403);
  const failureIndex = config.routes.findIndex(route => route.src === '/500' && route.dest === '/500.html' && route.status === 500);
  const notFoundIndex = config.routes.findIndex(route => route.dest === '/404.html' && route.status === 404);
  assert.ok(filesystemIndex >= 0);
  assert.ok(apiFallbackIndex > filesystemIndex);
  assert.equal(legacyApiFallback, undefined);
  assert.ok(apiFallbackIndex < notFoundIndex);
  assert.ok(forbiddenIndex > filesystemIndex);
  assert.ok(failureIndex > filesystemIndex);
  assert.ok(notFoundIndex > filesystemIndex);
});

test('README uses bounded GER1E-style microtype and no Mermaid source fallback', () => {
  const markdown = read('README.md');
  assert.match(markdown, /<sub><strong>01 \/\/ SYSTEM PROFILE<\/strong><\/sub>/i);
  assert.match(markdown, /<sub><strong>07 \/\/ DEEP DOCS<\/strong><\/sub>/i);
  assert.doesNotMatch(markdown, /font-size\s*=|style=["'][^"']*font-size/i);
  assert.doesNotMatch(markdown, /```mermaid/i);
});

test('architecture document uses a responsive static diagram instead of Mermaid', () => {
  const markdown = read('docs/ARCHITECTURE.md');
  assert.doesNotMatch(markdown, /```mermaid/i);
  assert.match(markdown, /assets\/brand\/para11ax-architecture\.svg/);
});
