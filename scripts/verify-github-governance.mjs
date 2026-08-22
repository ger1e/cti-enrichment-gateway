#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const REPOSITORY = 'ger1e/cti-enrichment-gateway';
const BRANCH = 'main';
const REQUIRED_STATUS = 'Tooling smoke';
const MAX_OUTPUT_BYTES = 1_000_000;
const MAX_VIOLATIONS = 16;

function add(violations, code, message) {
  if (violations.length < MAX_VIOLATIONS) violations.push({ code, message });
}

function enabled(value) {
  return value?.enabled === true;
}

export function validateBranchProtection(protection) {
  const violations = [];
  if (!protection || typeof protection !== 'object' || Array.isArray(protection)) {
    add(violations, 'invalid_protection_payload', 'branch protection payload is missing or malformed');
    return violations;
  }

  const status = protection.required_status_checks;
  if (!status || status.strict !== true) add(violations, 'strict_status', 'strict required status checks are not enabled');
  const contexts = [
    ...(Array.isArray(status?.contexts) ? status.contexts : []),
    ...(Array.isArray(status?.checks) ? status.checks.map(item => item?.context) : []),
  ].filter(value => typeof value === 'string');
  if (!contexts.includes(REQUIRED_STATUS)) add(violations, 'required_status', `required status '${REQUIRED_STATUS}' is missing`);

  if (!enabled(protection.enforce_admins)) add(violations, 'admin_enforcement', 'administrators are not bound by protection');

  const reviews = protection.required_pull_request_reviews;
  if (!reviews || typeof reviews !== 'object') {
    add(violations, 'pull_request_required', 'pull requests are not required');
  } else {
    if (reviews.dismiss_stale_reviews !== true) add(violations, 'stale_review_dismissal', 'stale approvals are not dismissed');
    if (reviews.required_approving_review_count !== 0) add(violations, 'solo_maintainer_review_policy', 'solo-maintainer policy must require PR flow without self-approval');
  }

  if (!enabled(protection.required_linear_history)) add(violations, 'linear_history', 'linear history is not required');
  if (!enabled(protection.required_conversation_resolution)) add(violations, 'conversation_resolution', 'review conversation resolution is not required');
  if (protection.allow_force_pushes?.enabled !== false) add(violations, 'force_push_denied', 'force pushes are not explicitly denied');
  if (protection.allow_deletions?.enabled !== false) add(violations, 'deletion_denied', 'branch deletion is not explicitly denied');
  return violations;
}

function readProtection() {
  const endpoint = `repos/${REPOSITORY}/branches/${BRANCH}/protection`;
  const result = spawnSync('gh', ['api', endpoint], {
    encoding: 'utf8',
    shell: false,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new Error('unable to read GitHub branch protection with authenticated gh');
  if (Buffer.byteLength(result.stdout ?? '', 'utf8') > MAX_OUTPUT_BYTES) throw new Error('GitHub branch protection response exceeded the bounded output limit');
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('GitHub branch protection response was not valid JSON');
  }
}

function main() {
  try {
    const violations = validateBranchProtection(readProtection());
    if (violations.length) {
      process.stderr.write(`governance verification failed: ${violations.map(item => item.code).join(',')}\n`);
      return 2;
    }
    process.stdout.write(`governance_ok repository=${REPOSITORY} branch=${BRANCH} status=${REQUIRED_STATUS.replace(/\s+/g, '_')}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`governance verification unavailable: ${error?.message ?? 'unknown error'}\n`);
    return 3;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) process.exitCode = main();
