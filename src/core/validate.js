import net from 'node:net';

const MAX_INDICATOR_LENGTH = 4096;
const CVE_RE = /^CVE-\d{4}-\d{4,}$/i;

export function classifyIndicator(input) {
  if (typeof input !== 'string') throw new TypeError('indicator must be a string');
  if (input.length > MAX_INDICATOR_LENGTH) throw new RangeError('indicator too long');
  const value = input.trim();
  if (!value) throw new TypeError('indicator is required');

  if (net.isIP(value)) return { value, type: 'ip' };
  if (CVE_RE.test(value)) return { value: value.toUpperCase(), type: 'cve' };

  throw new TypeError('unsupported indicator');
}
