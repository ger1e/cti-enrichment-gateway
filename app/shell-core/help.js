import { COMMAND_REGISTRY } from './catalog.js';
import { PIPELINE_LIMITS } from './types.js';

function surfaceTag(descriptor) {
  if (descriptor.surfaces.length === 1 && descriptor.surfaces[0] === 'cli') return '[CLI ONLY]';
  if (descriptor.surfaces.length === 1 && descriptor.surfaces[0] === 'web') return '[WEB ONLY]';
  return '';
}

function resolveQuery(query) {
  const tokens = Array.isArray(query)
    ? query
    : String(query ?? '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  return COMMAND_REGISTRY.resolve(tokens, null);
}

export function renderCommandIndex(namespace = null) {
  const items = namespace ? COMMAND_REGISTRY.byNamespace(namespace) : COMMAND_REGISTRY.all();
  return items
    .map(descriptor => `${descriptor.usage}${surfaceTag(descriptor) ? `  ${surfaceTag(descriptor)}` : ''} — ${descriptor.summary}`)
    .join('\n');
}

export function renderManual(query) {
  const resolved = resolveQuery(query);
  if (!resolved) return `no manual entry for ${String(query ?? '').trim()}`;
  const descriptor = resolved.descriptor;
  const lines = [
    descriptor.usage,
    surfaceTag(descriptor),
    descriptor.summary,
    `namespace: ${descriptor.namespace}`,
    `auth: ${descriptor.auth}`,
    `egress: ${descriptor.egressClass}`,
    `side-effect: ${descriptor.sideEffect}`,
  ].filter(Boolean);
  if (descriptor.provider) lines.push(`provider: ${descriptor.provider}`);
  if (descriptor.capabilities.length) lines.push(`capabilities: ${descriptor.capabilities.join(', ')}`);
  if (descriptor.aliases.length) lines.push(`aliases: ${descriptor.aliases.map(alias => alias.join(' ')).join(', ')}`);
  return lines.join('\n');
}

export function searchCommands(term) {
  const needle = String(term ?? '').trim().toLowerCase();
  if (!needle) return Object.freeze([]);
  return Object.freeze(COMMAND_REGISTRY.all()
    .filter(descriptor => [descriptor.id, descriptor.usage, descriptor.summary, descriptor.namespace, descriptor.provider ?? '']
      .some(value => String(value).toLowerCase().includes(needle)))
    .map(descriptor => Object.freeze({
      id: descriptor.id,
      command: descriptor.tokens.join(' '),
      usage: descriptor.usage,
      summary: descriptor.summary,
      surfaces: descriptor.surfaces,
    })));
}

export function whichCommand(query) {
  const resolved = resolveQuery(query);
  if (!resolved) return `${String(query ?? '').trim()}: command not found`;
  const descriptor = resolved.descriptor;
  const supplied = Array.isArray(query) ? query.join(' ') : String(query).trim();
  const canonical = descriptor.tokens.join(' ');
  return supplied.toLowerCase() === canonical ? canonical : `${supplied} -> ${canonical}`;
}

export function listAliases() {
  const aliases = [];
  for (const descriptor of COMMAND_REGISTRY.all()) {
    for (const alias of descriptor.aliases) {
      aliases.push(Object.freeze({ alias: alias.join(' '), command: descriptor.tokens.join(' '), id: descriptor.id }));
    }
  }
  aliases.sort((a, b) => a.alias.localeCompare(b.alias) || a.command.localeCompare(b.command));
  return Object.freeze(aliases);
}

export function renderCapabilities({ surface = null } = {}) {
  const items = surface ? COMMAND_REGISTRY.forSurface(surface) : COMMAND_REGISTRY.all();
  return Object.freeze(items.map(descriptor => Object.freeze({
    id: descriptor.id,
    command: descriptor.tokens.join(' '),
    namespace: descriptor.namespace,
    surfaces: descriptor.surfaces,
    auth: descriptor.auth,
    inputTypes: descriptor.inputTypes,
    outputType: descriptor.outputType,
    egressClass: descriptor.egressClass,
    sideEffect: descriptor.sideEffect,
    capabilities: descriptor.capabilities,
    ...(descriptor.provider ? { provider: descriptor.provider } : {}),
  })));
}

export function renderLimits() {
  return Object.freeze({ ...PIPELINE_LIMITS });
}
