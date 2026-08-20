function httpError(response) {
  const error = new Error(`provider HTTP ${response.status}`);
  error.status = response.status;
  error.retryAfter = response.headers.get('retry-after');
  return error;
}

export async function fetchJson(url, { fetchImpl = fetch, signal, maxBytes = 2_000_000 } = {}) {
  const response = await fetchImpl(url, {
    method: 'GET',
    signal,
    headers: { accept: 'application/json' },
    redirect: 'follow',
  });
  if (!response.ok) throw httpError(response);
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw Object.assign(new Error('provider response too large'), { status: 502 });
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw Object.assign(new Error('provider response too large'), { status: 502 });
  return JSON.parse(text);
}
