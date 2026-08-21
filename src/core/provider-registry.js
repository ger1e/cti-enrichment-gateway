const COST_CLASSES = new Set(['free', 'quota', 'scarce']);

function positiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function nonEmptyStrings(value) {
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.length > 0);
}

function assertAdapter(adapter) {
  if (!adapter || typeof adapter.name !== 'string' || !adapter.name) throw new TypeError('provider name is required');
  if (!nonEmptyStrings(adapter.types)) throw new TypeError(`provider ${adapter.name} must declare types`);
  if (!nonEmptyStrings(adapter.observationTypes)) throw new TypeError(`provider ${adapter.name} must declare observationTypes`);
  if (!COST_CLASSES.has(adapter.costClass)) throw new TypeError(`provider ${adapter.name} must declare a valid costClass`);
  if (!Number.isInteger(adapter.tier) || adapter.tier < 1 || adapter.tier > 5) throw new TypeError(`provider ${adapter.name} must declare a valid tier`);
  if (!positiveNumber(adapter.timeoutMs)) throw new TypeError(`provider ${adapter.name} must declare timeoutMs`);
  if (!positiveNumber(adapter.cacheTtlMs)) throw new TypeError(`provider ${adapter.name} must declare cacheTtlMs`);
  if (!positiveNumber(adapter.negativeCacheTtlMs)) throw new TypeError(`provider ${adapter.name} must declare negativeCacheTtlMs`);
  if (!positiveNumber(adapter.maxResponseBytes)) throw new TypeError(`provider ${adapter.name} must declare maxResponseBytes`);
  if (!nonEmptyStrings(adapter.fixedHosts)) throw new TypeError(`provider ${adapter.name} must declare fixedHosts`);
  if (typeof adapter.parserVersion !== 'string' || !adapter.parserVersion) throw new TypeError(`provider ${adapter.name} must declare parserVersion`);
  if (typeof adapter.sourceUrl !== 'string' || !adapter.sourceUrl.startsWith('https://')) throw new TypeError(`provider ${adapter.name} must declare sourceUrl`);
  if (typeof adapter.run !== 'function') throw new TypeError(`provider ${adapter.name} must implement run`);
}

export function createProviderRegistry(adapters = []) {
  const providers = new Map();
  for (const adapter of adapters) {
    assertAdapter(adapter);
    if (providers.has(adapter.name)) throw new Error(`duplicate provider: ${adapter.name}`);
    providers.set(adapter.name, Object.freeze({
      ...adapter,
      types: Object.freeze([...adapter.types]),
      observationTypes: Object.freeze([...adapter.observationTypes]),
      fixedHosts: Object.freeze([...adapter.fixedHosts]),
    }));
  }
  return Object.freeze({
    get(name) { return providers.get(name); },
    names() { return [...providers.keys()]; },
    values() { return [...providers.values()]; },
    forType(type) { return [...providers.values()].filter(provider => provider.types.includes(type)); },
  });
}
