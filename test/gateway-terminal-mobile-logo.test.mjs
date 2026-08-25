import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const url = path => new URL(`../${path}`, import.meta.url);
const read = path => readFile(url(path), 'utf8');

test('Gateway Terminal restores one canonical PARA11AX logo on boot and shell surfaces', async () => {
  const logoExists = await access(url('app/para11ax-mark.svg')).then(() => true, () => false);
  const polishExists = await access(url('app/terminal-polish.js')).then(() => true, () => false);
  assert.equal(logoExists, true, 'canonical PARA11AX SVG logo must exist');
  assert.equal(polishExists, true, 'terminal polish module must exist');
  const [polish, css] = await Promise.all([read('app/terminal-polish.js'), read('app/shell-polish.css')]);
  assert.match(polish, /\/app\/para11ax-mark\.svg/);
  assert.match(polish, /boot-brand-lockup/);
  assert.match(polish, /shell-logo/);
  assert.match(css, /\.para11ax-logo\{/);
  assert.match(css, /\.boot-brand-lockup\{/);
  assert.match(css, /\.shell-logo\{/);
});

test('PARA11AX logo asset uses the universal cyan red and white semantic palette', async () => {
  const logoExists = await access(url('app/para11ax-mark.svg')).then(() => true, () => false);
  assert.equal(logoExists, true, 'canonical PARA11AX SVG logo must exist');
  const svg = await read('app/para11ax-mark.svg');
  assert.match(svg, /viewBox=/);
  assert.match(svg, /#00E5FF/i);
  assert.match(svg, /#FF1E2D/i);
  assert.match(svg, /#F3F7FA/i);
  assert.match(svg, /PARA11AX/);
  assert.doesNotMatch(svg, /(?:href|src)\s*=\s*["']https?:\/\//i, 'logo must not load external resources');
});

test('wireframe globe remains continuously visible from initialize until gateway ready', async () => {
  const [polish, css] = await Promise.all([read('app/terminal-polish.js'), read('app/shell-polish.css')]);
  assert.match(polish, /classList\.add\(['"]boot-running['"]\)/);
  assert.match(polish, /classList\.remove\(['"]boot-running['"]\)/);
  assert.match(css, /\.boot-running \.boot-globe\{[^}]*opacity:\s*\.1/);
});

test('mobile shell prompt follows content instead of reserving a full-screen empty scrollback', async () => {
  const css = await read('app/shell-polish.css');
  assert.match(css, /\.unix-shell\{[^}]*justify-content:\s*flex-start/);
  assert.match(css, /\.shell-scrollback\{[^}]*flex:\s*0\s+1\s+auto/);
  assert.match(css, /\.shell-scrollback\{[^}]*max-height:\s*calc\(/);
  assert.match(css, /\.shell-prompt\{[^}]*position:\s*sticky/);
});

test('mobile header keeps the PARA11AX lockup readable without truncating the brand', async () => {
  const css = await read('app/shell-polish.css');
  assert.match(css, /\.shell-brand\{[^}]*max-width:\s*none/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.para11ax-logo\{[^}]*width:\s*12[0-9]px/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-status\{[^}]*min-height:\s*38px/);
});

test('Vercel cuts the legacy app script over to terminal main wrapper before filesystem resolution', async () => {
  const vercel = JSON.parse(await read('vercel.json'));
  const appScriptRoute = vercel.routes.find(route => route.src === '/app/app.js');
  assert.equal(appScriptRoute?.dest, '/app/terminal-main.js');
  assert.ok(vercel.routes.indexOf(appScriptRoute) < vercel.routes.findIndex(route => route.handle === 'filesystem'));
});
