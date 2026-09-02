import { readFile as nodeReadFile } from 'node:fs/promises';
import { ShellCommandError, shellError } from '../../app/shell-core/errors.js';

const MAX_BYTES = 4 * 1024 * 1024;

function bounded(value) {
  if (typeof value !== 'string') throw shellError('INVALID_ARGUMENT', 'investigation content must be UTF-8 text');
  if (new TextEncoder().encode(value).byteLength > MAX_BYTES) throw shellError('OUTPUT_LIMIT', 'investigation content exceeds 4 MiB');
  return value;
}

export function createInvestigationContentLoader({ readFile = nodeReadFile, stdinContent = null } = {}) {
  if (typeof readFile !== 'function') throw new TypeError('investigation readFile function required');
  return async function loadInvestigationContent(args = []) {
    if (args.length === 1 && args[0] === '--stdin') {
      if (typeof stdinContent !== 'string') throw shellError('POLICY_DENIED', 'investigation stdin content unavailable');
      return bounded(stdinContent);
    }
    if (args.length === 2 && args[0] === '--file') {
      const path = args[1];
      if (typeof path !== 'string' || !path.trim() || path.startsWith('--')) throw shellError('POLICY_DENIED', 'investigation --file requires one path');
      try { return bounded(await readFile(path, 'utf8')); }
      catch (error) {
        if (error instanceof ShellCommandError) throw error;
        throw shellError('INVALID_ARGUMENT', 'investigation file could not be read');
      }
    }
    throw shellError('POLICY_DENIED', 'investigation content requires exactly one --file <path> or --stdin transport');
  };
}
