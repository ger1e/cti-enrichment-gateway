import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const banned = /evidence gateway/i;
const textExtensions = /\.(?:md|html|js|mjs|css|svg|json|ya?ml|cff|txt)$/i;

async function collectTextFiles(dir = root, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (relative === 'test/no-evidence-gateway-copy.test.mjs') continue;
    const url = new URL(relative, root);
    if (entry.isDirectory()) files.push(...await collectTextFiles(url, relative));
    else if (textExtensions.test(entry.name)) files.push(relative);
  }
  return files;
}

test('PARA11AX branding never uses the Evidence Gateway label', async () => {
  const offenders = [];
  for (const file of await collectTextFiles()) {
    const content = await readFile(new URL(file, root), 'utf8');
    if (banned.test(content)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `remove Evidence Gateway branding from: ${offenders.join(', ')}`);
});

test('canonical public copy identifies PARA11AX as CTI enrichment', async () => {
  const [landing, readme, shell] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('README.md', root), 'utf8'),
    readFile(new URL('app/shell-ui.js', root), 'utf8'),
  ]);

  assert.match(landing, /CTI enrichment and correlation platform/i);
  assert.match(readme, /CTI enrichment and correlation platform/i);
  assert.match(shell, /CTI Enrichment \/\/ session unauthenticated/);
  assert.match(shell, /CTI Enrichment client v2/);
});
