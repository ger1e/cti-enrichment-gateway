import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createBrowserShellExecutor } from '../app/shell-browser-executor.js';
import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { renderCommandIndex, renderManual } from '../app/shell-core/help.js';

function descriptor(tokens) {
  const resolved = COMMAND_REGISTRY.resolve(tokens, 'web');
  assert.ok(resolved?.surfaceAvailable);
  return resolved.descriptor;
}

function browser(investigations, currentResult = null) {
  return createBrowserShellExecutor({
    client: {},
    session: {},
    investigations,
    initialState: { currentResult },
  });
}

test('investigation namespace is discoverable and inv resolves identically', () => {
  assert.equal(COMMAND_REGISTRY.resolve(['investigation', 'status']).descriptor.id, 'investigation.status');
  assert.equal(COMMAND_REGISTRY.resolve(['inv', 'status']).descriptor.id, 'investigation.status');
  assert.match(renderCommandIndex('investigation'), /investigation disposition set/);
  assert.match(renderManual(['investigation', 'status']), /workflow readiness/i);
});

test('every investigation command is no-egress and capability-free', () => {
  const commands = COMMAND_REGISTRY.byNamespace('investigation');
  assert.equal(commands.length, 22);
  for (const command of commands) {
    assert.equal(command.egressClass, 'none');
    assert.deepEqual(command.capabilities, []);
    assert.equal(command.auth, 'none');
  }
});

test('browser executor validates arguments and emits bounded mutation receipts', async () => {
  const calls = [];
  const investigations = {
    async handle(action) {
      calls.push(action);
      return {
        investigation: { id: 'inv-001', revision: 3, status: { phase: 'EVIDENCE', readiness: 'INCOMPLETE' } },
        action: action.type,
        invalidated: ['hunt'],
      };
    },
    reset() {},
    state() { return { activeInvestigationId: 'inv-001', available: true }; },
  };
  const executor = browser(investigations);
  const output = await executor.execute({ descriptor: descriptor(['investigation', 'new']), args: ['VPN', 'review'], context: { surface: 'web' } });
  assert.deepEqual(calls[0], { type: 'NEW', title: 'VPN review' });
  assert.deepEqual(output.value, {
    investigationId: 'inv-001', revision: 3, action: 'NEW', invalidated: ['hunt'], phase: 'EVIDENCE', readiness: 'INCOMPLETE',
  });
  await assert.rejects(executor.execute({ descriptor: descriptor(['investigation', 'status']), args: ['extra'], context: { surface: 'web' } }), /usage/i);
});

test('capture evidence consumes only the current enrichment result', async () => {
  const calls = [];
  const result = { schemaVersion: '2.0', status: 'ok', requestId: 'r', type: 'ip', indicator: '203.0.113.10', evidence: [], relationships: [], failures: [] };
  const investigations = {
    async handle() { throw new Error('unexpected generic investigation dispatch'); },
    async captureEvidence(value) { calls.push(value); return { investigation: { id: 'inv-1', revision: 2, status: { phase: 'HUNT_DESIGN', readiness: 'INCOMPLETE' } }, action: 'EVIDENCE_CAPTURE', invalidated: [] }; },
    reset() {}, state() { return { activeInvestigationId: 'inv-1', available: true }; },
  };
  const executor = browser(investigations, result);
  await executor.execute({ descriptor: descriptor(['investigation', 'capture', 'evidence']), args: [], context: { surface: 'web' } });
  assert.deepEqual(calls, [result]);
});

test('browser shell wiring installs the investigation adapter and active status projection', async () => {
  const shell = await readFile(new URL('../app/shell-ui.js', import.meta.url), 'utf8');
  const bridge = await readFile(new URL('../app/investigation-shell-bridge.js', import.meta.url), 'utf8');
  const entry = await readFile(new URL('../app/terminal-main.js', import.meta.url), 'utf8');
  assert.match(shell, /investigations:\s*investigationShellAdapter/);
  assert.match(shell, /INV:/);
  assert.match(bridge, /createInvestigationRepository/);
  assert.match(bridge, /createInvestigationRuntime/);
  assert.match(bridge, /createIndexedDbCaseStorage/);
  assert.match(entry, /investigation-shell-bridge\.js/);
});
