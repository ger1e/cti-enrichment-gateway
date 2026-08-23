import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/tooling-smoke.yml', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('public hosted CI runs only for pull requests to main or manual dispatch', () => {
  assert.match(workflow, /on:\s*\n\s*workflow_dispatch:/);
  assert.match(workflow, /^\s+pull_request:\s*$/m);
  assert.match(workflow, /pull_request:\s*\n\s+branches:\s*\n\s+- main/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /^\s+schedule:/m);
  assert.doesNotMatch(workflow, /^\s+workflow_run:/m);
  assert.doesNotMatch(workflow, /^\s+repository_dispatch:/m);
});

test('hosted CI is bounded to one fail-fast Ubuntu runner without package installation churn', () => {
  const runners = workflow.match(/^\s+runs-on:/gm) ?? [];
  assert.equal(runners.length, 1);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
  assert.doesNotMatch(workflow, /apt-get|brew\s+install|winget\s+install/i);
  assert.match(workflow, /timeout-minutes: 10/);
  assert.match(workflow, /cancel-in-progress: true/);
});

test('automatic Vercel Git deployments stay disabled', () => {
  assert.equal(vercel?.git?.deploymentEnabled, false);
});
