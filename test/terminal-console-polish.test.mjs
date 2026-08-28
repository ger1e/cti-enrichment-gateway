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

test('terminal uses only the horizontal scanner and never sweeps vertically through the shell', async () => {
  const css = await read('app/analyst-deck.css');
  assert.doesNotMatch(css, /\.unix-shell:before\{[^}]*animation:\s*terminal-scan/is);
  assert.doesNotMatch(css, /@keyframes\s+terminal-scan/i);
  assert.doesNotMatch(css, /translateY\(calc\(100dvh/i);
  assert.match(css, /\.shell-scanner-track\{[^}]*height:\s*1px/is);
});

test('terminal scroll regions remain scrollable without browser scrollbar chrome', async () => {
  const css = await read('app/analyst-deck.css');
  assert.match(css, /\.shell-scrollback\{[^}]*overflow:\s*auto!important[^}]*scrollbar-width:\s*none/is);
  assert.match(css, /\.shell-scrollback::-webkit-scrollbar[^}]*display:\s*none!important/is);
  assert.match(css, /\.shell-pre[^}]*scrollbar-width:\s*none/is);
  assert.match(css, /\.shell-result[^}]*scrollbar-width:\s*none/is);
});

test('phone runtime reads like a green xterm console rather than a framed input panel', async () => {
  const css = phoneCss(await read('app/analyst-deck.css'));
  assert.match(css, /\.terminal-stage\{[^}]*border:\s*0!important[^}]*box-shadow:\s*none!important/is);
  assert.match(css, /\.unix-shell\{[^}]*box-shadow:\s*none!important/is);
  assert.match(css, /\.shell-input\{[^}]*border-left:\s*0!important[^}]*border-top:\s*0!important/is);
  assert.match(css, /\.shell-input:focus[^}]*box-shadow:\s*none!important/is);
  assert.match(css, /\.shell-prompt\{[^}]*border-top:\s*0!important[^}]*box-shadow:\s*none!important/is);
});

test('phone terminal keeps a static textless phosphor bottom bezel', async () => {
  const css = phoneCss(await read('app/analyst-deck.css'));
  assert.match(css, /\.unix-shell:after\{[^}]*content:\s*""[^}]*position:\s*absolute[^}]*bottom:\s*0[^}]*height:\s*[23]px[^}]*background:\s*var\(--terminal-phosphor\)/is);
  assert.doesNotMatch(css, /\.unix-shell:after\{[^}]*content:\s*"[^"\r\n]+"/is,
    'bottom bezel must be visual only with no label text');
});
