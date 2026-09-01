import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { completeShellInput } from '../app/shell-core/completion.js';
import { renderCommandIndex, renderManual } from '../app/shell-core/help.js';
import { parseShellLine } from '../app/shell-core/parser.js';

const EXPECTED = Object.freeze([
  'mission new',
  'mission show',
  'mission profile set',
  'mission context set',
  'mission relevance',
  'mission hunt build',
  'mission kql validate',
  'mission result analyze',
  'mission servicenow',
  'mission export',
  'mission import',
  'mission clear',
]);

test('mission namespace exposes the approved shared command contract', () => {
  for (const command of EXPECTED) {
    for (const surface of ['web', 'cli']) {
      const resolved = COMMAND_REGISTRY.resolve(command.split(' '), surface);
      assert.equal(resolved?.surfaceAvailable, true, `${surface}:${command}`);
      assert.equal(resolved.descriptor.namespace, 'mission');
      assert.equal(resolved.descriptor.egressClass, 'none');
      assert.equal(resolved.descriptor.auth, 'none');
      assert.deepEqual(resolved.descriptor.capabilities, []);
      assert.deepEqual(resolved.descriptor.inputTypes, ['void', 'record']);
    }
  }
  assert.deepEqual(completeShellInput('mission ', { surface: 'web' }), [
    'clear', 'context', 'export', 'hunt', 'import', 'kql', 'new', 'profile',
    'relevance', 'result', 'servicenow', 'show',
  ]);
});

test('mission side effects distinguish volatile mutation from explicit download', () => {
  const mutable = new Set([
    'mission.new', 'mission.profile-set', 'mission.context-set', 'mission.relevance',
    'mission.hunt-build', 'mission.kql-validate', 'mission.result-analyze',
    'mission.servicenow', 'mission.import', 'mission.clear',
  ]);
  for (const descriptor of COMMAND_REGISTRY.byNamespace('mission')) {
    assert.equal(descriptor.sideEffect, mutable.has(descriptor.id) ? 'session' : 'none');
    assert.notEqual(descriptor.sideEffect, 'filesystem');
    assert.notEqual(descriptor.sideEffect, 'local-admin');
  }

  const pipeline = parseShellLine('mission export | download');
  const stages = pipeline.stages.map(stage => COMMAND_REGISTRY.resolve(stage.tokens, 'web').descriptor);
  assert.deepEqual(stages.map(item => item.id), ['mission.export', 'export.download']);
  assert.deepEqual(stages.map(item => item.sideEffect), ['none', 'browser-download']);
});

test('mission commands are discoverable through registry-backed help', () => {
  assert.equal(COMMAND_REGISTRY.byNamespace('mission').length, 12);
  assert.match(renderCommandIndex('mission'), /mission hunt build/i);
  assert.match(renderManual('mission result analyze'), /mission result analyze/i);
});
