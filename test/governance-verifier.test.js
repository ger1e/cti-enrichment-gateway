import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicProtectedGovernance } from '../scripts/verify-github-governance.mjs';

function validRepo() {
  return { private: false, visibility: 'public' };
}

function validBranch() {
  return { name: 'main', protected: true };
}

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

test('governance verifier accepts the exact public solo-maintainer protection contract', () => {
  assert.deepEqual(validatePublicProtectedGovernance(validRepo(), validBranch(), validProtection()), []);
});

test('governance verifier rejects public visibility and protected-main failures independently', () => {
  assert.ok(validatePublicProtectedGovernance({ private: true, visibility: 'private' }, validBranch(), validProtection()).includes('repository_not_public'));
  assert.ok(validatePublicProtectedGovernance(validRepo(), { name: 'main', protected: false }, validProtection()).includes('main_not_protected'));
  assert.ok(validatePublicProtectedGovernance(validRepo(), { name: 'other', protected: true }, validProtection()).includes('main_branch_unavailable'));
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
    assert.ok(validatePublicProtectedGovernance(validRepo(), validBranch(), protection).includes(code), code);
  }
});

test('governance verifier accepts required checks represented by GitHub checks objects', () => {
  const protection = validProtection();
  protection.required_status_checks.contexts = [];
  protection.required_status_checks.checks = [{ context: 'Tooling smoke', app_id: 1 }];
  assert.deepEqual(validatePublicProtectedGovernance(validRepo(), validBranch(), protection), []);
});

test('governance verifier fails closed on absent or malformed protection payloads', () => {
  for (const value of [null, [], {}, 'bad']) {
    const violations = validatePublicProtectedGovernance(validRepo(), validBranch(), value);
    assert.ok(violations.length > 0);
    assert.ok(violations.length <= 16);
  }
});
