import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');

test('operational and branded terminal identity is analyst@para11ax', () => {
  const shell = read('app/shell-ui.js');
  const deck = read('app/analyst-deck.js');
  const landing = read('landing-terminal-v7.js');
  const brand = read('docs/BRAND.md');
  const desktopHero = read('assets/brand/para11ax-terminal-hero.svg');
  const mobileHero = read('assets/brand/para11ax-terminal-hero-mobile.svg');
  assert.match(shell, /promptLabel\.textContent\s*=\s*['"]analyst@para11ax:~\$['"]/);
  assert.doesNotMatch(shell, /promptLabel\.textContent\s*=\s*['"]para11ax@gateway:~\$['"]/);
  assert.match(deck, /PROMPT_TEXT\s*=\s*['"]analyst@para11ax:~\$['"]/);
  assert.match(landing, /PROMPT_TEXT\s*=\s*['"]analyst@para11ax:~\$['"]/);
  assert.match(brand, /analyst@para11ax:~\$/);
  assert.match(desktopHero, /analyst@para11ax:~\$/);
  assert.match(mobileHero, /analyst@para11ax:~\$/);
  assert.match(shell, /BEARER:/, 'password prompt must remain separate');
});

test('terminal uses the native caret with an explicit phosphor blink cycle', () => {
  const css = read('site-cursor.css');
  assert.match(css, /@keyframes\s+terminal-caret-blink/i);
  assert.match(css, /\.shell-input\s*\{[^}]*caret-color:\s*var\(--terminal-phosphor/i);
  assert.match(css, /\.shell-input:focus\s*\{[^}]*animation:\s*terminal-caret-blink\s+[\d.]+s\s+steps\(1,end\)\s+infinite/i);
  assert.doesNotMatch(css, /\.shell-prompt::after|\.shell-input::after/, 'do not use a fake cursor that can desync from typed text');
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*animation:none!important/i);
});

test('clicking terminal chrome refocuses the command line without stealing text selection', () => {
  const deck = read('app/analyst-deck.js');
  assert.match(deck, /root\.addEventListener\(['"]click['"]/);
  assert.match(deck, /getSelection\(\)/);
  assert.match(deck, /selection\.isCollapsed/);
  assert.match(deck, /\.shell-input['"]\)\?\.focus\(\{\s*preventScroll:\s*true\s*\}\)/);
});

test('browser-owned PARA11AX surfaces share one local custom cursor system', () => {
  assert.equal(existsSync('site-cursor.css'), true, 'shared cursor stylesheet must exist');
  assert.equal(existsSync('assets/brand/para11ax-cursor.svg'), true, 'local cursor asset must exist');
  const cursorCss = read('site-cursor.css');
  assert.match(cursorCss, /url\(['"]?\/assets\/brand\/para11ax-cursor\.svg/i);
  assert.match(cursorCss, /cursor:\s*text/i, 'selectable terminal and document text must retain text selection semantics');
  assert.doesNotMatch(cursorCss, /https?:\/\//i, 'cursor layer must not load remote assets');
  assert.match(read('app/analyst-deck.js'), /CURSOR_HREF\s*=\s*['"]\/site-cursor\.css['"]/);
  assert.match(read('landing-terminal-v7.js'), /CURSOR_HREF\s*=\s*['"]\/site-cursor\.css['"]/);
  for (const path of ['403.html', '404.html', '500.html']) {
    assert.match(read(path), /href=['"]\/site-cursor\.css['"]/i, `${path} must load the shared cursor stylesheet`);
  }
});

test('Pepe remains boot-only and is never copied into analyst scrollback', () => {
  const entry = read('app/terminal-entry.js');
  assert.match(entry, /stage === ['"]pepe['"]/);
  assert.match(entry, /pepe\.hidden = false/);
  assert.doesNotMatch(entry, /pepeSignature|restorePepeSignature|shell-boot-pepe/);
  const ready = entry.slice(entry.indexOf("stage === 'ready'"));
  assert.doesNotMatch(ready, /pepe\.textContent|prepend\(|shell-boot-pepe/);
});
