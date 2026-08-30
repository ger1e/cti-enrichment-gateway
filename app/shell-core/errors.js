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

export class ShellCommandError extends Error {
  constructor(code, message, context = {}) {
    super(String(message));
    this.name = 'ShellCommandError';
    this.code = code;
    this.context = Object.freeze({ ...context });
  }
}

export function shellError(code, message, context = {}) {
  if (!SHELL_ERROR_CODES.includes(code)) throw new TypeError(`unknown shell error code: ${code}`);
  return new ShellCommandError(code, message, context);
}
