const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5_000;
const MAX_COLUMNS = 128;
const MAX_FIELD_CHARS = 4_096;

function fail(message) {
  throw new TypeError(`invalid result: ${message}`);
}

function utf8Size(value) {
  return new TextEncoder().encode(value).byteLength;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      if (field.length > MAX_FIELD_CHARS) fail('field too large');
      continue;
    }
    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 1) fail('too many rows');
    } else {
      field += char;
      if (field.length > MAX_FIELD_CHARS) fail('field too large');
    }
  }
  if (quoted) fail('unterminated CSV quote');
  if (field.length || row.length) {
    row.push(field);
    if (row.some(value => value !== '')) rows.push(row);
  }
  if (rows.length === 0) return [];

  const headers = rows[0].map(value => value.trim());
  if (headers.length > MAX_COLUMNS) fail('too many columns');
  if (headers.some(value => !value || value.length > 256)) fail('invalid CSV header');
  if (new Set(headers).size !== headers.length) fail('duplicate CSV header');

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_ROWS) fail('too many rows');
  return dataRows.map((values, index) => {
    if (values.length > headers.length) fail(`row ${index + 1} has too many columns`);
    const out = {};
    for (let i = 0; i < headers.length; i += 1) out[headers[i]] = values[i] ?? '';
    return out;
  });
}

function normalizeRows(input) {
  let rows;
  if (Array.isArray(input)) rows = input;
  else if (input && typeof input === 'object' && Array.isArray(input.rows)) rows = input.rows;
  else if (input && typeof input === 'object') rows = [input];
  else fail('expected rows');

  if (rows.length > MAX_ROWS) fail('too many rows');
  const columns = new Set();
  let nonEmptyRowCount = 0;
  let formulaLikeCellCount = 0;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`row ${rowIndex + 1} must be an object`);
    const entries = Object.entries(row);
    if (entries.length > MAX_COLUMNS) fail('too many columns');
    let rowNonEmpty = false;
    for (const [key, value] of entries) {
      if (!key || key.length > 256) fail('invalid column name');
      columns.add(key);
      if (columns.size > MAX_COLUMNS) fail('too many columns');
      if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) fail('rows must contain flat primitive values');
      if (typeof value === 'string') {
        if (value.length > MAX_FIELD_CHARS) fail('field too large');
        if (/^[=+\-@]/.test(value)) formulaLikeCellCount += 1;
        if (value.trim() !== '') rowNonEmpty = true;
      } else if (value !== null) {
        rowNonEmpty = true;
      }
    }
    if (rowNonEmpty) nonEmptyRowCount += 1;
  }

  return {
    rowCount: rows.length,
    columns: Object.freeze([...columns].sort((a, b) => a.localeCompare(b))),
    nonEmptyRowCount,
    formulaLikeCellCount,
  };
}

export function analyzeMissionResults(input) {
  let format = 'json';
  let parsed = input;

  if (typeof input === 'string') {
    if (utf8Size(input) > MAX_BYTES) throw new RangeError('invalid result: input too large');
    const text = input.trim();
    if (!text) {
      return Object.freeze({
        schemaVersion: 'mission-result-v1.0', format: 'text', state: 'IMPORT_EMPTY', rowCount: 0,
        columnCount: 0, columns: Object.freeze([]), nonEmptyRowCount: 0, formulaLikeCellCount: 0,
        limitations: Object.freeze(['input_empty']),
      });
    }
    if (text.startsWith('[') || text.startsWith('{')) {
      try { parsed = JSON.parse(text); }
      catch { fail('malformed JSON'); }
      format = 'json';
    } else {
      parsed = parseCsv(input);
      format = 'csv';
    }
  } else {
    let serialized;
    try { serialized = JSON.stringify(input); }
    catch { fail('input is not serializable'); }
    if (typeof serialized !== 'string') fail('expected rows');
    if (utf8Size(serialized) > MAX_BYTES) throw new RangeError('invalid result: input too large');
  }

  const summary = normalizeRows(parsed);
  const state = summary.rowCount === 0 ? 'NO_RESULTS' : 'RESULTS_PRESENT';
  const limitations = state === 'NO_RESULTS' ? Object.freeze(['no_results_is_not_benign_evidence']) : Object.freeze([]);
  return Object.freeze({
    schemaVersion: 'mission-result-v1.0',
    format,
    state,
    rowCount: summary.rowCount,
    columnCount: summary.columns.length,
    columns: summary.columns,
    nonEmptyRowCount: summary.nonEmptyRowCount,
    formulaLikeCellCount: summary.formulaLikeCellCount,
    limitations,
  });
}
