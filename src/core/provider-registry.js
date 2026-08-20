function assertAdapter(adapter) {
  if (!adapter || typeof adapter.name !== 'string' || !adapter.name) throw new TypeError('provider name is required');
  if (!Array.isArray(adapter.types) || adapter.types.length === 0) throw new TypeError(`provider ${adapter.name} must declare types`);
  if (typeof adapter.run !== 'function') throw new TypeError(`provider ${adapter.name} must implement run`);
}

export function createProviderRegistry(adapters = []) {
  const providers = new Map();
  for (const adapter of adapters) {
    assertAdapter(adapter);
    if (providers.has(adapter.name)) throw new Error(`duplicate provider: ${adapter.name}`);
    providers.set(adapter.name, Object.freeze({ ...adapter }));
  }
  return Object.freeze({
    get(name) { return providers.get(name); },
    names() { return [...providers.keys()]; },
    forType(type) { return [...providers.values()].filter(provider => provider.types.includes(type)); },
  });
}
