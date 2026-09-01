import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const framePath = 'app/terminal-input-frame.css';
const frameCss = existsSync(framePath) ? readFileSync(framePath, 'utf8') : '';
const prepaint = readFileSync('app/prepaint-v7.css', 'utf8');

test('command bar uses one square phosphor frame with restrained focus emphasis', () => {
  assert.match(prepaint, /@import url\(['"]\/app\/terminal-input-frame\.css['"]\);/i);
  assert.match(
    frameCss,
    /\.shell-prompt\{[^}]*border:1px solid var\(--terminal-line-strong\)!important[^}]*box-shadow:inset 0 0 0 1px rgba\(57,255,20,[^)]+\)[^}]*\}/i,
  );
  assert.match(
    frameCss,
    /\.shell-prompt:focus-within\{[^}]*border-color:var\(--terminal-phosphor\)!important[^}]*box-shadow:[^}]*inset[^}]*rgba\(57,255,20,[^)]+\)[^}]*\}/i,
  );
  assert.match(frameCss, /\.shell-input-wrap\{[^}]*border:0[^}]*box-shadow:none/i,
    'the outer command bar owns the frame; the input wrapper must not create a nested box');
  assert.match(frameCss, /\.shell-input\{[^}]*border:0/i);
  assert.doesNotMatch(frameCss, /border-radius/i);
});

test('phone command bar keeps the same full frame instead of reverting to an underline', () => {
  assert.doesNotMatch(
    frameCss,
    /@media\(max-width:430px\)\{[\s\S]*?\.shell-input-wrap\{[^}]*border:0[^}]*[\s\S]*?\.shell-input\{[^}]*border-bottom:1px solid var\(--terminal-line-strong\)/i,
  );
  assert.doesNotMatch(frameCss, /@media\(max-width:430px\)[\s\S]*?\.shell-prompt\{[^}]*border(?:-top)?:0/i,
    'phone must not remove the outer command-bar frame');
});
