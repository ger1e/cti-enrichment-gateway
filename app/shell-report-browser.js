import { sha256Hex } from '../src/core/sha256.js';
import { assertSnapshotQuality } from '../src/report/quality.js';

const FORMAT_META = Object.freeze({
  text: Object.freeze({ filename: 'report.txt', mimeType: 'text/plain;charset=utf-8' }),
  html: Object.freeze({ filename: 'report.html', mimeType: 'text/html;charset=utf-8' }),
  pdf: Object.freeze({ filename: 'report.pdf', mimeType: 'application/pdf' }),
  csv: Object.freeze({ filename: 'observables.csv', mimeType: 'text/csv;charset=utf-8' }),
  kql: Object.freeze({ filename: 'hunts.kql', mimeType: 'text/plain;charset=utf-8' }),
  navigator: Object.freeze({ filename: 'attack-navigator.json', mimeType: 'application/json;charset=utf-8' }),
  stix: Object.freeze({ filename: 'intelligence.stix.json', mimeType: 'application/stix+json;charset=utf-8' }),
  evidence: Object.freeze({ filename: 'evidence.json', mimeType: 'application/json;charset=utf-8' }),
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function safeText(value, max = 4096) {
  const out = String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim();
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function reportIdentity(snapshot, generatedAt) {
  const snapshotSha256 = sha256Hex(JSON.stringify(canonicalize(snapshot)));
  const reportHash = sha256Hex(JSON.stringify(canonicalize({ snapshotSha256, generatedAt, sourceSha: null })));
  return { snapshotSha256, reportId: `rpt-${reportHash.slice(0, 24)}` };
}

function evidenceLines(snapshot) {
  return (Array.isArray(snapshot.evidence) ? snapshot.evidence : []).slice(0, 100).map((item, index) => {
    const observation = item?.observation ?? {};
    const confidence = Number.isFinite(observation.confidence) ? ` confidence=${observation.confidence}` : '';
    const kind = safeText(observation.kind ?? 'enrichment', 128);
    const verdict = safeText(observation.verdict ?? 'unknown', 128);
    return `${String(index + 1).padStart(2, '0')}. ${safeText(item?.provider ?? 'unknown', 80)} // ${kind} // ${verdict}${confidence}`;
  });
}

function relationshipLines(snapshot) {
  return (Array.isArray(snapshot.relationships) ? snapshot.relationships : []).slice(0, 128).map((item, index) => {
    const target = item?.target ?? item?.value ?? '';
    const targetType = item?.targetType ?? item?.type ?? 'related';
    return `${String(index + 1).padStart(2, '0')}. ${safeText(item?.type ?? 'related', 80)} // ${safeText(targetType, 80)}:${safeText(target, 512)}`;
  });
}

function sourceLines(snapshot) {
  const values = [];
  for (const item of Array.isArray(snapshot.evidence) ? snapshot.evidence : []) {
    for (const reference of Array.isArray(item?.references) ? item.references : []) values.push(String(reference));
  }
  return [...new Set(values)].sort().slice(0, 128).map((value, index) => `${String(index + 1).padStart(2, '0')}. ${safeText(value, 2048)}`);
}

export function renderBrowserReportText(snapshot) {
  const evidence = evidenceLines(snapshot);
  const relationships = relationshipLines(snapshot);
  const sources = sourceLines(snapshot);
  const lines = [
    'PARA11AX ANALYST REPORT',
    `SUBJECT // ${safeText(snapshot.type, 32)}:${safeText(snapshot.indicator, 2048)}`,
    `REQUEST // ${safeText(snapshot.requestId, 128)} // STATUS=${safeText(snapshot.status ?? 'unknown', 32)} // PROFILE=${safeText(snapshot.profile ?? 'unknown', 32)}`,
    `QUERIED // ${safeText(snapshot.queriedAt, 64)}`,
    '',
    'EVIDENCE',
    ...(evidence.length ? evidence : ['none']),
    '',
    'RELATIONSHIPS',
    ...(relationships.length ? relationships : ['none']),
    '',
    'DECISION',
    safeText(snapshot.decision?.assessment ?? snapshot.correlation?.assessment ?? snapshot.guidance?.disposition ?? 'not available', 4096),
    '',
    'LIMITATIONS',
    ...((Array.isArray(snapshot.correlation?.limitations) && snapshot.correlation.limitations.length)
      ? snapshot.correlation.limitations.slice(0, 64).map((value, index) => `${String(index + 1).padStart(2, '0')}. ${safeText(value, 1024)}`)
      : ['none']),
    '',
    'SOURCES',
    ...(sources.length ? sources : ['none']),
  ];
  return `${lines.join('\n')}\n`;
}

function renderHtml(snapshot) {
  return `<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PARA11AX Analyst Report</title></head><body><pre>${escapeHtml(renderBrowserReportText(snapshot))}</pre></body></html>\n`;
}

function csvEscape(value) {
  let out = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(out)) out = `'${out}`;
  if (/[",\n\r]/.test(out)) out = `"${out.replace(/"/g, '""')}"`;
  return out;
}

function collectObservables(snapshot) {
  const rows = [{ type: String(snapshot.type ?? 'unknown'), value: String(snapshot.indicator ?? '') }];
  for (const relation of Array.isArray(snapshot.relationships) ? snapshot.relationships : []) {
    const value = relation?.target ?? relation?.value;
    const type = relation?.targetType ?? relation?.type;
    if (typeof value === 'string' && value && typeof type === 'string' && type) rows.push({ type, value });
  }
  const seen = new Set();
  return rows.filter(row => {
    const key = `${row.type}\u0000${row.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.type.localeCompare(b.type) || a.value.localeCompare(b.value));
}

function renderCsv(snapshot) {
  const rows = collectObservables(snapshot).map(item => `${csvEscape(item.type)},${csvEscape(item.value)}`);
  return `type,value\n${rows.join('\n')}\n`;
}

function collectHunts(snapshot) {
  const source = [
    ...(Array.isArray(snapshot.guidance?.hunts) ? snapshot.guidance.hunts : []),
    ...(Array.isArray(snapshot.decision?.huntPlan) ? snapshot.decision.huntPlan : []),
  ];
  const seen = new Set();
  return source.filter(item => typeof item?.kql === 'string' && item.kql.trim()).filter(item => {
    const key = item.kql.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 64);
}

function renderKql(snapshot) {
  const hunts = collectHunts(snapshot);
  if (!hunts.length) return '// PARA11AX // no evidence-backed KQL hunt present\n';
  return `${hunts.map((item, index) => `// HUNT ${String(index + 1).padStart(2, '0')} // ${safeText(item.id ?? item.hypothesis ?? 'evidence-backed', 256)}\n${item.kql.trim()}`).join('\n\n')}\n`;
}

function attackIds(snapshot) {
  const ids = [];
  for (const item of Array.isArray(snapshot.guidance?.attackMappings) ? snapshot.guidance.attackMappings : []) ids.push(item?.id ?? item?.techniqueId);
  for (const item of Array.isArray(snapshot.decision?.attackMappings) ? snapshot.decision.attackMappings : []) ids.push(item?.id ?? item?.techniqueId);
  for (const item of Array.isArray(snapshot.evidence) ? snapshot.evidence : []) {
    for (const id of Array.isArray(item?.observation?.attributes?.attackIds) ? item.observation.attributes.attackIds : []) ids.push(id);
  }
  return [...new Set(ids.filter(id => typeof id === 'string' && /^T\d{4}(?:\.\d{3})?$/.test(id)))].sort();
}

function renderNavigator(snapshot) {
  return canonicalJson({
    name: `PARA11AX ${snapshot.indicator}`,
    versions: { attack: '18', navigator: '4.9.1', layer: '4.5' },
    domain: 'enterprise-attack',
    description: 'Evidence-backed PARA11AX ATT&CK projection',
    techniques: attackIds(snapshot).map(techniqueID => ({ techniqueID, score: 1, comment: 'PARA11AX evidence-backed mapping' })),
  });
}

function uuidFromSeed(seed, index) {
  const chars = sha256Hex(`${seed}:${index}`).slice(0, 32).split('');
  chars[12] = '5';
  chars[16] = ['8', '9', 'a', 'b'][Number.parseInt(chars[16], 16) % 4];
  const hex = chars.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function renderStix(snapshot, reportId, generatedAt) {
  const objects = [];
  const id = uuidFromSeed(reportId, 0);
  if (snapshot.type === 'cve') {
    objects.push({ type: 'vulnerability', spec_version: '2.1', id: `vulnerability--${id}`, created: generatedAt, modified: generatedAt, name: snapshot.indicator, external_references: [{ source_name: 'cve', external_id: snapshot.indicator }] });
  } else {
    const value = String(snapshot.indicator ?? '');
    let pattern = null;
    if (snapshot.type === 'ip') pattern = value.includes(':') ? `[ipv6-addr:value = '${value.replace(/'/g, "\\'")}']` : `[ipv4-addr:value = '${value.replace(/'/g, "\\'")}']`;
    if (snapshot.type === 'domain') pattern = `[domain-name:value = '${value.replace(/'/g, "\\'")}']`;
    if (snapshot.type === 'url') pattern = `[url:value = '${value.replace(/'/g, "\\'")}']`;
    if (snapshot.type === 'hash') {
      const algorithm = value.length === 32 ? 'MD5' : value.length === 40 ? 'SHA-1' : value.length === 64 ? 'SHA-256' : null;
      if (algorithm) pattern = `[file:hashes.'${algorithm}' = '${value.replace(/'/g, "\\'")}']`;
    }
    if (snapshot.type === 'asn') {
      const number = Number(value.replace(/^AS/i, ''));
      if (Number.isSafeInteger(number) && number > 0) pattern = `[autonomous-system:number = ${number}]`;
    }
    if (pattern) objects.push({ type: 'indicator', spec_version: '2.1', id: `indicator--${id}`, created: generatedAt, modified: generatedAt, valid_from: snapshot.queriedAt ?? generatedAt, pattern_type: 'stix', pattern, name: `${snapshot.type}:${value}`.slice(0, 512) });
  }
  return canonicalJson({ type: 'bundle', id: `bundle--${uuidFromSeed(reportId, 1)}`, objects });
}

function latin1Base64(value) {
  const input = String(value);
  if (typeof btoa === 'function') return btoa(input);
  if (typeof Buffer !== 'undefined') return Buffer.from(input, 'latin1').toString('base64');
  throw new Error('base64 encoder unavailable');
}

function renderPdfBase64(snapshot) {
  const source = renderBrowserReportText(snapshot).replace(/[^\x20-\x7e\n]/g, '-').split(/\r?\n/).slice(0, 500);
  const lines = source.map(line => line.slice(0, 88).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'));
  const stream = ['BT', '/F1 9 Tf', '54 748 Td', '11 TL', ...lines.flatMap(line => [`(${line}) Tj`, 'T*']), 'ET'].join('\n') + '\n';
  const objects = [
    null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let body = '%PDF-1.4\n%CTI\n';
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = body.length;
    body += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return latin1Base64(body);
}

function artifact(format, content, encoding = 'utf8') {
  const meta = FORMAT_META[format];
  if (!meta) throw new TypeError(`unsupported report format: ${format}`);
  return Object.freeze({ filename: meta.filename, mimeType: meta.mimeType, encoding, content });
}

export function inspectBrowserReportQuality(snapshot, { generatedAt } = {}) {
  assertSnapshotQuality(snapshot);
  const time = new Date(generatedAt).toISOString();
  const identity = reportIdentity(snapshot, time);
  return Object.freeze({
    ok: true,
    reportId: identity.reportId,
    generatedAt: time,
    snapshotSha256: identity.snapshotSha256,
    evidenceCount: Array.isArray(snapshot.evidence) ? snapshot.evidence.length : 0,
    sourceCount: sourceLines(snapshot).length,
  });
}

export function projectBrowserReport(snapshot, format, { generatedAt } = {}) {
  assertSnapshotQuality(snapshot);
  const time = new Date(generatedAt).toISOString();
  const identity = reportIdentity(snapshot, time);
  if (format === 'text') return artifact(format, renderBrowserReportText(snapshot));
  if (format === 'html') return artifact(format, renderHtml(snapshot));
  if (format === 'pdf') return artifact(format, renderPdfBase64(snapshot), 'base64');
  if (format === 'csv') return artifact(format, renderCsv(snapshot));
  if (format === 'kql') return artifact(format, renderKql(snapshot));
  if (format === 'navigator') return artifact(format, renderNavigator(snapshot));
  if (format === 'stix') return artifact(format, renderStix(snapshot, identity.reportId, time));
  if (format === 'evidence') return artifact(format, canonicalJson(snapshot));
  throw new TypeError(`unsupported report format: ${format}`);
}

export function decodeBrowserArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object' || typeof artifact.filename !== 'string' || typeof artifact.mimeType !== 'string' || typeof artifact.content !== 'string') throw new TypeError('registered artifact required');
  if (artifact.encoding === 'utf8') return artifact.content;
  if (artifact.encoding !== 'base64') throw new TypeError('unsupported artifact encoding');
  const binary = typeof atob === 'function'
    ? atob(artifact.content)
    : typeof Buffer !== 'undefined'
      ? Buffer.from(artifact.content, 'base64').toString('latin1')
      : null;
  if (binary === null) throw new TypeError('base64 decoder unavailable');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index) & 0xff;
  return bytes;
}
