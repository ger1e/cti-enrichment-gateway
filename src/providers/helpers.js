export function arr(value) { return Array.isArray(value) ? value : []; }
export function uniq(values) { return [...new Set(arr(values).filter(v => v !== undefined && v !== null && String(v).trim()).map(v => String(v)))]; }
export function envValue(context, name) { const value = context?.env?.[name]; return typeof value === 'string' && value.trim() ? value.trim() : null; }
export function requireEnv(context, name) { const value = envValue(context, name); if (!value) throw Object.assign(new Error('provider credential not configured'), { status: 503 }); return value; }
export function isoFromUnix(value) { const n = Number(value); if (!Number.isFinite(n) || n <= 0) return null; return new Date(n * 1000).toISOString(); }
export function relation(targetType, target, relationship = 'related', extra = {}) { if (target === undefined || target === null || String(target).trim() === '') return null; return { targetType, target: String(target), relationship, ...extra }; }
export function compact(values) { return arr(values).filter(Boolean); }
export function hashKind(hash) { if (!/^[a-fA-F0-9]+$/.test(hash)) return null; if (hash.length === 32) return 'md5'; if (hash.length === 40) return 'sha1'; if (hash.length === 64) return 'sha256'; return null; }
export function vtVerdict(stats = {}) { if (Number(stats.malicious) > 0) return 'malicious'; if (Number(stats.suspicious) > 0) return 'suspicious'; if (Object.keys(stats).length) return 'no_detection'; return 'unknown'; }
export function riskVerdict(value) { const risk = String(value ?? '').toLowerCase(); if (['critical', 'high', 'malicious'].includes(risk)) return 'malicious'; if (['medium', 'moderate', 'suspicious'].includes(risk)) return 'suspicious'; if (['low', 'none', 'benign', 'clean'].includes(risk)) return 'no_detection'; return 'unknown'; }
export function firstEnglish(descriptions) { return arr(descriptions).find(x => x?.lang === 'en')?.value ?? arr(descriptions)[0]?.value ?? null; }
export function firstCvss(metrics = {}) { for (const group of ['cvssMetricV40','cvssMetricV31','cvssMetricV30','cvssMetricV2']) { const item = arr(metrics[group])[0]; if (item?.cvssData) return { version: item.cvssData.version ?? null, score: item.cvssData.baseScore ?? null, severity: item.cvssData.baseSeverity ?? item.baseSeverity ?? null, vector: item.cvssData.vectorString ?? null }; } return null; }
