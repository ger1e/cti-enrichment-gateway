export const EXECUTION_POLICY_VERSION = 'v8.1';
export const PROVIDER_CONCURRENCY_MAX = 4;
export const PROVIDER_MAX_ATTEMPTS = 2;
export const REQUEST_DEADLINE_MS = 20_000;

export const EXECUTION_POLICY = Object.freeze({
  version: EXECUTION_POLICY_VERSION,
  providerConcurrencyMax: PROVIDER_CONCURRENCY_MAX,
  providerMaxAttempts: PROVIDER_MAX_ATTEMPTS,
  requestDeadlineMs: REQUEST_DEADLINE_MS,
});
