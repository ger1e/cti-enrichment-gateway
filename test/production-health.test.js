import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootstrap = readFileSync(new URL('../scripts/bootstrap-vercel.ps1', import.meta.url), 'utf8');

function productionHealthFunction(source) {
  const start = source.indexOf('function Verify-ProductionHealth');
  const end = source.indexOf("Write-Host '=== CTI Enrichment Gateway / Vercel bootstrap ==='", start);
  assert.notEqual(start, -1, 'Verify-ProductionHealth must exist');
  assert.notEqual(end, -1, 'bootstrap entrypoint marker must exist');
  return source.slice(start, end);
}

test('production health uses authenticated vercel curl so Deployment Protection cannot intercept verification', () => {
  const source = productionHealthFunction(bootstrap);

  assert.match(source, /\$Vercel\s+curl\s+['"]?\/api\/health['"]?/i);
  assert.match(source, /--deployment\s+[^\r\n]*\$ProductionAlias/i);
  assert.match(source, /--scope\s+\$TeamSlug/i);
  assert.doesNotMatch(source, /Invoke-RestMethod/i);
  assert.match(source, /ConvertFrom-Json/i);
  assert.match(source, /gatewayAuthConfigured/);
});
