function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function section(title, content) {
  return `<section><h2>${title}</h2>${content}</section>`;
}

function list(items, render, empty = 'None recorded.') {
  if (!items.length) return `<p class="muted">${esc(empty)}</p>`;
  return `<ul>${items.map(item => `<li>${render(item)}</li>`).join('')}</ul>`;
}

function pill(value, cls = '') {
  return `<span class="pill ${esc(cls)}">${esc(value)}</span>`;
}

function label(value) {
  return String(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function factValue(value) {
  if (value == null) return 'unknown';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(factValue).join(', ') || 'none';
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${label(key)}=${factValue(item)}`).join(' · ');
  return String(value);
}

function structured(item) {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return factValue(item);
  return Object.entries(item).map(([key, value]) => `${label(key)}: ${factValue(value)}`).join(' · ');
}

export function renderHtml(model) {
  const assessment = model.executiveAssessment ?? {};
  const body = [
    section('Executive Summary', `<div class="summary"><div>${pill(`TLP:${model.tlp}`, 'tlp')}</div><p><strong>Assessment:</strong> ${esc(assessment.state ?? 'insufficient')}</p><p><strong>Confidence:</strong> ${esc(assessment.confidence ?? 'unknown')}</p><p class="mono">${esc(model.reportId)}</p></div>`),
    section('Scope & Subject', `<dl><dt>Subject</dt><dd class="mono">${esc(`${model.subject.type}:${model.subject.value}`)}</dd><dt>Queried</dt><dd>${esc(model.source.queriedAt)}</dd><dt>Profile</dt><dd>${esc(model.source.profile ?? 'unknown')}</dd><dt>Gateway</dt><dd>${esc(model.source.gatewayVersion)}</dd></dl>`),
    section('Key Findings', list(model.keyFindings, item => `${pill(item.state)} ${esc(item.title)} <span class="evidence">${esc(item.evidenceIds.join(', '))}</span>`)),
    section('Suspicious Behavior to Look Out For', list(model.suspiciousBehavior, item => `${pill(item.state, item.state.toLowerCase())} ${pill(item.mappingState, 'mapping')} ${esc(item.title)} <span class="evidence">${esc(item.evidenceIds.join(', '))}</span>`)),
    section('Indicators & Observables', `<table><thead><tr><th>Type</th><th>Value</th></tr></thead><tbody>${model.observables.map(item => `<tr><td>${esc(item.type)}</td><td class="mono">${esc(item.value)}</td></tr>`).join('')}</tbody></table>`),
    section('Threat Context', `<p><strong>Actors:</strong> ${esc(model.threatContext.actors.join(', ') || 'None evidenced.')}</p><p><strong>Malware / tooling:</strong> ${esc(model.threatContext.malware.join(', ') || 'None evidenced.')}</p>${list(model.threatContext.infrastructure, item => `${esc(item.type)}: <span class="mono">${esc(item.value)}</span>`, 'No related infrastructure.')}`),
    section('Correlation & Relationships', list(model.relationships, item => `${esc(item.provider ?? 'gateway')}: ${esc(item.relationship ?? item.type ?? 'related')} - <span class="mono">${esc(item.value ?? item.target ?? structured(item))}</span>`)),
    section('Timeline', list(model.timeline, item => `<time>${esc(item.at)}</time> ${esc(item.kind)} <span class="evidence">${esc(item.evidenceId)}</span>`)),
    section('Analytical Frameworks', `<h3>MITRE ATT&CK</h3>${list(model.frameworks.attack, item => `${pill(item.mappingState, 'mapping')} <span class="mono">${esc(item.id)}</span> <span class="evidence">${esc(item.evidenceIds.join(', '))}</span>`, 'No defensible ATT&CK mappings.')}<h3>Cyber Kill Chain</h3><p class="muted">${esc(model.frameworks.killChain.join(', ') || 'No defensible mapping.')}</p><h3>Pyramid of Pain</h3><p class="muted">${esc(model.frameworks.pyramidOfPain.join(', ') || 'No defensible mapping.')}</p><h3>Diamond Model</h3><p class="muted">${esc(model.frameworks.diamondModel.join(', ') || 'No defensible mapping.')}</p>`),
    section('Hunt Opportunities', list(model.huntOpportunities, item => `<strong>${esc(item.id)}</strong><p>${esc(item.hypothesis)}</p><p><strong>Telemetry:</strong> ${esc(item.telemetry.join(', '))}</p>${item.kql ? `<pre>${esc(item.kql)}</pre>` : ''}`)),
    section('Contradictions & Alternative Explanations', list(model.contradictions, item => esc(structured(item)))),
    section('Recommended Actions', list(model.actions, item => esc(structured(item)))),
    section('Intelligence & Telemetry Gaps', list(model.gaps, item => esc(structured(item)))),
    section('Confidence & Limitations', `<p><strong>Confidence:</strong> ${esc(assessment.confidence ?? 'unknown')}</p>${list(model.limitations, item => esc(structured(item)))}`),
    section('Sources & Evidence Provenance', `${list(model.evidence, item => `<span class="mono">${esc(item.id)}</span> ${esc(item.provider)} parser=${esc(item.integrity.parserVersion)} retrieved=${esc(item.retrievedAt)}`)}${list(model.sources, item => `<span class="mono">${esc(item)}</span>`, 'No external references.')}`),
    section('Reproducibility / Integrity', `<dl><dt>Report schema</dt><dd>${esc(model.reportSchemaVersion)}</dd><dt>Snapshot SHA-256</dt><dd class="mono">${esc(model.reproducibility.snapshotSha256)}</dd><dt>Source SHA</dt><dd class="mono">${esc(model.reproducibility.sourceSha ?? 'unavailable')}</dd><dt>Generated</dt><dd>${esc(model.reproducibility.generatedAt)}</dd></dl>`),
  ].join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CTI Report - ${esc(model.subject.value)}</title><style>:root{color-scheme:dark;background:#070b0d;color:#e8f6f2;font:15px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0,#102326 0,#070b0d 42%);color:#d8e5e3}main{max-width:1100px;margin:auto;padding:48px 24px 80px}header{border:1px solid #244348;background:#0b1417;padding:28px;margin-bottom:20px;box-shadow:0 0 36px #0e383844}h1{font-size:clamp(28px,5vw,58px);line-height:1;margin:0 0 12px;letter-spacing:-.04em;text-transform:uppercase}h2{margin:0 0 18px;font-size:18px;text-transform:uppercase;letter-spacing:.08em;color:#a9d7d0}h3{font-size:14px;text-transform:uppercase;color:#8cb7b1}section{border:1px solid #1c3034;background:#091114e8;padding:22px;margin:14px 0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid #193036;vertical-align:top}dt{color:#86aaa5;font-size:12px;text-transform:uppercase}dd{margin:0 0 10px}.mono,pre,.evidence{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-wrap:anywhere}pre{white-space:pre-wrap;padding:12px;border:1px solid #234148;background:#05090b}.pill{display:inline-block;border:1px solid #38575c;padding:2px 7px;margin-right:6px;font-size:11px;letter-spacing:.04em}.tlp{font-weight:800}.observed{border-color:#5f8}.look_for_next{border-color:#8cf}.contextual_not_observed{border-color:#db8}.mapping{opacity:.8}.muted,.evidence{color:#8fa3a1}.evidence{font-size:11px}a{color:inherit}@media print{body{background:#fff;color:#111}main{max-width:none;padding:0}header,section{background:#fff;color:#111;box-shadow:none;border-color:#999}.muted,.evidence,dt,h2,h3{color:#333}}</style></head><body><main><header><div class="pill tlp">${esc(`TLP:${model.tlp}`)}</div><h1>PARA11AX</h1><div class="mono">${esc(`${model.subject.type}:${model.subject.value}`)}</div><div class="muted">${esc(model.generatedAt)}</div></header>${body}</main></body></html>\n`;
}
