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

test('production health supplies the DPAPI-backed gateway bearer through native curl flags', () => {
  const source = productionHealthFunction(bootstrap);

  assert.match(source, /param\([^)]*\$Vercel[^)]*\$GatewayToken/is);
  assert.match(source, /\$deploymentUrl\s*=\s*["']https:\/\/\$ProductionAlias["']/i);
  assert.match(source, /\$Vercel\s+curl\s+['"]?\/api\/health['"]?/i);
  assert.match(source, /--deployment\s+\$deploymentUrl/i);
  assert.match(source, /--scope\s+\$TeamSlug/i);
  assert.match(source, /--\s+--header/i);
  assert.match(source, /Authorization:\s*Bearer\s+\$GatewayToken/i);
  assert.doesNotMatch(source, /Invoke-RestMethod/i);
  assert.doesNotMatch(source, /CTI_GATEWAY_TOKEN\s*=\s*['"][^'"]+['"]/i);
  assert.match(source, /ConvertFrom-Json/i);
  assert.match(source, /gatewayAuthConfigured/);
});

test('bootstrap passes the existing DPAPI gateway token into production health verification', () => {
  assert.match(bootstrap, /\$gatewayToken\s*=\s*Get-StoredGatewayToken/);
  assert.match(bootstrap, /Verify-ProductionHealth\s+-Vercel\s+\$Vercel\s+-GatewayToken\s+\$gatewayToken/i);
  assert.doesNotMatch(bootstrap, /Write-Host[^\r\n]*\$gatewayToken/i);
});
