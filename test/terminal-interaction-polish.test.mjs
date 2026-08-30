import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');

test('operational terminal identity remains analyst@para11ax while branding stays visually minimal', () => {
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
  assert.doesNotMatch(desktopHero, /analyst@para11ax:~\$/);
  assert.doesNotMatch(mobileHero, /analyst@para11ax:~\$/);
  assert.match(shell, /BEARER:/, 'password prompt must remain separate');
});

test('terminal replaces the native caret with a synchronized phosphor block cursor', () => {
  const css = read('site-cursor.css');
  const deck = read('app/analyst-deck.js');
  assert.match(css, /\.shell-input\s*\{[^}]*caret-color:\s*transparent!important/i);
  assert.match(css, /@keyframes\s+terminal-block-cursor-blink/i);
  assert.match(css, /\.shell-block-cursor\s*\{[^}]*background:\s*var\(--prompt-accent/i);
  assert.match(deck, /wireBlockCursor\(prompt\)/);
  assert.match(deck, /selectionStart/);
  assert.match(deck, /scrollLeft/);
  assert.doesNotMatch(css, /terminal-caret-blink/i);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*\.shell-block-cursor[\s\S]*animation:none!important/i);
});

test('clicking terminal chrome refocuses the command line without stealing text selection', () => {
  const deck = read('app/analyst-deck.js');
  assert.match(deck, /root\.addEventListener\(['"]click['"]/);
  assert.match(deck, /getSelection\(\)/);
  assert.match(deck, /selection\.isCollapsed/);
  assert.match(deck, /\.shell-input['"]\)\?\.focus\(\{\s*preventScroll:\s*true\s*\}\)/);
});

test('browser-owned PARA11AX surfaces use compact green tactical cursors', () => {
  assert.equal(existsSync('site-cursor.css'), true, 'shared cursor stylesheet must exist');
  assert.equal(existsSync('assets/brand/para11ax-cursor.svg'), true, 'default cursor asset must exist');
  assert.equal(existsSync('assets/brand/para11ax-cursor-target.svg'), true, 'actionable cursor asset must exist');

  const cursorCss = read('site-cursor.css');
  const defaultCursor = read('assets/brand/para11ax-cursor.svg');
  const targetCursor = read('assets/brand/para11ax-cursor-target.svg');

  assert.match(cursorCss, /--para11ax-cursor:url\(['"]?\/assets\/brand\/para11ax-cursor\.svg['"]?\)\s+1\s+1/i);
  assert.match(cursorCss, /--para11ax-cursor-target:url\(['"]?\/assets\/brand\/para11ax-cursor-target\.svg['"]?\)\s+11\s+11/i);
  assert.match(cursorCss, /a\[href\][\s\S]*cursor:var\(--para11ax-cursor-target\),pointer/i);
  assert.match(cursorCss, /cursor:\s*text/i, 'selectable terminal and document text must retain text selection semantics');
  assert.doesNotMatch(cursorCss, /https?:\/\//i, 'cursor layer must not load remote assets');

  for (const svg of [defaultCursor, targetCursor]) {
    assert.match(svg, /width=['"]22['"]/i);
    assert.match(svg, /height=['"]22['"]/i);
    assert.match(svg, /viewBox=['"]0 0 22 22['"]/i);
    assert.match(svg, /#39FF14/i);
    assert.match(svg, /#020403/i);
    assert.doesNotMatch(svg, /#FF2438/i, 'cursor palette must remain green/white/black only');
  }
  assert.doesNotMatch(defaultCursor, /<circle/i, 'default cursor must not regress to detached crosshair ornament');

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
