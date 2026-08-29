import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFile(url(path), 'utf8');

test('Web UI enters directly into one prepainted v7 visual stack', async () => {
  const [html, main, vercel] = await Promise.all([
    read('app/index.html'),
    read('app/terminal-main.js'),
    read('vercel.json').then(JSON.parse),
  ]);

  assert.match(html, /<html[^>]*data-terminal-first="v7"/);

  const styles = [
    '/app/app.css',
    '/app/shell.css',
    '/app/shell-polish.css',
    '/app/analyst-deck.css',
    '/app/earth-globe.css',
    '/brand-unification.css',
    '/app/desktop-layout-v7.css',
    '/site-cursor.css',
  ];
  let previous = -1;
  for (const href of styles) {
    const marker = `<link rel="stylesheet" href="${href}">`;
    const index = html.indexOf(marker);
    assert.ok(index > previous, `${href} must be declared in deterministic head order`);
    previous = index;
  }

  assert.match(html, /<script type="module" src="\/app\/terminal-main\.js"><\/script>/);
  assert.doesNotMatch(main, /visual-maxx\.js/);
  assert.doesNotMatch(main, /desktop-layout-v7\.js/);
  assert.equal(vercel.routes.some(route => route.src === '/app/app.js'), false, 'legacy app.js rewrite must be removed');
});
