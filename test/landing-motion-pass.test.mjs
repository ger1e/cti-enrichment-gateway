import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const adapter = () => read('landing-terminal-v7.js');
const motion = () => read('landing-radar-motion.css');
const radar = () => read('assets/brand/para11ax-radar.svg');
const rain = () => read('assets/brand/para11ax-rain.svg');
const desktopFit = () => read('landing-desktop-fit.css');

test('production landing source carries final visual identity before runtime', () => {
  const html = read('landing-maxx.html');
  const scriptIndex = html.indexOf('<script type="module" src="/landing-terminal-v7.js"></script>');
  assert.ok(scriptIndex > 0, 'production landing module must remain explicit');

  const styles = [
    '/brand-unification.css',
    '/site-cursor.css',
    '/landing-radar-motion.css',
    '/landing-desktop-fit.css',
  ];
  let previous = -1;
  for (const href of styles) {
    const marker = `<link rel="stylesheet" href="${href}">`;
    const index = html.indexOf(marker);
    assert.ok(index > previous, `${href} must load in deterministic prepaint order`);
    assert.ok(index < scriptIndex, `${href} must load before the landing runtime`);
    previous = index;
  }

  assert.match(html, /class="terminal-brand"[^>]*>\s*<img[^>]*class="shared-radar-lockup"[^>]*src="\/assets\/brand\/para11ax-radar-lockup\.svg"/i);
  assert.match(html, /class="ascii-logo"[^>]*data-brand-split="true"[^>]*>\s*<span class="logo-white">PARA<\/span><span class="logo-green">11<\/span><span class="logo-white">AX<\/span>/i);
  assert.match(html, /analyst@para11ax:~\$/);
  assert.doesNotMatch(html, /user@para11ax:~\$/);
});

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

test('landing PPI radar exposes real instrument geometry and target persistence', () => {
  const svg = radar();
  assert.match(svg, /id=["']azimuth-ticks["']/i, 'radar must include an azimuth tick ring');
  assert.ok((svg.match(/class=["']range-ring["']/gi) ?? []).length >= 4, 'radar must expose at least four range rings');
  for (const bearing of ['000', '090', '180', '270']) {
    assert.match(svg, new RegExp(`>${bearing}<`, 'i'), `radar missing ${bearing} bearing label`);
  }
  assert.match(svg, /id=["']ppi-sweep["']/i, 'radar must expose a dedicated PPI sweep group');
  assert.match(svg, /id=["']sweep-trail["']/i, 'radar must expose a fading sweep trail');
  assert.ok((svg.match(/class=["']target-return["']/gi) ?? []).length >= 4, 'radar must include multiple target returns');
  assert.ok((svg.match(/class=["']target-trail["']/gi) ?? []).length >= 3, 'radar must include persistence trails');
  assert.match(svg, /RNG\s+25/i);
  assert.match(svg, /RNG\s+50/i);
  assert.match(svg, /RNG\s+75/i);
  assert.match(svg, /RNG\s+100/i);
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

test('medium desktop landing uses an in-flow two-column hero instead of an absolute radar overlay', () => {
  assert.equal(existsSync('landing-desktop-fit.css'), true, 'medium-desktop landing fit stylesheet must exist');
  const js = adapter();
  const css = desktopFit();
  assert.match(js, /DESKTOP_FIT_HREF\s*=\s*['"]\/landing-desktop-fit\.css['"]/i);
  assert.match(css, /@media\s*\(min-width:\s*901px\)\s*and\s*\(max-width:\s*1600px\)/i);
  assert.match(css, /\.terminal-page\s*\{[^}]*width:\s*min\(1180px,calc\(100%\s*-\s*40px\)\)/i);
  assert.match(css, /\.terminal-hero\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:/is);
  assert.match(css, /\.terminal-hero\s*\{[^}]*min-height:\s*440px/i);
  assert.match(css, /\.hero-ghost\s*\{[^}]*position:\s*relative!important[^}]*width:\s*min\(100%,360px\)[^}]*aspect-ratio:\s*1/is);
  assert.match(css, /\.ascii-logo\s*\{[^}]*font-size:\s*clamp\([^}]*5\.8rem/i);
  assert.doesNotMatch(css, /transform:\s*scale\(|zoom\s*:/i, 'desktop fit must use real layout constraints, not page scaling');
});
