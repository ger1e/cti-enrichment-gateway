import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('user-facing PARA11AX copy never calls the product an Evidence Gateway', async () => {
  const [landing, readme, shell] = await Promise.all([
    read('index.html'),
    read('README.md'),
    read('app/shell-ui.js'),
  ]);

  for (const source of [landing, readme, shell]) assert.doesNotMatch(source, /evidence gateway/i);

  assert.match(landing, /CTI enrichment and correlation platform/i);
  assert.match(readme, /CTI enrichment and correlation platform/i);
  assert.match(shell, /CTI Enrichment \/\/ session unauthenticated/);
  assert.match(shell, /CTI Enrichment client v2/);
});
