import { shellError } from './shell-core/errors.js';

const MAX_BYTES = 2 * 1024 * 1024;
const INPUT_ID = 'mission-file-import';
const ACCEPT = Object.freeze({
  workspace: '.json,application/json',
  result: '.json,.csv,application/json,text/csv',
});
const EXTENSIONS = Object.freeze({
  workspace: Object.freeze(['.json']),
  result: Object.freeze(['.json', '.csv']),
});

function policy(message) {
  throw shellError('POLICY_DENIED', message);
}

function extensionAllowed(name, kind) {
  const normalized = String(name ?? '').trim().toLowerCase();
  return EXTENSIONS[kind].some(extension => normalized.endsWith(extension));
}

export function createMissionFileSelector({ documentRef = globalThis.document } = {}) {
  if (!documentRef?.body || typeof documentRef.createElement !== 'function' || typeof documentRef.getElementById !== 'function') {
    throw new TypeError('mission file document required');
  }
  let pending = false;

  function inputFor(kind) {
    let input = documentRef.getElementById(INPUT_ID);
    if (!input) {
      input = documentRef.createElement('input');
      input.id = INPUT_ID;
      input.type = 'file';
      input.hidden = true;
      input.multiple = false;
      documentRef.body.append(input);
    }
    input.accept = ACCEPT[kind];
    return input;
  }

  async function select({ kind, args = [] } = {}) {
    if (!Object.hasOwn(ACCEPT, kind)) policy('browser mission file selection is available only for workspace and result imports');
    if (!Array.isArray(args) || args.length) policy('browser mission file selection does not accept file or stdin flags');
    if (pending) throw shellError('POLICY_DENIED', 'mission file selection already active');
    const input = inputFor(kind);
    pending = true;

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value, error = null) => {
        if (settled) return;
        settled = true;
        pending = false;
        input.value = '';
        input.removeEventListener('change', onChange);
        input.removeEventListener('cancel', onCancel);
        if (error) reject(error);
        else resolve(value);
      };
      const onCancel = () => finish(null);
      const onChange = async () => {
        const files = input.files;
        if (!files || files.length === 0) { finish(null); return; }
        if (files.length !== 1) { finish(null, shellError('INVALID_ARGUMENT', 'exactly one mission file required')); return; }
        const file = files[0];
        if (!extensionAllowed(file?.name, kind)) { finish(null, shellError('INVALID_ARGUMENT', 'unsupported mission file type')); return; }
        if (!Number.isSafeInteger(file?.size) || file.size < 0) { finish(null, shellError('INVALID_ARGUMENT', 'invalid mission file size')); return; }
        if (file.size > MAX_BYTES) { finish(null, shellError('OUTPUT_LIMIT', 'mission file exceeds 2 MiB')); return; }
        try {
          const content = await file.text();
          if (typeof content !== 'string') throw new TypeError('mission file must contain text');
          if (new TextEncoder().encode(content).byteLength > MAX_BYTES) {
            finish(null, shellError('OUTPUT_LIMIT', 'mission file exceeds 2 MiB'));
            return;
          }
          finish(content);
        } catch (error) {
          if (error?.code === 'OUTPUT_LIMIT') finish(null, error);
          else finish(null, shellError('INVALID_ARGUMENT', 'mission file could not be read'));
        }
      };

      input.value = '';
      input.addEventListener('change', onChange);
      input.addEventListener('cancel', onCancel);
      try { input.click(); }
      catch { finish(null, shellError('INVALID_ARGUMENT', 'mission file selection failed')); }
    });
  }

  return Object.freeze({ select });
}
