import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { COMMAND_DESCRIPTORS } from '../app/shell-core/catalog.js';

const SHELL_DOC = new URL('../docs/SHELL.md', import.meta.url);
const SHODAN_DOC = new URL('../docs/SHODAN-SHELL.md', import.meta.url);
const README = new URL('../README.md', import.meta.url);

const namespaces = [...new Set(COMMAND_DESCRIPTORS.map(descriptor => descriptor.namespace))].sort();
const providerAliases = COMMAND_DESCRIPTORS
  .filter(descriptor => descriptor.id.startsWith('provider.alias.'))
  .map(descriptor => descriptor.tokens.join(' '))
  .sort();

test('unified shell documentation exists as the canonical operator command reference', () => {
  assert.equal(existsSync(SHELL_DOC), true, 'docs/SHELL.md must exist');
});

test('shell documentation tracks live namespaces and fixed provider shorthands', () => {
  if (!existsSync(SHELL_DOC)) return;
  const doc = readFileSync(SHELL_DOC, 'utf8');
  for (const namespace of namespaces) assert.match(doc, new RegExp(`\\b${namespace}\\b`, 'i'), namespace);
  for (const alias of providerAliases) assert.match(doc, new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i'), alias);
});

test('shell documentation states pipeline, surface, and hard security boundaries', () => {
  if (!existsSync(SHELL_DOC)) return;
  const doc = readFileSync(SHELL_DOC, 'utf8');
  for (const literal of ['|', 'CLI ONLY', 'WEB ONLY', '12 stages', '1,000 records', '2,000,000', '512,000', '10,000']) {
    assert.ok(doc.includes(literal), literal);
  }
  for (const forbidden of ['backticks', '$()', '&&', '||', 'semicolon', 'redirect', 'arbitrary OS', 'arbitrary URL', 'credential persistence']) {
    assert.match(doc, new RegExp(forbidden.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i'), forbidden);
  }
});

test('Shodan documentation locates the specialist surface inside the unified command fabric', () => {
  const doc = readFileSync(SHODAN_DOC, 'utf8');
  assert.match(doc, /unified command fabric/i);
  assert.match(doc, /docs\/SHELL\.md|SHELL\.md/i);
});

test('README links the canonical unified shell reference', () => {
  const readme = readFileSync(README, 'utf8');
  assert.match(readme, /docs\/SHELL\.md/);
});
