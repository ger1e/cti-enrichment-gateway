import {
  createCase,
  addNote as addCaseNote,
  addPin as addCasePin,
  removePin as removeCasePin,
  appendSnapshot,
  validateCaseValue,
} from './case-model.js';

const clone = value => structuredClone(value);
const fail = code => { throw new Error(code); };

export function createCaseRepository({ storage, now = () => new Date().toISOString(), uuid = () => crypto.randomUUID() } = {}) {
  if (!storage || ['get', 'put', 'delete', 'list'].some(name => typeof storage[name] !== 'function')) {
    throw new TypeError('case storage required');
  }

  let mutationTail = Promise.resolve();

  function mutate(operation) {
    const result = mutationTail.then(operation, operation);
    mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  async function get(id) {
    const value = await storage.get(id);
    return value == null ? null : clone(value);
  }

  async function requireExisting(id) {
    const value = await get(id);
    if (!value) fail('case_not_found');
    return value;
  }

  async function persist(value) {
    validateCaseValue(value);
    const detached = clone(value);
    await storage.put(detached);
    return clone(detached);
  }

  return Object.freeze({
    create(title) {
      return mutate(() => persist(createCase({ title, now, uuid })));
    },

    get,

    async list() {
      const values = (await storage.list()).filter(value => value?.schemaVersion === '1.0').map(clone);
      values.sort((a, b) => {
        const updated = String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''));
        return updated || String(a.id ?? '').localeCompare(String(b.id ?? ''));
      });
      return values;
    },

    save(value) {
      const detached = clone(value);
      return mutate(() => persist(detached));
    },

    remove(id) {
      return mutate(() => storage.delete(id));
    },

    addNote(id, text) {
      return mutate(async () => {
        const current = await requireExisting(id);
        return persist(addCaseNote(current, text, { now, uuid }));
      });
    },

    addPin(id, observable) {
      const detached = clone(observable);
      return mutate(async () => {
        const current = await requireExisting(id);
        return persist(addCasePin(current, detached, { now }));
      });
    },

    removePin(id, observable) {
      const detached = clone(observable);
      return mutate(async () => {
        const current = await requireExisting(id);
        return persist(removeCasePin(current, detached, { now }));
      });
    },

    capture(id, enrichment) {
      const detached = clone(enrichment);
      return mutate(async () => {
        const current = await requireExisting(id);
        return persist(appendSnapshot(current, detached, { now, uuid }));
      });
    },
  });
}
