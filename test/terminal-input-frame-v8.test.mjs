import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync('app/shell.css', 'utf8');

test('desktop command input uses a square phosphor frame with restrained focus emphasis', () => {
  assert.match(
    css,
    /\.shell-input-wrap\{[^}]*border:1px solid var\(--terminal-line-strong\)[^}]*box-shadow:inset 0 0 0 1px rgba\(57,255,20,[^)]+\)[^}]*\}/i,
  );
  assert.match(
    css,
    /\.shell-prompt:focus-within \.shell-input-wrap\{[^}]*border-color:var\(--terminal-phosphor\)[^}]*box-shadow:[^}]*inset[^}]*rgba\(57,255,20,[^)]+\)[^}]*\}/i,
  );
  assert.match(css, /\.shell-input\{[^}]*border:0/i);
  assert.doesNotMatch(css, /\.shell-input-wrap\{[^}]*border-radius/i);
});

test('phone command input stays line-style instead of becoming a boxed field', () => {
  assert.match(
    css,
    /@media\(max-width:430px\)\{[\s\S]*?\.shell-input-wrap\{[^}]*border:0[^}]*box-shadow:none[^}]*\}[\s\S]*?\.shell-input\{[^}]*border-bottom:1px solid var\(--terminal-line-strong\)[^}]*\}[\s\S]*?\}/i,
  );
});
