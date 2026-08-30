import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('terminal main preserves v7 prepaint ownership and retains the workspace module after terminal entry', async () => {
  const source = await read('app/terminal-main.js');
  const entryIndex = source.indexOf("await import('./terminal-entry.js')");
  const bridgeIndex = source.indexOf("await import('./case-shell-bridge.js')");
  assert.match(source, /document\.documentElement\.dataset\.terminalFirst\s*=\s*['"]v7['"]/);
  assert.doesNotMatch(source, /PREPAINT_STYLES|prepaintMarker|marker\.rel\s*=\s*['"]preload['"]/, 'terminal main must not schedule stylesheet work after v7 prepaint');
  assert.ok(entryIndex >= 0);
  assert.ok(bridgeIndex > entryIndex, 'workspace compatibility import remains after terminal-entry');
});

test('gateway client exposes observer hooks without exposing bearer material', async () => {
  const source = await read('app/api-client.js');
  assert.match(source, /addGatewayEnrichmentObserver/);
  assert.match(source, /getLatestGatewayClient/);
  assert.match(source, /notifyEnrichmentObservers/);
  assert.doesNotMatch(source, /getLatestGatewayToken|latestToken|export\s+(?:function|const|let|var)\s+getToken\b/);
});

test('case bridge owns local workspace storage import download and capture but no shell parser', async () => {
  const source = await read('app/case-shell-bridge.js');
  assert.match(source, /createIndexedDbCaseStorage/);
  assert.match(source, /createCaseRepository/);
  assert.match(source, /createCaseRuntime/);
  assert.match(source, /caseShellAdapter/);
  assert.match(source, /addGatewayEnrichmentObserver/);
  assert.match(source, /id\s*=\s*['"]case-import['"]/);
  assert.match(source, /type\s*=\s*['"]file['"]/);
  assert.match(source, /\.para11ax,application\/vnd\.para11ax\.case\+json/);
  assert.match(source, /hidden\s*=\s*true/);
  assert.doesNotMatch(source, /interpretCommand|addEventListener\(\s*['"]submit['"]/);
  assert.doesNotMatch(source, /PARA11AX_TOKEN|getToken\(|Authorization|localStorage|sessionStorage/);
});

test('shared browser execution boundary resets memory-only active case state on disconnect and reboot', async () => {
  const bridge = await read('app/case-shell-bridge.js');
  const executor = await read('app/shell-browser-executor.js');
  const ui = await read('app/shell-ui.js');
  assert.match(bridge, /reset\(\)\s*\{/);
  assert.match(executor, /cases\?\.reset\?\.\(\)/);
  assert.match(ui, /action\.action\s*===\s*['"]disconnect['"]/);
  assert.match(ui, /action\.action\s*===\s*['"]reboot['"]/);
  assert.match(ui, /caseShellAdapter\.reset\(\)/);
});

test('case bridge surfaces capture warnings without replacing gateway results', async () => {
  const source = await read('app/case-shell-bridge.js');
  assert.match(source, /captureResult\(result\)/);
  assert.match(source, /case capture failed; enrichment result remains valid/);
  assert.doesNotMatch(source, /result\s*=\s*.*warning/);
});
