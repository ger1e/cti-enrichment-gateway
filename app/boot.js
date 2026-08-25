export const PARA11AX_BOOT_LINES = Object.freeze([
  '[    0.000000] PARA11AX kernel 2.0.0 booting',
  '[    0.018442] random: entropy pool initialized',
  '[    0.027913] memory: volatile analyst workspace online',
  '[    0.041207] terminal0: framebuffer initialized',
  '[    0.058991] input0: keyboard controller attached',
  '[    0.071552] audio0: synthesized terminal device detected',
  '[    0.088440] net0: fixed-egress interface registered',
  '[    0.104811] net0: route policy locked',
  '[    0.128337] cache0: bounded TTL cache interface ready',
  '[    0.155002] pxsvc[evidence-v2]: schema loaded',
  '[    0.173449] pxsvc[provenance]: integrity fingerprints enabled',
  '[    0.196721] pxsvc[semantic-firewall]: absence != benign',
  '[    0.217208] pxsvc[semantic-firewall]: context != reputation',
  '[    0.238901] pxsvc[semantic-firewall]: claims != compromise proof',
  '[    0.259514] pxsvc[semantic-firewall]: infrastructure != attribution',
  '[    0.282113] pxsvc[correlation]: corroboration pipeline ready',
  '[    0.304848] pxsvc[correlation]: contradictions pipeline ready',
  '[    0.329991] pxsvc[relationships]: deduplication enabled',
  '[    0.354108] pxsvc[huntability]: bounded analyst pivots enabled',
  '[    0.377771] pxsvc[risk-axis]: KEV isolated',
  '[    0.397421] pxsvc[risk-axis]: EPSS isolated',
  '[    0.416994] pxsvc[risk-axis]: CVSS isolated',
  '[    0.441862] pxsvc[stix-2.1]: serializer ready',
  '[    0.468220] pxsvc[export]: JSON channel ready',
  '[    0.489668] pxsvc[provider-registry]: 37 sources registered',
  '[    0.512990] pxsvc[provider-registry]: arbitrary override disabled',
  '[    0.538221] pxsvc[active-scan]: disabled',
  '[    0.563114] pxsvc[auth]: bearer storage volatile',
  '[    0.588443] pxsvc[auth]: persistent credential storage disabled',
  '[    0.614008] pxsvc[shell]: command allowlist loaded',
  '[    0.639872] pxsvc[shell]: history secret filter active',
  '[    0.667004] pxsvc[shell]: completion index built',
  '[    0.694771] pxsvc[field-ui]: mobile terminal layout ready',
  '[    0.724219] pxsvc[terminal]: starting PARA11AX analyst terminal',
  '[    0.751662] pxsvc[terminal]: active [ OK ]',
]);

export function createPara11axBootSequence({
  audio,
  reducedMotion = false,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  onStage = () => {},
} = {}) {
  let started = false;
  let done = false;
  let skipped = false;

  const safeEnable = async () => { try { await audio?.enable?.(); } catch {} };
  const safePlay = name => { try { audio?.play?.(name); } catch {} };
  const safeStop = () => { try { audio?.stopAll?.(); } catch {} };
  const wait = async ms => { await sleep(ms); return !done; };

  const ready = () => {
    if (done) return;
    onStage('ready');
    safePlay('boot-ready');
    done = true;
  };

  return Object.freeze({
    async start() {
      if (started || done) return false;
      started = true;
      await safeEnable();
      if (reducedMotion) onStage('reduced');

      onStage('power');
      safePlay('boot-power');
      if (!await wait(280)) return true;

      onStage('modem');
      safePlay('modem-56k');
      if (!await wait(3200)) return true;

      onStage('pepe');
      safePlay('boot-lock');
      if (!await wait(620)) return true;

      for (let index = 0; index < PARA11AX_BOOT_LINES.length; index += 1) {
        onStage('boot-line', PARA11AX_BOOT_LINES[index]);
        const pause = [4, 9, 15, 24, 29].includes(index) ? 95 : 26;
        if (!await wait(pause)) return true;
      }

      onStage('target', '[  OK  ] PARA11AX services online // Analyst Terminal ready.');
      if (!await wait(260)) return true;
      ready();
      return true;
    },
    async skip() {
      if (done) return false;
      if (!started) {
        started = true;
        await safeEnable();
      }
      safeStop();
      skipped = true;
      ready();
      return true;
    },
    state() { return Object.freeze({ started, done, skipped }); },
  });
}
