import { shellError } from './errors.js';
import { PIPELINE_LIMITS, assertBoundedValue } from './types.js';

const PATH_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;
const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const COMPARATORS = new Set(['==', '!=', '<', '<=', '>', '>=']);

function typed(type, value, limits) {
  const output = { type, value };
  assertBoundedValue(output, limits);
  return output;
}

function requireType(input, accepted) {
  if (!input || !accepted.includes(input.type)) {
    throw shellError('PIPELINE_TYPE_MISMATCH', `expected ${accepted.join(' or ')} input`, {
      expected: accepted,
      actual: input?.type ?? 'void',
    });
  }
}

function validatePath(path) {
  const text = String(path ?? '');
  if (!PATH_PATTERN.test(text)) throw shellError('INVALID_ARGUMENT', 'invalid field path');
  const segments = text.split('.');
  if (segments.some(segment => !segment || FORBIDDEN_PATH_SEGMENTS.has(segment))) {
    throw shellError('INVALID_ARGUMENT', 'invalid field path');
  }
  return segments;
}

function getPath(value, path) {
  const segments = validatePath(path);
  let current = value;
  for (const segment of segments) {
    if (current == null) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      const index = Number(segment);
      if (!Number.isSafeInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
      continue;
    }
    if (typeof current !== 'object' || Array.isArray(current) || !Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

function comparable(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'number', value };
  if (typeof value === 'boolean') return { kind: 'string', value: String(value) };
  if (typeof value !== 'string') return { kind: 'string', value: value == null ? '' : String(value) };
  const trimmed = value.trim();
  if (trimmed !== '' && /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) {
    const number = Number(trimmed);
    if (Number.isFinite(number)) return { kind: 'number', value: number };
  }
  return { kind: 'string', value };
}

function compare(left, operator, right) {
  const a = comparable(left);
  const b = comparable(right);
  const numeric = a.kind === 'number' && b.kind === 'number';
  const x = numeric ? a.value : String(a.value);
  const y = numeric ? b.value : String(b.value);
  if (operator === '==') return x === y;
  if (operator === '!=') return x !== y;
  if (operator === '<') return x < y;
  if (operator === '<=') return x <= y;
  if (operator === '>') return x > y;
  if (operator === '>=') return x >= y;
  throw shellError('INVALID_ARGUMENT', 'unsupported comparison operator');
}

function positiveBoundedCount(args, limit) {
  if (args.length !== 1 || !/^(?:0|[1-9]\d*)$/.test(String(args[0]))) {
    throw shellError('INVALID_ARGUMENT', 'count must be a non-negative integer');
  }
  const count = Number(args[0]);
  if (!Number.isSafeInteger(count)) throw shellError('INVALID_ARGUMENT', 'count is out of range');
  if (count > limit) throw shellError('OUTPUT_LIMIT', 'requested count exceeds transform limit', { limit });
  return count;
}

function lines(text) {
  return text === '' ? [] : String(text).split(/\r?\n/);
}

function stableSerialized(value) {
  try { return JSON.stringify(value); }
  catch { throw shellError('INVALID_ARGUMENT', 'record is not serializable'); }
}

function dynamicType(value) {
  if (Array.isArray(value)) return 'records';
  if (value !== null && typeof value === 'object') return 'record';
  return 'scalar';
}

const handlers = {
  where({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['records']);
    assertBoundedValue(input, limits);
    if (args.length !== 3 || !COMPARATORS.has(args[1])) throw shellError('INVALID_ARGUMENT', 'usage: where <field> <operator> <value>');
    validatePath(args[0]);
    return typed('records', input.value.filter(record => compare(getPath(record, args[0]), args[1], args[2])), limits);
  },

  select({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['record']);
    assertBoundedValue(input, limits);
    if (!args.length) throw shellError('INVALID_ARGUMENT', 'select requires at least one field');
    const output = {};
    for (const path of args) {
      validatePath(path);
      output[path] = getPath(input.value, path);
    }
    return typed('record', output, limits);
  },

  fields({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['records']);
    assertBoundedValue(input, limits);
    if (!args.length) throw shellError('INVALID_ARGUMENT', 'fields requires at least one field');
    args.forEach(validatePath);
    const output = input.value.map(record => Object.fromEntries(args.map(path => [path, getPath(record, path)])));
    return typed('records', output, limits);
  },

  pluck({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['records']);
    assertBoundedValue(input, limits);
    if (args.length !== 1) throw shellError('INVALID_ARGUMENT', 'pluck requires exactly one field');
    validatePath(args[0]);
    return typed('records', input.value.map(record => getPath(record, args[0])), limits);
  },

  jsonpath({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['record', 'records', 'enrichment', 'graph', 'guidance']);
    assertBoundedValue(input, limits);
    if (args.length !== 1) throw shellError('INVALID_ARGUMENT', 'jsonpath requires exactly one dotted path');
    const value = getPath(input.value, args[0]);
    return typed(dynamicType(value), value, limits);
  },

  sort({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['records', 'text']);
    assertBoundedValue(input, limits);
    if (input.type === 'text') {
      if (args.length > 1 || (args[0] && !['asc', 'desc'].includes(args[0]))) throw shellError('INVALID_ARGUMENT', 'usage: sort [asc|desc]');
      const direction = args[0] === 'desc' ? -1 : 1;
      const output = lines(input.value).map((value, index) => ({ value, index }))
        .sort((a, b) => direction * a.value.localeCompare(b.value) || a.index - b.index)
        .map(item => item.value).join('\n');
      return typed('text', output, limits);
    }
    if (args.length < 1 || args.length > 2 || (args[1] && !['asc', 'desc'].includes(args[1]))) {
      throw shellError('INVALID_ARGUMENT', 'usage: sort <field> [asc|desc]');
    }
    validatePath(args[0]);
    const direction = args[1] === 'desc' ? -1 : 1;
    const output = input.value.map((value, index) => ({ value, index })).sort((a, b) => {
      const left = getPath(a.value, args[0]);
      const right = getPath(b.value, args[0]);
      const c = comparable(left);
      const d = comparable(right);
      let result;
      if (c.kind === 'number' && d.kind === 'number') result = c.value - d.value;
      else result = String(c.value).localeCompare(String(d.value));
      return direction * result || a.index - b.index;
    }).map(item => item.value);
    return typed('records', output, limits);
  },

  unique({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['records']);
    assertBoundedValue(input, limits);
    if (args.length) throw shellError('INVALID_ARGUMENT', 'unique takes no arguments');
    const seen = new Set();
    const output = [];
    for (const record of input.value) {
      const key = stableSerialized(record);
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(record);
    }
    return typed('records', output, limits);
  },

  count({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['records']);
    assertBoundedValue(input, limits);
    if (args.length) throw shellError('INVALID_ARGUMENT', 'count takes no arguments');
    return typed('scalar', input.value.length, limits);
  },

  group({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['records']);
    assertBoundedValue(input, limits);
    if (args.length !== 1) throw shellError('INVALID_ARGUMENT', 'group requires exactly one field');
    validatePath(args[0]);
    const groups = new Map();
    for (const record of input.value) {
      const key = getPath(record, args[0]);
      const identity = stableSerialized(key);
      let group = groups.get(identity);
      if (!group) {
        group = { key, count: 0, records: [] };
        groups.set(identity, group);
      }
      group.count += 1;
      group.records.push(record);
    }
    return typed('records', [...groups.values()], limits);
  },

  head({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['records', 'text']);
    assertBoundedValue(input, limits);
    const max = input.type === 'text' ? limits.textLines : limits.records;
    const count = positiveBoundedCount(args, max);
    if (input.type === 'text') return typed('text', lines(input.value).slice(0, count).join('\n'), limits);
    return typed('records', input.value.slice(0, count), limits);
  },

  tail({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['records', 'text']);
    assertBoundedValue(input, limits);
    const max = input.type === 'text' ? limits.textLines : limits.records;
    const count = positiveBoundedCount(args, max);
    if (input.type === 'text') return typed('text', count === 0 ? '' : lines(input.value).slice(-count).join('\n'), limits);
    return typed('records', count === 0 ? [] : input.value.slice(-count), limits);
  },

  grep({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['text']);
    assertBoundedValue(input, limits);
    if (!args.length) throw shellError('INVALID_ARGUMENT', 'grep requires a literal pattern');
    const pattern = args.join(' ');
    if (pattern.length > 256) throw shellError('INVALID_ARGUMENT', 'grep pattern is too long');
    return typed('text', lines(input.value).filter(line => line.includes(pattern)).join('\n'), limits);
  },

  wc({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['text']);
    assertBoundedValue(input, limits);
    if (args.length > 1 || (args[0] && !['-l', '-w', '-c'].includes(args[0]))) throw shellError('INVALID_ARGUMENT', 'usage: wc [-l|-w|-c]');
    if (args[0] === '-l') return typed('scalar', lines(input.value).length, limits);
    if (args[0] === '-c') return typed('scalar', new TextEncoder().encode(input.value).length, limits);
    const trimmed = input.value.trim();
    return typed('scalar', trimmed ? trimmed.split(/\s+/).length : 0, limits);
  },

  uniq({ input, args, limits = PIPELINE_LIMITS }) {
    requireType(input, ['text']);
    assertBoundedValue(input, limits);
    if (args.length) throw shellError('INVALID_ARGUMENT', 'uniq takes no arguments');
    const output = [];
    for (const line of lines(input.value)) {
      if (!output.length || output.at(-1) !== line) output.push(line);
    }
    return typed('text', output.join('\n'), limits);
  },
};

export const TRANSFORM_HANDLERS = Object.freeze(handlers);
