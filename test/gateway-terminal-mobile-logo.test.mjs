import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFile(url(path), 'utf8');

test('Gateway Terminal and landing resolve one canonical radar lockup', async () => {
  const logoExists = await access(url('assets/brand/para11ax-radar-lockup.svg')).then(() => true, () => false);
  const polishExists = await access(url('app/terminal-polish.js')).then(() => true, () => false);
  assert.equal(logoExists, true, 'canonical PARA11AX radar SVG must exist');
  assert.equal(polishExists, true, 'terminal polish module must exist');
  const [main, brand, brandCss, polish, css] = await Promise.all([
    read('app/terminal-main.js'), read('brand-unification.js'), read('brand-unification.css'), read('app/terminal-polish.js'), read('app/shell-polish.css'),
  ]);
  assert.match(main, /\.\.\/brand-unification\.js/);
  assert.match(brand, /\/assets\/brand\/para11ax-radar-lockup\.svg/);
  assert.match(brand, /\.terminal-brand/);
  assert.match(brand, /\.terminal-mark/);
  assert.match(brand, /\.para11ax-logo/);
  assert.match(brandCss, /\.shared-radar-lockup/);
  assert.match(polish, /boot-brand-lockup/);
  assert.match(polish, /shell-logo/);
  assert.match(css, /\.para11ax-logo\{/);
});

test('canonical PARA11AX logo asset is a phosphor animated radar, not the legacy sentinel', async () => {
  const svg = await read('assets/brand/para11ax-radar-lockup.svg');
  assert.match(svg, /viewBox=/);
  assert.match(svg, /#39FF14/i);
  assert.match(svg, /#FF2438/i);
  assert.match(svg, /#F7FFF6/i);
  assert.match(svg, /<animateTransform\b[^>]*type=["']rotate["']/i);
  assert.match(svg, /PARA/);
  assert.match(svg, /11/);
  assert.match(svg, /AX/);
  assert.doesNotMatch(svg, /sentinel|helmet|visor/i);
  assert.doesNotMatch(svg, /(?:href|src)\s*=\s*["']https?:\/\//i, 'logo must not load external resources');
});

test('wireframe globe remains continuously visible from initialize until gateway ready', async () => {
  const [polish, css] = await Promise.all([read('app/terminal-polish.js'), read('app/shell-polish.css')]);
  assert.match(polish, /classList\.add\(['"]boot-running['"]\)/);
  assert.match(polish, /classList\.remove\(['"]boot-running['"]\)/);
  const runningRule = css.match(/\.boot-running \.boot-globe\{([^}]*)\}/)?.[1] || '';
  const runningOpacity = Number(runningRule.match(/opacity:\s*([0-9.]+)/)?.[1]);
  assert.ok(runningOpacity >= 0.24, 'initialized globe must stay clearly visible');
  const mobileRule = css.match(/@media\(max-width:720px\)\{[\s\S]*?\.boot-running \.boot-globe\{([^}]*)\}/)?.[1] || '';
  const mobileOpacity = Number(mobileRule.match(/opacity:\s*([0-9.]+)/)?.[1]);
  assert.ok(mobileOpacity >= 0.30, 'mobile initialized globe must remain clearly visible');
});

test('mobile shell prompt follows content instead of reserving a full-screen empty scrollback', async () => {
  const css = await read('app/shell-polish.css');
  assert.match(css, /\.unix-shell\{[^}]*justify-content:\s*flex-start/);
  assert.match(css, /\.shell-scrollback\{[^}]*flex:\s*0\s+1\s+auto/);
  assert.match(css, /\.shell-scrollback\{[^}]*max-height:\s*calc\(/);
  assert.match(css, /\.shell-prompt\{[^}]*position:\s*sticky/);
});

test('mobile header keeps the PARA11AX lockup readable while reserving space for the clock', async () => {
  const css = await read('app/shell-polish.css');
  assert.match(css, /\.shell-brand\{[^}]*max-width:\s*none/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.para11ax-logo\{[^}]*width:\s*12[0-9]px/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-status\{[^}]*grid-template-areas:[^}]*brand clock[^}]*state state/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-status\{[^}]*min-height:\s*50px/);
});

test('Vercel cuts the legacy app script over to terminal main wrapper before filesystem resolution', async () => {
  const vercel = JSON.parse(await read('vercel.json'));
  const appScriptRoute = vercel.routes.find(route => route.src === '/app/app.js');
  assert.equal(appScriptRoute?.dest, '/app/terminal-main.js');
  assert.ok(vercel.routes.indexOf(appScriptRoute) < vercel.routes.findIndex(route => route.handle === 'filesystem'));
});
