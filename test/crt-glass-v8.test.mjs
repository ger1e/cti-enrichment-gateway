import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');

test('render-blocking v7 cascade loads the CRT glass skin without runtime stylesheet insertion', () => {
  assert.equal(existsSync('app/crt-glass.css'), true);
  const prepaint = read('app/prepaint-v7.css');
  const main = read('app/terminal-main.js');
  assert.match(prepaint, /@import url\(['"]\/app\/crt-glass\.css['"]\);/);
  assert.match(main, /dataset\.terminalFirst\s*=\s*['"]v7['"]/);
  assert.doesNotMatch(main, /crt-glass\.css|\.css['"`]/);
});

test('CRT glass skin stays green-black and adds smoked glass, phosphor bloom, scanlines, and vignette', () => {
  const css = read('app/crt-glass.css').toLowerCase();
  for (const required of [
    '--crt-glass:',
    '--crt-glass-strong:',
    '--crt-bloom:',
    'backdrop-filter:',
    '-webkit-backdrop-filter:',
    'repeating-linear-gradient',
    'radial-gradient',
    '#39ff14',
    '#020403',
  ]) assert.match(css, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  for (const forbidden of ['#00e5ff', '#f6c945', '#39ff88', '#ff1e2d', '#ff4050']) {
    assert.doesNotMatch(css, new RegExp(forbidden));
  }
});

test('glass treatment preserves terminal section layout and reduces effects on small/reduced-motion displays', () => {
  const css = read('app/crt-glass.css');
  assert.match(css, /html\[data-terminal-first="v7"\]/);
  assert.match(css, /\.shell-result[^}]*background:\s*transparent\s*!important/is);
  assert.doesNotMatch(css, /border-radius\s*:/i);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/i);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
});
