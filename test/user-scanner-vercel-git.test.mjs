import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

test('user-scanner Vercel project only auto-deploys main', () => {
  const config = readJson('workers/user-scanner/vercel.json');
  assert.deepEqual(config.git?.deploymentEnabled, {
    '**': false,
    main: true,
  });
});
