import { MISSION_KQL_SCHEMA, MISSION_KQL_SCHEMA_VERSION } from './kql-schema.js';

const MAX_QUERY_CHARS = 32_000;
const CONTROL_COMMAND = /^\s*\.(?:show|drop|create|alter|set|set-or-append|set-or-replace|delete|clear|rename|move|replace|execute|ingest)\b/i;
const BROAD_QUERY = /(?:^|\|)\s*search\s+\*(?:\s|$)|(?:^|\|)\s*union\s+\*/i;
const IDENT = '[A-Za-z_][A-Za-z0-9_]*';
const SIMPLE_WHERE = new RegExp(`^(${IDENT})\\s*(?:==|=~|!=|!~|>=|<=|>|<|!in~?\\b|in~?\\b|has(?:_cs|_any|_all)?\\b|contains(?:_cs)?\\b|startswith(?:_cs)?\\b|endswith(?:_cs)?\\b)`, 'i');

function frozenSorted(values) {
  return Object.freeze([...new Set(values)].sort((a, b) => a.localeCompare(b)));
}

function referencedTables(query) {
  const tables = [];
  const first = query.replace(/^\s*(?:\/\/[^\n]*\n|\s)*/g, '').match(new RegExp(`^(${IDENT})\\b`));
  if (first) tables.push(first[1]);

  for (const match of query.matchAll(new RegExp(`\\bjoin\\s+(?:kind\\s*=\\s*${IDENT}\\s+)?\\(?\\s*(${IDENT})\\b`, 'gi'))) tables.push(match[1]);
  for (const match of query.matchAll(new RegExp(`\\bunion\\s+(?!\\*)([^|\n]+)`, 'gi'))) {
    for (const part of match[1].split(',')) {
      const token = part.trim().match(new RegExp(`^(${IDENT})$`));
      if (token) tables.push(token[1]);
    }
  }
  return frozenSorted(tables);
}

function explicitColumnsAndWarnings(query) {
  const columns = new Set();
  const warnings = new Set();

  for (const match of query.matchAll(/(?:^|\|)\s*where\s+([^|\n]+)/gi)) {
    const expression = match[1].trim();
    const simple = expression.match(SIMPLE_WHERE);
    if (!simple || /\b(?:and|or)\b/i.test(expression)) {
      warnings.add('where_expression_unverified');
    } else {
      columns.add(simple[1]);
    }
  }

  for (const match of query.matchAll(/(?:^|\|)\s*project\s+([^|\n]+)/gi)) {
    for (const raw of match[1].split(',')) {
      const part = raw.trim();
      const alias = part.match(new RegExp(`^${IDENT}\\s*=\\s*(${IDENT})$`));
      if (alias) {
        columns.add(alias[1]);
        continue;
      }
      const bare = part.match(new RegExp(`^(${IDENT})$`));
      if (bare) {
        columns.add(bare[1]);
        continue;
      }
      warnings.add('project_expression_unverified');
    }
  }

  return { columns: frozenSorted(columns), warnings };
}

export function validateMissionKql(input) {
  if (typeof input !== 'string') throw new TypeError('invalid KQL: query must be text');
  const query = input.trim();
  if (!query) throw new TypeError('invalid KQL: empty query');
  if (query.length > MAX_QUERY_CHARS) throw new RangeError('invalid KQL: query too large');
  if (CONTROL_COMMAND.test(query)) throw new TypeError('invalid KQL: control command is not permitted');

  const warnings = new Set();
  if (BROAD_QUERY.test(query)) warnings.add('broad_unbounded_query');

  const tables = referencedTables(query);
  if (tables.length > 1) warnings.add('multi_table_column_scope_unverified');
  const unknownTables = tables.filter(name => !Object.hasOwn(MISSION_KQL_SCHEMA, name));
  const extracted = explicitColumnsAndWarnings(query);
  for (const warning of extracted.warnings) warnings.add(warning);
  const columns = extracted.columns;
  const unknownColumns = [];

  if (tables.length === 1 && unknownTables.length === 0) {
    const table = tables[0];
    const allowed = new Set(MISSION_KQL_SCHEMA[table]);
    for (const column of columns) if (!allowed.has(column)) unknownColumns.push(`${table}.${column}`);
  }

  const frozenWarnings = frozenSorted(warnings);
  const state = frozenWarnings.length || unknownTables.length || unknownColumns.length || tables.length === 0
    ? 'SCHEMA_UNVERIFIED'
    : 'VALID';

  return Object.freeze({
    schemaVersion: MISSION_KQL_SCHEMA_VERSION,
    state,
    tables,
    columns,
    unknownTables: frozenSorted(unknownTables),
    unknownColumns: frozenSorted(unknownColumns),
    warnings: frozenWarnings,
  });
}
