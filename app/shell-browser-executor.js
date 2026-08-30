import { shellError } from './shell-core/errors.js';

const PROFILES = new Set(['fast', 'standard', 'full']);
const SHODAN_COMMANDS = new Set(['host', 'search', 'count', 'stats', 'domain', 'info']);
const RESULT_REQUIRED = new Set([
  'result-summary','result-request','result-evidence','result-facts','result-providers','result-failures',
  'result-contradictions','result-corroboration','result-references','result-relationships','result-coverage',
  'result-correlation','result-graph','result-guidance','result-decision','result-attacks','result-hunts',
  'result-telemetry','result-freshness','result-raw','view','json','stix','copy',
]);

function text(value) { return { type: 'text', value: String(value ?? '') }; }
function record(value) { return { type: 'record', value }; }
function records(value) { return { type: 'records', value: Array.isArray(value) ? value : [] }; }

function invalid(message, context = undefined) {
  throw shellError('INVALID_ARGUMENT', message, context);
}

function parseProfile(args, fallback) {
  if (!args.length) return fallback;
  if (args.length !== 1) invalid('profile accepts one value');
  const raw = String(args[0]);
  const value = raw.startsWith('--') ? raw.slice(2) : raw;
  if (!PROFILES.has(value)) invalid('profile must be fast, standard, or full');
  return value;
}

function parseEnrichArgs(args, fallbackProfile) {
  if (!args.length || args.length > 2) invalid('usage: enrich <observable> [--fast|--standard|--full]');
  const indicator = String(args[0] ?? '').trim();
  if (!indicator) invalid('observable required');
  return { indicator, profile: args.length === 2 ? parseProfile([args[1]], fallbackProfile) : fallbackProfile };
}

function parseUserScannerArgs(args) {
  if (args.length < 2) invalid('usage: user-scanner <email|username> <target> [options]');
  const scanType = String(args[0]).toLowerCase();
  const target = String(args[1] ?? '').trim();
  if (!['email', 'username'].includes(scanType) || !target) invalid('user-scanner requires email or username target');
  let category = null;
  let module = null;
  let crossScan = false;
  let noNsfw = true;
  for (let index = 2; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--cross-scan') { crossScan = true; continue; }
    if (token === '--include-nsfw') { noNsfw = false; continue; }
    if (token === '--category' || token === '--module') {
      const value = args[index + 1];
      if (!value || String(value).startsWith('--') || !/^[a-z0-9._-]{1,64}$/i.test(String(value))) invalid(`${token} requires a safe value`);
      if (token === '--category') category = String(value);
      else module = String(value).replace(/\./g, '_');
      index += 1;
      continue;
    }
    invalid(`unsupported user-scanner option: ${token}`);
  }
  if (category && module) invalid('user-scanner category and module are mutually exclusive');
  return { scanType, target, category, module, crossScan, noNsfw };
}

function parseShodanArgs(args) {
  const command = String(args[0] ?? '').toLowerCase();
  if (!SHODAN_COMMANDS.has(command)) invalid('usage: shodan <host|search|count|stats|domain|info> ...');
  if (command === 'info') {
    if (args.length !== 1) invalid('usage: shodan info');
    return { command, target: null, query: null, facets: null };
  }
  if (command === 'host') {
    const target = String(args[1] ?? '').trim();
    if (args.length !== 2 || !target || target.length > 64 || !/^[0-9a-f:.]+$/i.test(target) || (!target.includes('.') && !target.includes(':'))) invalid('usage: shodan host <ip>');
    return { command, target, query: null, facets: null };
  }
  if (command === 'domain') {
    const target = String(args[1] ?? '').trim().toLowerCase().replace(/\.$/, '');
    if (args.length !== 2 || !target || target.length > 253 || !/^[a-z0-9.-]+$/i.test(target) || !target.includes('.') || target.includes('..')) invalid('usage: shodan domain <domain>');
    return { command, target, query: null, facets: null };
  }
  if (command === 'search' || command === 'count') {
    const parts = args.slice(1);
    if (!parts.length || parts.some(token => String(token).startsWith('--'))) invalid(`usage: shodan ${command} <query>`);
    const query = parts.join(' ').trim();
    if (!query || query.length > 1024) invalid('Shodan query must be 1..1024 characters');
    return { command, target: null, query, facets: null };
  }
  const queryParts = [];
  let facets = null;
  for (let index = 1; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--facets') {
      if (facets !== null || index + 1 >= args.length || index + 2 !== args.length) invalid('usage: shodan stats <query> [--facets <fields>]');
      facets = String(args[index + 1]);
      if (!/^[a-z0-9_.-]+(?::[1-9]\d{0,2})?(?:,[a-z0-9_.-]+(?::[1-9]\d{0,2})?)*$/i.test(facets) || facets.length > 256) invalid('invalid Shodan facets');
      index += 1;
      continue;
    }
    if (String(token).startsWith('--')) invalid(`unsupported Shodan option: ${token}`);
    queryParts.push(token);
  }
  const query = queryParts.join(' ').trim();
  if (!query || query.length > 1024) invalid('usage: shodan stats <query> [--facets <fields>]');
  return { command, target: null, query, facets };
}

function resultOrInput(state, input) {
  if (input && input.type === 'enrichment') return input.value;
  return state.currentResult;
}

export function createBrowserShellExecutor({
  client,
  session,
  cases = null,
  downloads = { save: () => {} },
  clipboard = { writeText: async () => {} },
  audio = {},
  now = () => new Date(),
  monotonicNow = () => 0,
  version = 'unknown',
  initialState = {},
} = {}) {
  if (!client || typeof client !== 'object') throw new TypeError('browser shell client required');
  if (!session || typeof session !== 'object') throw new TypeError('browser shell session required');
  const startedAt = Number(monotonicNow()) || 0;
  const state = {
    profile: PROFILES.has(initialState.profile) ? initialState.profile : 'standard',
    currentResult: initialState.currentResult ?? null,
  };

  const snapshot = () => Object.freeze({ profile: state.profile, currentResult: state.currentResult, startedAt, version });

  async function execute({ descriptor, args = [], input = { type: 'void', value: null }, context = {}, signal } = {}) {
    if (!descriptor || typeof descriptor.handler !== 'string') throw new TypeError('command descriptor required');
    const handler = descriptor.handler;
    if (RESULT_REQUIRED.has(handler) && !resultOrInput(state, input)) invalid('no current enrichment result');

    if (handler === 'enrich') {
      const request = parseEnrichArgs(args, state.profile);
      const value = await client.enrich(request.indicator, request.profile, signal);
      state.currentResult = value;
      return { type: 'enrichment', value };
    }
    if (handler === 'profile') {
      if (!args.length) return text(`profile: ${state.profile}`);
      state.profile = parseProfile(args, state.profile);
      return text(`profile: ${state.profile}`);
    }
    if (handler === 'batch') {
      if (args.length < 1 || args.length > 20) invalid('batch accepts 1..20 observables');
      const value = await client.batch(args.map(String), state.profile, signal);
      return record(value);
    }
    if (handler === 'health') return record(await client.health(signal));
    if (handler === 'status') return record(await client.status(signal));
    if (handler === 'meta') return record(await client.meta(signal));
    if (handler === 'shodan') return record(await client.shodan(parseShodanArgs(args), signal));
    if (handler === 'user-scanner') return record(await client.userScanner(parseUserScannerArgs(args), signal));

    if (handler === 'result-summary') return text(JSON.stringify(resultOrInput(state, input)));
    if (handler === 'result-request') {
      const value = resultOrInput(state, input);
      return record({ requestId: value.requestId, indicator: value.indicator, type: value.type, profile: value.profile, status: value.status, queriedAt: value.queriedAt, durationMs: value.durationMs });
    }
    if (handler === 'result-evidence') return { type: 'evidence', value: resultOrInput(state, input).evidence ?? [] };
    if (handler === 'result-failures') return records(resultOrInput(state, input).failures);
    if (handler === 'result-relationships') return { type: 'relationships', value: resultOrInput(state, input).relationships ?? [] };
    if (handler === 'result-coverage') return record(resultOrInput(state, input).coverage ?? {});
    if (handler === 'result-correlation') return record(resultOrInput(state, input).correlation ?? {});
    if (handler === 'result-graph') return { type: 'graph', value: resultOrInput(state, input).evidenceGraph ?? { nodes: [], edges: [] } };
    if (handler === 'result-guidance') return { type: 'guidance', value: resultOrInput(state, input).guidance ?? {} };
    if (handler === 'result-decision') return record(resultOrInput(state, input).decision ?? {});
    if (handler === 'result-contradictions') return records(resultOrInput(state, input).correlation?.contradictions ?? []);
    if (handler === 'result-corroboration') return records(resultOrInput(state, input).correlation?.corroboration ?? []);
    if (handler === 'result-references') {
      const refs = [];
      for (const evidence of resultOrInput(state, input).evidence ?? []) for (const reference of evidence.references ?? []) refs.push(reference);
      return records(refs);
    }
    if (handler === 'result-providers') {
      const names = [...new Set((resultOrInput(state, input).evidence ?? []).map(item => item.provider).filter(Boolean))].sort();
      return { type: 'provider-list', value: names.map(name => ({ name })) };
    }
    if (handler === 'result-facts') return records(resultOrInput(state, input).evidence ?? []);
    if (handler === 'result-attacks') return records(resultOrInput(state, input).guidance?.attackMappings ?? []);
    if (handler === 'result-hunts') return records(resultOrInput(state, input).guidance?.hunts ?? resultOrInput(state, input).decision?.hunts ?? []);
    if (handler === 'result-telemetry') return record(resultOrInput(state, input).guidance?.telemetry ?? {});
    if (handler === 'result-freshness') return records(resultOrInput(state, input).guidance?.freshness ?? []);
    if (handler === 'result-raw') return text(JSON.stringify(resultOrInput(state, input), null, 2));
    if (handler === 'view') return text(JSON.stringify(resultOrInput(state, input)));

    if (handler === 'json') {
      const serialized = JSON.stringify(resultOrInput(state, input), null, 2);
      if (args[0] === 'save') downloads.save(serialized, 'application/json', 'para11ax-evidence.json');
      return text(serialized);
    }
    if (handler === 'stix') {
      const current = resultOrInput(state, input);
      const value = await client.stix(current.indicator, current.profile ?? state.profile, signal);
      return { type: 'artifact', value };
    }
    if (handler === 'copy') {
      const current = resultOrInput(state, input);
      const target = String(args[0] ?? 'observable');
      let value;
      if (target === 'observable') value = current.indicator;
      else if (target === 'json') value = JSON.stringify(current, null, 2);
      else if (target === 'request-id') value = current.requestId;
      else if (target === 'report') value = JSON.stringify(current);
      else invalid('copy target must be observable, report, json, or request-id');
      await clipboard.writeText(String(value ?? ''));
      return text(String(value ?? ''));
    }

    if (handler === 'sound') {
      if (args.length !== 1 || !['on', 'off'].includes(args[0])) invalid('sound must be on or off');
      if (typeof audio.mute === 'function') audio.mute(args[0] === 'off');
      if (args[0] === 'on' && typeof audio.enable === 'function') await audio.enable();
      return text(`sound: ${args[0]}`);
    }
    if (handler === 'volume') {
      if (args.length !== 1 || !/^\d{1,3}$/.test(String(args[0]))) invalid('volume must be 0..100');
      const percent = Number(args[0]);
      if (percent < 0 || percent > 100) invalid('volume must be 0..100');
      if (typeof audio.setVolume === 'function') audio.setVolume(percent / 100);
      return text(`volume: ${percent}`);
    }
    if (handler === 'theme') return text('green-black CRT');
    if (handler === 'pwd') return text('/para11ax');
    if (handler === 'hostname') return text('para11ax');
    if (handler === 'date') return text(now().toString());
    if (handler === 'echo' || handler === 'printf') return text(args.join(' '));
    if (handler === 'uname') return text(`PARA11AX ${version}`);
    if (handler === 'id') return text('analyst@para11ax');
    if (handler === 'uptime') return text(String(Math.max(0, Number(monotonicNow()) - startedAt)));
    if (handler === 'version') return text(version);

    if (handler === 'disconnect' || handler === 'auth-clear') {
      session.disconnect?.();
      state.currentResult = null;
      return text('disconnected');
    }
    if (handler === 'auth-status') return text(session.snapshot?.().hasToken ? 'authenticated' : 'locked');
    if (handler === 'whoami' || handler === 'session') return record(session.snapshot?.() ?? {});
    if (handler === 'reboot') {
      session.reset?.();
      state.currentResult = null;
      return text('reboot');
    }
    if (handler === 'login') return text('hidden bearer prompt required');
    if (handler === 'clear') return text('');

    if (handler.startsWith('case-') && cases?.handle) return cases.handle({ action: handler, args }, state);

    throw shellError('CAPABILITY_UNAVAILABLE', 'browser command handler unavailable', { handler, surface: context.surface ?? 'web' });
  }

  return Object.freeze({ execute, state: snapshot });
}
