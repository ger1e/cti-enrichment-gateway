import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');
const forbiddenPersistence = /localStorage|sessionStorage|indexedDB|document\.cookie/i;
const activeCss = [
  'app/app.css',
  'app/shell.css',
  'app/shell-polish.css',
  'app/tactical-maxx.css',
  'app/analyst-deck.css',
  'app/earth-globe.css',
];

const legacyPalette = [
  /#00e5ff/i,
  /#f6c945/i,
  /#39ff88/i,
  /#ff1e2d/i,
  /#ff4050/i,
  /rgba?\(\s*0\s*,\s*229\s*,\s*255/i,
  /rgba?\(\s*246\s*,\s*201\s*,\s*69/i,
  /rgba?\(\s*57\s*,\s*255\s*,\s*136/i,
  /rgba?\(\s*255\s*,\s*30\s*,\s*45/i,
];

test('terminal-first presentation assets load after terminal polish without replacing the shell boundary', () => {
  assert.equal(existsSync('app/analyst-deck.js'), true);
  assert.equal(existsSync('app/analyst-deck.css'), true);
  const main = read('app/terminal-main.js');
  assert.match(main, /import ['"]\.\/analyst-deck\.js['"]/);
  assert.ok(main.indexOf('./analyst-deck.js') > main.indexOf('./terminal-polish.js'));

  const source = read('app/analyst-deck.js');
  for (const selector of ['.unix-shell', '.shell-prompt']) {
    assert.match(source, new RegExp(selector.replace('.', '\\.')));
  }
  assert.match(read('app/analyst-deck.css'), /\.shell-scrollback/);
  assert.doesNotMatch(source, /replaceChildren|analyst-header|analyst-workspace|analyst-identity|analyst-telemetry-strip|investigation-launcher/);
  assert.doesNotMatch(source, /createGatewayClient|api-client\.js|session\.js|fetch\s*\(/);
  assert.doesNotMatch(source, forbiddenPersistence);
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML/);
});

test('terminal-first shell uses one canonical analyst prompt and keeps scrollback as the dominant viewport', () => {
  const [source, css] = [read('app/analyst-deck.js'), read('app/analyst-deck.css')];
  assert.match(source, /PROMPT_TEXT\s*=\s*['"]analyst@para11ax:~\$['"]/);
  assert.match(source, /dataset\.terminalFirst\s*=\s*['"]v7['"]/);
  assert.match(css, /\.unix-shell[^}]*display:\s*grid/is);
  assert.match(css, /grid-template-rows:\s*auto\s+minmax\(0,1fr\)\s+auto/is);
  assert.match(css, /\.shell-scrollback[^}]*min-height:\s*0/is);
  assert.match(css, /\.shell-scrollback[^}]*overflow:\s*auto/is);
  assert.match(css, /\.shell-prompt[^}]*grid-template-columns:\s*max-content\s+minmax\(0,1fr\)/is);
  assert.doesNotMatch(css, /EVIDENCE WORKSPACE|OPERATIONAL STATE|analyst-workspace|analyst-telemetry|analyst-identity|investigation-launcher/);
});

test('all active app presentation styles eradicate the legacy cyan amber and old green palette', () => {
  for (const path of activeCss) {
    const css = read(path);
    for (const forbidden of legacyPalette) {
      assert.doesNotMatch(css, forbidden, `${path} still contains legacy color ${forbidden}`);
    }
  }
});

test('terminal-first palette is black phosphor white muted gray with red reserved for exception semantics', () => {
  const css = activeCss.map(read).join('\n').toLowerCase();
  for (const token of ['#020403', '#39ff14', '#f7fff6', '#8da391', '#ff2438']) {
    assert.match(css, new RegExp(token));
  }
  const finalCss = read('app/analyst-deck.css').toLowerCase();
  assert.match(finalCss, /--terminal-bg:\s*#020403/);
  assert.match(finalCss, /--terminal-phosphor:\s*#39ff14/);
  assert.match(finalCss, /--terminal-text:\s*#f7fff6/);
  assert.match(finalCss, /--terminal-muted:\s*#8da391/);
  assert.match(finalCss, /--terminal-alert:\s*#ff2438/);
  assert.doesNotMatch(finalCss, /--[\w-]*(?:cyan|amber|green)\s*:/i);
});

test('result surfaces render as terminal sections rather than dashboard cards or HUD grids', () => {
  const css = read('app/analyst-deck.css');
  assert.match(css, /\.shell-result[^}]*border-top:/is);
  assert.match(css, /\.shell-result[^}]*background:\s*transparent/is);
  assert.match(css, /\.overview[^}]*display:\s*block/is);
  assert.match(css, /\.hud-cell[^}]*display:\s*grid/is);
  assert.match(css, /\.hud-cell[^}]*grid-template-columns:\s*minmax\(/is);
  assert.doesNotMatch(css, /repeat\(4|box-shadow:\s*0 28px 90px|border-radius:/i);
});

test('boot auth and runtime share the same terminal palette and do not switch visual language', () => {
  const css = read('app/analyst-deck.css');
  assert.match(css, /\.boot-panel[^}]*background:\s*var\(--terminal-bg\)/is);
  assert.match(css, /\.access[^}]*background:\s*var\(--terminal-bg\)/is);
  assert.match(css, /\.terminal-stage[^}]*background:\s*var\(--terminal-bg\)/is);
  assert.match(css, /\.boot-globe[^}]*filter:\s*drop-shadow\([^)]*57\s*,\s*255\s*,\s*20/is);
  assert.match(css, /\.secret-mode[^}]*--prompt-accent:\s*var\(--terminal-phosphor\)/is);
});

test('mobile terminal preserves one shell plane and prompt without dashboard reflow', () => {
  const css = read('app/analyst-deck.css');
  const phone = css.slice(css.indexOf('@media(max-width:430px)'), css.indexOf('@media(prefers-reduced-motion:reduce)'));
  assert.match(phone, /\.unix-shell[^}]*grid-template-rows:\s*auto\s+auto\s+auto/is);
  assert.match(phone, /\.shell-prompt[^}]*grid-template-columns:\s*max-content\s+minmax\(0,1fr\)/is);
  assert.match(phone, /\.shell-scrollback[^}]*scrollbar-width:\s*none/is);
  assert.doesNotMatch(phone, /\.unix-shell[^}]*grid-template-rows:[^;}]*minmax\(0,1fr\)/is);
  assert.doesNotMatch(css, /analyst-view-rail|analyst-action-rail|analyst-status-rail|analyst-workspace|analyst-telemetry/);
});

test('terminal-first presentation disables nonessential motion for reduced-motion users', () => {
  const css = read('app/analyst-deck.css');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /animation:\s*none\s*!important/i);
  assert.match(css, /transition:\s*none\s*!important/i);
});
