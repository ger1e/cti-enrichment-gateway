#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REPOSITORY = 'ger1e/para11ax';
const BRANCH = 'main';
const REQUIRED_STATUS = 'Tooling smoke';
const MAX_OUTPUT_BYTES = 1_000_000;
const MAX_VIOLATIONS = 16;

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

function add(violations, code) {
  if (violations.length < MAX_VIOLATIONS) violations.push(code);
}

function enabled(value) {
  return value?.enabled === true;
}

export function validatePublicProtectedGovernance(repo, branch, protection) {
  const violations = [];

  if (!repo || typeof repo !== 'object' || repo.private !== false || repo.visibility !== 'public') {
    add(violations, 'repository_not_public');
  }
  if (!branch || typeof branch !== 'object' || branch.name !== BRANCH) {
    add(violations, 'main_branch_unavailable');
  }
  if (branch?.protected !== true) {
    add(violations, 'main_not_protected');
  }
  if (!protection || typeof protection !== 'object' || Array.isArray(protection)) {
    add(violations, 'invalid_protection_payload');
    return violations;
  }

  const status = protection.required_status_checks;
  if (!status || status.strict !== true) add(violations, 'strict_status');
  const contexts = [
    ...(Array.isArray(status?.contexts) ? status.contexts : []),
    ...(Array.isArray(status?.checks) ? status.checks.map(item => item?.context) : []),
  ].filter(value => typeof value === 'string');
  if (!contexts.includes(REQUIRED_STATUS)) add(violations, 'required_status');

  if (!enabled(protection.enforce_admins)) add(violations, 'admin_enforcement');

  const reviews = protection.required_pull_request_reviews;
  if (!reviews || typeof reviews !== 'object') {
    add(violations, 'pull_request_required');
  } else {
    if (reviews.dismiss_stale_reviews !== true) add(violations, 'stale_review_dismissal');
    if (reviews.required_approving_review_count !== 0) add(violations, 'solo_maintainer_review_policy');
  }

  if (!enabled(protection.required_linear_history)) add(violations, 'linear_history');
  if (!enabled(protection.required_conversation_resolution)) add(violations, 'conversation_resolution');
  if (protection.allow_force_pushes?.enabled !== false) add(violations, 'force_push_denied');
  if (protection.allow_deletions?.enabled !== false) add(violations, 'deletion_denied');

  return violations;
}

function main() {
  try {
    const repo = parseJson(runGh(['api', `repos/${REPOSITORY}`]), 'repository');
    const branch = parseJson(runGh(['api', `repos/${REPOSITORY}/branches/${BRANCH}`]), 'branch');
    const protection = parseJson(runGh(['api', `repos/${REPOSITORY}/branches/${BRANCH}/protection`]), 'branch protection');
    const violations = validatePublicProtectedGovernance(repo, branch, protection);

    if (violations.length) {
      process.stderr.write(`governance verification failed: ${violations.join(',')}\n`);
      return 2;
    }

    process.stdout.write(`governance_ok repository=${REPOSITORY} branch=${BRANCH} mode=public_protected required_status=${REQUIRED_STATUS.replace(/\s+/g, '_')}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`governance verification unavailable: ${error?.message ?? 'unknown error'}\n`);
    return 3;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
