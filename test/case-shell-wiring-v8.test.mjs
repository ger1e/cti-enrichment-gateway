import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('terminal main loads the local case bridge after the shell entrypoint', async () => {
  const source = await read('app/terminal-main.js');
  const entryIndex = source.indexOf("import './terminal-entry.js'");
  const bridgeIndex = source.indexOf("import './case-shell-bridge.js'");
  assert.ok(entryIndex >= 0);
  assert.ok(bridgeIndex > entryIndex, 'case bridge must attach after terminal-entry creates the gateway client');
});

test('gateway client exposes observer hooks without exposing bearer material', async () => {
  const source = await read('app/api-client.js');
  assert.match(source, /addGatewayEnrichmentObserver/);
  assert.match(source, /getLatestGatewayClient/);
  assert.match(source, /notifyEnrichmentObservers/);
  assert.doesNotMatch(source, /getLatestGatewayToken|latestToken|export\s+(?:function|const|let|var)\s+getToken\b/);
});

test('case bridge owns only local workspace state and exact hidden bundle input', async () => {
  const source = await read('app/case-shell-bridge.js');
  assert.match(source, /createIndexedDbCaseStorage/);
  assert.match(source, /createCaseRepository/);
  assert.match(source, /createCaseRuntime/);
  assert.match(source, /interpretCommand/);
  assert.match(source, /addGatewayEnrichmentObserver/);
  assert.match(source, /id\s*=\s*['"]case-import['"]/);
  assert.match(source, /type\s*=\s*['"]file['"]/);
  assert.match(source, /\.para11ax,application\/vnd\.para11ax\.case\+json/);
  assert.match(source, /hidden\s*=\s*true/);
  assert.doesNotMatch(source, /PARA11AX_TOKEN|getToken\(|Authorization|localStorage|sessionStorage/);
});

test('case bridge resets memory-only active state on disconnect and reboot', async () => {
  const source = await read('app/case-shell-bridge.js');
  assert.match(source, /action\.action\s*===\s*['"]disconnect['"]/);
  assert.match(source, /action\.action\s*===\s*['"]reboot['"]/);
  assert.match(source, /runtime\?\.reset\(\)/);
});

test('case bridge surfaces capture warnings without replacing gateway results', async () => {
  const source = await read('app/case-shell-bridge.js');
  assert.match(source, /captureResult\(result\)/);
  assert.match(source, /case capture failed; enrichment result remains valid/);
  assert.doesNotMatch(source, /result\s*=\s*.*warning/);
});
