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
