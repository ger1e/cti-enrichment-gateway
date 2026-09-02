import {
  createInvestigation,
  importInvestigation,
  migrateCaseToInvestigation,
  reduceInvestigation,
} from '../src/core/investigation/index.js';

const clone = value => structuredClone(value);

function fail(code) {
  const error = new Error(code === 'INVESTIGATION_ALREADY_EXISTS' ? `${code}: investigation already exists` : code);
  error.code = code;
  throw error;
}

export function createInvestigationRepository({
  storage,
  now = () => new Date().toISOString(),
  uuid = () => crypto.randomUUID(),
} = {}) {
  if (!storage || ['get', 'put', 'delete', 'list'].some(name => typeof storage[name] !== 'function')) {
    throw new TypeError('investigation storage required');
  }
  let mutationTail = Promise.resolve();

  function serialize(operation) {
    const result = mutationTail.then(operation, operation);
    mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  async function get(id) {
    const stored = await storage.get(id);
    if (stored == null) return null;
    if (stored.schemaVersion === '1.0') {
      const migrated = migrateCaseToInvestigation(stored, { now });
      await storage.put(clone(migrated));
      return clone(migrated);
    }
    return clone(importInvestigation(stored));
  }

  async function requireExisting(id) {
    const value = await get(id);
    if (!value) fail('INVESTIGATION_NOT_FOUND');
    return value;
  }

  async function persist(value) {
    const validated = importInvestigation(value);
    await storage.put(clone(validated));
    return clone(validated);
  }

  return Object.freeze({
    create(title) {
      return serialize(async () => {
        const value = createInvestigation({ title, now, uuid });
        if (await storage.get(value.id)) fail('INVESTIGATION_ALREADY_EXISTS');
        return persist(value);
      });
    },

    get,

    async list() {
      const results = [];
      for (const stored of await storage.list()) {
        results.push(stored?.schemaVersion === '1.0' ? await get(stored.id) : clone(importInvestigation(stored)));
      }
      return results.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)) || String(left.id).localeCompare(String(right.id)));
    },

    save(value, { overwrite = false } = {}) {
      const detached = clone(value);
      return serialize(async () => {
        const validated = importInvestigation(detached);
        if (!overwrite && await storage.get(validated.id)) fail('INVESTIGATION_ALREADY_EXISTS');
        return persist(validated);
      });
    },

    remove(id) {
      return serialize(() => storage.delete(id));
    },

    mutate(id, action, dependencies = {}) {
      const detached = clone(action);
      return serialize(async () => {
        const current = await requireExisting(id);
        const next = reduceInvestigation(current, detached, { now, uuid, ...dependencies });
        return persist(next);
      });
    },

    migrateLegacy() {
      return serialize(async () => {
        const migrated = [];
        for (const value of await storage.list()) {
          if (value?.schemaVersion !== '1.0') continue;
          const next = migrateCaseToInvestigation(value, { now });
          await storage.put(clone(next));
          migrated.push(clone(next));
        }
        return migrated;
      });
    },
  });
}
