import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');

const forbiddenPersistence = /localStorage|sessionStorage|indexedDB|document\.cookie/i;

test('analyst deck v4 presentation assets exist and are loaded after the terminal runtime', () => {
  assert.equal(existsSync('app/analyst-deck.js'), true, 'analyst-deck.js must exist');
  assert.equal(existsSync('app/analyst-deck.css'), true, 'analyst-deck.css must exist');
  const main = read('app/terminal-main.js');
  assert.match(main, /import ['"]\.\/analyst-deck\.js['"]/);
  assert.ok(main.indexOf("./analyst-deck.js") > main.indexOf("./terminal-polish.js"), 'analyst deck must decorate the mounted shell after terminal polish');
});

test('adapter restructures the existing shell instead of replacing command or evidence behavior', () => {
  const source = read('app/analyst-deck.js');
  for (const selector of ['.unix-shell', '.shell-status', '.shell-scrollback', '.shell-prompt']) {
    assert.match(source, new RegExp(selector.replace('.', '\\.')));
  }
  for (const marker of ['analyst-deck', 'analyst-command-deck', 'investigation-launcher', 'analyst-workspace', 'analyst-status-rail', 'analyst-view-rail']) {
    assert.match(source, new RegExp(marker));
  }
  assert.doesNotMatch(source, /createGatewayClient|api-client\.js|session\.js|fetch\s*\(/, 'presentation adapter must not bypass the existing shell/controller boundary');
  assert.doesNotMatch(source, forbiddenPersistence);
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML/);
});

test('analyst deck exposes only bounded existing view and action commands', () => {
  const source = read('app/analyst-deck.js');
  for (const view of ['overview', 'evidence', 'correlation', 'relationships', 'coverage', 'raw']) {
    assert.match(source, new RegExp(`['"]${view}['"]`));
  }
  for (const action of ['help', 'meta', 'status', 'json', 'stix', 'clear']) {
    assert.match(source, new RegExp(`['"]${action}['"]`));
  }
  assert.doesNotMatch(source, /providerOverride|providers\s*:|curl|wget|ssh|sudo/i);
  assert.match(source, /para11ax-command-input/);
  assert.match(source, /requestSubmit|dispatchEvent/);
});

test('analyst deck uses the landing palette and makes data surfaces dominant over matrix effects', () => {
  const css = read('app/analyst-deck.css').toLowerCase();
  for (const token of ['#39ff14', '#ff2438', '#020403', 'analyst-command-deck', 'investigation-launcher', 'analyst-workspace', 'analyst-status-rail', 'analyst-view-rail']) {
    assert.match(css, new RegExp(token));
  }
  assert.doesNotMatch(css, /#00e5ff/, 'legacy cyan must not return in the active analyst deck');
  assert.match(css, /\.analyst-workspace[^}]*background:\s*(?:#|var\()/is);
  assert.match(css, /\.analyst-workspace[^}]*z-index:\s*[4-9]/is);
  assert.match(css, /\.matrix-heavy[^}]*z-index:\s*[0-2]/is);
  assert.match(css, /\.shell-result-(?:overview|evidence|correlation|relationships|coverage)/i);
});

test('boot becomes a compact cold-start console while compatibility payloads remain present', () => {
  const [css, html] = [read('app/analyst-deck.css'), read('app/index.html')];
  assert.match(css, /\.boot-panel[^}]*max-width:/is);
  assert.match(css, /\.boot-log[^}]*max-height:\s*(?:8[0-9]|9[0-9]|1[0-2][0-9])px/is);
  assert.match(css, /\.boot-pepe[^}]*opacity:\s*0(?:\.0+)?/is);
  assert.match(html, /id="pepe-ascii"/i);
  assert.match(html, /id="boot-initialize"/i);
  assert.match(html, /id="boot-skip"/i);
});

test('mobile deck is single-column, thumb-safe, sticky, and keeps rain off the active data plane', () => {
  const css = read('app/analyst-deck.css');
  assert.match(css, /@media\s*\(max-width:\s*430px\)/i);
  assert.match(css, /\.analyst-deck[^}]*grid-template-columns:\s*1fr/is);
  assert.match(css, /\.analyst-view-rail[^}]*position:\s*sticky/is);
  assert.match(css, /\.analyst-view-rail[^}]*overflow-x:\s*auto/is);
  assert.match(css, /\.analyst-view-rail[^}]*min-height:\s*44px/is);
  assert.match(css, /\.investigation-launcher[^}]*min-height:\s*44px/is);
  assert.match(css, /\.analyst-workspace[^}]*overflow-x:\s*hidden/is);
  assert.match(css, /\.shell-result-raw[^}]*overflow-x:\s*auto/is);
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*\.tactical-hud[^}]*display:\s*none/is);
});

test('analyst deck disables nonessential motion for reduced-motion users', () => {
  const css = read('app/analyst-deck.css');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /animation:\s*none\s*!important/i);
  assert.match(css, /transition:\s*none\s*!important/i);
});
