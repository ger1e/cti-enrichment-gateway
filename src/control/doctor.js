import { PROVIDER_MANIFEST, providerSecretNames } from '../providers/manifest.js';

const REQUIRED_NODE_MAJOR = 24;

export function collectDoctorState(env = process.env) {
  const providerSecrets = providerSecretNames();
  const providersConfigured = providerSecrets.reduce((count, name) => count + (typeof env[name] === 'string' && env[name].length > 0 ? 1 : 0), 0);
  const nodeMajor = Number.parseInt(process.versions.node.split('.', 1)[0], 10);
  return Object.freeze({
    node: Object.freeze({
      ok: nodeMajor === REQUIRED_NODE_MAJOR,
      major: nodeMajor,
      requiredMajor: REQUIRED_NODE_MAJOR,
    }),
    manifest: Object.freeze({
      ok: Object.keys(PROVIDER_MANIFEST).length > 0,
      providerCount: Object.keys(PROVIDER_MANIFEST).length,
      credentialedProviderCount: providerSecrets.length,
    }),
    configuration: Object.freeze({
      providersConfigured,
      gatewayTokenConfigured: typeof env.PARA11AX_TOKEN === 'string' && env.PARA11AX_TOKEN.length > 0,
      observabilityConfigured: typeof env.SENTRY_AUTH_TOKEN === 'string' && env.SENTRY_AUTH_TOKEN.length > 0,
    }),
  });
}
