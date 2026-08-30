import { ShellCommandError, shellError } from './errors.js';
import { PIPELINE_LIMITS, assertBoundedValue } from './types.js';
import { TRANSFORM_HANDLERS } from './transforms.js';

function capabilitySet(value) {
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}

function aborted(signal) {
  if (signal?.aborted) throw shellError('OPERATION_ABORTED', 'operation aborted');
}

function validateAst(ast, limits) {
  if (!ast || ast.type !== 'pipeline' || !Array.isArray(ast.stages)) {
    throw shellError('INVALID_ARGUMENT', 'pipeline AST required');
  }
  if (ast.stages.length > limits.stages) {
    throw shellError('OUTPUT_LIMIT', 'pipeline stage limit exceeded', { limit: limits.stages });
  }
  for (const stage of ast.stages) {
    if (!stage || stage.type !== 'invocation' || !Array.isArray(stage.tokens) || stage.tokens.length === 0) {
      throw shellError('INVALID_ARGUMENT', 'invalid pipeline invocation');
    }
  }
}

function validateGate(descriptor, resolved, input, context) {
  if (!resolved.surfaceAvailable) {
    throw shellError('SURFACE_UNAVAILABLE', 'command is unavailable on this surface', { command: descriptor.id });
  }
  if (descriptor.auth === 'required' && !context.authenticated) {
    throw shellError('AUTH_REQUIRED', 'authentication required', { command: descriptor.id });
  }
  const available = capabilitySet(context.capabilities);
  const missing = descriptor.capabilities.filter(capability => !available.has(capability));
  if (missing.length) {
    throw shellError('CAPABILITY_UNAVAILABLE', 'required capability unavailable', { command: descriptor.id, capabilities: missing });
  }
  if (!descriptor.inputTypes.includes(input.type)) {
    throw shellError('PIPELINE_TYPE_MISMATCH', 'pipeline input type is not accepted by command', {
      command: descriptor.id,
      expected: descriptor.inputTypes,
      actual: input.type,
    });
  }
}

async function executeStage({ descriptor, args, input, executor, context, signal, limits }) {
  const transform = TRANSFORM_HANDLERS[descriptor.handler];
  if (typeof transform === 'function') return transform({ input, args, limits });
  if (!executor || typeof executor.execute !== 'function') {
    throw shellError('CAPABILITY_UNAVAILABLE', 'surface executor unavailable', { command: descriptor.id });
  }
  return executor.execute({ descriptor, args, input, context, signal });
}

export async function executePipeline(ast, {
  registry,
  executor,
  context = {},
  signal = null,
  limits = PIPELINE_LIMITS,
} = {}) {
  validateAst(ast, limits);
  if (!registry || typeof registry.resolve !== 'function') throw shellError('INVALID_ARGUMENT', 'command registry required');

  const surface = context.surface ?? 'web';
  let input = { type: 'void', value: null };

  for (const stage of ast.stages) {
    aborted(signal);
    const resolved = registry.resolve(stage.tokens, surface);
    if (!resolved) {
      throw shellError('COMMAND_NOT_FOUND', 'command not found', { command: String(stage.tokens[0] ?? '').toLowerCase() });
    }

    const { descriptor, args } = resolved;
    validateGate(descriptor, resolved, input, context);

    let output;
    try {
      output = await executeStage({ descriptor, args, input, executor, context, signal, limits });
    } catch (error) {
      if (error instanceof ShellCommandError) throw error;
      if (error?.name === 'AbortError' || signal?.aborted) throw shellError('OPERATION_ABORTED', 'operation aborted');
      throw shellError('UPSTREAM_FAILED', 'command execution failed', { command: descriptor.id });
    }

    aborted(signal);
    try {
      assertBoundedValue(output, limits);
    } catch (error) {
      if (error instanceof ShellCommandError) throw error;
      throw shellError('UPSTREAM_FAILED', 'command returned an invalid typed value', { command: descriptor.id });
    }
    input = output;
  }

  return input;
}
