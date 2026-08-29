import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS, interpretCommand, completeCommand } from '../app/shell.js';

const ctx = { authenticated: false, profile: 'standard' };

function command(input) {
  return interpretCommand(input, ctx);
}

test('case command registry exposes only the local workspace verbs', () => {
  const names = new Set(COMMANDS.map(item => item.name));
  for (const name of ['case', 'pin', 'unpin', 'note', 'diff']) assert.equal(names.has(name), true);
});

test('case lifecycle grammar maps to deterministic local actions', () => {
  assert.deepEqual(command('case new Operation Fixture'), { action: 'case-new', title: 'Operation Fixture', historySafe: true });
  assert.deepEqual(command('case open case-1'), { action: 'case-open', caseId: 'case-1', historySafe: true });
  assert.deepEqual(command('case close'), { action: 'case-close', historySafe: true });
  assert.deepEqual(command('case list'), { action: 'case-list', historySafe: true });
  assert.deepEqual(command('case show'), { action: 'case-show', historySafe: true });
  assert.deepEqual(command('case refresh'), { action: 'case-refresh', staleOnly: false, historySafe: true });
  assert.deepEqual(command('case refresh --stale'), { action: 'case-refresh', staleOnly: true, historySafe: true });
  assert.deepEqual(command('case export'), { action: 'case-export', historySafe: true });
  assert.deepEqual(command('case import'), { action: 'case-import', historySafe: true });
});

test('pin and local find grammar preserve explicit canonical observable identity', () => {
  assert.deepEqual(command('pin'), { action: 'case-pin', historySafe: true });
  assert.deepEqual(command('unpin certificate abc123'), {
    action: 'case-unpin', observable: { type: 'certificate', value: 'abc123' }, historySafe: true,
  });
  assert.deepEqual(command('case find ip 203.0.113.7'), {
    action: 'case-find', observable: { type: 'ip', value: '203.0.113.7' }, historySafe: true,
  });
  assert.deepEqual(command('case find attack T1071.004'), {
    action: 'case-find', observable: { type: 'attack', value: 'T1071.004' }, historySafe: true,
  });
});

test('notes and diffs are explicit local actions', () => {
  assert.deepEqual(command('note investigate beacon overlap'), { action: 'case-note', text: 'investigate beacon overlap', historySafe: true });
  assert.deepEqual(command('diff'), { action: 'case-diff', historySafe: true });
});

test('typed grammar rejects ambiguous, unsupported, or inline import forms', () => {
  for (const input of [
    'pin 203.0.113.7',
    'unpin 203.0.113.7',
    'unpin email a@example.test',
    'case find example.test',
    'case find email a@example.test',
    'case import payload.json',
    'case export out.para11ax',
    'case refresh --all',
    'case close extra',
    'case nope',
    'note',
    'diff extra',
  ]) assert.equal(command(input).action, 'error', input);
});

test('case grammar is local and does not require an authenticated gateway session', () => {
  for (const input of ['case list', 'case find domain example.test', 'case new Fixture']) {
    assert.notEqual(command(input).action, 'auth-required');
  }
});

test('autocomplete exposes case subcommands and canonical observable types', () => {
  assert.deepEqual(completeCommand('case '), ['close','export','find','import','list','new','open','refresh','show']);
  assert.deepEqual(completeCommand('case f'), ['find']);
  assert.deepEqual(completeCommand('case find c'), ['certificate','cidr','cve']);
  assert.deepEqual(completeCommand('unpin d'), ['domain']);
});
