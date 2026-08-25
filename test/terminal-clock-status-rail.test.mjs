import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Gateway Terminal header renders a live local 24-hour clock with responsive seconds and metadata', async () => {
  const polish = await read('app/terminal-polish.js');
  const css = await read('app/shell-polish.css');
  assert.match(polish, /shell-clock/);
  assert.match(polish, /shell-clock-hm/);
  assert.match(polish, /shell-clock-seconds/);
  assert.match(polish, /shell-clock-meta/);
  assert.match(polish, /setInterval\([^,]+,\s*1000\)/);
  assert.match(polish, /getHours\(\)/);
  assert.match(polish, /getMinutes\(\)/);
  assert.match(polish, /getSeconds\(\)/);
  assert.match(css, /\.shell-clock\{/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-clock-seconds[^}]*display:\s*none/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-clock-meta[^}]*display:\s*none/);
});

test('Gateway Terminal adds a persistent semantic footer rail below the prompt', async () => {
  const polish = await read('app/terminal-polish.js');
  const css = await read('app/shell-polish.css');
  assert.match(polish, /shell-footer/);
  assert.match(polish, /PARA11AX \/\/ EVIDENCE GATEWAY/);
  assert.match(polish, /37 SOURCES/);
  assert.match(polish, /37 SRC/);
  assert.match(polish, /EVIDENCE v2/);
  assert.match(polish, /READ ONLY/);
  assert.match(polish, /shell-footer-led/);
  assert.match(polish, /GATEWAY/);
  assert.match(polish, /EVIDENCE/);
  assert.match(polish, /PROVIDERS/);
  assert.match(polish, /AUTH/);
  assert.match(css, /\.shell-footer\{/);
  assert.match(css, /position:\s*sticky/);
});

test('status cues remain semantic and event-driven instead of permanently animating the shell', async () => {
  const polish = await read('app/terminal-polish.js');
  const css = await read('app/shell-polish.css');
  for (const cue of ['cue-auth-up','cue-auth-down','cue-busy','cue-success','cue-partial','cue-error','cue-contradiction','cue-export','cue-complete','cue-history']) {
    assert.match(polish, new RegExp(cue));
    assert.match(css, new RegExp(`\\.${cue}`));
  }
  assert.match(polish, /secret-mode/);
  assert.match(css, /\.secret-mode[^}]*--prompt-accent:\s*var\(--px-amber\)/);
  assert.doesNotMatch(css, /\.unix-shell\s*\{[^}]*animation:\s*[^;]*infinite/);
});

test('active Gateway Terminal retains the red back-and-forth PARA11AX scanner', async () => {
  const polish = await read('app/terminal-polish.js');
  const legacy = await read('app/app.css');
  assert.match(polish, /scanner-track/);
  assert.match(polish, /shell-scanner-track/);
  assert.match(legacy, /\.scanner-track i\{[^}]*animation:scanner\s+1\.8s\s+ease-in-out\s+infinite\s+alternate/);
  assert.match(legacy, /@keyframes scanner\{from\{transform:translateX\(-20%\)\}to\{transform:translateX\(670%\)\}\}/);
});

test('mobile header and footer collapse secondary telemetry before brand prompt or clock overflow', async () => {
  const css = await read('app/shell-polish.css');
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-status[^}]*grid-template-columns:/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-footer-center[^}]*display:\s*none/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-footer-desktop[^}]*display:\s*none/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-footer-mobile[^}]*display:\s*inline/);
});
