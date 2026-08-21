function frozenStrings(values) {
  return Object.freeze([...values].map(String));
}

function entry(adapter) {
  return Object.freeze({
    name: adapter.name,
    types: frozenStrings(adapter.types),
    observationTypes: frozenStrings(adapter.observationTypes),
    requiresCredential: Boolean(adapter.requiredEnv),
    credentialEnv: adapter.requiredEnv ?? adapter.optionalEnv ?? null,
    optionalCredential: Boolean(adapter.optionalEnv),
    costClass: adapter.costClass,
    tier: adapter.tier,
    timeoutMs: adapter.timeoutMs,
    cacheTtlMs: adapter.cacheTtlMs,
    negativeCacheTtlMs: adapter.negativeCacheTtlMs,
    maxResponseBytes: adapter.maxResponseBytes,
    fixedHosts: frozenStrings(adapter.fixedHosts),
    parserVersion: adapter.parserVersion,
    sourceUrl: adapter.sourceUrl,
    active: adapter.active !== false,
  });
}

export function manifestForRegistry(registry) {
  if (!registry || typeof registry.names !== 'function' || typeof registry.get !== 'function') {
    throw new TypeError('provider registry is required');
  }
  return Object.freeze(registry.names().map(name => entry(registry.get(name))));
}
