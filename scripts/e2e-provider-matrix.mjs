import { ALL_PROVIDERS } from '../src/providers/index.js';
import { probeProvider } from '../src/control/provider-probe.js';

const names = ['threatfox', 'urlhaus', 'malwarebazaar'];

for (const name of names) {
  const provider = ALL_PROVIDERS.find(item => item.name === name);
  if (!provider) {
    console.log(`ABUSECH_RECHECK=${JSON.stringify({ provider: name, status: 'missing_provider' })}`);
    continue;
  }
  const result = await probeProvider(provider, { env: process.env, fetchImpl: fetch });
  console.log(`ABUSECH_RECHECK=${JSON.stringify({
    provider: result.provider,
    status: result.status,
    checks: result.checks.map(check => ({
      type: check.type,
      status: check.status,
      latencyMs: check.latencyMs,
      httpStatus: check.httpStatus,
      observationType: check.observationType,
      verdict: check.verdict,
    })),
  })}`);
}

await import('node:fs').then(({ mkdirSync, writeFileSync }) => {
  mkdirSync('public', { recursive: true });
  writeFileSync('public/index.html', 'abusech credential recheck complete\n');
});
