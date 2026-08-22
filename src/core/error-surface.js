import { randomUUID } from 'node:crypto';
import { securityHeaders } from './http.js';

const ERROR_CATALOGUE = Object.freeze({
  400: Object.freeze({ code: 'invalid_request', title: 'MALFORMED REQUEST', message: 'The request could not be accepted by the gateway.' }),
  401: Object.freeze({ code: 'unauthorized', title: 'AUTHENTICATION REQUIRED', message: 'A valid gateway bearer credential is required.' }),
  403: Object.freeze({ code: 'forbidden', title: 'ACCESS DENIED', message: 'This operation is not permitted.' }),
  404: Object.freeze({ code: 'not_found', title: 'ROUTE NOT FOUND', message: 'The requested gateway route does not exist.' }),
  405: Object.freeze({ code: 'method_not_allowed', title: 'METHOD NOT ALLOWED', message: 'This route does not accept the requested HTTP method.' }),
  408: Object.freeze({ code: 'request_timeout', title: 'REQUEST TIMEOUT', message: 'The request exceeded its bounded execution window.' }),
  413: Object.freeze({ code: 'payload_too_large', title: 'PAYLOAD TOO LARGE', message: 'The request exceeded the gateway payload limit.' }),
  415: Object.freeze({ code: 'unsupported_media_type', title: 'MEDIA TYPE REJECTED', message: 'This route accepts JSON request bodies only.' }),
  422: Object.freeze({ code: 'unprocessable_request', title: 'REQUEST REJECTED', message: 'The request was syntactically valid but could not be processed safely.' }),
  429: Object.freeze({ code: 'rate_limited', title: 'RATE LIMIT ENGAGED', message: 'The bounded request rate has been exceeded. Retry later.' }),
  500: Object.freeze({ code: 'internal_error', title: 'INTERNAL GATEWAY ERROR', message: 'The gateway could not complete the request safely.' }),
  502: Object.freeze({ code: 'upstream_error', title: 'UPSTREAM FAILURE', message: 'An upstream intelligence source failed to return a usable response.' }),
  503: Object.freeze({ code: 'service_unavailable', title: 'GATEWAY UNAVAILABLE', message: 'The gateway is temporarily unable to service this request.' }),
  504: Object.freeze({ code: 'upstream_timeout', title: 'UPSTREAM TIMEOUT', message: 'An upstream intelligence source exceeded its bounded response window.' }),
});

const OPTIONAL_HEADER_NAMES = new Set(['allow', 'retry-after']);
const MAX_ACCEPT_BYTES = 4096;
const MAX_ACCEPT_RANGES = 32;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function headerValue(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  return headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
}

function parseAccept(value) {
  const accept = String(value ?? '').trim().toLowerCase();
  if (!accept || accept.length > MAX_ACCEPT_BYTES) return [];
  return accept.split(',').slice(0, MAX_ACCEPT_RANGES).map((part, index) => {
    const [rawMedia, ...params] = part.split(';');
    const media = rawMedia.trim();
    const match = /^([!#$%&'*+.^_`|~0-9a-z-]+|\*)\/([!#$%&'*+.^_`|~0-9a-z-]+|\*)$/.exec(media);
    if (!match) return null;
    let q = 1;
    for (const param of params) {
      const qMatch = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param);
      if (!qMatch) continue;
      const parsed = Number(qMatch[1]);
      q = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
      break;
    }
    const specificity = match[1] === '*' ? 0 : match[2] === '*' ? 1 : 2;
    return { type: match[1], subtype: match[2], q, specificity, index };
  }).filter(Boolean);
}

function qualityFor(ranges, mediaType) {
  const [type, subtype] = mediaType.split('/');
  let best = null;
  for (const range of ranges) {
    if (range.type !== '*' && range.type !== type) continue;
    if (range.subtype !== '*' && range.subtype !== subtype) continue;
    if (!best || range.specificity > best.specificity ||
        (range.specificity === best.specificity && range.index < best.index)) {
      best = range;
    }
  }
  return best?.q ?? 0;
}

function wantsHtml(request) {
  const ranges = parseAccept(headerValue(request?.headers, 'accept'));
  if (!ranges.length) return false;
  const htmlQ = qualityFor(ranges, 'text/html');
  const jsonQ = qualityFor(ranges, 'application/json');
  return htmlQ > 0 && htmlQ > jsonQ;
}

function safeRequestId(value) {
  return typeof value === 'string' && UUID.test(value) ? value : randomUUID();
}

function safeStatus(status) {
  const value = Number(status);
  return ERROR_CATALOGUE[value] ? value : 500;
}

function safeCode(status, code) {
  const fallback = ERROR_CATALOGUE[status].code;
  const value = typeof code === 'string' && /^[a-z0-9_]{1,64}$/.test(code) ? code : fallback;
  return value;
}

function optionalHeaders(headers) {
  const safe = {};
  if (!headers || typeof headers !== 'object') return safe;
  for (const [name, value] of Object.entries(headers)) {
    const normalized = String(name).toLowerCase();
    if (!OPTIONAL_HEADER_NAMES.has(normalized)) continue;
    const text = String(value ?? '');
    if (!text || text.length > 128 || /[\r\n]/.test(text)) continue;
    safe[normalized] = text;
  }
  return safe;
}

function htmlPage(status, requestId) {
  const meta = ERROR_CATALOGUE[status];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>${status} // ${meta.title}</title>
<style>
:root{color-scheme:dark;--bg:#050807;--panel:#09110f;--grid:#16362d;--ink:#dffdf2;--muted:#7ca99a;--acid:#77ffbe;--warn:#ff5874}
*{box-sizing:border-box}html,body{min-height:100%;margin:0;background:var(--bg);color:var(--ink);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace}
body{display:grid;place-items:center;overflow:hidden;background-image:linear-gradient(rgba(119,255,190,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(119,255,190,.025) 1px,transparent 1px);background-size:28px 28px}
body:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 30%,rgba(72,255,184,.08),transparent 42%),repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0,rgba(255,255,255,.012) 1px,transparent 1px,transparent 4px)}
main{position:relative;width:min(760px,calc(100vw - 32px));border:1px solid var(--grid);background:linear-gradient(180deg,rgba(9,17,15,.96),rgba(4,8,7,.98));box-shadow:0 0 80px rgba(61,255,180,.08),inset 0 0 40px rgba(61,255,180,.02);padding:clamp(26px,5vw,54px)}
.kicker{color:var(--acid);letter-spacing:.18em;font-size:12px;text-transform:uppercase}.code{font-size:clamp(76px,18vw,172px);font-weight:900;line-height:.82;letter-spacing:-.08em;margin:24px 0 20px;text-shadow:3px 0 rgba(255,88,116,.5),-3px 0 rgba(119,255,190,.35)}
h1{font-size:clamp(20px,4vw,34px);margin:0 0 14px;letter-spacing:.08em}p{color:var(--muted);line-height:1.65;max-width:62ch}.meta{margin-top:30px;padding-top:18px;border-top:1px solid var(--grid);display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:var(--muted)}.meta b{color:var(--ink);font-weight:600}a{display:inline-block;margin-top:28px;color:var(--acid);text-decoration:none;border:1px solid var(--grid);padding:10px 14px}a:hover{border-color:var(--acid);background:rgba(119,255,190,.05)}
</style>
</head>
<body>
<main>
<div class="kicker">CTI ENRICHMENT GATEWAY // CONTROLLED FAILURE</div>
<div class="code">${status}</div>
<h1>${meta.title}</h1>
<p>${meta.message}</p>
<div class="meta"><span>REQUEST ID <b>${requestId}</b></span><span>MODE <b>FAIL CLOSED</b></span></div>
<a href="/api/meta">OPEN PUBLIC GATEWAY META →</a>
</main>
</body>
</html>`;
}

export function renderHttpError(request, status, code, { headers = {}, requestId = null } = {}) {
  const normalizedStatus = safeStatus(status);
  const correlationId = safeRequestId(requestId);
  const error = safeCode(normalizedStatus, code);
  const html = wantsHtml(request);
  return {
    status: normalizedStatus,
    headers: {
      ...optionalHeaders(headers),
      ...securityHeaders(),
      'cache-control': 'no-store',
      'content-type': html ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
      'x-request-id': correlationId,
    },
    body: html ? htmlPage(normalizedStatus, correlationId) : { error, requestId: correlationId },
  };
}

export const ERROR_STATUS_CODES = Object.freeze(Object.keys(ERROR_CATALOGUE).map(Number));
