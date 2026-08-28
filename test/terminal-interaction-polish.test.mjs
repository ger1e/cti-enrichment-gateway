import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');

const htmlSurfaces = [
  'landing-maxx.html',
  'index.html',
  'app/index.html',
  '403.html',
  '404.html',
  '500.html',
];

test('operational shell identity is analyst@para11ax everywhere', () => {
  const shell = read('app/shell-ui.js');
  const deck = read('app/analyst-deck.js');
  assert.match(shell, /analyst@para11ax:~\$/);
  assert.match(deck, /PROMPT_TEXT\s*=\s*['"]analyst@para11ax:~\$['"]/);
  assert.doesNotMatch(`${shell}\n${deck}`, /para11ax@gateway:~\$|user@para11ax:\s*~/);
  assert.match(shell, /BEARER:/, 'password prompt must remain separate');
});

test('terminal uses the native caret with an explicit phosphor blink cycle', () => {
  const css = read('app/shell.css');
  assert.match(css, /@keyframes\s+terminal-caret-blink/i);
  assert.match(css, /\.shell-input[^}]*caret-color:\s*var\(--terminal-phosphor\)/i);
  assert.match(css, /\.shell-input:focus[^}]*animation:\s*terminal-caret-blink\s+[\d.]+s\s+steps\(1,end\)\s+infinite/i);
  assert.doesNotMatch(css, /\.shell-prompt::after|\.shell-input::after/, 'do not use a fake cursor that can desync from typed text');
});

test('clicking terminal chrome refocuses the command line without stealing text selection', () => {
  const shell = read('app/shell-ui.js');
  assert.match(shell, /root\.addEventListener\(['"]click['"]/);
  assert.match(shell, /getSelection\(\)/);
  assert.match(shell, /selection\.isCollapsed/);
  assert.match(shell, /focusInput\(\)/);
});

test('all public browser surfaces load one local PARA11AX cursor system', () => {
  assert.equal(existsSync('site-cursor.css'), true, 'shared cursor stylesheet must exist');
  assert.equal(existsSync('assets/brand/para11ax-cursor.svg'), true, 'local cursor asset must exist');
  const cursorCss = read('site-cursor.css');
  assert.match(cursorCss, /url\(['"]?\/assets\/brand\/para11ax-cursor\.svg/i);
  assert.match(cursorCss, /cursor:\s*text/i, 'selectable terminal and document text must retain text selection semantics');
  assert.doesNotMatch(cursorCss, /https?:\/\//i, 'cursor layer must not load remote assets');
  for (const path of htmlSurfaces) {
    assert.match(read(path), /href=['"]\/site-cursor\.css['"]/i, `${path} must load the shared cursor stylesheet`);
  }
});
