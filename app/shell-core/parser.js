import { shellError } from './errors.js';
import { PIPELINE_LIMITS } from './types.js';

const COMPARISON_OPERATORS = new Set(['==', '!=', '<', '<=', '>', '>=']);

function invalid(message) {
  throw shellError('INVALID_SYNTAX', message);
}

export function tokenizeShellLine(input) {
  const tokens = [];
  let value = '';
  let quote = null;
  let escaped = false;

  const push = () => {
    if (value !== '') {
      tokens.push(value);
      value = '';
    }
  };

  for (const char of String(input ?? '')) {
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else value += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '|') {
      push();
      tokens.push('|');
      continue;
    }
    if (/\s/.test(char)) {
      push();
      continue;
    }
    value += char;
  }

  if (quote) invalid('unterminated quoted string');
  if (escaped) value += '\\';
  push();
  return tokens;
}

function rejectRawHostShellSyntax(input) {
  const text = String(input ?? '');
  let quote = null;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '`') invalid('host command substitution is not supported');
    if (char === '$' && text[index + 1] === '(') invalid('host command substitution is not supported');
    if (char === '&' && text[index + 1] === '&') invalid('host command chaining is not supported');
    if (char === '|' && text[index + 1] === '|') invalid('host command chaining is not supported');
    if (char === ';') invalid('host command chaining is not supported');
  }
}

function rejectArgvHostShellSyntax(tokens) {
  for (const raw of tokens) {
    const token = String(raw);
    if (token.includes('`') || token.includes('$(')) invalid('host command substitution is not supported');
    if (token.includes('&&') || token.includes('||') || token.includes(';')) invalid('host command chaining is not supported');
  }
}

function splitPipeline(tokens, limits) {
  if (tokens.length === 0) return [];
  const stages = [];
  let current = [];
  for (const token of tokens) {
    if (token === '|') {
      if (current.length === 0) invalid('empty pipeline stage');
      stages.push(current);
      current = [];
      continue;
    }
    current.push(token);
  }
  if (current.length === 0) invalid('empty pipeline stage');
  stages.push(current);
  if (stages.length > limits.stages) {
    throw shellError('OUTPUT_LIMIT', 'pipeline stage limit exceeded', { limit: limits.stages });
  }
  return stages;
}

function tokenContainsRedirectSyntax(token) {
  return token.includes('<') || token.includes('>');
}

function validateStageSyntax(stages) {
  for (const stage of stages) {
    const command = String(stage[0] ?? '').toLowerCase();
    for (let index = 0; index < stage.length; index += 1) {
      const token = String(stage[index]);
      if (token === '&&' || token === '||' || token === ';' || token.includes('`') || token.includes('$(')) {
        invalid('host shell syntax is not supported');
      }
      if (!tokenContainsRedirectSyntax(token)) continue;
      const whereOperatorPosition = command === 'where' && index === 2 && COMPARISON_OPERATORS.has(token);
      if (!whereOperatorPosition) invalid('host redirect syntax is not supported');
    }
  }
}

function freezeAst(stages) {
  return Object.freeze({
    type: 'pipeline',
    stages: Object.freeze(stages.map(tokens => Object.freeze({
      type: 'invocation',
      tokens: Object.freeze([...tokens]),
    }))),
  });
}

export function parseShellLine(input, { limits = PIPELINE_LIMITS } = {}) {
  rejectRawHostShellSyntax(input);
  const stages = splitPipeline(tokenizeShellLine(input), limits);
  validateStageSyntax(stages);
  return freezeAst(stages);
}

export function parseShellTokens(argv, { limits = PIPELINE_LIMITS } = {}) {
  if (!Array.isArray(argv)) throw shellError('INVALID_ARGUMENT', 'argv token array required');
  const tokens = argv.map(token => String(token));
  rejectArgvHostShellSyntax(tokens);
  const stages = splitPipeline(tokens, limits);
  validateStageSyntax(stages);
  return freezeAst(stages);
}
