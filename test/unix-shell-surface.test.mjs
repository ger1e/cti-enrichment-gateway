import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('browser cuts legacy app asset over to PARA11AX terminal wrapper before filesystem resolution', async () => {
  const html = await read('app/index.html');
  const vercel = JSON.parse(await read('vercel.json'));
  const main = await read('app/terminal-main.js');
  const entry = await read('app/terminal-entry.js');
  assert.match(html, /<script\s+type="module"\s+src="\/app\/app\.js"/);
  const rewriteIndex = vercel.routes.findIndex(route => route.src === '/app/app.js' && route.dest === '/app/terminal-main.js');
  const filesystemIndex = vercel.routes.findIndex(route => route.handle === 'filesystem');
  assert.ok(rewriteIndex >= 0 && rewriteIndex < filesystemIndex, 'terminal asset rewrite must run before filesystem');
  assert.match(main, /import ['"]\.\/terminal-entry\.js['"]/);
  assert.match(main, /import ['"]\.\/terminal-polish\.js['"]/);
  assert.match(entry, /\/app\/shell\.css/);
});

test('boot uses PARA11AX-native services, dense OK statuses, kernel timestamps, target readiness and 56k stage', async () => {
  const source = await read('app/boot.js');
  const entry = await read('app/terminal-entry.js');
  assert.match(source, /PARA11AX kernel 2\.0\.0 booting/);
  assert.match(source, /\[\s*0\.\d+\]/);
  assert.match(source, /pxsvc\[evidence-v2\]/);
  assert.match(source, /pxsvc\[semantic-firewall\]/);
  assert.match(source, /pxsvc\[provider-registry\]/);
  assert.match(source, /pxsvc\[gateway\]/);
  assert.match(source, /PARA11AX services online/);
  assert.ok((source.match(/\[ OK \]/g) || []).length >= 20, 'boot should present many successful PARA11AX service statuses');
  assert.match(source, /modem-56k/);
  assert.match(entry, /pxsvcd:/);
  assert.doesNotMatch(`${source}\n${entry}`, /systemd|para11ax\.service/i);
  assert.match(source, /if\s*\(reducedMotion\)\s*onStage\(['"]reduced['"]\)/);
  assert.doesNotMatch(source, /if\s*\(reducedMotion\)\s*\{[^}]*return\s+true[^}]*\}/);
});

test('interactive shell exposes the gateway prompt, secret auth mode and command scrollback', async () => {
  const source = await read('app/shell-ui.js');
  const css = await read('app/shell.css');
  assert.match(source, /para11ax@gateway:~\$/);
  assert.doesNotMatch(source, /para11ax@terminal:~\$/);
  assert.match(source, /hostname['"]\) appendLine\(['"]gateway['"]\)/);
  assert.match(source, /runEnrichmentOperation/);
  assert.match(source, /type\s*=\s*['"]password['"]/);
  assert.match(source, /shell-scrollback/);
  assert.match(source, /shell-prompt/);
  assert.match(css, /\.shell-scrollback/);
  assert.match(css, /\.shell-prompt[^}]*position:sticky/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-prompt/);
});

test('shell keyboard maxxing includes history autocomplete cancellation and line editing controls', async () => {
  const source = await read('app/shell-ui.js');
  for (const token of ['ArrowUp','ArrowDown','Tab','Ctrl+L','Ctrl+C','Ctrl+U','Ctrl+W','Home','End','Escape']) {
    assert.ok(source.includes(token), `missing terminal control ${token}`);
  }
});

test('new terminal runtime keeps auth volatile and forbids dynamic execution/storage', async () => {
  const source = `${await read('app/terminal-entry.js')}\n${await read('app/shell-ui.js')}\n${await read('app/shell.js')}`;
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(/);
  assert.doesNotMatch(source, /fetch\s*\(\s*[^'"`]/, 'arbitrary dynamic fetch must not appear in shell runtime');
});
