import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const adapter = () => read('landing-terminal-v7.js');
const motion = () => read('landing-radar-motion.css');

test('landing radar uses a rotational phosphor sweep with trail pulse and bounded contacts', () => {
  assert.equal(existsSync('landing-radar-motion.css'), true, 'landing radar motion stylesheet must exist');
  const css = motion();
  const js = adapter();
  assert.match(js, /MOTION_HREF\s*=\s*['"]\/landing-radar-motion\.css['"]/i);
  assert.match(js, /function\s+enhanceRadar\s*\(/i);
  assert.match(js, /RADAR_CONTACTS\s*=\s*4/i);
  assert.match(js, /['"]radar-sweep['"]/i);
  assert.match(js, /['"]radar-trail['"]/i);
  assert.match(js, /['"]radar-pulse['"]/i);
  assert.match(css, /@keyframes\s+radar-sweep[\s\S]*rotate\(360deg\)/i);
  assert.match(css, /@keyframes\s+radar-contact-ping/i);
  assert.match(css, /@keyframes\s+radar-ring-pulse/i);
});

test('landing disables the full-height hero scanner and keeps radar motion circular', () => {
  const css = motion();
  assert.match(css, /\.terminal-hero:before\s*\{[^}]*content:\s*none!important[^}]*animation:\s*none!important/is);
  assert.doesNotMatch(css, /translateY\(588px\)/i);
  assert.match(css, /\.radar-sweep[^}]*animation:\s*radar-sweep/i);
});

test('bounded landing polish uses terminal-native snap cues without new runtime capability', () => {
  const css = motion();
  const js = adapter();
  assert.match(css, /@keyframes\s+acquisition-pulse/i);
  assert.match(css, /\.terminal-button:hover[^}]*animation:\s*acquisition-pulse/i);
  assert.match(css, /\.session-line[^}]*steps\(/i);
  assert.match(css, /\[data-reveal\][^}]*steps\(/i);
  assert.match(css, /\.rain:nth-child\(5n\)/i);
  assert.doesNotMatch(js, /AudioContext|webkitAudioContext|new\s+Audio\s*\(|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/i);
});

test('mobile and reduced-motion radar contracts lower complexity without hiding content', () => {
  const css = motion();
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.radar-contact:nth-of-type\(n\+3\)\s*\{\s*display:\s*none/is);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.radar-sweep[\s\S]*animation:\s*none!important/is);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.radar-contact[\s\S]*animation:\s*none!important/is);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.radar-pulse[\s\S]*animation:\s*none!important/is);
});
