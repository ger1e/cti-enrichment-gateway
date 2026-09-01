import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function phoneCss(css) {
  const start = css.indexOf('@media(max-width:430px)');
  const end = css.indexOf('@media(prefers-reduced-motion:reduce)', start);
  assert.ok(start >= 0, 'phone breakpoint must exist');
  assert.ok(end > start, 'phone breakpoint must end before reduced-motion rules');
  return css.slice(start, end);
}

test('phone terminal reserves the viewport for transcript plus a dedicated bottom command bar', async () => {
  const css = phoneCss(await read('app/analyst-deck.css'));

  assert.match(css, /\.unix-shell\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,1fr\)\s+auto/i,
    'phone shell must reserve the middle row for scrollback and the final row for the command bar');
  assert.doesNotMatch(css, /\.unix-shell\{[^}]*align-content:\s*start/i,
    'phone shell must stretch to the viewport instead of collapsing around the transcript');

  assert.match(css, /\.shell-status\{[^}]*grid-template-rows:\s*auto\s+auto/i);
  assert.match(css, /\.shell-status\{[^}]*grid-template-areas:\s*['"]brand clock['"]\s*['"]state state['"]/i);
  assert.match(css, /\.shell-brand\{[^}]*grid-area:\s*brand/i);
  assert.match(css, /\.shell-clock\{[^}]*grid-area:\s*clock/i);
  assert.match(css, /\.shell-session-state\{[^}]*grid-area:\s*state/i);
  assert.match(css, /\.shell-session-state\{[^}]*position:\s*relative!important/i);
  assert.doesNotMatch(css, /\.shell-session-state\{[^}]*position:\s*absolute!important/i,
    'phone status text must never overlay logo or clock');

  assert.match(css, /\.shell-scrollback\{[^}]*min-height:\s*0!important[^}]*max-height:\s*none!important[^}]*overflow:\s*auto!important/i,
    'scrollback must consume the flexible middle row and scroll inside it');

  assert.match(css, /\.shell-prompt\{[^}]*grid-template-columns:\s*max-content\s+minmax\(0,1fr\)!important/i);
  assert.match(css, /\.shell-prompt\{[^}]*min-height:\s*4\dpx!important/i);
  assert.match(css, /\.shell-input\{[^}]*height:\s*3[2-6]px!important/i);
  assert.match(css, /\.shell-prompt\{[^}]*env\(safe-area-inset-bottom\)/i);
});
