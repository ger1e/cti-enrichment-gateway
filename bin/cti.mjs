#!/usr/bin/env node
import { collectDoctorState } from '../src/control/doctor.js';
import { printProviderList, printProviderEnvTemplate, runMaltegoCheck, runReleaseVerify, runSetup } from '../src/control/commands.js';
import { runReportCompile, runReportDiff } from '../src/control/report-commands.js';

const HELP = `cti-enrichment-gateway operator CLI

Usage:
  cti doctor
  cti providers list
  cti providers env-template
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
