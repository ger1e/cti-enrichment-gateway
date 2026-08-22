import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBranchProtection } from '../scripts/verify-github-governance.mjs';

function validProtection() {
  return {
    required_status_checks: {
      strict: true,
      contexts: ['Tooling smoke'],
      checks: [],
    },
    enforce_admins: { enabled: true },
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: false,
      required_approving_review_count: 0,
    },
    required_linear_history: { enabled: true },
    required_conversation_resolution: { enabled: true },
    allow_force_pushes: { enabled: false },
    allow_deletions: { enabled: false },
  };
}

test('governance verifier accepts the exact solo-maintainer protection contract', () => {
  assert.deepEqual(validateBranchProtection(validProtection()), []);
});

test('governance verifier rejects every required protection property independently', () => {
  const cases = [
    ['strict_status', p => { p.required_status_checks.strict = false; }],
    ['required_status', p => { p.required_status_checks.contexts = []; }],
    ['admin_enforcement', p => { p.enforce_admins.enabled = false; }],
    ['pull_request_required', p => { p.required_pull_request_reviews = null; }],
    ['stale_review_dismissal', p => { p.required_pull_request_reviews.dismiss_stale_reviews = false; }],
    ['solo_maintainer_review_policy', p => { p.required_pull_request_reviews.required_approving_review_count = 1; }],
    ['linear_history', p => { p.required_linear_history.enabled = false; }],
    ['conversation_resolution', p => { p.required_conversation_resolution.enabled = false; }],
    ['force_push_denied', p => { p.allow_force_pushes.enabled = true; }],
    ['deletion_denied', p => { p.allow_deletions.enabled = true; }],
  ];
  for (const [code, mutate] of cases) {
    const protection = validProtection();
    mutate(protection);
    assert.ok(validateBranchProtection(protection).some(item => item.code === code), code);
  }
});

test('governance verifier accepts required checks represented by GitHub checks objects', () => {
  const protection = validProtection();
  protection.required_status_checks.contexts = [];
  protection.required_status_checks.checks = [{ context: 'Tooling smoke', app_id: 1 }];
  assert.deepEqual(validateBranchProtection(protection), []);
});

test('governance verifier fails closed on absent or malformed protection payloads', () => {
  for (const value of [null, [], {}, 'bad']) {
    const violations = validateBranchProtection(value);
    assert.ok(violations.length > 0);
    assert.ok(violations.length <= 16);
  }
});
