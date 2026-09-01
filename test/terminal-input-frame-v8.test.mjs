import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const framePath = 'app/terminal-input-frame.css';
const frameCss = existsSync(framePath) ? readFileSync(framePath, 'utf8') : '';
const prepaint = readFileSync('app/prepaint-v7.css', 'utf8');

test('desktop command input uses a square phosphor frame with restrained focus emphasis', () => {
  assert.match(prepaint, /@import url\(['"]\/app\/terminal-input-frame\.css['"]\);/i);
  assert.match(
    frameCss,
    /\.shell-input-wrap\{[^}]*border:1px solid var\(--terminal-line-strong\)[^}]*box-shadow:inset 0 0 0 1px rgba\(57,255,20,[^)]+\)[^}]*\}/i,
  );
  assert.match(
    frameCss,
    /\.shell-prompt:focus-within \.shell-input-wrap\{[^}]*border-color:var\(--terminal-phosphor\)[^}]*box-shadow:[^}]*inset[^}]*rgba\(57,255,20,[^)]+\)[^}]*\}/i,
  );
  assert.match(frameCss, /\.shell-input\{[^}]*border:0/i);
  assert.doesNotMatch(frameCss, /border-radius/i);
});

test('phone command input stays line-style instead of becoming a boxed field', () => {
  assert.match(
    frameCss,
    /@media\(max-width:430px\)\{[\s\S]*?\.shell-input-wrap\{[^}]*border:0[^}]*box-shadow:none[^}]*\}[\s\S]*?\.shell-input\{[^}]*border-bottom:1px solid var\(--terminal-line-strong\)[^}]*\}[\s\S]*?\}/i,
  );
});
