#!/usr/bin/env node
import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { parseShellTokens } from '../app/shell-core/parser.js';
import { executePipeline } from '../app/shell-core/runtime.js';
import { createNodeShellExecutor, renderNodeShellOutput } from '../src/control/shell-node-executor.js';

function normalizedArgv(argv) {
  if (argv.length === 0) return ['help'];
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) return ['help'];
  return argv;
}

async function main(argv) {
  const ast = parseShellTokens(normalizedArgv(argv));
  const executor = createNodeShellExecutor({ registry: COMMAND_REGISTRY });
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
