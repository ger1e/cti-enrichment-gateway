import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');

test('WebUI runtime pins the same canonical SVG favicon as landing', () => {
  const landing = read('index.html');
  const runtime = read('app/terminal-main.js');
  assert.match(landing, /rel=["']icon["'][^>]*href=["']\/favicon\.svg["']/i);
  assert.match(runtime, /favicon\.href\s*=\s*['"]\/favicon\.svg['"]/i);
  assert.match(runtime, /favicon\.rel\s*=\s*['"]icon['"]/i);
  assert.match(runtime, /favicon\.type\s*=\s*['"]image\/svg\+xml['"]/i);
});

test('landing rain renderer is slower-looking and substantially denser without touching app rain', () => {
  const css = read('landing-radar-motion.css');
  assert.match(css, /\.matrix-rain[^}]*background-size:\s*56%\s+auto\s*!important/is);
  assert.match(css, /\.matrix-rain[^}]*background-repeat:\s*repeat\s*!important/is);
  assert.match(css, /@media\(max-width:640px\)[\s\S]*?\.matrix-rain[^}]*background-size:\s*auto\s+56%\s*!important/is);
});
