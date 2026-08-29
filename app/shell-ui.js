import { GatewayHttpError } from './api-client.js';
import { runEnrichmentOperation } from './shell-runtime.js';
import { COMMANDS, completeCommand, createHistory, interpretCommand } from './shell.js';
import {
  buildOverview,
  buildEvidence,
  buildCorrelation,
  buildRelationships,
  buildCoverage,
  jsonLines,
} from './view-model.js';
import {
  renderOverview,
  renderEvidence,
  renderCorrelation,
  renderRelationships,
  renderCoverage,
  renderRaw,
} from './renderers.js';

const CONTROL_LABELS = Object.freeze(['Ctrl+L', 'Ctrl+C', 'Ctrl+U', 'Ctrl+W', 'Home', 'End', 'Escape']);
void CONTROL_LABELS;

const PALETTE_TEXT = [
  'void       #050608  terminal background',
  'cyan       #00E5FF  context / structure',
  'green      #39FF88  corroborated / verified state',
  'amber      #F6C945  uncertainty / partial coverage',
  'red        #FF1E2D  failure / contradiction / scanner',
  'white      #F3F7FA  primary terminal text',
  'muted      #7D8B95  secondary terminal text',
].join('\n');

function formatDuration(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function safeFilename(indicator, suffix) {
  const stem = String(indicator || 'indicator').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'indicator';
  return `${stem}.${suffix}`;
}

function downloadText(text, type, filename) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

function groupHelp() {
  const categories = ['core', 'auth', 'gateway', 'enrichment', 'osint', 'result', 'export', 'terminal'];
  const lines = ['PARA11AX COMMAND INDEX', ''];
  for (const category of categories) {
    const items = COMMANDS.filter(item => item.category === category);
    if (!items.length) continue;
    lines.push(category.toUpperCase());
    for (const item of items) lines.push(`  ${item.usage.padEnd(46)} ${item.summary}`);
    lines.push('');
  }
  lines.push('Keys: ↑/↓ history · Tab completion · Ctrl+L clear · Ctrl+C cancel · Ctrl+U clear line · Ctrl+W delete word · Home/End · Esc clear');
  lines.push('Security: no arbitrary provider selection, shell execution, pipes, redirects, filesystem writes, or credential persistence.');
  return lines.join('\n');
}

function commandHelp(topic) {
  const query = String(topic || '').toLowerCase();
  const item = COMMANDS.find(command => command.name === query || (command.aliases || []).includes(query));
  if (!item) return `no manual entry for ${query || '<empty>'}`;
  const aliases = item.aliases?.length ? `\naliases: ${item.aliases.join(', ')}` : '';
  return `${item.name.toUpperCase()}\nusage: ${item.usage}${aliases}\n${item.summary}`;
}

export function mountAnalystShell({
  container,
  client,
  session,
  audio,
  version = '2.0.0',
  now = () => new Date(),
  monotonicNow = () => performance.now(),
  onReboot = () => {},
} = {}) {
  if (!container || !client || !session || !audio) throw new TypeError('shell dependencies required');

  const mountedAt = monotonicNow();
  const history = createHistory(200);
  let profile = 'standard';
  let currentResult = null;
  let activeController = null;
  let secretMode = false;
  let busy = false;
  let glitchTimer = null;

  const root = document.createElement('section');
  root.className = 'unix-shell';
  root.setAttribute('aria-label', 'PARA11AX interactive analyst shell');

  const status = document.createElement('header');
  status.className = 'shell-status';
  const brand = document.createElement('span');
  brand.className = 'shell-brand';
  brand.textContent = `PARA11AX Gateway Terminal ${version}`;
  const sessionState = document.createElement('span');
  sessionState.className = 'shell-session-state';
  status.append(brand, sessionState);

  const scrollback = document.createElement('div');
  scrollback.className = 'shell-scrollback';
  scrollback.setAttribute('role', 'log');
  scrollback.setAttribute('aria-live', 'polite');
  scrollback.setAttribute('aria-relevant', 'additions');

  const prompt = document.createElement('form');
  prompt.className = 'shell-prompt';
  prompt.autocomplete = 'off';
  const promptLabel = document.createElement('label');
  promptLabel.className = 'shell-prompt-label';
  const input = document.createElement('input');
  input.className = 'shell-input';
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;
  input.enterKeyHint = 'send';
  input.setAttribute('aria-label', 'PARA11AX command line');
  promptLabel.htmlFor = 'para11ax-command-input';
  input.id = 'para11ax-command-input';
  prompt.append(promptLabel, input);

  root.append(status, scrollback, prompt);
  container.replaceChildren(root);
  container.hidden = false;

  const focusInput = () => input.focus({ preventScroll: true });
  const triggerGlitch = (className, duration = 220) => {
    if (glitchTimer) clearTimeout(glitchTimer);
    root.classList.remove(className);
    void root.offsetWidth;
    root.classList.add(className);
    try { audio.play('glitch'); } catch {}
    glitchTimer = setTimeout(() => {
      root.classList.remove(className);
      glitchTimer = null;
    }, duration);
  };

  const authenticated = () => ['ready', 'result', 'running'].includes(session.snapshot().mode) && session.snapshot().hasToken;
  const updateStatus = () => {
    sessionState.textContent = `${authenticated() ? 'AUTH:UP' : 'AUTH:DOWN'} · PROFILE:${profile.toUpperCase()} · ${busy ? 'BUSY' : 'READY'}`;
    sessionState.classList.toggle('is-authenticated', authenticated());
  };
  const updatePrompt = () => {
    if (secretMode) {
      promptLabel.textContent = 'BEARER:';
      input.type = 'password';
      input.setAttribute('aria-label', 'Gateway bearer secret');
    } else {
      promptLabel.textContent = 'analyst@para11ax:~$';
      input.type = 'text';
      input.setAttribute('aria-label', 'PARA11AX command line');
    }
    updateStatus();
  };

  const scrollBottom = () => { scrollback.scrollTop = scrollback.scrollHeight; };
  const appendLine = (text = '', tone = '') => {
    const line = document.createElement('div');
    line.className = `shell-line${tone ? ` shell-${tone}` : ''}`;
    line.textContent = String(text);
    scrollback.append(line);
    scrollBottom();
    return line;
  };
  const appendPre = (text, tone = '') => {
    const pre = document.createElement('pre');
    pre.className = `shell-pre${tone ? ` shell-${tone}` : ''}`;
    pre.textContent = String(text);
    scrollback.append(pre);
    scrollBottom();
    return pre;
  };
  const appendJson = (value, tone = '') => appendPre(JSON.stringify(value, null, 2), tone);
  const clearScrollback = () => scrollback.replaceChildren();

  function renderResultView(viewName) {
    if (!currentResult) { appendLine('para11ax: no enrichment result loaded', 'amber'); return; }
    const block = document.createElement('section');
    block.className = `shell-result shell-result-${viewName}`;
    scrollback.append(block);
    if (viewName === 'overview') renderOverview(block, buildOverview(currentResult));
    else if (viewName === 'evidence') renderEvidence(block, buildEvidence(currentResult));
    else if (viewName === 'correlation') renderCorrelation(block, buildCorrelation(currentResult));
    else if (viewName === 'relationships') renderRelationships(block, buildRelationships(currentResult));
    else if (viewName === 'coverage') renderCoverage(block, buildCoverage(currentResult));
    else renderRaw(block, jsonLines(currentResult), '');
    scrollBottom();
  }

  function resultFilter(filter) {
    if (!currentResult) { appendLine('para11ax: no enrichment result loaded', 'amber'); return; }
    if (filter === 'last') return renderResultView('overview');
    if (filter === 'request') return appendJson({
      requestId: currentResult.requestId,
      indicator: currentResult.indicator,
      type: currentResult.type,
      profile: currentResult.profile,
      status: currentResult.status,
      queriedAt: currentResult.queriedAt,
      durationMs: currentResult.durationMs,
      budget: currentResult.budget,
    });
    if (filter === 'failures') return appendJson(currentResult.failures || [], 'red');
    if (filter === 'contradictions') return appendJson(currentResult.correlation?.contradictions || [], 'red');
    if (filter === 'corroboration') return appendJson(currentResult.correlation?.corroboration || [], 'green');
    if (filter === 'references') {
      const refs = [...new Set((currentResult.evidence || []).flatMap(item => item.references || []).map(ref => typeof ref === 'string' ? ref : ref?.url).filter(Boolean))];
      return appendPre(refs.length ? refs.join('\n') : '(no references)');
    }
    if (filter === 'providers') {
      const providers = [...new Set([
        ...(currentResult.evidence || []).map(item => item.provider),
        ...(currentResult.failures || []).map(item => item.provider),
      ].filter(Boolean))].sort();
      return appendPre(providers.length ? providers.join('\n') : '(no providers represented)');
    }
  }

  function beginOperation(useSession = false) {
    if (busy) throw new Error('operation already active');
    activeController = new AbortController();
    busy = true;
    if (useSession) session.startRequest(activeController);
    updateStatus();
    return activeController;
  }

  function endOperation() {
    activeController = null;
    busy = false;
    updateStatus();
  }

  function abortOperation() {
    if (activeController && !activeController.signal.aborted) activeController.abort();
    try { session.reset(); } catch {}
    activeController = null;
    busy = false;
    updateStatus();
  }

  async function runGateway(action) {
    if (action.action === 'meta') {
      const controller = beginOperation(false);
      try { appendJson(await client.meta(controller.signal)); }
      finally { endOperation(); }
      return;
    }
    if (action.action === 'health' || action.action === 'status') {
      const controller = beginOperation(false);
      try { appendJson(await client[action.action](controller.signal)); }
      finally { endOperation(); }
      return;
    }
    if (action.action === 'enrich') {
      const controller = beginOperation(false);
      appendLine(`enrich: ${action.indicator} [profile=${action.profile}]`, 'cyan');
      audio.play('scan');
      triggerGlitch('glitch-scan', 260);
      try {
        const result = await runEnrichmentOperation({
          session,
          client,
          controller,
          indicator: action.indicator,
          profile: action.profile,
        });
        currentResult = result;
        profile = action.profile;
        const contradictions = result.correlation?.contradictions?.length || 0;
        audio.play(result.status === 'ok' ? 'result-ok' : result.status === 'partial' ? 'result-partial' : 'result-error');
        if (contradictions) {
          try { audio.play('contradiction'); } catch {}
          triggerGlitch('glitch-error', 260);
        } else if (result.status === 'error') triggerGlitch('glitch-error', 260);
        else triggerGlitch('glitch-result', 240);
        appendLine(`[ ${String(result.status).toUpperCase()} ] ${result.indicator} · ${result.type} · ${result.durationMs ?? '?'}ms`, result.status === 'ok' ? 'green' : result.status === 'partial' ? 'amber' : 'red');
        renderResultView('overview');
      } finally { endOperation(); }
      return;
    }
    if (action.action === 'user-scanner') {
      const controller = beginOperation(false);
      const scope = action.module ? `module=${action.module}` : action.category ? `category=${action.category}` : 'scope=full';
      appendLine(`user-scanner: ${action.scanType} ${action.target} [${scope}${action.crossScan ? ' · cross-scan' : ''}]`, 'cyan');
      audio.play('scan');
      triggerGlitch('glitch-scan', 260);
      try {
        const scan = await client.userScanner({
          scanType: action.scanType,
          target: action.target,
          category: action.category,
          module: action.module,
          crossScan: action.crossScan,
          noNsfw: action.noNsfw,
        }, controller.signal);
        const summary = scan.summary;
        const tone = summary.errors > 0 ? 'amber' : 'green';
        appendLine(`[ OK ] USER-SCANNER ${scan.scanId} · scanned=${summary.totalScanned} · found=${summary.found} · errors=${summary.errors} · ${scan.durationMs}ms`, tone);
        for (const item of scan.results.slice(0, 100)) {
          const label = item.siteName || '(unknown site)';
          const category = item.category ? ` [${item.category}]` : '';
          const url = item.url ? ` · ${item.url}` : '';
          appendLine(`FOUND  ${label}${category}${url}`, 'green');
        }
        if (scan.results.length > 100) appendLine(`… ${scan.results.length - 100} additional hits omitted from terminal scrollback`, 'muted');
        if (scan.erroredSites.length) appendLine(`errors: ${scan.erroredSites.slice(0, 24).join(', ')}${scan.erroredSites.length > 24 ? ', …' : ''}`, 'amber');
        appendLine('OSINT enumeration is isolated from Evidence v2 correlation and the current enrichment result.', 'muted');
        triggerGlitch('glitch-result', 240);
      } finally { endOperation(); }
      return;
    }
    if (action.action === 'batch') {
      const controller = beginOperation(false);
      appendLine(`batch: ${action.indicators.length} observables [profile=${action.profile}]`, 'cyan');
      audio.play('scan');
      triggerGlitch('glitch-scan', 240);
      try {
        const batch = await client.batch(action.indicators, action.profile, controller.signal);
        profile = action.profile;
        appendLine(`[ OK ] batch ${batch.requestId} · ${batch.inputCount} inputs · ${batch.uniqueIndicators ?? '?'} unique · ${batch.durationMs ?? '?'}ms`, 'green');
        for (const item of batch.results || []) {
          appendLine(`${String(item.index).padStart(2, '0')}  ${String(item.status).padEnd(8)}  ${item.canonical || item.input || ''}${item.duplicateOf !== undefined ? `  duplicate-of=${item.duplicateOf}` : ''}`, item.status === 'error' || item.status === 'invalid' ? 'red' : item.status === 'skipped' ? 'amber' : '');
        }
        triggerGlitch('glitch-result', 220);
      } finally { endOperation(); }
      return;
    }
    if (action.action === 'stix') {
      if (!currentResult) { appendLine('para11ax: no enrichment result loaded', 'amber'); return; }
      const controller = beginOperation(false);
      audio.play('stix-start');
      try {
        const bundle = await client.stix(currentResult.indicator, currentResult.profile, controller.signal);
        downloadText(JSON.stringify(bundle, null, 2), 'application/stix+json', safeFilename(currentResult.indicator, 'stix.json'));
        audio.play('stix-ok');
        appendLine(`[ OK ] STIX 2.1 bundle exported · ${bundle.objects?.length ?? 0} objects`, 'green');
        triggerGlitch('glitch-result', 180);
      } finally { endOperation(); }
    }
  }

  async function executeAction(action) {
    if (action.action === 'noop') return;
    if (action.action === 'error' || action.action === 'unknown' || action.action === 'auth-required') {
      appendLine(action.message, action.action === 'auth-required' ? 'amber' : 'red');
      if (action.action === 'unknown') appendLine("type 'help' for available commands", 'muted');
      audio.play('result-error');
      triggerGlitch('glitch-error', 190);
      return;
    }
    if (action.action === 'help') { appendPre(action.topic ? commandHelp(action.topic) : groupHelp()); return; }
    if (action.action === 'clear') { clearScrollback(); return; }
    if (action.action === 'history') {
      appendPre(history.entries().map((line, index) => `${String(index + 1).padStart(4)}  ${line}`).join('\n') || '(history empty)');
      return;
    }
    if (action.action === 'login-secret') {
      if (authenticated()) { appendLine('authentication already active; run auth clear first', 'amber'); return; }
      secretMode = true;
      updatePrompt();
      appendLine('enter gateway bearer in hidden prompt; value is memory-only and never added to history', 'muted');
      return;
    }
    if (action.action === 'auth-status') { appendLine(authenticated() ? 'AUTHENTICATED // VOLATILE BEARER PRESENT' : 'LOCKED // NO BEARER', authenticated() ? 'green' : 'amber'); return; }
    if (action.action === 'auth-clear') {
      abortOperation();
      session.disconnect();
      currentResult = null;
      appendLine('[ OK ] volatile authentication cleared', 'green');
      updateStatus();
      return;
    }
    if (action.action === 'disconnect') {
      abortOperation();
      session.disconnect();
      currentResult = null;
      audio.play('disconnect');
      triggerGlitch('glitch-disconnect', 360);
      appendLine('Connection to gateway closed.', 'amber');
      updateStatus();
      return;
    }
    if (action.action === 'reboot') {
      abortOperation();
      session.disconnect();
      currentResult = null;
      history.clear();
      triggerGlitch('glitch-disconnect', 360);
      appendLine('Broadcast message from para11ax: system reboot requested.', 'amber');
      await Promise.resolve(onReboot());
      return;
    }
    if (action.action === 'show-profile') { appendLine(profile); return; }
    if (action.action === 'set-profile') { profile = action.profile; appendLine(`profile=${profile}`, 'cyan'); updateStatus(); return; }
    if (action.action === 'view') { renderResultView(action.view); return; }
    if (action.action === 'result-filter') { resultFilter(action.filter); return; }
    if (action.action === 'print-json') { currentResult ? appendJson(currentResult) : appendLine('para11ax: no enrichment result loaded', 'amber'); return; }
    if (action.action === 'download-json') {
      if (!currentResult) { appendLine('para11ax: no enrichment result loaded', 'amber'); return; }
      downloadText(JSON.stringify(currentResult, null, 2), 'application/json', safeFilename(currentResult.indicator, 'evidence.json'));
      appendLine('[ OK ] Evidence v2 JSON exported', 'green');
      return;
    }
    if (action.action === 'copy') {
      if (!currentResult) { appendLine('para11ax: no enrichment result loaded', 'amber'); return; }
      const value = action.target === 'observable' ? currentResult.indicator : action.target === 'request-id' ? currentResult.requestId : JSON.stringify(currentResult, null, 2);
      try { await navigator.clipboard.writeText(String(value)); audio.play('copy'); appendLine(`[ OK ] copied ${action.target}`, 'green'); }
      catch { appendLine('clipboard unavailable', 'red'); triggerGlitch('glitch-error', 180); }
      return;
    }
    if (action.action === 'sound') {
      if (action.enabled) { await audio.enable(); audio.mute(false); }
      else audio.mute(true);
      appendLine(`sound=${action.enabled ? 'on' : 'off'}`);
      return;
    }
    if (action.action === 'volume') { audio.setVolume(action.volume); appendLine(`volume=${Math.round(action.volume * 100)}`); return; }
    if (action.action === 'local') {
      if (action.name === 'whoami') appendLine(authenticated() ? 'analyst // authenticated volatile session' : 'analyst // unauthenticated');
      else if (action.name === 'uptime') appendLine(formatDuration(monotonicNow() - mountedAt));
      else if (action.name === 'version') appendLine(`PARA11AX Gateway Terminal ${version}\nCTI Enrichment client v2`);
      else if (action.name === 'theme') appendPre(PALETTE_TEXT);
      else if (action.name === 'pwd') appendLine('/home/analyst');
      else if (action.name === 'hostname') appendLine('gateway');
      else if (action.name === 'date') appendLine(now().toString());
      else if (action.name === 'echo') appendLine(action.value || '');
      return;
    }
    await runGateway(action);
  }

  async function submitSecret() {
    const secret = input.value;
    input.value = '';
    if (!secret.trim()) { appendLine('empty bearer rejected', 'red'); triggerGlitch('glitch-error', 180); return; }
    try { await audio.enable(); } catch {}
    session.setToken(secret);
    try {
      const health = await client.health();
      session.unlock();
      secretMode = false;
      audio.play('access-ok');
      appendLine(`[  OK  ] Authentication accepted. Gateway ${health?.version || 'online'}.`, 'green');
      triggerGlitch('glitch-result', 180);
    } catch (error) {
      session.disconnect();
      secretMode = false;
      audio.play('access-denied');
      triggerGlitch('glitch-error', 260);
      appendLine(error instanceof GatewayHttpError && error.status === 401 ? '[FAILED] Authentication rejected.' : '[FAILED] Gateway unavailable.', 'red');
    } finally {
      updatePrompt();
      focusInput();
    }
  }

  prompt.addEventListener('submit', async event => {
    event.preventDefault();
    audio.typing(secretMode ? 'token' : 'enter');
    if (secretMode) { await submitSecret(); return; }
    const line = input.value;
    input.value = '';
    const action = interpretCommand(line, { authenticated: authenticated(), profile });
    if (action.historySafe !== false) history.push(line);
    if (line.trim()) appendLine(`analyst@para11ax:~$ ${line}`);
    try { await executeAction(action); }
    catch (error) {
      if (error?.name === 'AbortError') appendLine('^C', 'amber');
      else if (error instanceof GatewayHttpError) appendLine(`gateway: ${error.code}${error.requestId ? ` [${error.requestId}]` : ''}`, 'red');
      else appendLine('terminal: command failed', 'red');
      triggerGlitch('glitch-error', 240);
      if (busy) abortOperation();
    }
    updatePrompt();
    focusInput();
  });

  input.addEventListener('beforeinput', event => {
    if (!secretMode && event.inputType === 'insertText' && event.data) audio.typing('character');
  });
  input.addEventListener('paste', () => { if (!secretMode) audio.typing('paste'); });
  input.addEventListener('keydown', event => {
    if (secretMode) return;
    if (event.key === 'Backspace' || event.key === 'Delete') audio.typing('backspace');
    if (event.key === 'ArrowUp') { event.preventDefault(); input.value = history.up(); input.setSelectionRange(input.value.length, input.value.length); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); input.value = history.down(); input.setSelectionRange(input.value.length, input.value.length); return; }
    if (event.key === 'Tab') {
      event.preventDefault();
      const suggestions = completeCommand(input.value);
      if (suggestions.length === 1) {
        const raw = input.value;
        const split = raw.search(/\s/);
        input.value = split < 0 ? `${suggestions[0]} ` : `${raw.slice(0, split + 1)}${suggestions[0]} `;
      } else if (suggestions.length > 1) appendLine(suggestions.join('  '), 'cyan');
      audio.play('tab');
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); clearScrollback(); return; } // Ctrl+L
    if (event.ctrlKey && event.key.toLowerCase() === 'c') { event.preventDefault(); abortOperation(); input.value = ''; appendLine('^C', 'amber'); return; } // Ctrl+C
    if (event.ctrlKey && event.key.toLowerCase() === 'u') { event.preventDefault(); input.value = ''; return; } // Ctrl+U
    if (event.ctrlKey && event.key.toLowerCase() === 'w') { event.preventDefault(); input.value = input.value.replace(/\s*\S+\s*$/, ''); return; } // Ctrl+W
    if (event.key === 'Home') { event.preventDefault(); input.setSelectionRange(0, 0); return; }
    if (event.key === 'End') { event.preventDefault(); input.setSelectionRange(input.value.length, input.value.length); return; }
    if (event.key === 'Escape') { event.preventDefault(); input.value = ''; }
  });

  appendLine(`PARA11AX Gateway Terminal ${version}`);
  appendLine('CTI Enrichment // session unauthenticated', 'muted');
  appendLine("type 'help' for commands; run 'login' to authenticate", 'cyan');
  updatePrompt();
  focusInput();

  return Object.freeze({
    focus: focusInput,
    clear: clearScrollback,
    abort: () => {
      if (glitchTimer) clearTimeout(glitchTimer);
      abortOperation();
    },
    state: () => Object.freeze({ authenticated: authenticated(), profile, hasResult: Boolean(currentResult), busy, secretMode }),
  });
}
