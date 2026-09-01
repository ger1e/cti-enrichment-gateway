const LIST_FIELDS = Object.freeze([
  'industries',
  'geographies',
  'technologies',
  'attackPaths',
  'priorityActors',
  'telemetry',
  'crownJewels',
]);

const MAX_ID = 128;
const MAX_NAME = 256;
const MAX_ITEMS = 64;
const MAX_ITEM = 256;

function fail(field) {
  throw new TypeError(`invalid client profile: ${field}`);
}

function requiredText(value, field, max) {
  if (typeof value !== 'string') fail(field);
  const out = value.trim();
  if (!out || out.length > max) fail(field);
  return out;
}

function normalizedList(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ITEMS) fail(field);
  const normalized = value.map((item, index) => {
    if (typeof item !== 'string') fail(`${field}[${index}]`);
    const out = item.trim().toLowerCase();
    if (!out || out.length > MAX_ITEM) fail(`${field}[${index}]`);
    return out;
  });
  return Object.freeze([...new Set(normalized)].sort((a, b) => a.localeCompare(b)));
}

export function normalizeClientProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('client profile');
  const profile = {
    id: requiredText(input.id, 'id', MAX_ID).toLowerCase(),
    name: requiredText(input.name, 'name', MAX_NAME),
  };
  for (const field of LIST_FIELDS) profile[field] = normalizedList(input[field], field);
  return Object.freeze(profile);
}
