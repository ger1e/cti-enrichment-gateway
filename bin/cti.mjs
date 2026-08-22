#!/usr/bin/env node
import { collectDoctorState } from '../src/control/doctor.js';
import { printProviderList, printProviderEnvTemplate, runMaltegoCheck, runReleaseVerify, runSetup } from '../src/control/commands.js';
import { probeProviders } from '../src/control/provider-probe.js';
import { runReportCompile, runReportDiff } from '../src/control/report-commands.js';

const HELP = `cti-enrichment-gateway operator CLI

Usage:
  cti doctor
  cti providers list
  cti providers env-template
  cti providers probe [--all] [--provider <name>]
  cti maltego check
  cti release verify
  cti setup
  cti repair
  cti report compile <snapshot.json> --out <dir> [--preset <name>] [--generated-at <ISO8601>] [--source-sha <SHA1>]
  cti report diff <before.json> <after.json>
`;

function fail(message, code = 2) {
  process.stderr.write(`ERROR: ${message}\n`);
  return code;
}

function parseProviderProbeArgs(args) {
  let includeCredentialed = false;
  let providerName = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--all') {
      includeCredentialed = true;
      continue;
    }
    if (arg === '--provider') {
      const value = args[i + 1];
      if (!value || value.startsWith('--')) throw new Error('--provider requires a provider name');
      providerName = value;
      i += 1;
      continue;
    }
    throw new Error(`unknown provider probe argument: ${arg}`);
  }
  return { includeCredentialed, providerName };
}

async function runProviderProbe(args) {
  const options = parseProviderProbeArgs(args);
  const results = await probeProviders(options);
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  return results.some(result => !['ok', 'unconfigured'].includes(result.status)) ? 1 : 0;
}

async function main(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    process.stdout.write(HELP);
    return 0;
  }

  const [command, subcommand, ...rest] = argv;
  if (command === 'doctor' && subcommand === undefined) {
    process.stdout.write(`${JSON.stringify(collectDoctorState(), null, 2)}\n`);
    return 0;
  }
  if (command === 'providers' && subcommand === 'list' && rest.length === 0) return printProviderList();
  if (command === 'providers' && subcommand === 'env-template' && rest.length === 0) return printProviderEnvTemplate();
  if (command === 'providers' && subcommand === 'probe') return runProviderProbe(rest);
  if (command === 'maltego' && subcommand === 'check' && rest.length === 0) return runMaltegoCheck();
  if (command === 'release' && subcommand === 'verify' && rest.length === 0) return runReleaseVerify();
  if (command === 'setup' && subcommand === undefined) return runSetup();
  if (command === 'repair' && subcommand === undefined) return runSetup({ repair: true });
  if (command === 'report' && subcommand === 'compile') return runReportCompile(rest);
  if (command === 'report' && subcommand === 'diff') return runReportDiff(rest);
  return fail(`unknown command: ${[command, subcommand].filter(Boolean).join(' ')}`);
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  process.exitCode = fail(error instanceof Error ? error.message : 'command failed', 1);
}
