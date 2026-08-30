export function makeSession({ authenticated = true } = {}) {
  let token = authenticated ? 'fixture-token' : null;
  return {
    snapshot: () => ({ mode: token ? 'ready' : 'locked', hasToken: Boolean(token) }),
    setToken: value => { token = value; },
    unlock: () => {},
    startRequest: () => {},
    completeRequest: () => {},
    failRequest: () => {},
    reset: () => {},
    disconnect: () => { token = null; },
  };
}

export function makeAudio() {
  return { enable: async () => {}, mute: () => {}, play: () => {}, typing: () => {}, setVolume: () => {} };
}

export function makeEnvelope(indicator = '8.8.8.8') {
  return {
    schemaVersion: '2.0',
    gatewayVersion: 'test',
    requestId: 'req-1',
    indicator,
    type: 'ip',
    profile: 'standard',
    status: 'ok',
    queriedAt: '2026-08-30T00:00:00.000Z',
    durationMs: 1,
    evidence: [],
    failures: [],
    relationships: [],
    correlation: { contradictions: [], corroboration: [], limitations: [] },
    coverage: {},
    decision: {},
    guidance: {},
    evidenceGraph: { nodes: [], edges: [], counts: { nodes: 0, edges: 0 } },
  };
}

export function makeRichEnvelope() {
  const value = makeEnvelope();
  value.evidence = [
    { provider: 'virustotal', observation: { verdict: 'malicious', confidence: 0.95 }, references: [] },
    { provider: 'greynoise', observation: { verdict: 'unknown', confidence: 0.70 }, references: [] },
  ];
  value.relationships = [{ type: 'resolves_to', target: '1.1.1.1', provider: 'virustotal' }];
  value.evidenceGraph = { nodes: [{ id: 'observable:fixture', type: 'observable' }], edges: [], counts: { nodes: 1, edges: 0 } };
  value.guidance = { disposition: 'investigate', confidence: 'medium', hunts: [], attackMappings: [], telemetry: {} };
  return value;
}

export function makeClient(overrides = {}) {
  return {
    health: async () => ({ status: 'ok' }),
    status: async () => ({ status: 'ok' }),
    meta: async () => ({ providers: [] }),
    enrich: async indicator => makeEnvelope(indicator),
    batch: async () => ({ requestId: 'b1', results: [] }),
    shodan: async () => ({ requestId: 's1', command: 'info', creditImpact: 'none', durationMs: 1, data: {} }),
    userScanner: async () => ({ scanId: 'u1', durationMs: 1, summary: { totalScanned: 0, found: 0, errors: 0 }, results: [], erroredSites: [] }),
    provider: async (_provider, indicator) => makeEnvelope(indicator),
    stix: async () => ({ type: 'bundle', objects: [] }),
    ...overrides,
  };
}

export function makeProviderAdapter({ name = 'unit-provider', types = ['ip'], active = true, run = async () => ({ kind: 'fixture_context', verdict: 'unknown' }) } = {}) {
  return {
    name,
    types,
    active,
    observationTypes: ['fixture_context'],
    cacheTtlMs: 1000,
    negativeCacheTtlMs: 100,
    costClass: 'free',
    tier: 1,
    timeoutMs: 100,
    maxResponseBytes: 2048,
    fixedHosts: ['example.test'],
    parserVersion: '1',
    sourceUrl: 'https://example.test/docs',
    run,
  };
}
