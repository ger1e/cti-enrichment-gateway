import { ALL_PROVIDERS } from '../providers/index.js';

const SAMPLE_BY_TYPE = Object.freeze({
  ip: '8.8.8.8',
  domain: 'example.com',
  url: 'https://example.com/',
  hash: '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
  cve: 'CVE-2021-44228',
  attack: 'T1059',
  asn: 'AS15169',
  cidr: '8.8.8.0/24',
});

function inputFor(provider) {
  const type = provider.types?.find(candidate => SAMPLE_BY_TYPE[candidate]);
  if (!type) return null;
  return Object.freeze({ type, value: SAMPLE_BY_TYPE[type] });
}

function configured(env, name) {
  return typeof name === 'string' && typeof env?.[name] === 'string' && env[name].trim().length > 0;
}

function classify(error) {
  const status = Number(error?.status);
  if (status === 401 || status === 403) return 'auth_failed';
  if (status === 429) return 'rate_limited';
  if (status === 408 || status === 504 || error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
  if (Number.isFinite(status) && status >= 500) return 'upstream_error';
  return 'contract_error';
}

export async function probeProvider(provider, {
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const input = inputFor(provider);
  if (!input) return Object.freeze({ provider: provider.name, status: 'unsupported_probe' });
  if (provider.requiredEnv && !configured(env, provider.requiredEnv)) {
    return Object.freeze({ provider: provider.name, status: 'unconfigured', type: input.type });
  }

  const started = Date.now();
  const timeoutMs = Math.min(Math.max(Number(provider.timeoutMs) || 5000, 1000), 15000);
  try {
    const data = await provider.run(input, {
      env,
      fetchImpl,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!data || typeof data !== 'object' || typeof data.observationType !== 'string' || !data.observationType) {
      return Object.freeze({ provider: provider.name, status: 'contract_error', type: input.type, latencyMs: Date.now() - started });
    }
    return Object.freeze({
      provider: provider.name,
      status: 'ok',
      type: input.type,
      latencyMs: Date.now() - started,
      observationType: data.observationType,
      verdict: typeof data.verdict === 'string' ? data.verdict : 'unknown',
    });
  } catch (error) {
    const status = Number(error?.status);
    return Object.freeze({
      provider: provider.name,
      status: classify(error),
      type: input.type,
      latencyMs: Date.now() - started,
      ...(Number.isFinite(status) ? { httpStatus: status } : {}),
    });
  }
}

export async function probeProviders({
  providers = ALL_PROVIDERS,
  env = process.env,
  fetchImpl = fetch,
  includeCredentialed = false,
  providerName = null,
} = {}) {
  const selected = providers
    .filter(provider => provider?.active !== false)
    .filter(provider => !providerName || provider.name === providerName)
    .filter(provider => includeCredentialed || !provider.requiredEnv);

  if (providerName && selected.length === 0) throw new Error('unknown or excluded provider');

  const output = [];
  for (const provider of selected) {
    output.push(await probeProvider(provider, { env, fetchImpl }));
  }
  return output;
}
