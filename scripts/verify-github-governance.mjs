#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const REPOSITORY = 'ger1e/cti-enrichment-gateway';
const BRANCH = 'main';
const REQUIRED_STATUS = 'Tooling smoke';
const MAX_OUTPUT_BYTES = 1_000_000;

function runGh(args) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    shell: false,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new Error(`gh ${args.join(' ')} failed`);
  if (Buffer.byteLength(result.stdout ?? '', 'utf8') > MAX_OUTPUT_BYTES) throw new Error('GitHub response exceeded bounded output limit');
  return result.stdout;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} response was not valid JSON`);
  }
}

export function validatePrivateFreeGovernance(repo, branch) {
  const violations = [];
  if (!repo || typeof repo !== 'object' || repo.private !== true) {
    violations.push('repository_not_private');
  }
  if (!branch || typeof branch !== 'object' || branch.name !== BRANCH) {
    violations.push('main_branch_unavailable');
  }
  return violations;
}

function main() {
  try {
    const repo = parseJson(runGh(['api', `repos/${REPOSITORY}`]), 'repository');
    const branch = parseJson(runGh(['api', `repos/${REPOSITORY}/branches/${BRANCH}`]), 'branch');
    const violations = validatePrivateFreeGovernance(repo, branch);
    if (violations.length) {
      process.stderr.write(`governance verification failed: ${violations.join(',')}\n`);
      return 2;
    }

    const mode = branch.protected === true ? 'protected' : 'private_free_procedural';
    process.stdout.write(`governance_ok repository=${REPOSITORY} branch=${BRANCH} mode=${mode} required_status=${REQUIRED_STATUS.replace(/\s+/g, '_')}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`governance verification unavailable: ${error?.message ?? 'unknown error'}\n`);
    return 3;
  }
}

process.exitCode = main();
