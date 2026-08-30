import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const desktop = readFileSync(new URL('../app/desktop-layout-v7.css', import.meta.url), 'utf8');

test('desktop boot and terminal share one fixed CRT chassis across the skip handoff', () => {
  assert.match(
    desktop,
    /html\[data-terminal-first="v7"\] \.boot-panel,\s*html\[data-terminal-first="v7"\] \.terminal-stage\{[^}]*width:100%!important;[^}]*height:calc\(100dvh - 14px\)!important;[^}]*min-height:0!important;[^}]*overflow:hidden!important;[^}]*border:1px solid var\(--terminal-line\)!important;/s,
    'boot and terminal must use the same desktop outer-frame geometry and border',
  );

  assert.match(
    desktop,
    /html\[data-terminal-first="v7"\] \.boot-panel\{[^}]*padding:0 clamp\(14px,2vw,26px\)!important;?/s,
    'boot content must use the same horizontal CRT inset as the terminal shell',
  );
});
