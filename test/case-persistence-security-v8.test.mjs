import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const CASE_SOURCES = Object.freeze([
  'app/case-model.js',
  'app/case-repository.js',
  'app/case-index.js',
  'app/case-bundle.js',
  'app/case-runtime.js',
  'app/case-shell-bridge.js',
  'app/indexeddb-case-storage.js',
]);

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('local case persistence never references bearer/session persistence primitives', async () => {
  for (const path of CASE_SOURCES) {
    const source = await read(path);
    assert.doesNotMatch(source, /PARA11AX_TOKEN|getToken\s*\(|Authorization|localStorage|sessionStorage/, path);
  }
});

test('local case modules contain no direct network persistence path', async () => {
  for (const path of CASE_SOURCES) {
    const source = await read(path);
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon\s*\(/, path);
  }
});

test('IndexedDB is the sole browser persistence adapter for cases', async () => {
  const storage = await read('app/indexeddb-case-storage.js');
  const repository = await read('app/case-repository.js');
  const bridge = await read('app/case-shell-bridge.js');
  assert.match(storage, /indexedDB\.open\(DB_NAME, DB_VERSION\)/);
  assert.match(storage, /para11ax-workspace-v1/);
  assert.match(storage, /STORE_NAME\s*=\s*['"]cases['"]/);
  assert.match(bridge, /createIndexedDbCaseStorage/);
  assert.match(repository, /storage\.(?:get|put|delete|list)/);
  assert.doesNotMatch(`${storage}\n${repository}\n${bridge}`, /CacheStorage|caches\.open|FileSystemHandle|showSaveFilePicker/);
});

test('active case state remains runtime-only and is never serialized as workspace metadata', async () => {
  const runtime = await read('app/case-runtime.js');
  const model = await read('app/case-model.js');
  const storage = await read('app/indexeddb-case-storage.js');
  assert.match(runtime, /let activeCaseId = null/);
  assert.doesNotMatch(model, /activeCaseId/);
  assert.doesNotMatch(storage, /activeCaseId/);
});
