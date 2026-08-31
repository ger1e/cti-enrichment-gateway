export const SHELL_ERROR_CODES = Object.freeze([
  'COMMAND_NOT_FOUND',
  'INVALID_SYNTAX',
  'INVALID_ARGUMENT',
  'PIPELINE_TYPE_MISMATCH',
  'AUTH_REQUIRED',
  'CAPABILITY_UNAVAILABLE',
  'SURFACE_UNAVAILABLE',
  'PROVIDER_UNAVAILABLE',
  'POLICY_DENIED',
  'QUOTA_GUARD',
  'OUTPUT_LIMIT',
  'OPERATION_ABORTED',
  'UPSTREAM_FAILED',
]);

const SENSITIVE_CONTEXT_KEY = /(?:authorization|bearer|token|secret|password|credential|api[_-]?key)/i;
const MAX_CONTEXT_DEPTH = 6;
const MAX_CONTEXT_ITEMS = 64;

function sanitizeContextValue(value, depth = 0) {
  if (depth > MAX_CONTEXT_DEPTH) return '[REDACTED]';
  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, MAX_CONTEXT_ITEMS).map(item => sanitizeContextValue(item, depth + 1)));
  }
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_CONTEXT_ITEMS)) {
      output[key] = SENSITIVE_CONTEXT_KEY.test(key) ? '[REDACTED]' : sanitizeContextValue(item, depth + 1);
    }
    return Object.freeze(output);
  }
  if (typeof value === 'string') return value.slice(0, 4096);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  return String(value ?? '').slice(0, 4096);
}

export class ShellCommandError extends Error {
  constructor(code, message, context = {}) {
    super(String(message));
    this.name = 'ShellCommandError';
    this.code = code;
    this.context = sanitizeContextValue(context);
  }
}

export function shellError(code, message, context = {}) {
  if (!SHELL_ERROR_CODES.includes(code)) throw new TypeError(`unknown shell error code: ${code}`);
  return new ShellCommandError(code, message, context);
}
