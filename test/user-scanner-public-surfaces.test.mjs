import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('README documents the built-in User Scanner shell capability and boundary', () => {
  const readme = read('README.md');
  assert.match(readme, /user-scanner/i);
  assert.match(readme, /\bosint\b/i);
  assert.match(readme, /\bidentity\b/i);
  assert.match(readme, /active OSINT/i);
  assert.match(readme, /\/api\/para11ax\/user-scanner/);
  assert.match(readme, /separate from Evidence v2/i);
});

test('landing page advertises identity OSINT in the existing PARA11AX shell', () => {
  const landing = read('index.html');
  assert.match(landing, /identity OSINT/i);
  assert.match(landing, /user-scanner username kaifcodec/i);
  assert.match(landing, /same analyst shell/i);
  assert.match(landing, /active OSINT/i);
});

test('API and architecture docs describe the isolated User Scanner path', () => {
  const api = read('docs/API.md');
  const architecture = read('docs/ARCHITECTURE.md');
  assert.match(api, /POST `?\/api\/para11ax\/user-scanner`?/i);
  assert.match(api, /scanType/i);
  assert.match(api, /crossScan/i);
  assert.match(architecture, /User Scanner/i);
  assert.match(architecture, /isolated/i);
  assert.match(architecture, /active OSINT/i);
  assert.match(architecture, /Evidence v2/i);
});

test('operations, security controls and env template cover hosted worker wiring', () => {
  const operations = read('docs/OPERATIONS.md');
  const controls = read('docs/SECURITY-CONTROLS.md');
  const env = read('.env.example');
  assert.match(operations, /PARA11AX_USER_SCANNER_URL/);
  assert.match(operations, /PARA11AX_USER_SCANNER_TOKEN/);
  assert.match(operations, /user-scanner-kappa\.vercel\.app/);
  assert.match(controls, /User Scanner/i);
  assert.match(controls, /active OSINT/i);
  assert.match(env, /^PARA11AX_USER_SCANNER_URL=/m);
  assert.match(env, /^PARA11AX_USER_SCANNER_TOKEN=/m);
});
