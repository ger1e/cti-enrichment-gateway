import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { rdapProvider } from '../src/providers/index.js';

const gatewayToken = 'test-gateway-token';

function request(contentType) {
  return {
    method: 'POST',
    headers: {
      authorization: `Bearer ${gatewayToken}`,
      'content-type': contentType,
    },
    body: { indicator: '8.8.8.8' },
  };
}

function fixtureApp() {
  const fetchImpl = async () => new Response(JSON.stringify({ handle: 'NET-X', country: 'US' }), { status: 200 });
  return createApp({ env: { PARA11AX_TOKEN: gatewayToken }, fetchImpl, adapters: [rdapProvider] });
}

test('JSON media type validation accepts JSON and structured +json but rejects lookalikes', async () => {
  const app = fixtureApp();
  assert.equal((await app.handleEnrich(request('application/json; charset=utf-8'))).status, 200);
  assert.equal((await app.handleEnrich(request('application/vnd.api+json'))).status, 200);
  assert.equal((await app.handleEnrich(request('application/problem+json; charset=UTF-8'))).status, 200);
  assert.equal((await app.handleEnrich(request('application/jsonp'))).status, 415);
  assert.equal((await app.handleEnrich(request('text/json'))).status, 415);
  assert.equal((await app.handleEnrich(request('application/+json'))).status, 415);
  assert.equal((await app.handleEnrich(request('application/foo/bar+json'))).status, 415);
});

test('Vercel bootstrap keeps generated gateway bearer out of terminal and stores it with current-user DPAPI', () => {
  const script = readFileSync(new URL('../scripts/bootstrap-vercel.ps1', import.meta.url), 'utf8');
  assert.match(script, /ProtectedData\]::Protect/);
  assert.match(script, /ProtectedData\]::Unprotect/);
  assert.match(script, /gateway-token\.dpapi/);
  assert.doesNotMatch(script, /Write-Host\s+\$plain/);
  assert.doesNotMatch(script, /shown only in this terminal session/i);
  assert.match(script, /git connect --yes --scope \$TeamSlug/);
});

test('Vercel bootstrap DPAPI cleanup cannot mask a protection failure under StrictMode', () => {
  const script = readFileSync(new URL('../scripts/bootstrap-vercel.ps1', import.meta.url), 'utf8');
  const start = script.indexOf('function Save-GatewayToken');
  const end = script.indexOf('function Get-StoredGatewayToken');
  assert.ok(start >= 0 && end > start, 'Save-GatewayToken function not found');
  const saveFunction = script.slice(start, end);
  const tryIndex = saveFunction.indexOf('try {');
  assert.ok(tryIndex > 0, 'Save-GatewayToken try block not found');
  for (const variable of ['$protectedBytes = $null', '$encoded = $null']) {
    const initialization = saveFunction.indexOf(variable);
    assert.ok(initialization >= 0 && initialization < tryIndex, `${variable} must be initialized before try`);
  }
});

test('Vercel bootstrap deploys the exact clean origin/main source instead of redeploying a stale artifact', () => {
  const script = readFileSync(new URL('../scripts/bootstrap-vercel.ps1', import.meta.url), 'utf8');
  assert.match(script, /fetch --depth 1 origin main/);
  assert.match(script, /rev-parse FETCH_HEAD/);
  assert.match(script, /status --porcelain/);
  assert.match(script, /deploy --prod --yes --scope \$TeamSlug/);
  assert.doesNotMatch(script, /\bredeploy\b/);
});

test('Maltego bootstrap reuses native stored credentials and keeps Windows DPAPI as the local trust boundary', () => {
  const installer = readFileSync(new URL('../maltego/install.ps1', import.meta.url), 'utf8');
  const entry = readFileSync(new URL('../maltego/bootstrap_entry.py', import.meta.url), 'utf8');
  const store = readFileSync(new URL('../maltego/credential_store.py', import.meta.url), 'utf8');

  assert.match(installer, /bootstrap_entry\.py/);
  assert.match(entry, /load_token\(\)/);
  assert.match(entry, /configure_token_interactively\(\)/);
  assert.match(entry, /PARA11AX_TOKEN/);
  assert.match(store, /CryptProtectData/);
  assert.match(store, /CryptUnprotectData/);
  assert.match(store, /gateway-token\.dpapi/);
});
