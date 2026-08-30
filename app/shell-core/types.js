import { shellError } from './errors.js';

export const VALUE_TYPES = Object.freeze([
  'void',
  'text',
  'scalar',
  'record',
  'records',
  'enrichment',
  'evidence',
  'relationships',
  'graph',
  'guidance',
  'provider-list',
  'artifact',
  'error',
]);

export const PIPELINE_LIMITS = Object.freeze({
  stages: 12,
  records: 1000,
  intermediateBytes: 2_000_000,
  renderedBytes: 512_000,
  textLines: 10_000,
});

const encoder = new TextEncoder();

export function estimateValueBytes(value) {
  if (value == null) return 0;
  if (typeof value === 'string') return encoder.encode(value).length;
  let serialized;
  try { serialized = JSON.stringify(value); }
  catch { throw shellError('INVALID_ARGUMENT', 'shell value is not serializable'); }
  return encoder.encode(serialized ?? '').length;
}

export function assertBoundedValue(input, limits = PIPELINE_LIMITS) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw shellError('INVALID_ARGUMENT', 'typed shell value required');
  }
  if (!VALUE_TYPES.includes(input.type)) {
    throw shellError('INVALID_ARGUMENT', `unknown shell value type: ${String(input.type)}`);
  }

  const value = input.value;
  if ((input.type === 'records' || input.type === 'provider-list' || input.type === 'evidence' || input.type === 'relationships') && Array.isArray(value)) {
    if (value.length > limits.records) {
      throw shellError('OUTPUT_LIMIT', 'record limit exceeded', { limit: limits.records });
    }
  }

  if (input.type === 'text' && typeof value === 'string') {
    const lines = value === '' ? 0 : value.split(/\r?\n/).length;
    if (lines > limits.textLines) {
      throw shellError('OUTPUT_LIMIT', 'text line limit exceeded', { limit: limits.textLines });
    }
  }

  const bytes = estimateValueBytes(value);
  if (bytes > limits.intermediateBytes) {
    throw shellError('OUTPUT_LIMIT', 'intermediate value byte limit exceeded', { limit: limits.intermediateBytes });
  }
  return true;
}
