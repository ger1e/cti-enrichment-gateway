import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PROVIDER_MANIFEST, providerSecretNames } from '../providers/manifest.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAX_DELEGATED_OUTPUT = 2_000_000;

function spawnChecked(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    maxBuffer: MAX_DELEGATED_OUTPUT,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    process.stderr.write(`ERROR: failed to execute ${command}\n`);
    return 1;
  }
  return Number.isInteger(result.status) ? result.status : 1;
}

export function printProviderList() {
  for (const name of Object.keys(PROVIDER_MANIFEST).sort((a, b) => a.localeCompare(b))) {
    const policy = PROVIDER_MANIFEST[name];
    process.stdout.write(`${name}\t${policy.displayName}\t${policy.types.join(',')}\t${policy.costClass}\ttier=${policy.tier}\n`);
  }
  return 0;
}

export function printProviderEnvTemplate() {
  for (const name of providerSecretNames()) process.stdout.write(`${name}=\n`);
  return 0;
}

export function runMaltegoCheck() {
  if (process.platform === 'win32') {
    return spawnChecked('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'maltego/install.ps1', '-Check']);
  }
  return spawnChecked('sh', ['maltego/install.sh', '--check']);
}

export function runReleaseVerify() {
  if (process.platform === 'win32') return spawnChecked('npm.cmd', ['run', 'verify:repo']);
  return spawnChecked('npm', ['run', 'verify:repo']);
}

export function runSetup({ repair = false } = {}) {
  if (process.platform === 'win32') {
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'maltego/install.ps1'];
    if (repair) args.push('-Repair');
    return spawnChecked('powershell.exe', args);
  }
  const args = ['maltego/install.sh'];
  if (repair) args.push('--repair');
  return spawnChecked('sh', args);
}
