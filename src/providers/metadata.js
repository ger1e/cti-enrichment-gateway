import { PROVIDER_MANIFEST, providerPolicy } from './manifest.js';

export const PROVIDER_METADATA = PROVIDER_MANIFEST;

export function withProviderMetadata(adapter) {
  const policy = providerPolicy(adapter?.name);
  const credentialFields = policy.credentialEnv
    ? policy.optionalCredential
      ? { requiredEnv: undefined, optionalEnv: policy.credentialEnv }
      : { requiredEnv: policy.credentialEnv, optionalEnv: undefined }
    : { requiredEnv: undefined, optionalEnv: undefined };

  return Object.freeze({
    ...adapter,
    name: adapter.name,
    ...credentialFields,
    types: Object.freeze([...policy.types]),
    observationTypes: Object.freeze([...policy.observationTypes]),
    tier: policy.tier,
    costClass: policy.costClass,
    timeoutMs: policy.timeoutMs,
    probeIntervalMs: policy.probeIntervalMs ?? 0,
    cacheTtlMs: policy.cacheTtlMs,
    negativeCacheTtlMs: policy.negativeCacheTtlMs,
    maxResponseBytes: policy.maxResponseBytes,
    fixedHosts: Object.freeze([...policy.fixedHosts]),
    methods: Object.freeze([...policy.methods]),
    protocols: Object.freeze([...policy.protocols]),
    parserVersion: policy.parserVersion,
    sourceUrl: policy.sourceUrl,
    active: policy.active,
    distribution: policy.distribution,
    displayName: policy.displayName,
    authType: policy.authType,
    semanticClassHints: Object.freeze([...policy.semanticClassHints]),
    sourceRole: policy.sourceRole,
    freshnessClass: policy.freshnessClass,
    admissionVersion: policy.admissionVersion,
    executionPolicy: policy.executionPolicy,
  });
}
