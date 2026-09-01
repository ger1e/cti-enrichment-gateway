import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function phoneCss(css) {
  const start = css.indexOf('@media(max-width:430px)');
  const reducedMotion = css.indexOf('@media(prefers-reduced-motion:reduce)', start);
  const end = reducedMotion > start ? reducedMotion : css.length;
  assert.ok(start >= 0, 'phone breakpoint must exist');
  assert.ok(end > start, 'phone breakpoint must contain rules');
  return css.slice(start, end);
}

test('phone terminal reserves the viewport for transcript plus a dedicated bottom command bar', async () => {
  const deckCss = phoneCss(await read('app/analyst-deck.css'));
  const finalCss = phoneCss(await read('app/terminal-input-frame.css'));

  assert.match(finalCss, /\.unix-shell\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,1fr\)\s+auto!important/i,
    'final cascade must reserve the middle row for scrollback and the final row for the command bar');
  assert.match(finalCss, /\.unix-shell\{[^}]*align-content:\s*stretch!important/i,
    'final cascade must stretch to the viewport instead of collapsing around the transcript');
  assert.doesNotMatch(finalCss, /\.unix-shell\{[^}]*align-content:\s*start/i);

  assert.match(deckCss, /\.shell-status\{[^}]*grid-template-rows:\s*auto\s+auto/i);
  assert.match(deckCss, /\.shell-status\{[^}]*grid-template-areas:\s*['"]brand clock['"]\s*['"]state state['"]/i);
  assert.match(deckCss, /\.shell-brand\{[^}]*grid-area:\s*brand/i);
  assert.match(deckCss, /\.shell-clock\{[^}]*grid-area:\s*clock/i);
  assert.match(deckCss, /\.shell-session-state\{[^}]*grid-area:\s*state/i);
  assert.match(deckCss, /\.shell-session-state\{[^}]*position:\s*relative!important/i);
  assert.doesNotMatch(deckCss, /\.shell-session-state\{[^}]*position:\s*absolute!important/i,
    'phone status text must never overlay logo or clock');

  assert.match(finalCss, /\.shell-scrollback\{[^}]*grid-row:\s*2!important[^}]*min-height:\s*0!important[^}]*max-height:\s*none!important[^}]*overflow:\s*auto!important/i,
    'scrollback must consume the flexible middle row and scroll inside it');

  assert.match(finalCss, /\.shell-prompt\{[^}]*grid-row:\s*3!important[^}]*position:\s*relative!important[^}]*bottom:\s*auto!important/i,
    'command bar must occupy the dedicated final row rather than following transcript content');
  assert.match(deckCss, /\.shell-prompt\{[^}]*grid-template-columns:\s*max-content\s+minmax\(0,1fr\)!important/i);
  assert.match(deckCss, /\.shell-prompt\{[^}]*min-height:\s*4\dpx!important/i);
  assert.match(deckCss, /\.shell-input\{[^}]*height:\s*3[2-6]px!important/i);
  assert.match(finalCss, /\.shell-prompt\{[^}]*env\(safe-area-inset-bottom\)/i);
});
