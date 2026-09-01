import test from 'node:test';
import assert from 'node:assert/strict';

import { createMissionFileSelector } from '../app/mission-file-bridge.js';

class FakeInput {
  constructor() {
    this.id = '';
    this.type = '';
    this.accept = '';
    this.hidden = false;
    this.multiple = true;
    this.value = '';
    this.files = [];
    this.listeners = new Map();
    this.clickCount = 0;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  click() {
    this.clickCount += 1;
  }

  dispatch(type) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }
}

function fixture() {
  const input = new FakeInput();
  const nodes = new Map();
  const documentRef = {
    getElementById: id => nodes.get(id) ?? null,
    createElement: tag => {
      assert.equal(tag, 'input');
      return input;
    },
    body: {
      append(node) {
        nodes.set(node.id, node);
      },
    },
  };
  return { input, selector: createMissionFileSelector({ documentRef }) };
}

test('workspace selection reads one explicit JSON file and resets the picker', async () => {
  const { input, selector } = fixture();
  const selected = selector.select({ kind: 'workspace', args: [] });
  assert.equal(input.type, 'file');
  assert.equal(input.accept, '.json,application/json');
  assert.equal(input.hidden, true);
  assert.equal(input.multiple, false);
  assert.equal(input.clickCount, 1);
  input.value = 'mission.json';
  input.files = [{ name: 'mission.json', size: 12, text: async () => '{"ok":true}' }];
  input.dispatch('change');
  assert.equal(await selected, '{"ok":true}');
  assert.equal(input.value, '');
  assert.equal(input.listeners.get('change').size, 0);
});

test('result selection accepts CSV and cancellation returns null without stale state', async () => {
  const { input, selector } = fixture();
  const selected = selector.select({ kind: 'result', args: [] });
  assert.equal(input.accept, '.json,.csv,application/json,text/csv');
  input.dispatch('cancel');
  assert.equal(await selected, null);
  assert.equal(input.value, '');
  assert.equal(input.listeners.get('cancel').size, 0);
});

test('oversized files fail before file text is read', async () => {
  const { input, selector } = fixture();
  let reads = 0;
  const selected = selector.select({ kind: 'result', args: [] });
  input.files = [{
    name: 'results.csv',
    size: (2 * 1024 * 1024) + 1,
    text: async () => { reads += 1; return ''; },
  }];
  input.dispatch('change');
  await assert.rejects(selected, error => error.code === 'OUTPUT_LIMIT');
  assert.equal(reads, 0);
});

test('browser file selector denies flags unsupported kinds and wrong extensions', async () => {
  const { input, selector } = fixture();
  await assert.rejects(selector.select({ kind: 'workspace', args: ['--file', 'x.json'] }), error => error.code === 'POLICY_DENIED');
  await assert.rejects(selector.select({ kind: 'profile', args: [] }), error => error.code === 'POLICY_DENIED');

  const selected = selector.select({ kind: 'workspace', args: [] });
  input.files = [{ name: 'mission.csv', size: 4, text: async () => 'x' }];
  input.dispatch('change');
  await assert.rejects(selected, error => error.code === 'INVALID_ARGUMENT');
});
