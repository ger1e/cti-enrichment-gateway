import { createGatewayClient } from './api-client.js';
import { createAudioEngine } from './audio.js';
import { createPara11axBootSequence } from './boot.js';
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
const bootScreen = bootPanel.querySelector('.boot-screen');
const bootTitle = byId('boot-title');
const bootStandby = bootPanel.querySelector('.boot-standby span:last-child');
const reducedMotion = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

let boot = null;
let shell = null;
let shellObserver = null;
let bootLineStarted = false;
let bootLineCount = 0;
let bootTranscript = [];
let glitchTimer = null;

accessPanel.hidden = true;
workspace.hidden = true;
document.title = 'PARA11AX // Gateway Terminal';
if (bootTitle) bootTitle.textContent = 'GATEWAY TERMINAL';
if (bootStandby) bootStandby.textContent = 'PARA11AX GATEWAY // COLD START';

function triggerGlitch(target, className, duration = 280) {
  if (!target) return;
  if (glitchTimer) clearTimeout(glitchTimer);
  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);
  try { audio.play('glitch'); } catch {}
  glitchTimer = setTimeout(() => {
    target.classList.remove(className);
    glitchTimer = null;
  }, duration);
}

function createBootGlobe() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('boot-globe');
  svg.setAttribute('viewBox', '0 0 240 240');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const rotor = document.createElementNS(ns, 'g');
  rotor.classList.add('boot-globe-grid');
  const rim = document.createElementNS(ns, 'circle');
  rim.setAttribute('cx', '120');
  rim.setAttribute('cy', '120');
  rim.setAttribute('r', '88');
  rim.classList.add('boot-globe-rim');
  rotor.append(rim);

  for (const ry of [22, 43, 64]) {
    const latitude = document.createElementNS(ns, 'ellipse');
    latitude.setAttribute('cx', '120');
    latitude.setAttribute('cy', '120');
    latitude.setAttribute('rx', '88');
    latitude.setAttribute('ry', String(ry));
    latitude.classList.add('boot-globe-line');
    rotor.append(latitude);
  }
  for (const rx of [24, 46, 68]) {
    const longitude = document.createElementNS(ns, 'ellipse');
    longitude.setAttribute('cx', '120');
    longitude.setAttribute('cy', '120');
    longitude.setAttribute('rx', String(rx));
    longitude.setAttribute('ry', '88');
    longitude.classList.add('boot-globe-line');
    rotor.append(longitude);
  }

  const equator = document.createElementNS(ns, 'line');
  equator.setAttribute('x1', '32');
  equator.setAttribute('y1', '120');
  equator.setAttribute('x2', '208');
  equator.setAttribute('y2', '120');
  equator.classList.add('boot-globe-line');
  rotor.append(equator);

  const meridian = document.createElementNS(ns, 'ellipse');
  meridian.setAttribute('cx', '120');
  meridian.setAttribute('cy', '120');
  meridian.setAttribute('rx', '14');
  meridian.setAttribute('ry', '88');
  meridian.classList.add('boot-globe-meridian');
  rotor.append(meridian);

  svg.append(rotor);
  bootScreen.prepend(svg);
  return svg;
}

const bootGlobe = createBootGlobe();
void bootGlobe;

function clearBootClasses() {
  document.body.classList.remove(
    'boot-powering', 'boot-modem', 'boot-pepe-visible', 'boot-glitch',
    'boot-posting', 'boot-scanning', 'boot-ready', 'boot-complete', 'unix-booting',
  );
  bootPanel.classList.remove('glitch-boot', 'glitch-pepe', 'glitch-lock');
  if (glitchTimer) {
    clearTimeout(glitchTimer);
    glitchTimer = null;
  }
}

function resetBootSurface() {
  clearBootClasses();
  document.body.classList.add('boot-active', 'unix-booting');
  if (reducedMotion) document.body.classList.add('reduced-terminal-motion');
  bootPanel.hidden = false;
  workspace.hidden = true;
  bootStatus.textContent = 'STANDBY // USER INPUT REQUIRED';
  bootLog.replaceChildren();
  bootTranscript = [];
  pepe.hidden = true;
  bootInitialize.disabled = false;
  bootSkip.disabled = false;
  bootLineStarted = false;
  bootLineCount = 0;
}

function remember(entry) {
  bootTranscript.push(Object.freeze({ ...entry }));
}

function appendLine(text, className = 'unix-boot-line', tone = '') {
  const value = String(text);
  const line = document.createElement('div');
  line.className = className;
  line.textContent = value;
  bootLog.append(line);
  remember({ kind: 'line', text: value, tone });
  bootLog.scrollTop = bootLog.scrollHeight;
}

function appendTarget(text) {
  const value = String(text);
  const line = document.createElement('div');
  line.className = 'unix-boot-line unix-target-line';
  const led = document.createElement('span');
  led.className = 'post-led ready';
  led.setAttribute('aria-hidden', 'true');
  const content = document.createElement('span');
  content.textContent = value;
  line.append(led, content);
  bootLog.append(line);
  remember({ kind: 'line', text: value, tone: 'green' });
  bootLog.scrollTop = bootLog.scrollHeight;
}

function restoreBootTranscript() {
  const scrollback = workspace.querySelector('.shell-scrollback');
  if (!scrollback || !bootTranscript.length) return;
  const fragment = document.createDocumentFragment();
  for (const entry of bootTranscript) {
    const node = document.createElement(entry.kind === 'pre' ? 'pre' : 'div');
    node.className = entry.kind === 'pre'
      ? `shell-pre ${entry.className || ''}${entry.tone ? ` shell-${entry.tone}` : ''}`.trim()
      : `shell-line shell-boot-line${entry.tone ? ` shell-${entry.tone}` : ''}`;
    node.textContent = entry.text;
    fragment.append(node);
  }
  const separator = document.createElement('div');
  separator.className = 'shell-line shell-muted shell-boot-separator';
  separator.textContent = '── boot transcript retained ──';
  fragment.append(separator);
  scrollback.prepend(fragment);
  scrollback.scrollTop = scrollback.scrollHeight;
}

function wireMobileEraseCue() {
  const commandInput = workspace.querySelector('#para11ax-command-input');
  if (!commandInput) return;
  commandInput.addEventListener('beforeinput', event => {
    if (commandInput.type === 'password') return;
    if (event.inputType === 'deleteContentBackward' || event.inputType === 'deleteContentForward') {
      audio.typing('backspace');
    }
  });
}

function wireHelpFormatting() {
  const scrollback = workspace.querySelector('.shell-scrollback');
  if (!scrollback) return null;
  const classify = node => {
    if (node?.nodeType === 1 && node.matches?.('.shell-pre') && node.textContent.startsWith('PARA11AX COMMAND INDEX')) {
      node.classList.add('shell-help');
    }
  };
  for (const node of scrollback.children) classify(node);
  if (typeof globalThis.MutationObserver !== 'function') return null;
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) classify(node);
  });
  observer.observe(scrollback, { childList: true });
  return observer;
}

function renderBootStage(stage, payload) {
  if (stage === 'reduced') {
    document.body.classList.add('reduced-terminal-motion');
    return;
  }
  if (stage === 'power') {
    document.body.classList.add('boot-powering');
    bootStatus.textContent = 'kernel: booting PARA11AX Gateway Terminal';
    appendLine('[    0.000000] power0: CRT terminal bus online');
    triggerGlitch(bootPanel, 'glitch-boot', 360);
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
  if (stage === 'boot-line') {
    if (!bootLineStarted) {
      bootLineStarted = true;
      document.body.classList.add('boot-posting');
    }
    bootLineCount += 1;
    appendLine(payload);
    if ([9, 21, 32].includes(bootLineCount)) triggerGlitch(bootPanel, 'glitch-boot', 120);
    return;
  }
  if (stage === 'pepe') {
    document.body.classList.remove('boot-modem', 'boot-posting');
    document.body.classList.add('boot-pepe-visible', 'boot-glitch');
    bootStatus.textContent = 'firmware0: signature verified';
    pepe.hidden = false;
    remember({ kind: 'pre', text: pepe.textContent, tone: 'cyan', className: 'shell-boot-pepe' });
    triggerGlitch(bootPanel, 'glitch-pepe', 820);
    return;
  }
  if (stage === 'target') {
    document.body.classList.remove('boot-pepe-visible', 'boot-glitch');
    document.body.classList.add('boot-scanning');
    pepe.hidden = true;
    bootStatus.textContent = 'pxsvcd: gateway.target reached';
    appendTarget(payload);
    triggerGlitch(bootPanel, 'glitch-lock', 420);
    return;
  }
  if (stage === 'ready') {
    document.body.classList.remove('boot-scanning');
    document.body.classList.add('boot-ready');
    bootStatus.textContent = 'pxsvcd: Gateway Terminal active';
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
    restoreBootTranscript();
    wireMobileEraseCue();
    shellObserver?.disconnect();
    shellObserver = wireHelpFormatting();
  }
}

function makeBoot() {
  return createPara11axBootSequence({ audio, reducedMotion, onStage: renderBootStage });
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
  shellObserver?.disconnect();
  shellObserver = null;
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
