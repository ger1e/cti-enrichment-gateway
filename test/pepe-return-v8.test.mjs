import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('Pepe gets a deliberate boot takeover while staying boot-only', () => {
  const boot = read('app/boot.js');
  const entry = read('app/terminal-entry.js');
  const css = read('app/crt-glass.css');

  assert.match(boot, /PEPE_HOLD_MS\s*=\s*1900/);
  assert.match(boot, /onStage\('pepe'\)[\s\S]*wait\(PEPE_HOLD_MS\)/);

  assert.match(entry, /stage === 'pepe'/);
  assert.match(entry, /triggerGlitch\(bootPanel, 'glitch-pepe',[\s\S]*\)/);
  assert.match(entry, /stage === 'target'[\s\S]*pepe\.hidden = true/);
  assert.doesNotMatch(entry, /shell-boot-pepe/);

  assert.match(css, /\.boot-pepe-visible\s+\.boot-globe\s*\{[^}]*opacity:\.025!important/is);
  assert.match(css, /\.boot-pepe-visible\s+\.boot-pepe\s*\{[^}]*text-shadow:[^}]*var\(--crt-phosphor\)/is);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.boot-pepe-visible\s+\.boot-pepe/is);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[\s\S]*\.boot-pepe-visible\s+\.boot-pepe/is);
});
