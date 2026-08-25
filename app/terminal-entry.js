import { createGatewayClient } from './api-client.js';
import { createAudioEngine } from './audio.js';
import { createUnixBootSequence } from './boot.js';
import { createSession } from './session.js';
import { mountAnalystShell } from './shell-ui.js';

if (!document.querySelector('link[href="/app/shell.css"]')) {
  const shellStyles = document.createElement('link');
  shellStyles.rel = 'stylesheet';
  shellStyles.href = '/app/shell.css';
  document.head.append(shellStyles);
}

const session = createSession();
const audio = createAudioEngine();
const client = createGatewayClient({ getToken: session.getToken });
const byId = id => document.getElementById(id);

const bootPanel = byId('boot-panel');
const bootInitialize = byId('boot-initialize');
const bootSkip = byId('boot-skip');
const bootStatus = byId('boot-status');
const bootLog = byId('boot-log');
const pepe = byId('pepe-ascii');
const workspace = byId('workspace');
const accessPanel = byId('access-panel');
const reducedMotion = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

let boot = null;
let shell = null;
let bootLineStarted = false;

accessPanel.hidden = true;
workspace.hidden = true;

function clearBootClasses() {
  document.body.classList.remove(
    'boot-powering', 'boot-modem', 'boot-pepe-visible', 'boot-glitch',
    'boot-posting', 'boot-scanning', 'boot-ready', 'boot-complete', 'unix-booting',
  );
}

function resetBootSurface() {
  clearBootClasses();
  document.body.classList.add('boot-active', 'unix-booting');
  if (reducedMotion) document.body.classList.add('reduced-terminal-motion');
  bootPanel.hidden = false;
  workspace.hidden = true;
  bootStatus.textContent = 'STANDBY // USER INPUT REQUIRED';
  bootLog.replaceChildren();
  pepe.hidden = true;
  bootInitialize.disabled = false;
  bootSkip.disabled = false;
  bootLineStarted = false;
}

function appendLine(text, className = 'unix-boot-line') {
  const line = document.createElement('div');
  line.className = className;
  line.textContent = String(text);
  bootLog.append(line);
  bootLog.scrollTop = bootLog.scrollHeight;
}

function appendTarget(text) {
  const line = document.createElement('div');
  line.className = 'unix-boot-line unix-target-line';
  const led = document.createElement('span');
  led.className = 'post-led ready';
  led.setAttribute('aria-hidden', 'true');
  const content = document.createElement('span');
  content.textContent = String(text);
  line.append(led, content);
  bootLog.append(line);
  bootLog.scrollTop = bootLog.scrollHeight;
}

function renderBootStage(stage, payload) {
  if (stage === 'reduced') {
    document.body.classList.add('reduced-terminal-motion');
    return;
  }
  if (stage === 'power') {
    document.body.classList.add('boot-powering');
    bootStatus.textContent = 'kernel: booting PARA11AX';
    appendLine('[    0.000000] power0: CRT terminal bus online');
    return;
  }
  if (stage === 'modem') {
    document.body.classList.remove('boot-powering');
    document.body.classList.add('boot-modem');
    bootStatus.textContent = 'modem0: negotiating V.90 56000';
    appendLine('[    0.214220] modem0: ATZ');
    appendLine('[    0.245881] modem0: OK');
    appendLine('[    0.287002] modem0: ATDT PARA11AX-UPLINK');
    appendLine('[    0.411284] modem0: CONNECT 56000/V90');
    return;
  }
  if (stage === 'pepe') {
    document.body.classList.remove('boot-modem');
    document.body.classList.add('boot-pepe-visible', 'boot-glitch');
    bootStatus.textContent = 'firmware0: signature verified';
    pepe.hidden = false;
    return;
  }
  if (stage === 'boot-line') {
    if (!bootLineStarted) {
      bootLineStarted = true;
      document.body.classList.remove('boot-pepe-visible', 'boot-glitch');
      document.body.classList.add('boot-posting');
      pepe.hidden = true;
      bootLog.replaceChildren();
    }
    appendLine(payload);
    return;
  }
  if (stage === 'target') {
    document.body.classList.remove('boot-posting');
    document.body.classList.add('boot-scanning');
    bootStatus.textContent = 'systemd: analyst.target reached';
    appendTarget(payload);
    return;
  }
  if (stage === 'ready') {
    document.body.classList.remove('boot-scanning');
    document.body.classList.add('boot-ready');
    bootStatus.textContent = 'para11ax.service: active (running)';
    bootInitialize.disabled = true;
    bootSkip.disabled = true;
    bootPanel.hidden = true;
    workspace.hidden = false;
    shell = mountAnalystShell({
      container: workspace,
      client,
      session,
      audio,
      version: '2.0.0',
      onReboot: replayBoot,
    });
  }
}

function makeBoot() {
  return createUnixBootSequence({ audio, reducedMotion, onStage: renderBootStage });
}

async function startBoot() {
  bootInitialize.disabled = true;
  boot = makeBoot();
  await boot.start();
}

async function skipBoot() {
  bootInitialize.disabled = true;
  bootSkip.disabled = true;
  boot ||= makeBoot();
  await boot.skip();
}

async function replayBoot() {
  shell?.abort?.();
  shell = null;
  session.disconnect();
  resetBootSurface();
  bootInitialize.disabled = true;
  boot = makeBoot();
  await boot.start();
}

bootInitialize.addEventListener('click', () => { void startBoot(); });
bootSkip.addEventListener('click', () => { void skipBoot(); });

resetBootSurface();
