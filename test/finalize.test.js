import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const finalizePath = new URL('../scripts/finalize.ps1', import.meta.url);
const workflowPath = new URL('../.github/workflows/tooling-smoke.yml', import.meta.url);
const verifyRepoPath = new URL('../scripts/verify-repo.sh', import.meta.url);

function read(path) {
  return readFileSync(path, 'utf8');
}

test('finalizer protects main with PR-only changes and required Tooling smoke before deployment', () => {
  const source = read(finalizePath);

  assert.match(source, /Invoke-Gh|gh(?:\.exe)?/i);
  assert.match(source, /branches\/main\/protection/);
  assert.match(source, /Tooling smoke/);
  assert.match(source, /required_pull_request_reviews/);
  assert.match(source, /required_status_checks/);
  assert.match(source, /enforce_admins/);
  assert.match(source, /allow_force_pushes/);
  assert.match(source, /allow_deletions/);
  assert.match(source, /status --porcelain/);
  assert.match(source, /fetch[^\r\n]*origin[^\r\n]*main/);
  assert.match(source, /rev-parse[^\r\n]*(FETCH_HEAD|origin\/main)/);
  assert.match(source, /bootstrap-vercel\.ps1/);
});

test('finalizer verifies the current Tooling smoke status and reads branch protection back', () => {
  const source = read(finalizePath);

  assert.match(source, /commits\/.*\/status/);
  assert.match(source, /success/i);
  assert.match(source, /ConvertFrom-Json/);
  assert.match(source, /required_status_checks/);
  assert.match(source, /required_pull_request_reviews/);
});

test('finalizer refuses unapproved origin, dirty source, stale main, or missing authenticated GitHub CLI', () => {
  const source = read(finalizePath);

  assert.match(source, /ger1e\/cti-enrichment-gateway/);
  assert.match(source, /Unexpected origin|approved repository/i);
  assert.match(source, /modified or untracked|dirty/i);
  assert.match(source, /current origin\/main|stale/i);
  assert.match(source, /auth status/);
  assert.match(source, /GitHub CLI|gh\.exe|gh command/i);
});

test('Tooling smoke parses the finalizer and repository invariants require its contract', () => {
  const workflow = read(workflowPath);
  const verifyRepo = read(verifyRepoPath);

  assert.match(workflow, /'scripts\/finalize\.ps1'/);
  assert.match(verifyRepo, /finalize\.ps1/);
  assert.match(verifyRepo, /Tooling smoke/);
  assert.match(verifyRepo, /branches\/main\/protection/);
});

test('Tooling smoke is fail-closed, exact-SHA, PR/manual only, and single-runner Ubuntu on the private repo', () => {
  const workflow = read(workflowPath);
  const runnerLines = workflow.match(/^\s*runs-on:/gm) ?? [];

  assert.match(workflow, /name: Enforce core validation result/);
  assert.match(workflow, /STATUS_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(workflow, /statuses\/\$\{STATUS_SHA\}/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.equal(runnerLines.length, 1);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.doesNotMatch(workflow, /runs-on: macos-latest/);
  assert.doesNotMatch(workflow, /runs-on: windows-latest/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /^\s+schedule:/m);
});
