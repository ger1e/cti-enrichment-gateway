import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const adapter = () => read('landing-terminal-v7.js');
const motion = () => read('landing-radar-motion.css');
const radar = () => read('assets/brand/para11ax-radar.svg');
const rain = () => read('assets/brand/para11ax-rain.svg');
const desktopFit = () => read('landing-desktop-fit.css');

test('landing radar uses a self-contained rotational phosphor SVG sweep', () => {
  assert.equal(existsSync('landing-radar-motion.css'), true, 'landing radar motion stylesheet must exist');
  assert.equal(existsSync('assets/brand/para11ax-radar.svg'), true, 'native radar asset must exist');
  const css = motion();
  const js = adapter();
  const svg = radar();
  assert.match(js, /MOTION_HREF\s*=\s*['"]\/landing-radar-motion\.css['"]/i);
  assert.match(css, /\.hero-ghost[^}]*para11ax-radar\.svg/i);
  assert.match(svg, /<animateTransform\b[^>]*type=["']rotate["'][^>]*repeatCount=["']indefinite["']/i);
  assert.match(svg, /#39FF14/i);
  assert.doesNotMatch(js, /enhanceRadar|RADAR_CONTACTS/i);
});

test('landing disables the full-height hero scanner and mounts radar without runtime construction', () => {
  const css = motion();
  assert.match(css, /\.terminal-hero:before\s*\{[^}]*content:\s*none!important[^}]*animation:\s*none!important/is);
  assert.doesNotMatch(css, /translateY\(588px\)/i);
  assert.match(css, /\.hero-ghost[^}]*background:[^}]*para11ax-radar\.svg/is);
});

test('bounded landing polish uses terminal-native snap cues and README-style native rain without new runtime capability', () => {
  const css = motion();
  const js = adapter();
  const rainSvg = rain();
  assert.match(css, /@keyframes\s+acquisition-pulse/i);
  assert.match(css, /\.terminal-button:hover[^}]*animation:\s*acquisition-pulse/i);
  assert.match(css, /\.session-line[^}]*steps\(/i);
  assert.match(css, /\[data-reveal\][^}]*steps\(/i);
  assert.match(css, /\.matrix-rain[^}]*para11ax-rain\.svg/i);
  assert.ok((rainSvg.match(/<animateTransform\b[^>]*type=["']translate["']/gi) ?? []).length >= 12);
  assert.doesNotMatch(js, /AudioContext|webkitAudioContext|new\s+Audio\s*\(|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/i);
});

test('mobile and reduced-motion radar contracts lower complexity without hiding content', () => {
  const css = motion();
  const radarSvg = radar();
  const rainSvg = rain();
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.hero-ghost[^}]*opacity:/is);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.hero-ghost[^}]*opacity:/is);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.matrix-rain[^}]*opacity:/is);
  assert.match(radarSvg, /prefers-reduced-motion:\s*reduce/i);
  assert.match(rainSvg, /prefers-reduced-motion:\s*reduce/i);
});

test('medium desktop landing uses a bounded fit layer instead of large-desktop hero geometry', () => {
  assert.equal(existsSync('landing-desktop-fit.css'), true, 'medium-desktop landing fit stylesheet must exist');
  const js = adapter();
  const css = desktopFit();
  assert.match(js, /DESKTOP_FIT_HREF\s*=\s*['"]\/landing-desktop-fit\.css['"]/i);
  assert.match(css, /@media\s*\(min-width:\s*901px\)\s*and\s*\(max-width:\s*1600px\)/i);
  assert.match(css, /\.terminal-page\s*\{[^}]*width:\s*min\(1240px,calc\(100%\s*-\s*40px\)\)/i);
  assert.match(css, /\.terminal-hero\s*\{[^}]*min-height:\s*480px/i);
  assert.match(css, /\.hero-ghost\s*\{[^}]*width:\s*min\(33%,400px\)/i);
  assert.match(css, /\.ascii-logo\s*\{[^}]*font-size:\s*clamp\([^}]*6\.4rem/i);
  assert.doesNotMatch(css, /transform:\s*scale\(|zoom\s*:/i, 'desktop fit must use real layout constraints, not page scaling');
});
