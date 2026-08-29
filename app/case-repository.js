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
    async create(title) {
      const value = createCase({ title, now, uuid });
      return persist(value);
    },

    get,

    async list() {
      const values = (await storage.list()).map(clone);
      values.sort((a, b) => {
        const updated = String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''));
        return updated || String(a.id ?? '').localeCompare(String(b.id ?? ''));
      });
      return values;
    },

    async save(value) {
      return persist(value);
    },

    async remove(id) {
      await storage.delete(id);
    },

    async addNote(id, text) {
      const current = await requireExisting(id);
      return persist(addCaseNote(current, text, { now, uuid }));
    },

    async addPin(id, observable) {
      const current = await requireExisting(id);
      return persist(addCasePin(current, observable, { now }));
    },

    async removePin(id, observable) {
      const current = await requireExisting(id);
      return persist(removeCasePin(current, observable, { now }));
    },

    async capture(id, enrichment) {
      const current = await requireExisting(id);
      return persist(appendSnapshot(current, enrichment, { now, uuid }));
    },
  });
}
