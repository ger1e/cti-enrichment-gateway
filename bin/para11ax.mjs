#!/usr/bin/env node
import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { parseShellTokens } from '../app/shell-core/parser.js';
import { executePipeline } from '../app/shell-core/runtime.js';
import { shellError } from '../app/shell-core/errors.js';
import { createNodeShellExecutor, renderNodeShellOutput } from '../src/control/shell-node-executor.js';

const MAX_MISSION_STDIN_BYTES = 2 * 1024 * 1024;
const MISSION_STDIN_HANDLERS = new Set([
  'mission-profile-set',
  'mission-context-set',
  'mission-hunt-build',
  'mission-result-analyze',
  'mission-import',
]);

function normalizedArgv(argv) {
  if (argv.length === 0) return ['help'];
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) return ['help'];
  return argv;
}

async function readBoundedStdin(stream) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of stream) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += value.byteLength;
    if (bytes > MAX_MISSION_STDIN_BYTES) throw shellError('OUTPUT_LIMIT', 'mission stdin exceeds 2 MiB');
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function requestsMissionStdin(ast) {
  return ast.stages.some(stage => {
    const resolved = COMMAND_REGISTRY.resolve(stage.tokens, 'cli');
    return resolved?.surfaceAvailable
      && MISSION_STDIN_HANDLERS.has(resolved.descriptor.handler)
      && resolved.args.length === 1
      && resolved.args[0] === '--stdin';
  });
}

async function main(argv) {
  const normalized = normalizedArgv(argv);
  const ast = parseShellTokens(normalized);
  const missionStdin = requestsMissionStdin(ast) ? await readBoundedStdin(process.stdin) : null;
  const executor = createNodeShellExecutor({ registry: COMMAND_REGISTRY, missionStdin });
  const output = await executePipeline(ast, {
    registry: COMMAND_REGISTRY,
    executor,
    context: {
      surface: 'cli',
      authenticated: true,
      capabilities: new Set(['gateway-read', 'provider-read']),
    },
  });
  const finalStage = ast.stages.at(-1);
  const resolution = finalStage ? COMMAND_REGISTRY.resolve(finalStage.tokens, 'cli') : null;
  const rendered = renderNodeShellOutput(output, {
    descriptor: resolution?.descriptor ?? null,
    pipelineLength: ast.stages.length,
  });
  if (rendered) process.stdout.write(rendered);
  return Number.isInteger(output?.exitCode) ? output.exitCode : 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  const code = typeof error?.code === 'string' ? error.code : 'COMMAND_FAILED';
  const rawMessage = error instanceof Error ? error.message : 'command failed';
  const message = code === 'COMMAND_NOT_FOUND' ? 'unknown command' : rawMessage;
  process.stderr.write(`ERROR [${code}]: ${message}\n`);
  process.exitCode = code === 'COMMAND_NOT_FOUND' ? 2 : 1;
}
