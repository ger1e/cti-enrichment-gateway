import rawManifest from '../../config/providers.json' with { type: 'json' };

const MAX_PROVIDERS = 64;
const MAX_TEXT = 512;
const REQUIRED_ARRAYS = ['types','observationTypes','fixedHosts','methods','protocols'];
const REQUIRED_NUMBERS = ['tier','timeoutMs','cacheTtlMs','negativeCacheTtlMs','maxResponseBytes'];
const COST_CLASSES = new Set(['free','quota','scarce']);
const AUTH_TYPES = new Set(['none','api_key','bearer','basic','token']);
const DISTRIBUTIONS = new Set(['internal','shareable','internal_only']);

function fail(message) {
  throw new Error(`invalid provider manifest: ${message}`);
}

function boundedText(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || value.length < 1 || value.length > MAX_TEXT) fail(field);
  return value;
}

function boundedArray(value, field) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) fail(field);
  const out = value.map((item, index) => boundedText(item, `${field}[${index}]`));
  if (new Set(out).size !== out.length) fail(`${field} duplicate`);
  return Object.freeze(out);
}

function validatePolicy(name, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(name);
  const output = { ...input };
  output.displayName = boundedText(input.displayName, `${name}.displayName`);
  if (input.credentialEnv !== null && (typeof input.credentialEnv !== 'string' || !/^[A-Z0-9_]{3,80}$/.test(input.credentialEnv))) fail(`${name}.credentialEnv`);
  output.credentialEnv = input.credentialEnv;
  if (typeof input.optionalCredential !== 'boolean') fail(`${name}.optionalCredential`);
  if (!AUTH_TYPES.has(input.authType)) fail(`${name}.authType`);
  if (input.credentialEnv === null && input.authType !== 'none') fail(`${name}.authType without credential`);
  if (input.credentialEnv !== null && input.authType === 'none') fail(`${name}.credential auth`);
  if (!COST_CLASSES.has(input.costClass)) fail(`${name}.costClass`);
  if (!DISTRIBUTIONS.has(input.distribution)) fail(`${name}.distribution`);
  if (typeof input.active !== 'boolean') fail(`${name}.active`);
  for (const field of REQUIRED_NUMBERS) {
    if (!Number.isSafeInteger(input[field]) || input[field] < 1) fail(`${name}.${field}`);
  }
  if (input.probeIntervalMs !== undefined) {
    if (!Number.isSafeInteger(input.probeIntervalMs) || input.probeIntervalMs < 0 || input.probeIntervalMs > 60_000) fail(`${name}.probeIntervalMs`);
    output.probeIntervalMs = input.probeIntervalMs;
  }
  for (const field of REQUIRED_ARRAYS) output[field] = boundedArray(input[field], `${name}.${field}`);
  output.semanticClassHints = Array.isArray(input.semanticClassHints) && input.semanticClassHints.length
    ? boundedArray(input.semanticClassHints, `${name}.semanticClassHints`)
    : Object.freeze([]);
  output.parserVersion = boundedText(input.parserVersion, `${name}.parserVersion`);
  output.sourceUrl = boundedText(input.sourceUrl, `${name}.sourceUrl`);
  try {
    const source = new URL(output.sourceUrl);
    if (source.protocol !== 'https:') fail(`${name}.sourceUrl protocol`);
  } catch {
    fail(`${name}.sourceUrl`);
  }
  for (const host of output.fixedHosts) {
    if (!/^[a-z0-9.-]+$/i.test(host) || host.includes('..')) fail(`${name}.fixedHosts`);
  }
  for (const protocol of output.protocols) if (protocol !== 'https:') fail(`${name}.protocols`);
  for (const method of output.methods) if (!['GET','POST'].includes(method)) fail(`${name}.methods`);
  return Object.freeze(output);
}

if (!rawManifest || typeof rawManifest !== 'object' || Array.isArray(rawManifest)) fail('root');
const entries = Object.entries(rawManifest);
if (entries.length < 1 || entries.length > MAX_PROVIDERS) fail('provider count');

export const PROVIDER_MANIFEST = Object.freeze(Object.fromEntries(entries.map(([name, policy]) => {
  if (!/^[a-z0-9-]{1,64}$/.test(name)) fail(`provider name ${name}`);
  return [name, validatePolicy(name, policy)];
})));

export function providerPolicy(name) {
  const policy = PROVIDER_MANIFEST[name];
  if (!policy) throw new Error(`missing provider manifest policy: ${String(name ?? 'unknown')}`);
  return policy;
}

export function providerSecretNames() {
  return Object.freeze([...new Set(Object.values(PROVIDER_MANIFEST)
    .map(policy => policy.credentialEnv)
    .filter(Boolean))].sort());
}
