import test from 'node:test';
import assert from 'node:assert/strict';
import * as mission from '../src/core/mission/index.js';

test('mission core exports only the bounded deterministic analyst workflow functions', () => {
  assert.deepEqual(Object.keys(mission).sort(), [
    'analyzeMissionResults',
    'assessClientRelevance',
    'buildHuntPackage',
    'createMissionWorkspace',
    'executeMissionCommand',
    'exportMissionWorkspace',
    'importMissionWorkspace',
    'normalizeClientProfile',
    'reduceMissionWorkspace',
    'validateMissionKql',
  ]);
  for (const value of Object.values(mission)) assert.equal(typeof value, 'function');
});
