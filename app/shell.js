import { SUPPORTED_OBSERVABLE_TYPES } from './observable-input.js';

const PROFILES = Object.freeze(['fast', 'standard', 'full']);
const VIEWS = Object.freeze(['overview', 'evidence', 'correlation', 'relationships', 'coverage', 'raw']);
const CASE_SUBCOMMANDS = Object.freeze(['close', 'export', 'find', 'import', 'list', 'new', 'open', 'refresh', 'show']);
const USER_SCANNER_TYPES = Object.freeze(['email', 'username']);
const USER_SCANNER_FLAGS = Object.freeze(['--category', '--module', '--cross-scan', '--include-nsfw']);

export const COMMANDS = Object.freeze([
  { name: 'help', aliases: ['?'], category: 'core', usage: 'help [command]', summary: 'show command index or command help' },
  { name: 'man', category: 'core', usage: 'man <command>', summary: 'show detailed command help' },
  { name: 'clear', aliases: ['cls'], category: 'core', usage: 'clear', summary: 'clear terminal scrollback' },
  { name: 'history', category: 'core', usage: 'history', summary: 'show non-secret command history' },
  { name: 'reboot', category: 'core', usage: 'reboot', summary: 'replay the PARA11AX Gateway boot sequence' },
  { name: 'disconnect', aliases: ['exit', 'logout'], category: 'core', usage: 'disconnect', summary: 'destroy bearer and lock the session' },
  { name: 'whoami', category: 'core', usage: 'whoami', summary: 'show local session identity/state' },
  { name: 'uptime', category: 'core', usage: 'uptime', summary: 'show frontend terminal uptime' },
  { name: 'version', category: 'core', usage: 'version', summary: 'show terminal/gateway version information' },

  { name: 'login', category: 'auth', usage: 'login', summary: 'open hidden bearer prompt; inline bearer is rejected' },
  { name: 'auth', category: 'auth', usage: 'auth <status|clear>', summary: 'inspect or clear volatile authentication' },

  { name: 'health', category: 'gateway', usage: 'health', summary: 'authenticated gateway health' },
  { name: 'status', category: 'gateway', usage: 'status', summary: 'authenticated aggregate runtime status' },
  { name: 'meta', category: 'gateway', usage: 'meta', summary: 'public gateway capabilities and hard limits' },

  { name: 'enrich', aliases: ['scan', 'pivot'], category: 'enrichment', usage: 'enrich <observable> [--fast|--standard|--full]', summary: 'run bounded Evidence v2 enrichment' },
  { name: 'profile', category: 'enrichment', usage: 'profile [fast|standard|full]', summary: 'show or set the fixed enrichment profile' },
  { name: 'batch', category: 'enrichment', usage: 'batch <observable> [observable ...]', summary: 'enrich 1..20 observables using the active profile' },

  { name: 'user-scanner', aliases: ['osint', 'identity'], category: 'osint', usage: 'user-scanner <email|username> <target> [--category <name>|--module <name>] [--cross-scan] [--include-nsfw]', summary: 'run isolated email/username OSINT through User Scanner' },

  { name: 'case', category: 'case', usage: 'case <new|open|close|list|show|refresh|export|import|find>', summary: 'manage the browser-local analyst workspace' },
  { name: 'pin', category: 'case', usage: 'pin', summary: 'pin the current typed enrichment result to the active case' },
  { name: 'unpin', category: 'case', usage: 'unpin <type> <value>', summary: 'remove one exact typed pin from the active case' },
  { name: 'note', category: 'case', usage: 'note <text>', summary: 'append an analyst note to the active case' },
  { name: 'diff', category: 'case', usage: 'diff', summary: 'show the latest semantic diff for the current result' },

  { name: 'view', category: 'result', usage: 'view <overview|evidence|correlation|relationships|coverage|raw>', summary: 'render a result view' },
  { name: 'overview', aliases: ['ovr'], category: 'result', usage: 'overview', summary: 'render overview' },
  { name: 'evidence', aliases: ['evd'], category: 'result', usage: 'evidence', summary: 'render evidence' },
  { name: 'correlation', aliases: ['cor'], category: 'result', usage: 'correlation', summary: 'render correlation' },
  { name: 'relationships', aliases: ['rel'], category: 'result', usage: 'relationships', summary: 'render relationships' },
  { name: 'coverage', aliases: ['cov'], category: 'result', usage: 'coverage', summary: 'render coverage' },
  { name: 'raw', category: 'result', usage: 'raw', summary: 'render raw Evidence v2 JSON' },
  { name: 'last', category: 'result', usage: 'last', summary: 'reprint the current result summary' },
  { name: 'request', category: 'result', usage: 'request', summary: 'show current request metadata' },
  { name: 'failures', aliases: ['failed'], category: 'result', usage: 'failures', summary: 'show provider failures only' },
  { name: 'contradictions', category: 'result', usage: 'contradictions', summary: 'show contradictions only' },
  { name: 'corroboration', category: 'result', usage: 'corroboration', summary: 'show corroborated evidence only' },
  { name: 'references', category: 'result', usage: 'references', summary: 'show source references from current evidence' },
  { name: 'providers', category: 'result', usage: 'providers', summary: 'show providers represented in the current result' },

  { name: 'json', category: 'export', usage: 'json [save]', summary: 'print or download Evidence v2 JSON' },
  { name: 'stix', category: 'export', usage: 'stix', summary: 'generate and download STIX 2.1 from current observable' },
  { name: 'copy', category: 'export', usage: 'copy <observable|report|json|request-id>', summary: 'copy current observable, analyst report, JSON, or request id' },

  { name: 'sound', category: 'terminal', usage: 'sound <on|off>', summary: 'enable or mute synthesized terminal audio' },
  { name: 'volume', category: 'terminal', usage: 'volume <0-100>', summary: 'set synthesized audio volume' },
  { name: 'theme', category: 'terminal', usage: 'theme', summary: 'show PARA11AX semantic palette' },
  { name: 'pwd', category: 'terminal', usage: 'pwd', summary: 'print virtual working directory' },
  { name: 'hostname', category: 'terminal', usage: 'hostname', summary: 'print terminal hostname' },
  { name: 'date', category: 'terminal', usage: 'date', summary: 'print local browser time' },
  { name: 'echo', category: 'terminal', usage: 'echo [text]', summary: 'echo local text without shell evaluation' },
]);

const INDEX = new Map();
for (const item of COMMANDS) {
  INDEX.set(item.name, item);
  for (const alias of item.aliases || []) INDEX.set(alias, item);
}

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

function directView(command) {
  const item = INDEX.get(command);
  return item && VIEWS.includes(item.name) ? item.name : null;
}

export function interpretCommand(input, context = {}) {
  const { command, args } = parseCommand(input);
  const authenticated = Boolean(context.authenticated);
  const activeProfile = isProfile(context.profile) ? context.profile : 'standard';
  if (!command) return result('noop');

  const canonical = INDEX.get(command)?.name;
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
  if (canonical === 'whoami') return result('local', { name: 'whoami' });
  if (canonical === 'uptime') return result('local', { name: 'uptime' });
  if (canonical === 'version') return result('local', { name: 'version' });
  if (canonical === 'theme') return result('local', { name: 'theme' });
  if (canonical === 'pwd') return result('local', { name: 'pwd' });
  if (canonical === 'hostname') return result('local', { name: 'hostname' });
  if (canonical === 'date') return result('local', { name: 'date' });
  if (canonical === 'echo') return result('local', { name: 'echo', value: args.join(' ') });

  if (canonical === 'case') return parseCase(args);
  if (canonical === 'pin') {
    if (args.length) return error('usage: pin');
    return result('case-pin');
  }
  if (canonical === 'unpin') {
    if (args.length !== 2 || !isObservableType(args[0]) || !args[1]) return error('usage: unpin <type> <value>');
    return result('case-unpin', { observable: { type: args[0], value: args[1] } });
  }
  if (canonical === 'note') {
    if (!args.length) return error('usage: note <text>');
    return result('case-note', { text: args.join(' ') });
  }
  if (canonical === 'diff') {
    if (args.length) return error('usage: diff');
    return result('case-diff');
  }

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

  if (canonical === 'enrich') {
    if (!authenticated) return needsAuth();
    return parseEnrich(args, activeProfile);
  }

  if (canonical === 'user-scanner') {
    if (!authenticated) return needsAuth();
    return parseUserScanner(args);
  }

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
  if (view) {
    if (!authenticated) return needsAuth();
    return result('view', { view });
  }

  if (['last', 'request', 'failures', 'contradictions', 'corroboration', 'references', 'providers'].includes(canonical)) {
    if (!authenticated) return needsAuth();
    return result('result-filter', { filter: canonical });
  }

  if (canonical === 'json') {
    if (!authenticated) return needsAuth();
    if (!args.length) return result('print-json');
    if (args.length === 1 && args[0] === 'save') return result('download-json');
    return error('usage: json [save]');
  }
  if (canonical === 'stix') {
    if (!authenticated) return needsAuth();
    return result('stix');
  }
  if (canonical === 'copy') {
    if (!authenticated) return needsAuth();
    if (args.length !== 1 || !['observable', 'report', 'json', 'request-id'].includes(args[0])) return error('usage: copy <observable|report|json|request-id>');
    return result('copy', { target: args[0] });
  }

  return result('unknown', { command, message: `para11ax: ${command}: command not found` });
}

const COMPLETIONS = Object.freeze({
  view: VIEWS,
  profile: PROFILES,
  sound: Object.freeze(['off', 'on']),
  auth: Object.freeze(['clear', 'status']),
  copy: Object.freeze(['json', 'observable', 'report', 'request-id']),
  json: Object.freeze(['save']),
  case: CASE_SUBCOMMANDS,
  unpin: SUPPORTED_OBSERVABLE_TYPES,
});

export function completeCommand(input) {
  const raw = String(input);
  const trimmedLeft = raw.replace(/^\s+/, '');
  const firstSpace = trimmedLeft.search(/\s/);
  if (firstSpace < 0) {
    const prefix = trimmedLeft.toLowerCase();
    if (!prefix) return COMMANDS.map(item => item.name).sort();
    return [...new Set(COMMANDS.flatMap(item => [item.name, ...(item.aliases || [])]))]
      .filter(name => name.startsWith(prefix))
      .sort();
  }
  const command = trimmedLeft.slice(0, firstSpace).toLowerCase();
  const canonical = INDEX.get(command)?.name || command;
  const fragmentRaw = trimmedLeft.slice(firstSpace).trimStart();
  const fragment = fragmentRaw.toLowerCase();

  if (canonical === 'user-scanner') {
    const pieces = fragmentRaw.split(/\s+/);
    if (pieces.length === 1 && !fragmentRaw.endsWith(' ')) {
      return USER_SCANNER_TYPES.filter(value => value.startsWith(pieces[0].toLowerCase()));
    }
    if (pieces.length === 1 && fragmentRaw.endsWith(' ')) return USER_SCANNER_TYPES;
    const last = fragmentRaw.endsWith(' ') ? '' : (pieces.at(-1) || '');
    if (last.startsWith('--')) return USER_SCANNER_FLAGS.filter(value => value.startsWith(last.toLowerCase())).sort();
    return [];
  }

  if (canonical === 'case') {
    const pieces = fragment.split(/\s+/);
    if (pieces[0] === 'find' && (pieces.length > 1 || fragment.endsWith(' '))) {
      const typeFragment = pieces[1] ?? '';
      return [...SUPPORTED_OBSERVABLE_TYPES].filter(value => value.startsWith(typeFragment)).sort();
    }
    if (pieces.length > 1) return [];
    return [...CASE_SUBCOMMANDS].filter(value => value.startsWith(pieces[0] ?? '')).sort();
  }

  return [...(COMPLETIONS[canonical] || [])].filter(value => value.startsWith(fragment)).sort();
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
