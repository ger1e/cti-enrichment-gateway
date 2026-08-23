async function diag(name, url, timeoutMs = 12000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    let apiStatus = null;
    const ct = response.headers.get('content-type') ?? '';
    if (ct.includes('json')) {
      try {
        const text = await response.text();
        apiStatus = JSON.parse(text)?.status_code ?? null;
      } catch {}
    } else {
      try { await response.body?.cancel(); } catch {}
    }
    console.log(`PUBLIC_DIAG=${JSON.stringify({ name, status: response.status, apiStatus, contentType: ct.split(';')[0] })}`);
  } catch (error) {
    console.log(`PUBLIC_DIAG=${JSON.stringify({ name, transportError: error?.name ?? 'Error' })}`);
  }
}

await diag('threatminer-doc-ip', 'https://api.threatminer.org/v2/host.php?q=192.0.2.1&rt=2', 12000);
await diag('circl-www', 'https://www.circl.lu/doc/misp/feed-osint/hashes.csv', 12000);
await diag('circl-apex', 'https://circl.lu/doc/misp/feed-osint/hashes.csv', 12000);

await import('node:fs').then(({ mkdirSync, writeFileSync }) => {
  mkdirSync('public', { recursive: true });
  writeFileSync('public/index.html', 'public diagnostic complete\n');
});
