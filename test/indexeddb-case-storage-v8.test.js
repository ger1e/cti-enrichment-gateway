import test from 'node:test';
import assert from 'node:assert/strict';
import { createIndexedDbCaseStorage } from '../app/indexeddb-case-storage.js';

function fakeIndexedDB() {
  const state = {
    opened: null,
    storeConfig: null,
    values: new Map(),
    failNext: null,
    openFailure: false,
  };

  const indexedDB = {
    open(name, version) {
      state.opened = { name, version };
      const request = {};
      queueMicrotask(() => {
        if (state.openFailure) {
          request.error = new Error('browser raw open failure');
          request.onerror?.({ target: request });
          return;
        }
        const db = {
          objectStoreNames: { contains: storeName => state.storeConfig?.name === storeName },
          createObjectStore(storeName, options) {
            state.storeConfig = { name: storeName, keyPath: options.keyPath };
            return {};
          },
          transaction(storeName, mode) {
            assert.equal(storeName, 'cases');
            const tx = { mode, error: null };
            const complete = () => queueMicrotask(() => tx.oncomplete?.({ target: tx }));
            const issue = (operation, arg) => {
              const req = {};
              queueMicrotask(() => {
                if (state.failNext === operation || state.failNext === 'request') {
                  state.failNext = null;
                  req.error = new Error('browser raw request failure');
                  req.onerror?.({ target: req });
                  return;
                }
                if (operation === 'get') req.result = state.values.has(arg) ? structuredClone(state.values.get(arg)) : undefined;
                if (operation === 'put') { state.values.set(arg.id, structuredClone(arg)); req.result = arg.id; }
                if (operation === 'delete') { state.values.delete(arg); req.result = undefined; }
                if (operation === 'getAll') req.result = [...state.values.values()].map(value => structuredClone(value));
                req.onsuccess?.({ target: req });
                complete();
              });
              return req;
            };
            tx.objectStore = () => ({
              get: key => issue('get', key),
              put: value => issue('put', value),
              delete: key => issue('delete', key),
              getAll: () => issue('getAll'),
            });
            return tx;
          },
          close() {},
        };
        request.result = db;
        request.onupgradeneeded?.({ target: request });
        request.onsuccess?.({ target: request });
      });
      return request;
    },
  };
  return { indexedDB, state };
}

test('adapter upgrades the fixed workspace database while preserving the cases store', async () => {
  const fake = fakeIndexedDB();
  const storage = createIndexedDbCaseStorage({ indexedDB: fake.indexedDB });
  assert.equal(await storage.get('missing'), null);
  assert.deepEqual(fake.state.opened, { name: 'para11ax-workspace-v1', version: 2 });
  assert.deepEqual(fake.state.storeConfig, { name: 'cases', keyPath: 'id' });
});

test('adapter uses readonly reads and readwrite mutations with detached values', async () => {
  const fake = fakeIndexedDB();
  const storage = createIndexedDbCaseStorage({ indexedDB: fake.indexedDB });
  const value = { id: 'case-1', title: 'Fixture' };
  await storage.put(value);
  value.title = 'outside mutation';
  assert.deepEqual(await storage.get('case-1'), { id: 'case-1', title: 'Fixture' });
  assert.deepEqual(await storage.list(), [{ id: 'case-1', title: 'Fixture' }]);
  await storage.delete('case-1');
  assert.equal(await storage.get('case-1'), null);
});

test('missing IndexedDB and raw browser failures collapse to workspace_storage_failed', async () => {
  assert.throws(() => createIndexedDbCaseStorage({ indexedDB: null }), /workspace_storage_failed/);

  const openFail = fakeIndexedDB();
  openFail.state.openFailure = true;
  const storageA = createIndexedDbCaseStorage({ indexedDB: openFail.indexedDB });
  await assert.rejects(() => storageA.list(), error => error.message === 'workspace_storage_failed');

  const requestFail = fakeIndexedDB();
  const storageB = createIndexedDbCaseStorage({ indexedDB: requestFail.indexedDB });
  await storageB.list();
  requestFail.state.failNext = 'get';
  await assert.rejects(() => storageB.get('x'), error => error.message === 'workspace_storage_failed' && !error.message.includes('browser raw'));
});
