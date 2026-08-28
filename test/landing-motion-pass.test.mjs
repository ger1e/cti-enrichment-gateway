import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const landing = () => readFileSync('landing-maxx.html', 'utf8');
const adapter = () => readFileSync('landing-terminal-v7.js', 'utf8');

test('landing radar uses a rotational phosphor sweep with trail pulse and bounded contacts', () => {
  const html = landing();
  assert.match(html, /class="radar-sweep"/i);
  assert.match(html, /class="radar-trail"/i);
  assert.match(html, /class="radar-pulse"/i);
  assert.ok((html.match(/class="radar-contact/g) || []).length >= 2, 'radar needs at least two bounded contacts');
  assert.ok((html.match(/class="radar-contact/g) || []).length <= 4, 'radar contacts must stay bounded to four');
  assert.match(html, /@keyframes\s+radar-sweep[\s\S]*rotate\(360deg\)/i);
  assert.match(html, /@keyframes\s+radar-contact-ping/i);
  assert.match(html, /@keyframes\s+radar-ring-pulse/i);
});

test('landing removes the full-height hero scanner and keeps radar motion circular', () => {
  const html = landing();
  assert.doesNotMatch(html, /@keyframes\s+hero-scan/i);
  assert.doesNotMatch(html, /translateY\(588px\)/i);
  assert.match(html, /\.terminal-hero:before\s*\{[^}]*content:\s*none/is);
});

test('bounded landing polish uses terminal-native snap cues without new runtime capability', () => {
  const html = landing();
  const js = adapter();
  assert.match(html, /@keyframes\s+acquisition-pulse/i);
  assert.match(html, /\.terminal-button:hover[^}]*animation:\s*acquisition-pulse/i);
  assert.match(html, /\.session-line[^}]*steps\(/i);
  assert.match(html, /\[data-reveal\][^}]*steps\(/i);
  assert.match(html, /\.rain:nth-child\(5n\)/i);
  assert.doesNotMatch(js, /AudioContext|webkitAudioContext|new\s+Audio\s*\(|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/i);
});

test('mobile and reduced-motion radar contracts lower complexity without hiding content', () => {
  const html = landing();
  assert.match(html, /@media\s*\(max-width:\s*640px\)[\s\S]*\.radar-contact:nth-of-type\(n\+3\)\s*\{\s*display:\s*none/is);
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.radar-sweep[\s\S]*animation:\s*none!important/is);
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.radar-contact[\s\S]*animation:\s*none!important/is);
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.radar-pulse[\s\S]*animation:\s*none!important/is);
});
