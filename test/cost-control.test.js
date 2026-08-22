import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/tooling-smoke.yml', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('ordinary CI is cost-bounded to one Ubuntu validation runner', () => {
  assert.match(workflow, /validate:\s*\n[\s\S]*?runs-on: ubuntu-latest/);
  assert.doesNotMatch(workflow, /apt-get/);
  assert.doesNotMatch(workflow, /\n\s*maltego_linux:/);
  assert.doesNotMatch(workflow, /\n\s*publish_status:/);
  assert.match(workflow, /cancel-in-progress: true/);
});

test('macOS and Windows CI can run only after explicit full_cross_platform dispatch and successful validate', () => {
  for (const job of ['maltego_macos', 'maltego_windows']) {
    const start = workflow.indexOf(`  ${job}:`);
    assert.notEqual(start, -1, job);
    const nextJob = workflow.indexOf('\n  maltego_', start + 1);
    const block = workflow.slice(start, nextJob === -1 ? workflow.length : nextJob);
    assert.match(block, /needs: validate/);
    assert.match(block, /github\.event_name == 'workflow_dispatch'/);
    assert.match(block, /inputs\.full_cross_platform/);
    assert.match(block, /needs\.validate\.result == 'success'/);
  }
});

test('automatic Vercel Git deployments are disabled so production is explicit exact-main finalization only', () => {
  assert.equal(vercel?.git?.deploymentEnabled, false);
});
