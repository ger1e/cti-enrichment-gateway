import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Gateway Terminal header renders a live local 24-hour clock with responsive seconds and metadata', async () => {
  const shell = await read('app/shell-ui.js');
  const css = await read('app/shell-polish.css');
  assert.match(shell, /shell-clock/);
  assert.match(shell, /shell-clock-hm/);
  assert.match(shell, /shell-clock-seconds/);
  assert.match(shell, /shell-clock-meta/);
  assert.match(shell, /setInterval\([^,]+,\s*1000\)/);
  assert.match(shell, /getHours\(\)/);
  assert.match(shell, /getMinutes\(\)/);
  assert.match(shell, /getSeconds\(\)/);
  assert.match(css, /\.shell-clock\{/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-clock-seconds[^}]*display:\s*none/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-clock-meta[^}]*display:\s*none/);
});

test('Gateway Terminal adds a persistent semantic footer rail below the prompt', async () => {
  const shell = await read('app/shell-ui.js');
  const css = await read('app/shell-polish.css');
  assert.match(shell, /shell-footer/);
  assert.match(shell, /PARA11AX \/\/ EVIDENCE GATEWAY/);
  assert.match(shell, /37 SOURCES/);
  assert.match(shell, /EVIDENCE v2/);
  assert.match(shell, /READ ONLY/);
  assert.match(shell, /shell-footer-led/);
  assert.match(shell, /GATEWAY/);
  assert.match(shell, /EVIDENCE/);
  assert.match(shell, /PROVIDERS/);
  assert.match(shell, /AUTH/);
  assert.match(css, /\.shell-footer\{/);
  assert.match(css, /position:\s*sticky/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*37 SRC/);
});

test('status cues remain semantic and event-driven instead of permanently animating the shell', async () => {
  const shell = await read('app/shell-ui.js');
  const css = await read('app/shell-polish.css');
  for (const cue of ['cue-auth-up','cue-auth-down','cue-busy','cue-success','cue-partial','cue-error','cue-contradiction','cue-export','cue-complete','cue-history']) {
    assert.match(shell, new RegExp(cue));
    assert.match(css, new RegExp(`\\.${cue}`));
  }
  assert.match(shell, /secret-mode/);
  assert.match(css, /\.secret-mode[^}]*--prompt-accent:\s*var\(--px-amber\)/);
  assert.doesNotMatch(css, /\.unix-shell\s*\{[^}]*animation:\s*[^;]*infinite/);
});

test('active Gateway Terminal retains the red back-and-forth PARA11AX scanner', async () => {
  const shell = await read('app/shell-ui.js');
  const legacy = await read('app/app.css');
  assert.match(shell, /scanner-track/);
  assert.match(shell, /shell-scanner-track/);
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
