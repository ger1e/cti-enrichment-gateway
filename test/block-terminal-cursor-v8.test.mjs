import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');

test('terminal prompt uses one synced phosphor block cursor instead of the native caret', () => {
  const css = read('site-cursor.css');
  const deck = read('app/analyst-deck.js');

  assert.match(css, /\.shell-input\s*\{[^}]*caret-color:\s*transparent/i, 'native caret must be hidden');
  assert.match(css, /@keyframes\s+terminal-block-cursor-blink/i);
  assert.match(css, /\.shell-block-cursor\s*\{[^}]*width:\s*\.6\d*ch[^}]*height:\s*1\.\d+em[^}]*background:\s*var\(--prompt-accent/i);
  assert.match(css, /terminal-block-cursor-blink\s+[\d.]+s\s+steps\(1,end\)\s+infinite/i);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*\.shell-block-cursor[\s\S]*animation:none!important/i);

  assert.match(deck, /function\s+wireBlockCursor\s*\(/);
  assert.match(deck, /selectionStart/);
  assert.match(deck, /scrollLeft/);
  assert.match(deck, /measureText\(/);
  assert.match(deck, /cursor\.getBoundingClientRect\(\)\.width/);
  assert.match(deck, /input\.type\s*===\s*['"]password['"]/);
  assert.match(deck, /['"]•['"]\.repeat\(/, 'password cursor position must be measured from mask glyphs, not secret text');
  assert.doesNotMatch(deck, /textContent\s*=\s*input\.value|innerHTML\s*=\s*input\.value/, 'secret or typed input must never be mirrored into the DOM');

  for (const eventName of ['input', 'keyup', 'click', 'select', 'scroll', 'focus', 'blur']) {
    assert.match(deck, new RegExp(`addEventListener\\(['"]${eventName}['"]`), `${eventName} must keep the cursor synchronized`);
  }
});

test('block cursor is anchored to the command input bar, not the prompt or CRT plane', () => {
  const css = read('site-cursor.css');
  const deck = read('app/analyst-deck.js');

  assert.match(css, /\.shell-input-wrap\s*\{[^}]*position:\s*relative[^}]*min-width:\s*0[^}]*width:\s*100%/i,
    'input wrapper must establish the cursor containing block');
  assert.match(css, /\.shell-block-cursor\s*\{[^}]*top:\s*50%/i,
    'cursor vertical position must be local to the input wrapper');
  assert.match(deck, /const\s+inputWrap\s*=\s*document\.createElement\(['"]span['"]\)/,
    'cursor runtime must create a dedicated input wrapper');
  assert.match(deck, /inputWrap\.className\s*=\s*['"]shell-input-wrap['"]/);
  assert.match(deck, /input\.replaceWith\(inputWrap\)/);
  assert.match(deck, /inputWrap\.append\(input,\s*cursor\)/,
    'cursor must be a sibling of the input inside its wrapper');
  assert.match(deck, /const\s+wrapRect\s*=\s*inputWrap\.getBoundingClientRect\(\)/,
    'cursor horizontal math must be relative to the input wrapper');
  assert.doesNotMatch(deck, /const\s+promptRect\s*=\s*prompt\.getBoundingClientRect\(\)/,
    'cursor coordinates must not depend on the wider prompt/CRT plane');
});
