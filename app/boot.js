export const UNIX_BOOT_LINES = Object.freeze([
  '[    0.000000] PARA11AX kernel 2.0.0 booting',
  '[    0.018442] random: entropy pool initialized',
  '[    0.027913] memory: volatile analyst workspace online',
  '[    0.041207] terminal0: framebuffer initialized',
  '[    0.058991] input0: keyboard controller attached',
  '[    0.071552] audio0: synthesized terminal device detected',
  '[    0.088440] net0: fixed-egress interface registered',
  '[    0.104811] net0: route policy locked',
  '[    0.128337] cache0: bounded TTL cache interface ready',
  '[    0.155002] evidence-v2: schema loaded',
  '[    0.173449] provenance: integrity fingerprints enabled',
  '[    0.196721] semantic-firewall: absence != benign',
  '[    0.217208] semantic-firewall: context != reputation',
  '[    0.238901] semantic-firewall: claims != compromise proof',
  '[    0.259514] semantic-firewall: infrastructure != attribution',
  '[    0.282113] correlation-engine: corroboration pipeline ready',
  '[    0.304848] correlation-engine: contradictions pipeline ready',
  '[    0.329991] relationship-index: deduplication enabled',
  '[    0.354108] huntability: bounded analyst pivots enabled',
  '[    0.377771] risk-axis: KEV isolated',
  '[    0.397421] risk-axis: EPSS isolated',
  '[    0.416994] risk-axis: CVSS isolated',
  '[    0.441862] stix-2.1: serializer ready',
  '[    0.468220] export0: JSON channel ready',
  '[    0.489668] provider-registry: 37 sources registered',
  '[    0.512990] provider-registry: arbitrary override disabled',
  '[    0.538221] active-scanning: disabled',
  '[    0.563114] auth0: bearer storage volatile',
  '[    0.588443] auth0: persistent credential storage disabled',
  '[    0.614008] shell0: command allowlist loaded',
  '[    0.639872] shell0: history secret filter active',
  '[    0.667004] shell0: completion index built',
  '[    0.694771] mobile0: field terminal layout ready',
  '[    0.724219] para11ax.service: starting analyst terminal',
  '[    0.751662] para11ax.service: started [ OK ]',
]);

export function createUnixBootSequence({
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

      for (let index = 0; index < UNIX_BOOT_LINES.length; index += 1) {
        onStage('boot-line', UNIX_BOOT_LINES[index]);
        const pause = [4, 9, 15, 24, 29].includes(index) ? 95 : 26;
        if (!await wait(pause)) return true;
      }

      onStage('target', '[  OK  ] Reached target PARA11AX Analyst Terminal.');
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
