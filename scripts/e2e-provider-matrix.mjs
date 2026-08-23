const key = process.env.ABUSECH_API_KEY;

function safeBody(text) {
  return String(text ?? '').replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]').slice(0, 240);
}

async function probe(name, url, options) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let queryStatus = null;
    try { queryStatus = JSON.parse(text)?.query_status ?? null; } catch {}
    console.log(`ABUSECH_DIAG=${JSON.stringify({ name, status: response.status, queryStatus, body: safeBody(text) })}`);
  } catch (error) {
    console.log(`ABUSECH_DIAG=${JSON.stringify({ name, transportError: error?.name ?? 'Error' })}`);
  }
}

if (!key || !key.trim()) {
  console.log('ABUSECH_DIAG={"name":"shared-key","status":"unconfigured"}');
} else {
  await probe('threatfox', 'https://threatfox-api.abuse.ch/api/v1/', {
    method: 'POST',
    headers: { 'Auth-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'search_ioc', search_term: '8.8.8.8', exact_match: true }),
  });
  await probe('urlhaus', 'https://urlhaus-api.abuse.ch/v1/url/', {
    method: 'POST',
    headers: { 'Auth-Key': key, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ url: 'https://example.com/' }).toString(),
  });
  await probe('malwarebazaar', 'https://mb-api.abuse.ch/api/v1/', {
    method: 'POST',
    headers: { 'Auth-Key': key, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query: 'get_info', hash: '44d88612fea8a8f36de82e1278abb02f' }).toString(),
  });
}

await import('node:fs').then(({ mkdirSync, writeFileSync }) => {
  mkdirSync('public', { recursive: true });
  writeFileSync('public/index.html', 'abusech diagnostic complete\n');
});
