import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

const MAX_SCAN_BYTES = 5 * 1024 * 1024;

const blockedPathPatterns = [
  /(^|\/)\.env$/i,
  /(^|\/)\.env\.(?!example$)[^/]+$/i,
  /\.(?:pcap|pcapng|cap|dmp|core|exe|dll|sys|msi|apk|dmg|iso|p12|pfx|key|pem|7z|rar)$/i,
  /(^|\/)(?:samples?|captures?|secrets?|keys?)(\/|$)/i,
];

const secretPatterns = [
  ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/],
  ['GitHub fine-grained PAT', /\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
];

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function configuredForbiddenTerms() {
  return (process.env.PUBLIC_RELEASE_FORBIDDEN_TERMS ?? '')
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean);
}

const failures = [];
const files = trackedFiles();

for (const file of files) {
  if (blockedPathPatterns.some((pattern) => pattern.test(file))) {
    failures.push(`${file}: blocked artifact/path for public release`);
    continue;
  }

  let size;
  try {
    size = statSync(file).size;
  } catch {
    continue;
  }
  if (size > MAX_SCAN_BYTES) continue;

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(text)) failures.push(`${file}: possible ${label}`);
  }

  for (const term of configuredForbiddenTerms()) {
    if (text.toLocaleLowerCase().includes(term.toLocaleLowerCase())) {
      failures.push(`${file}: contains forbidden release term '${term}'`);
    }
  }
}

if (failures.length > 0) {
  console.error('Public-release audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nTreat every match as a review gate. Do not weaken a rule merely to make CI green.');
  process.exit(1);
}

console.log(`Public-release audit passed for ${files.length} tracked files.`);
console.log('Note: this is a guardrail, not proof that the repository is safe to publish.');
