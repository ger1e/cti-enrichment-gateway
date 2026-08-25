import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('public root has a static PARA11AX landing page', () => {
  assert.equal(existsSync('index.html'), true, 'index.html must exist at repository root for Vercel static serving');
});

test('landing page is mobile-first, self-contained, and reduced-motion safe', () => {
  if (!existsSync('index.html')) return assert.fail('index.html is missing');
  const html = read('index.html');
  assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1"/i);
  assert.match(html, /PARA11AX/);
  assert.match(html, /cti-enrichment-gateway\.vercel\.app/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/i);
  assert.match(html, /matrix-rain/i);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/i, 'landing page must not depend on external JavaScript');
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(?:js|css)(?:[?"'])/i, 'landing page must not load remote JS/CSS');
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

test('Vercel preserves API routing while mapping branded browser error surfaces', () => {
  const config = JSON.parse(read('vercel.json'));
  assert.equal(config.git?.deploymentEnabled?.['**'], false);
  assert.equal(config.git?.deploymentEnabled?.main, true);
  assert.ok(Array.isArray(config.routes), 'routes must be explicit so the browser catch-all cannot swallow /api/*');
  const filesystemIndex = config.routes.findIndex((route) => route.handle === 'filesystem');
  const forbiddenIndex = config.routes.findIndex((route) => route.src === '/403' && route.dest === '/403.html' && route.status === 403);
  const failureIndex = config.routes.findIndex((route) => route.src === '/500' && route.dest === '/500.html' && route.status === 500);
  const notFoundIndex = config.routes.findIndex((route) => route.dest === '/404.html' && route.status === 404);
  assert.ok(filesystemIndex >= 0, 'filesystem routing must run before browser fallback');
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
  assert.match(markdown, /assets\/diagrams\/architecture-flow\.svg/);
});
