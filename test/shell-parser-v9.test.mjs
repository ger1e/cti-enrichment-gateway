import assert from 'node:assert/strict';
import test from 'node:test';

import { PIPELINE_LIMITS } from '../app/shell-core/types.js';
import { parseShellLine, parseShellTokens, tokenizeShellLine } from '../app/shell-core/parser.js';

const stages = input => parseShellLine(input).stages.map(stage => [...stage.tokens]);

test('tokenizer preserves quoting and backslash escapes while exposing native pipes', () => {
  assert.deepEqual(tokenizeShellLine('echo "a b" c\\ d | grep b'), ['echo', 'a b', 'c d', '|', 'grep', 'b']);
  assert.deepEqual(tokenizeShellLine("echo 'a|b'"), ['echo', 'a|b']);
});

test('parser preserves argument text and creates pipeline stages', () => {
  assert.deepEqual(stages('enrich "Example.COM" --full | evidence | head 20'), [
    ['enrich', 'Example.COM', '--full'],
    ['evidence'],
    ['head', '20'],
  ]);
});

test('parser rejects host-shell execution and chaining syntax', () => {
  for (const line of [
    'echo `id`',
    'echo $(id)',
    'help && whoami',
    'help || whoami',
    'help; whoami',
    'echo x > file',
    'cat < file',
  ]) {
    assert.throws(() => parseShellLine(line), error => error.code === 'INVALID_SYNTAX', line);
  }
});

test('comparison operators are valid only in where expressions', () => {
  assert.deepEqual(stages('result evidence | where confidence >= 0.8'), [
    ['result', 'evidence'],
    ['where', 'confidence', '>=', '0.8'],
  ]);
  assert.deepEqual(stages('result evidence | where confidence < 1'), [
    ['result', 'evidence'],
    ['where', 'confidence', '<', '1'],
  ]);
  assert.throws(() => parseShellLine('echo x >= y'), error => error.code === 'INVALID_SYNTAX');
});

test('empty and oversized pipelines fail closed', () => {
  for (const line of ['| help', 'help |', 'help || echo']) {
    assert.throws(() => parseShellLine(line), error => error.code === 'INVALID_SYNTAX');
  }
  const tooLong = Array.from({ length: PIPELINE_LIMITS.stages + 1 }, () => 'help').join(' | ');
  assert.throws(() => parseShellLine(tooLong), error => error.code === 'OUTPUT_LIMIT');
});

test('unterminated quotes fail rather than silently changing arguments', () => {
  assert.throws(() => parseShellLine('echo "unfinished'), error => error.code === 'INVALID_SYNTAX');
});

test('argv parser treats literal pipe tokens as PARA11AX pipeline separators', () => {
  assert.deepEqual(parseShellTokens(['provider', 'list', '|', 'head', '2']).stages.map(stage => [...stage.tokens]), [
    ['provider', 'list'],
    ['head', '2'],
  ]);
  assert.throws(() => parseShellTokens(['help', '&&', 'whoami']), error => error.code === 'INVALID_SYNTAX');
});
