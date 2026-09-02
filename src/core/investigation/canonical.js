const FORBIDDEN_KEY = /token|secret|password|authorization|cookie/i;

export const clone = value => structuredClone(value);

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort((left, right) => left.localeCompare(right)).map(key => [key, canonicalize(value[key])]),
  );
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function encodedBytes(value) {
  return new TextEncoder().encode(String(value)).byteLength;
}

export function assertPlainJsonTree(value, path = '$', stack = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`invalid investigation: non-finite number at ${path}`);
    return;
  }
  if (typeof value !== 'object') throw new TypeError(`invalid investigation: non-JSON value at ${path}`);
  if (stack.has(value)) throw new TypeError(`invalid investigation: cyclic value at ${path}`);
  stack.add(value);

  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if ((array && prototype !== Array.prototype) || (!array && prototype !== Object.prototype)) {
    throw new TypeError(`invalid investigation: plain object required at ${path}`);
  }
  if (Object.getOwnPropertySymbols(value).length) throw new TypeError(`invalid investigation: symbol key at ${path}`);

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).filter(key => key !== 'length');
  if (array && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) {
    throw new TypeError(`invalid investigation: sparse array at ${path}`);
  }
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError(`invalid investigation: accessor property at ${path}.${key}`);
    }
    if (FORBIDDEN_KEY.test(key)) throw new TypeError(`invalid investigation: secret-bearing key at ${path}.${key}`);
    assertPlainJsonTree(descriptor.value, array ? `${path}[${key}]` : `${path}.${key}`, stack);
  }
  stack.delete(value);
}

export function sameCanonicalJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

