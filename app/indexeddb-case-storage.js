const DB_NAME = 'para11ax-workspace-v1';
const DB_VERSION = 2;
const STORE_NAME = 'cases';

const clone = value => structuredClone(value);
const storageError = () => new Error('workspace_storage_failed');

export function createIndexedDbCaseStorage({ indexedDB } = {}) {
  if (!indexedDB || typeof indexedDB.open !== 'function') throw storageError();

  let databasePromise = null;

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      let request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch {
        reject(storageError());
        return;
      }
      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        } catch {
          reject(storageError());
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(storageError());
      request.onblocked = () => reject(storageError());
    }).catch(error => {
      databasePromise = null;
      throw error?.message === 'workspace_storage_failed' ? error : storageError();
    });
    return databasePromise;
  }

  async function run(mode, operation) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let tx;
      let request;
      let result;
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        reject(storageError());
      };
      try {
        tx = db.transaction(STORE_NAME, mode);
        request = operation(tx.objectStore(STORE_NAME));
      } catch {
        fail();
        return;
      }
      request.onsuccess = () => { result = request.result; };
      request.onerror = fail;
      tx.onerror = fail;
      tx.onabort = fail;
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
    });
  }

  return Object.freeze({
    async get(id) {
      const value = await run('readonly', store => store.get(id));
      return value === undefined ? null : clone(value);
    },

    async put(value) {
      const detached = clone(value);
      await run('readwrite', store => store.put(detached));
      return clone(detached);
    },

    async delete(id) {
      await run('readwrite', store => store.delete(id));
    },

    async list() {
      const values = await run('readonly', store => store.getAll());
      return (Array.isArray(values) ? values : []).map(clone);
    },
  });
}

export const INDEXEDDB_CASE_STORAGE = Object.freeze({
  database: DB_NAME,
  version: DB_VERSION,
  store: STORE_NAME,
});
