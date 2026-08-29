import test from 'node:test';
import assert from 'node:assert/strict';
import { explainSemanticDiff } from '../src/core/change-explanation.js';

test('semantic diff explanations are fixed, deterministic, and de-duplicated', () => {
  const reasons = explainSemanticDiff({
    changes: [
      { category: 'decision_changed' },
      { category: 'evidence_added' },
      { category: 'evidence_added' },
      { category: 'provider_coverage_changed' },
    ],
  });
  assert.deepEqual(reasons, [
    'decision support changed',
    'new normalized evidence was observed',
    'provider coverage changed',
  ]);
});

test('unknown categories remain explicit and output is bounded to 16 reasons', () => {
  const changes = Array.from({ length: 20 }, (_, index) => ({ category: `unknown-${index}` }));
  const reasons = explainSemanticDiff({ changes });
  assert.deepEqual(reasons, ['semantic evidence changed']);
  assert.equal(reasons.length <= 16, true);
});
