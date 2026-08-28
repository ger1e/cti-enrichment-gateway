import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootstrap = readFileSync(new URL('../scripts/bootstrap-vercel.ps1', import.meta.url), 'utf8');

function productionHealthFunction(source) {
  const start = source.indexOf('function Verify-ProductionHealth');
  const end = source.indexOf("Write-Host '=== PARA11AX / Vercel bootstrap ==='", start);
  assert.notEqual(start, -1, 'Verify-ProductionHealth must exist');
  assert.notEqual(end, -1, 'bootstrap entrypoint marker must exist');
  return source.slice(start, end);
}

test('production health supplies the DPAPI-backed gateway bearer through native curl flags', () => {
  const source = productionHealthFunction(bootstrap);

  assert.match(source, /\[string\]\$Vercel\b/i);
  assert.match(source, /\[string\]\$GatewayToken\b/i);
  assert.match(source, /\$deploymentUrl\s*=\s*["']https:\/\/\$ProductionAlias["']/i);
  assert.match(source, /\$Vercel\s+curl\s+['"]?\/api\/para11ax\/health['"]?/i);
  assert.match(source, /--deployment\s+\$deploymentUrl/i);
  assert.match(source, /--scope\s+\$TeamSlug/i);
  assert.match(source, /--\s+--header/i);
  assert.match(source, /Authorization:\s*Bearer\s+\$GatewayToken/i);
  assert.doesNotMatch(source, /Invoke-RestMethod/i);
  assert.doesNotMatch(source, /2>&1/);
  assert.doesNotMatch(source, /PARA11AX_TOKEN\s*=\s*['"][^'"]+['"]/i);
  assert.match(source, /ConvertFrom-Json/i);
  assert.match(source, /gatewayAuthConfigured/);
});

test('bootstrap minimizes plaintext gateway bearer lifetime and reacquires it from DPAPI for health only', () => {
  const setToken = bootstrap.indexOf("Set-SensitiveVercelEnv -Vercel $Vercel -Name 'PARA11AX_TOKEN' -Value $gatewayToken");
  const providerLoop = bootstrap.indexOf("foreach ($name in $SecretNames | Where-Object { $_ -ne 'PARA11AX_TOKEN' })", setToken);
  const clearInitial = bootstrap.indexOf('$gatewayToken = $null', setToken);
  const deploy = bootstrap.indexOf('Invoke-NativeChecked $Vercel deploy --prod --yes --scope $TeamSlug');
  const reacquire = bootstrap.indexOf('$healthToken = Get-StoredGatewayToken', deploy);
  const verify = bootstrap.indexOf('Verify-ProductionHealth -Vercel $Vercel -GatewayToken $healthToken', reacquire);
  const clearHealth = bootstrap.indexOf('$healthToken = $null', verify);

  assert.ok(setToken >= 0);
  assert.ok(clearInitial > setToken && clearInitial < providerLoop, 'initial plaintext bearer must be cleared before provider setup');
  assert.ok(deploy >= 0);
  assert.ok(reacquire > deploy, 'health bearer must be reacquired from DPAPI after deployment');
  assert.ok(verify > reacquire);
  assert.ok(clearHealth > verify);
  assert.doesNotMatch(bootstrap, /Write-Host[^\r\n]*\$(?:gatewayToken|healthToken)/i);
});
