import { MISSION_KQL_SCHEMA, MISSION_KQL_SCHEMA_VERSION } from './kql-schema.js';

const MAX_QUERY_CHARS = 32_000;
const CONTROL_COMMAND = /^\s*\.(?:show|drop|create|alter|set|set-or-append|set-or-replace|delete|clear|rename|move|replace|execute|ingest)\b/i;
const BROAD_QUERY = /(?:^|\|)\s*search\s+\*(?:\s|$)|(?:^|\|)\s*union\s+\*/i;
const IDENT = '[A-Za-z_][A-Za-z0-9_]*';

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

function explicitColumns(query) {
  const columns = new Set();
  for (const match of query.matchAll(new RegExp(`\\bwhere\\s+(${IDENT})\\s*(?:==|=~|!=|!~|>=|<=|>|<|\\bin\\b|\\bhas\\b|\\bcontains\\b|\\bstartswith\\b|\\bendswith\\b)`, 'gi'))) {
    columns.add(match[1]);
  }
  for (const match of query.matchAll(/\bproject\s+([^|\n]+)/gi)) {
    for (const raw of match[1].split(',')) {
      const part = raw.trim();
      const alias = part.match(new RegExp(`^${IDENT}\\s*=\\s*(${IDENT})$`));
      if (alias) {
        columns.add(alias[1]);
        continue;
      }
      const bare = part.match(new RegExp(`^(${IDENT})$`));
      if (bare) columns.add(bare[1]);
    }
  }
  return frozenSorted(columns);
}

export function validateMissionKql(input) {
  if (typeof input !== 'string') throw new TypeError('invalid KQL: query must be text');
  const query = input.trim();
  if (!query) throw new TypeError('invalid KQL: empty query');
  if (query.length > MAX_QUERY_CHARS) throw new RangeError('invalid KQL: query too large');
  if (CONTROL_COMMAND.test(query)) throw new TypeError('invalid KQL: control command is not permitted');

  const warnings = [];
  if (BROAD_QUERY.test(query)) warnings.push('broad_unbounded_query');

  const tables = referencedTables(query);
  const unknownTables = tables.filter(name => !Object.hasOwn(MISSION_KQL_SCHEMA, name));
  const columns = explicitColumns(query);
  const unknownColumns = [];

  if (tables.length === 1 && unknownTables.length === 0) {
    const table = tables[0];
    const allowed = new Set(MISSION_KQL_SCHEMA[table]);
    for (const column of columns) if (!allowed.has(column)) unknownColumns.push(`${table}.${column}`);
  }

  const state = warnings.length || unknownTables.length || unknownColumns.length || tables.length === 0
    ? 'SCHEMA_UNVERIFIED'
    : 'VALID';

  return Object.freeze({
    schemaVersion: MISSION_KQL_SCHEMA_VERSION,
    state,
    tables,
    columns,
    unknownTables: frozenSorted(unknownTables),
    unknownColumns: frozenSorted(unknownColumns),
    warnings: frozenSorted(warnings),
  });
}
