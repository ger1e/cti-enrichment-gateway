import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFile(url(path), 'utf8');

test('Web UI resolves the compatibility entry into one render-blocking v7 cascade', async () => {
  const [
    html,
    appCss,
    baseCss,
    prepaint,
    main,
    terminalEntry,
    terminalPolish,
    analystJs,
    analystCss,
    earthJs,
    brandJs,
    vercel,
  ] = await Promise.all([
    read('app/index.html'),
    read('app/app.css'),
    read('app/app-base.css'),
    read('app/prepaint-v7.css'),
    read('app/terminal-main.js'),
    read('app/terminal-entry.js'),
    read('app/terminal-polish.js'),
    read('app/analyst-deck.js'),
    read('app/analyst-deck.css'),
    read('app/earth-globe.js'),
    read('brand-unification.js'),
    read('vercel.json').then(JSON.parse),
  ]);

  assert.equal(baseCss, appCss, 'prepaint base must remain byte-identical to the canonical app stylesheet');
  assert.match(html, /<html\s+lang="en"\s+data-terminal-first="v7">/i, 'v7 state must exist in source HTML before first paint');
  assert.match(html, /<link rel="stylesheet" href="\/app\/app\.css">/);
  assert.match(html, /<script type="module" src="\/app\/app\.js"><\/script>/);

  const styles = [
    '/app/app-base.css',
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
    const marker = `@import url('${href}');`;
    const index = prepaint.indexOf(marker);
    assert.ok(index > previous, `${href} must be imported in deterministic cascade order`);
    previous = index;
  }

  assert.match(prepaint, /html,body\{[^}]*height:100dvh[^}]*overflow:hidden[^}]*background:var\(--terminal-bg\)/s, 'boot geometry must not wait for the v7 data attribute');
  assert.match(prepaint, /\.app-shell\{[^}]*width:min\(1380px,calc\(100% - 18px\)\)[^}]*height:100dvh/s);
  assert.match(prepaint, /\.boot-panel,\.access,\.terminal-stage\{[^}]*background:var\(--terminal-bg\)!important/s);

  const cssRoute = vercel.routes.find(route => route.src === '/app/app.css');
  const jsRoute = vercel.routes.find(route => route.src === '/app/app.js');
  assert.equal(cssRoute?.dest, '/app/prepaint-v7.css');
  assert.equal(jsRoute?.dest, '/app/terminal-main.js');

  const stateMarker = "document.documentElement.dataset.terminalFirst = 'v7';";
  assert.ok(main.indexOf(stateMarker) >= 0, 'runtime must declare v7 state');
  assert.doesNotMatch(main, /PREPAINT_STYLES|prepaintMarker|\.css['"`]/, 'runtime entry must not schedule a second stylesheet cascade');
  assert.match(main, /await import\('\.\/terminal-entry\.js'\)/);
  assert.doesNotMatch(main, /visual-maxx\.js/);
  assert.doesNotMatch(main, /desktop-layout-v7\.js/);

  for (const [name, source] of [
    ['terminal-entry', terminalEntry],
    ['terminal-polish', terminalPolish],
    ['analyst-deck', analystJs],
    ['earth-globe', earthJs],
    ['brand-unification', brandJs],
  ]) {
    assert.match(
      source,
      /document\.documentElement\.dataset\.terminalFirst\s*(?:===|!==)\s*'v7'/,
      `${name} must suppress dynamic stylesheet insertion when the v7 prepaint cascade is active`,
    );
  }

  assert.match(analystCss, /data-terminal-first="v7"/);
  assert.doesNotMatch(analystCss, /data-terminal-first="v6"/);
});
