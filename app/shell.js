import { SUPPORTED_OBSERVABLE_TYPES } from './observable-input.js';
import { COMMAND_REGISTRY } from './shell-core/catalog.js';
import { completeShellInput } from './shell-core/completion.js';

const PROFILES = Object.freeze(['fast', 'standard', 'full']);
const VIEWS = Object.freeze(['overview', 'evidence', 'correlation', 'relationships', 'coverage', 'raw']);
const USER_SCANNER_TYPES = Object.freeze(['email', 'username']);
const USER_SCANNER_FLAGS = Object.freeze(['--category', '--module', '--cross-scan', '--include-nsfw']);
const SHODAN_SUBCOMMANDS = Object.freeze(['count', 'domain', 'host', 'info', 'search', 'stats']);
const SHODAN_FLAGS = Object.freeze(['--facets']);

function compatibilityCommands() {
  const entries = new Map();
  for (const descriptor of COMMAND_REGISTRY.forSurface('web')) {
    for (const sequence of [descriptor.tokens, ...descriptor.aliases]) {
      if (sequence.length !== 1) continue;
      const name = sequence[0];
      if (!entries.has(name)) entries.set(name, Object.freeze({
        name,
        aliases: Object.freeze([]),
        category: descriptor.namespace,
        usage: descriptor.usage,
        summary: descriptor.summary,
      }));
    }
    if (descriptor.tokens.length > 1) {
      const root = descriptor.tokens[0];
      if (!entries.has(root)) entries.set(root, Object.freeze({
        name: root,
        aliases: Object.freeze([]),
        category: descriptor.namespace,
        usage: descriptor.usage,
        summary: descriptor.summary,
      }));
    }
  }
  return Object.freeze([...entries.values()].sort((a, b) => a.name.localeCompare(b.name)));
}

export const COMMANDS = compatibilityCommands();

function tokenize(input) {
  const tokens = [];
  let value = '';
  let quote = null;
  let escaped = false;
  for (const char of String(input)) {
    if (escaped) { value += char; escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (quote) {
      if (char === quote) quote = null;
      else value += char;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (/\s/.test(char)) {
      if (value) { tokens.push(value); value = ''; }
      continue;
    }
    value += char;
  }
  if (escaped) value += '\\';
  if (value) tokens.push(value);
  return tokens;
}

export function parseCommand(input) {
  const tokens = tokenize(input);
  return { command: (tokens.shift() || '').toLowerCase(), args: tokens };
}

const result = (action, fields = {}, historySafe = true) => ({ action, ...fields, historySafe });
const error = (message, historySafe = true) => result('error', { message }, historySafe);
const needsAuth = () => result('auth-required', { message: 'authentication required; run login' });
const isProfile = value => PROFILES.includes(value);
const isView = value => VIEWS.includes(value);
const isObservableType = value => SUPPORTED_OBSERVABLE_TYPES.includes(value);

function parseEnrich(args, activeProfile) {
  if (!args.length) return error('usage: enrich <observable> [--fast|--standard|--full]');
  const indicator = args[0];
  let profile = activeProfile;
  if (args.length > 2) return error('unsupported enrichment arguments; provider overrides are disabled');
  if (args[1]) {
    const flag = args[1];
    if (!flag.startsWith('--')) return error('only fixed profile flags are supported');
    const requested = flag.slice(2);
    if (!isProfile(requested)) return error('invalid profile; use fast, standard, or full');
    profile = requested;
  }
  return result('enrich', { indicator, profile });
}

function parseUserScanner(args) {
  if (args.length < 2) return error('usage: user-scanner <email|username> <target> [--category <name>|--module <name>] [--cross-scan] [--include-nsfw]');
  const scanType = args[0]?.toLowerCase();
  const target = String(args[1] || '').trim();
  if (!USER_SCANNER_TYPES.includes(scanType) || !target) return error('user-scanner scan type must be email or username');
  if (target.length > 320) return error('user-scanner target exceeds 320 characters');
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
      if (!value || value.startsWith('--')) return error(`${token} requires a value`);
      if (!/^[a-z0-9._-]{1,64}$/i.test(value)) return error(`${token} value contains unsupported characters`);
      if (token === '--category') category = value;
      else module = value.replace(/\./g, '_');
      index += 1;
      continue;
    }
    return error(`unsupported user-scanner option: ${token}`);
  }
  if (category && module) return error('user-scanner category and module are mutually exclusive');
  return result('user-scanner', { scanType, target, category, module, crossScan, noNsfw });
}

function parseShodan(args) {
  const command = args[0]?.toLowerCase();
  if (!command || !SHODAN_SUBCOMMANDS.includes(command)) return error('usage: shodan <host|search|count|stats|domain|info> ...');
  if (command === 'info') {
    if (args.length !== 1) return error('usage: shodan info');
    return result('shodan', { command, target: null, query: null, facets: null });
  }
  if (command === 'host') {
    const target = String(args[1] || '').trim();
    if (args.length !== 2 || !target || target.length > 64 || !/^[0-9a-f:.]+$/i.test(target) || (!target.includes('.') && !target.includes(':'))) return error('usage: shodan host <ip>');
    return result('shodan', { command, target, query: null, facets: null });
  }
  if (command === 'domain') {
    const target = String(args[1] || '').trim().toLowerCase().replace(/\.$/, '');
    if (args.length !== 2 || !target || target.length > 253 || !/^[a-z0-9.-]+$/i.test(target) || !target.includes('.') || target.includes('..')) return error('usage: shodan domain <domain>');
    return result('shodan', { command, target, query: null, facets: null });
  }
  if (command === 'search' || command === 'count') {
    const queryParts = args.slice(1);
    if (!queryParts.length || queryParts.some(token => token.startsWith('--'))) return error(`usage: shodan ${command} <query>`);
    const query = queryParts.join(' ').trim();
    if (!query || query.length > 1024) return error('Shodan query must be 1..1024 characters');
    return result('shodan', { command, target: null, query, facets: null });
  }
  const queryParts = [];
  let facets = null;
  for (let index = 1; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--facets') {
      if (facets !== null || index + 1 >= args.length || index + 2 !== args.length) return error('usage: shodan stats <query> [--facets <fields>]');
      facets = args[index + 1];
      if (!/^[a-z0-9_.-]+(?::[1-9]\d{0,2})?(?:,[a-z0-9_.-]+(?::[1-9]\d{0,2})?)*$/i.test(facets) || facets.length > 256) return error('invalid Shodan facets');
      index += 1;
      continue;
    }
    if (token.startsWith('--')) return error(`unsupported Shodan option: ${token}`);
    queryParts.push(token);
  }
  const query = queryParts.join(' ').trim();
  if (!query || query.length > 1024) return error('usage: shodan stats <query> [--facets <fields>]');
  return result('shodan', { command, target: null, query, facets });
}

function parseCase(args) {
  const subcommand = args[0]?.toLowerCase();
  if (!subcommand) return error('usage: case <new|open|close|list|show|refresh|export|import|find>');
  if (subcommand === 'new') {
    const title = args.slice(1).join(' ');
    if (!title) return error('usage: case new <title>');
    return result('case-new', { title });
  }
  if (subcommand === 'open') {
    if (args.length !== 2 || !args[1]) return error('usage: case open <id>');
    return result('case-open', { caseId: args[1] });
  }
  if (['close', 'list', 'show', 'export', 'import'].includes(subcommand)) {
    if (args.length !== 1) return error(`usage: case ${subcommand}`);
    return result(`case-${subcommand}`);
  }
  if (subcommand === 'refresh') {
    if (args.length === 1) return result('case-refresh', { staleOnly: false });
    if (args.length === 2 && args[1] === '--stale') return result('case-refresh', { staleOnly: true });
    return error('usage: case refresh [--stale]');
  }
  if (subcommand === 'find') {
    if (args.length !== 3 || !isObservableType(args[1]) || !args[2]) return error('usage: case find <type> <value>');
    return result('case-find', { observable: { type: args[1], value: args[2] } });
  }
  return error(`unsupported case subcommand: ${subcommand}`);
}

function legacyCanonical(command) {
  if (command === 'auth' || command === 'case') return command;
  const resolved = COMMAND_REGISTRY.resolve([command], 'web');
  if (!resolved?.surfaceAvailable) return null;
  const id = resolved.descriptor.id;
  if (id === 'discovery.help') return 'help';
  if (id === 'discovery.man') return 'man';
  if (id === 'session.login') return 'login';
  if (id === 'session.history') return 'history';
  if (id === 'session.reboot') return 'reboot';
  if (id === 'session.disconnect') return 'disconnect';
  if (id === 'session.whoami') return 'whoami';
  if (id === 'session.uptime') return 'uptime';
  if (id === 'session.version') return 'version';
  if (id === 'system.health') return 'health';
  if (id === 'system.status') return 'status';
  if (id === 'system.meta') return 'meta';
  if (id === 'intel.enrich') return 'enrich';
  if (id === 'intel.profile') return 'profile';
  if (id === 'intel.batch') return 'batch';
  if (id === 'osint.user-scanner') return 'user-scanner';
  if (id === 'osint.shodan') return 'shodan';
  if (id === 'case.pin') return 'pin';
  if (id === 'case.unpin') return 'unpin';
  if (id === 'case.note') return 'note';
  if (id === 'case.diff') return 'diff';
  if (id === 'result.view') return 'view';
  if (id === 'result.summary') return command === 'last' ? 'last' : 'overview';
  if (id === 'result.evidence') return 'evidence';
  if (id === 'result.correlation') return 'correlation';
  if (id === 'result.relationships') return 'relationships';
  if (id === 'result.coverage') return 'coverage';
  if (id === 'result.raw') return 'raw';
  if (id === 'result.request') return 'request';
  if (id === 'result.failures') return 'failures';
  if (id === 'result.contradictions') return 'contradictions';
  if (id === 'result.corroboration') return 'corroboration';
  if (id === 'result.references') return 'references';
  if (id === 'result.providers') return 'providers';
  if (id === 'export.json') return 'json';
  if (id === 'export.stix') return 'stix';
  if (id === 'export.copy') return 'copy';
  if (id === 'terminal.clear') return 'clear';
  if (id === 'terminal.sound') return 'sound';
  if (id === 'terminal.volume') return 'volume';
  if (id === 'terminal.theme') return 'theme';
  if (id === 'terminal.pwd') return 'pwd';
  if (id === 'terminal.hostname') return 'hostname';
  if (id === 'terminal.date') return 'date';
  if (id === 'terminal.echo') return 'echo';
  return null;
}

function directView(command) {
  const canonical = legacyCanonical(command);
  return VIEWS.includes(canonical) ? canonical : null;
}

export function interpretCommand(input, context = {}) {
  const { command, args } = parseCommand(input);
  const authenticated = Boolean(context.authenticated);
  const activeProfile = isProfile(context.profile) ? context.profile : 'standard';
  if (!command) return result('noop');
  const canonical = legacyCanonical(command);
  if (!canonical) return result('unknown', { command, message: `para11ax: ${command}: command not found` });

  if (canonical === 'login') {
    if (args.length) return error('inline bearer rejected; run login and use the hidden bearer prompt', false);
    return result('login-secret');
  }
  if (canonical === 'auth') {
    if (args.length !== 1 || !['status', 'clear'].includes(args[0])) return error('usage: auth <status|clear>');
    return result(args[0] === 'status' ? 'auth-status' : 'auth-clear');
  }
  if (canonical === 'meta') return result('meta');
  if (canonical === 'help') return result('help', { topic: args[0]?.toLowerCase() || null });
  if (canonical === 'man') return args.length === 1 ? result('help', { topic: args[0].toLowerCase() }) : error('usage: man <command>');
  if (canonical === 'clear') return result('clear');
  if (canonical === 'history') return result('history');
  if (canonical === 'reboot') return result('reboot');
  if (canonical === 'disconnect') return result('disconnect');
  if (['whoami', 'uptime', 'version', 'theme', 'pwd', 'hostname', 'date'].includes(canonical)) return result('local', { name: canonical });
  if (canonical === 'echo') return result('local', { name: 'echo', value: args.join(' ') });

  if (canonical === 'case') return parseCase(args);
  if (canonical === 'pin') return args.length ? error('usage: pin') : result('case-pin');
  if (canonical === 'unpin') {
    if (args.length !== 2 || !isObservableType(args[0]) || !args[1]) return error('usage: unpin <type> <value>');
    return result('case-unpin', { observable: { type: args[0], value: args[1] } });
  }
  if (canonical === 'note') return args.length ? result('case-note', { text: args.join(' ') }) : error('usage: note <text>');
  if (canonical === 'diff') return args.length ? error('usage: diff') : result('case-diff');

  if (canonical === 'sound') {
    if (args.length !== 1 || !['on', 'off'].includes(args[0])) return error('usage: sound <on|off>');
    return result('sound', { enabled: args[0] === 'on' });
  }
  if (canonical === 'volume') {
    if (args.length !== 1 || !/^\d{1,3}$/.test(args[0])) return error('usage: volume <0-100>');
    const percent = Number(args[0]);
    if (percent < 0 || percent > 100) return error('volume must be between 0 and 100');
    return result('volume', { volume: percent / 100 });
  }
  if (canonical === 'profile') {
    if (!args.length) return result('show-profile', { profile: activeProfile });
    if (args.length !== 1 || !isProfile(args[0])) return error('usage: profile <fast|standard|full>');
    return result('set-profile', { profile: args[0] });
  }

  if (['health', 'status'].includes(canonical) && !authenticated) return needsAuth();
  if (canonical === 'health') return result('health');
  if (canonical === 'status') return result('status');
  if (canonical === 'enrich') return authenticated ? parseEnrich(args, activeProfile) : needsAuth();
  if (canonical === 'user-scanner') return authenticated ? parseUserScanner(args) : needsAuth();
  if (canonical === 'shodan') return authenticated ? parseShodan(args) : needsAuth();
  if (canonical === 'batch') {
    if (!authenticated) return needsAuth();
    if (!args.length || args.length > 20) return error('batch accepts 1..20 observables');
    return result('batch', { indicators: [...args], profile: activeProfile });
  }
  if (canonical === 'view') {
    if (!authenticated) return needsAuth();
    if (args.length !== 1 || !isView(args[0])) return error('usage: view <overview|evidence|correlation|relationships|coverage|raw>');
    return result('view', { view: args[0] });
  }
  const view = directView(command);
  if (view) return authenticated ? result('view', { view }) : needsAuth();

  if (['last', 'request', 'failures', 'contradictions', 'corroboration', 'references', 'providers'].includes(canonical)) {
    return authenticated ? result('result-filter', { filter: canonical }) : needsAuth();
  }
  if (canonical === 'json') {
    if (!authenticated) return needsAuth();
    if (!args.length) return result('print-json');
    if (args.length === 1 && args[0] === 'save') return result('download-json');
    return error('usage: json [save]');
  }
  if (canonical === 'stix') return authenticated ? result('stix') : needsAuth();
  if (canonical === 'copy') {
    if (!authenticated) return needsAuth();
    if (args.length !== 1 || !['observable', 'report', 'json', 'request-id'].includes(args[0])) return error('usage: copy <observable|report|json|request-id>');
    return result('copy', { target: args[0] });
  }
  return result('unknown', { command, message: `para11ax: ${command}: command not found` });
}

export function completeCommand(input) {
  const raw = String(input);
  const trimmedLeft = raw.replace(/^\s+/, '');
  const firstSpace = trimmedLeft.search(/\s/);
  const root = firstSpace < 0 ? trimmedLeft.toLowerCase() : trimmedLeft.slice(0, firstSpace).toLowerCase();
  const remainder = firstSpace < 0 ? '' : trimmedLeft.slice(firstSpace).trimStart();

  if (root === 'user-scanner' || root === 'osint' || root === 'identity') {
    const pieces = remainder.split(/\s+/);
    if (pieces.length === 1 && !remainder.endsWith(' ')) return USER_SCANNER_TYPES.filter(value => value.startsWith(pieces[0].toLowerCase()));
    if (pieces.length === 1 && remainder.endsWith(' ')) return [...USER_SCANNER_TYPES];
    const last = remainder.endsWith(' ') ? '' : (pieces.at(-1) || '');
    if (last.startsWith('--')) return USER_SCANNER_FLAGS.filter(value => value.startsWith(last.toLowerCase())).sort();
  }

  if (root === 'shodan') {
    const pieces = remainder.split(/\s+/);
    if (pieces.length === 1 && !remainder.endsWith(' ')) return SHODAN_SUBCOMMANDS.filter(value => value.startsWith(pieces[0].toLowerCase())).sort();
    if (pieces.length === 1 && remainder.endsWith(' ')) return [...SHODAN_SUBCOMMANDS].sort();
    const subcommand = pieces[0]?.toLowerCase();
    const last = remainder.endsWith(' ') ? '' : (pieces.at(-1) || '');
    if (subcommand === 'stats' && last.startsWith('--')) return SHODAN_FLAGS.filter(value => value.startsWith(last.toLowerCase())).sort();
  }

  return completeShellInput(raw, {
    surface: 'web',
    observableTypes: SUPPORTED_OBSERVABLE_TYPES,
    caseTypes: SUPPORTED_OBSERVABLE_TYPES,
  });
}

export function createHistory(limit = 100) {
  const max = Math.max(1, Math.min(1000, Number(limit) || 100));
  const values = [];
  let cursor = 0;
  return Object.freeze({
    push(line) {
      const value = String(line).trim();
      if (!value || /^login(?:\s|$)/i.test(value)) { cursor = values.length; return; }
      if (values.at(-1) !== value) values.push(value);
      while (values.length > max) values.shift();
      cursor = values.length;
    },
    up() {
      if (!values.length) return '';
      cursor = Math.max(0, cursor - 1);
      return values[cursor] || '';
    },
    down() {
      if (!values.length) return '';
      cursor = Math.min(values.length, cursor + 1);
      return cursor === values.length ? '' : values[cursor];
    },
    entries() { return [...values]; },
    clear() { values.length = 0; cursor = 0; },
  });
}
