import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMMANDS,
  parseCommand,
  interpretCommand,
  completeCommand,
  createHistory,
} from '../app/shell.js';

test('command registry exposes the approved analyst shell without fake OS execution', () => {
  const names = new Set(COMMANDS.flatMap((item) => [item.name, ...(item.aliases || [])]));
  for (const name of [
    'help','man','clear','history','reboot','disconnect','whoami','uptime','version',
    'login','auth','health','status','meta','enrich','scan','pivot','profile','view',
    'overview','evidence','correlation','relationships','coverage','raw','json','stix',
    'copy','last','request','failures','contradictions','corroboration','references',
    'providers','batch','sound','volume','theme','pwd','hostname','date','echo',
  ]) assert.ok(names.has(name), `missing shell command: ${name}`);

  for (const forbidden of ['sudo','ssh','curl','wget','eval','exec','source']) assert.equal(names.has(forbidden), false);
});

test('parser supports quoted arguments but never interprets shell operators', () => {
  assert.deepEqual(parseCommand('enrich "example.com" --full'), { command: 'enrich', args: ['example.com', '--full'] });
  assert.deepEqual(parseCommand("echo 'a b'"), { command: 'echo', args: ['a b'] });
  assert.deepEqual(parseCommand('echo x | curl evil'), { command: 'echo', args: ['x', '|', 'curl', 'evil'] });
  assert.deepEqual(parseCommand(''), { command: '', args: [] });
});

test('login always switches to a secret prompt and refuses inline bearer material', () => {
  assert.deepEqual(interpretCommand('login', { authenticated: false, profile: 'standard' }), { action: 'login-secret', historySafe: true });
  const inline = interpretCommand('login super-secret-token', { authenticated: false, profile: 'standard' });
  assert.equal(inline.action, 'error');
  assert.match(inline.message, /hidden bearer prompt/i);
  assert.equal(inline.historySafe, false);
  assert.equal(JSON.stringify(inline).includes('super-secret-token'), false);
});

test('enrich aliases and profile flags normalize to the fixed gateway profiles', () => {
  for (const verb of ['enrich', 'scan', 'pivot']) {
    assert.deepEqual(interpretCommand(`${verb} example.org --fast`, { authenticated: true, profile: 'standard' }), {
      action: 'enrich', indicator: 'example.org', profile: 'fast', historySafe: true,
    });
  }
  assert.deepEqual(interpretCommand('enrich example.org', { authenticated: true, profile: 'full' }).profile, 'full');
  assert.equal(interpretCommand('enrich example.org --provider virustotal', { authenticated: true, profile: 'standard' }).action, 'error');
});

test('profile, view, result filters, exports and gateway commands map to bounded actions', () => {
  assert.deepEqual(interpretCommand('profile full', { authenticated: true, profile: 'standard' }), { action: 'set-profile', profile: 'full', historySafe: true });
  assert.deepEqual(interpretCommand('view evidence', { authenticated: true, profile: 'standard' }), { action: 'view', view: 'evidence', historySafe: true });
  assert.deepEqual(interpretCommand('cor', { authenticated: true, profile: 'standard' }), { action: 'view', view: 'correlation', historySafe: true });
  assert.equal(interpretCommand('failures', { authenticated: true, profile: 'standard' }).action, 'result-filter');
  assert.equal(interpretCommand('json save', { authenticated: true, profile: 'standard' }).action, 'download-json');
  assert.equal(interpretCommand('stix', { authenticated: true, profile: 'standard' }).action, 'stix');
  assert.equal(interpretCommand('health', { authenticated: true, profile: 'standard' }).action, 'health');
  assert.equal(interpretCommand('status', { authenticated: true, profile: 'standard' }).action, 'status');
  assert.equal(interpretCommand('meta', { authenticated: false, profile: 'standard' }).action, 'meta');
});

test('batch is bounded to 20 indicators and uses only the active fixed profile', () => {
  const ok = interpretCommand('batch a.example b.example c.example', { authenticated: true, profile: 'standard' });
  assert.deepEqual(ok, { action: 'batch', indicators: ['a.example','b.example','c.example'], profile: 'standard', historySafe: true });
  const tooMany = interpretCommand(`batch ${Array.from({ length: 21 }, (_, i) => `h${i}.example`).join(' ')}`, { authenticated: true, profile: 'standard' });
  assert.equal(tooMany.action, 'error');
  assert.match(tooMany.message, /20/);
});

test('auth-required commands fail locally while public and local commands remain usable', () => {
  assert.equal(interpretCommand('enrich example.org', { authenticated: false, profile: 'standard' }).action, 'auth-required');
  assert.equal(interpretCommand('health', { authenticated: false, profile: 'standard' }).action, 'auth-required');
  assert.equal(interpretCommand('meta', { authenticated: false, profile: 'standard' }).action, 'meta');
  assert.equal(interpretCommand('help', { authenticated: false, profile: 'standard' }).action, 'help');
  assert.equal(interpretCommand('pwd', { authenticated: false, profile: 'standard' }).action, 'local');
});

test('autocomplete handles commands and structured subcommands', () => {
  assert.deepEqual(completeCommand('enr'), ['enrich']);
  assert.deepEqual(completeCommand('view c'), ['correlation','coverage']);
  assert.deepEqual(completeCommand('profile f'), ['fast','full']);
  assert.deepEqual(completeCommand('sound '), ['off','on']);
  assert.deepEqual(completeCommand('auth '), ['clear','status']);
});

test('history supports up/down navigation and never stores secret-bearing login lines', () => {
  const history = createHistory(100);
  history.push('help');
  history.push('enrich example.org');
  history.push('login secret-material');
  assert.deepEqual(history.entries(), ['help','enrich example.org']);
  assert.equal(history.up(), 'enrich example.org');
  assert.equal(history.up(), 'help');
  assert.equal(history.down(), 'enrich example.org');
  assert.equal(history.down(), '');
});

test('terminal controls resolve to explicit safe local actions', () => {
  assert.equal(interpretCommand('sound off', { authenticated: false, profile: 'standard' }).action, 'sound');
  assert.equal(interpretCommand('volume 75', { authenticated: false, profile: 'standard' }).volume, 0.75);
  assert.equal(interpretCommand('volume 101', { authenticated: false, profile: 'standard' }).action, 'error');
  assert.equal(interpretCommand('reboot', { authenticated: false, profile: 'standard' }).action, 'reboot');
  assert.equal(interpretCommand('clear', { authenticated: false, profile: 'standard' }).action, 'clear');
  assert.equal(interpretCommand('sudo rm -rf /', { authenticated: false, profile: 'standard' }).action, 'unknown');
});
