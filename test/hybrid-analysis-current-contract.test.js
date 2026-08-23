import test from 'node:test';
import assert from 'node:assert/strict';
import { hybridAnalysisProvider } from '../src/providers/hybrid-analysis.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('Hybrid Analysis GET search/hash parses current SearchByHash object including top-level sha256s', async () => {
  const related = 'b'.repeat(64);
  const output = await hybridAnalysisProvider.run(
    { type: 'hash', value: 'a'.repeat(64) },
    {
      env: { HYBRID_ANALYSIS_API_KEY: 'test-key' },
      fetchImpl: async () => json({
        sha256s: [related],
        reports: [
          { id: 'r1', environment_id: 160, state: 'SUCCESS', verdict: 'malicious' },
        ],
      }),
    },
  );
  assert.equal(output.verdict, 'malicious');
  assert.equal(output.attributes.reportCount, 1);
  assert.equal(output.relationships.some(row => row.targetType === 'hash' && row.target === related), true);
});
