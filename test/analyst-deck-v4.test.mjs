import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');
const forbiddenPersistence = /localStorage|sessionStorage|indexedDB|document\.cookie/i;

test('analyst deck presentation assets exist and load after terminal polish', () => {
  assert.equal(existsSync('app/analyst-deck.js'), true);
  assert.equal(existsSync('app/analyst-deck.css'), true);
  const main = read('app/terminal-main.js');
  assert.match(main, /import ['"]\.\/analyst-deck\.js['"]/);
  assert.ok(main.indexOf('./analyst-deck.js') > main.indexOf('./terminal-polish.js'));
});

test('v5 keeps the existing shell boundary and removes generated command button rails', () => {
  const source = read('app/analyst-deck.js');
  for (const selector of ['.unix-shell', '.shell-status', '.shell-scrollback', '.shell-prompt']) {
    assert.match(source, new RegExp(selector.replace('.', '\\.')));
  }
  for (const marker of ['analyst-deck', 'analyst-header', 'investigation-launcher', 'analyst-workspace', 'analyst-telemetry-strip']) {
    assert.match(source, new RegExp(marker));
  }
  for (const removed of ['VIEW_COMMANDS', 'ACTION_COMMANDS', 'analyst-view-rail', 'analyst-action-rail', 'analyst-command', 'commandButton', 'buildRail']) {
    assert.doesNotMatch(source, new RegExp(removed));
  }
  assert.doesNotMatch(source, /createGatewayClient|api-client\.js|session\.js|fetch\s*\(/);
  assert.doesNotMatch(source, forbiddenPersistence);
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML/);
});

test('v5 is prompt-first with one evidence viewport and passive telemetry', () => {
  const source = read('app/analyst-deck.js');
  assert.match(source, /EVIDENCE WORKSPACE/);
  assert.match(source, /OPERATIONAL STATE/);
  assert.match(source, /OBSERVED ≠ INFERRED ≠ CONTEXTUAL/);
  assert.match(source, /shell-scrollback/);
  assert.match(source, /shell-prompt/);
  assert.doesNotMatch(source, /requestSubmit|data-command|data-last-run/);
  assert.doesNotMatch(source, /<observable>|VIEW_COMMANDS|ACTION_COMMANDS/);
});

test('v5 uses one strict phosphor palette and reserves red for exception semantics', () => {
  const css = read('app/analyst-deck.css').toLowerCase();
  for (const token of ['#020403', '#39ff14', '#f7fff6', '#8da391', '#ff2438']) {
    assert.match(css, new RegExp(token));
  }
  for (const drift of ['#00e5ff', '#050806', '#08100a', '#111713', '#9eb7a1', '#c07f87', '#c29298']) {
    assert.doesNotMatch(css, new RegExp(drift), `palette drift ${drift} must be removed`);
  }
  assert.match(css, /--deck-bg:\s*#020403/);
  assert.match(css, /--deck-phosphor:\s*#39ff14/);
  assert.match(css, /--deck-text:\s*#f7fff6/);
  assert.match(css, /--deck-muted:\s*#8da391/);
  assert.match(css, /--deck-alert:\s*#ff2438/);
});

test('v5 layout gives the workspace full width and reduces decorative layers behind data', () => {
  const css = read('app/analyst-deck.css');
  assert.match(css, /\.analyst-deck[^}]*grid-template-columns:\s*minmax\(0,1fr\)/is);
  assert.doesNotMatch(css, /grid-template-columns:\s*minmax\(0,1fr\)\s+248px/i);
  assert.match(css, /\.analyst-workspace[^}]*z-index:\s*[4-9]/is);
  assert.match(css, /\.matrix-heavy[^}]*z-index:\s*[0-2]/is);
  assert.match(css, /\.matrix-heavy[^}]*opacity:\s*\.1[0-9]/is);
  assert.match(css, /\.tactical-hud[^}]*opacity:\s*\.0[0-9]/is);
  assert.match(css, /\.analyst-telemetry-strip[^}]*display:\s*flex/is);
});

test('boot remains compact while compatibility payloads stay present', () => {
  const [css, html] = [read('app/analyst-deck.css'), read('app/index.html')];
  assert.match(css, /\.boot-panel[^}]*max-width:/is);
  assert.match(css, /\.boot-log[^}]*max-height:/is);
  assert.match(css, /\.boot-pepe[^}]*opacity:\s*0(?:\.0+)?/is);
  assert.match(html, /id="pepe-ascii"/i);
  assert.match(html, /id="boot-initialize"/i);
  assert.match(html, /id="boot-skip"/i);
});

test('mobile v5 is a single prompt-first column without button rails or side status panels', () => {
  const css = read('app/analyst-deck.css');
  assert.match(css, /@media\s*\(max-width:\s*430px\)/i);
  assert.match(css, /\.analyst-deck[^}]*grid-template-columns:\s*1fr/is);
  assert.match(css, /\.investigation-launcher[^}]*min-height:\s*44px/is);
  assert.match(css, /\.analyst-workspace[^}]*overflow-x:\s*hidden/is);
  assert.match(css, /\.shell-result-raw[^}]*overflow-x:\s*auto/is);
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*\.tactical-hud[^}]*display:\s*none/is);
  assert.doesNotMatch(css, /analyst-view-rail|analyst-action-rail|analyst-status-rail/);
});

test('analyst deck disables nonessential motion for reduced-motion users', () => {
  const css = read('app/analyst-deck.css');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /animation:\s*none\s*!important/i);
  assert.match(css, /transition:\s*none\s*!important/i);
});
