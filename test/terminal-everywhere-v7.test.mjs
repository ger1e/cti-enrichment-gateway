import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const bannedPalette = /#00e5ff|#f6c945|#39ff88|#00ffff|#ff1e2d|#ff4050/i;

const activePresentationFiles = [
  'landing-maxx.html',
  'app/app.css',
  'app/shell.css',
  'app/shell-polish.css',
  'app/analyst-deck.css',
  'app/tactical-maxx.css',
];

test('landing is a terminal-first v7 surface with live visual motion hooks', () => {
  const landing = read('landing-maxx.html');
  const adapter = read('landing-terminal-v7.js');
  assert.match(landing, /class="terminal-hero"/i);
  assert.match(landing, /class="terminal-topline"/i);
  assert.match(landing, /class="terminal-overview"/i);
  assert.match(landing, /class="terminal-integrations"/i);
  assert.match(adapter, /PROMPT_TEXT\s*=\s*['"]analyst@para11ax:~\$['"]/i);
  assert.match(landing, /PROVENANCE-FIRST CTI PLATFORM/i);
  assert.match(landing, /EVIDENCE FIRST\./i);
  assert.match(landing, /BOUNDED ALWAYS\./i);
  assert.match(landing, /OPERATIONAL WHEN SUPPORTED\./i);
  assert.match(landing, /landing-terminal-v7\.js/i);
  assert.match(landing, /prefers-reduced-motion:\s*reduce/i);
});

test('landing motion adapter is visual-only and non-persistent', () => {
  assert.equal(existsSync('landing-terminal-v7.js'), true, 'landing-terminal-v7.js must exist');
  const source = read('landing-terminal-v7.js');
  assert.match(source, /terminalMotion\s*=\s*['"]v7['"]/i);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/i);
  assert.doesNotMatch(source, /AudioContext|webkitAudioContext|new\s+Audio\s*\(|\.mp3|\.wav|\.ogg/i);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie/i);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest/i);
});

test('active presentation sources use the canonical terminal palette only', () => {
  const source = activePresentationFiles.filter(existsSync).map(read).join('\n').toLowerCase();
  for (const token of ['#020403', '#39ff14', '#f7fff6', '#8da391', '#ff2438']) {
    assert.match(source, new RegExp(token), `${token} must remain represented`);
  }
  assert.doesNotMatch(source, bannedPalette);
});

test('README uses minimal desktop and mobile hero assets while preserving CI badges and analyst entry below the banner', () => {
  const readme = read('README.md');
  assert.match(readme, /assets\/brand\/para11ax-terminal-hero\.svg/i);
  assert.match(readme, /assets\/brand\/para11ax-terminal-hero-mobile\.svg/i);
  assert.match(readme, /Tooling smoke/i);
  assert.match(readme, /CodeQL/i);
  assert.match(readme, /ENTER ANALYST UI/i);
  assert.match(readme, /analyst@para11ax:~\$/i);
  assert.equal(existsSync('assets/brand/para11ax-terminal-hero.svg'), true);
  assert.equal(existsSync('assets/brand/para11ax-terminal-hero-mobile.svg'), true);
  for (const path of ['assets/brand/para11ax-terminal-hero.svg', 'assets/brand/para11ax-terminal-hero-mobile.svg']) {
    const svg = read(path);
    assert.doesNotMatch(svg, /analyst@para11ax:~\$/i, `${path} must keep terminal copy out of the banner`);
    assert.doesNotMatch(svg, /SEMANTIC FIREWALL|FIXED SOURCES|STIX|READ-ONLY|EVIDENCE GATEWAY/i, `${path} must stay visually minimal`);
  }
});

test('brand system declares terminal frame primary and no new audio identity', () => {
  const brand = read('docs/BRAND.md');
  assert.match(brand, /terminal frame/i);
  assert.match(brand, /terminal prompt/i);
  assert.match(brand, /primary identity/i);
  assert.match(brand, /no new audio/i);
  assert.match(brand, /analyst@para11ax:~\$/i);
  assert.doesNotMatch(brand, /caution-amber\s*\|\s*`?#f6c945/i);
});

test('authenticated app preserves native shell flow and canonical analyst prompt', () => {
  const deck = read('app/analyst-deck.js');
  const css = read('app/analyst-deck.css');
  assert.match(deck, /PROMPT_TEXT\s*=\s*['"]analyst@para11ax:~\$['"]/);
  assert.match(deck, /dataset\.terminalFirst\s*=\s*['"]v7['"]/);
  assert.doesNotMatch(deck, /analyst-view-rail|analyst-action-rail|analyst-status-rail/i);
  assert.doesNotMatch(deck, /fetch\s*\(|api-client|session\.js/i);
  assert.match(css, /\.unix-shell[^}]*grid-template-rows:\s*auto\s+minmax\(0,1fr\)\s+auto/is);
  assert.match(css, /\.shell-scrollback[^}]*overflow:\s*auto/is);
  assert.match(css, /\.shell-prompt[^}]*border-top/is);
});

test('mobile and reduced-motion terminal contracts remain explicit', () => {
  const appCss = read('app/analyst-deck.css');
  const landing = read('landing-maxx.html');
  assert.match(appCss, /@media\s*\(max-width:\s*430px\)/i);
  assert.match(appCss, /prefers-reduced-motion:\s*reduce/i);
  assert.match(appCss, /\.raw-console|\.code-line/i);
  assert.match(landing, /@media\s*\(max-width:\s*430px\)|@media\s*\(max-width:\s*480px\)/i);
});

test('boot and auth compatibility markers remain untouched', () => {
  const html = read('app/index.html');
  assert.match(html, /id="boot-panel"/i);
  assert.match(html, /id="pepe-ascii"/i);
  assert.match(html, /id="access-panel"/i);
  assert.match(html, /TOKEN HELD IN MEMORY ONLY/i);
  assert.match(html, /name="theme-color"\s+content="#020403"/i);
});
