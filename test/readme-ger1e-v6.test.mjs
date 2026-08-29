import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');

test('README uses one ger1e-style mobile-normalized animated hero without the old slogan wall', () => {
  const readme = read('README.md');
  const hero = 'assets/brand/para11ax-readme-hero-v6.gif';

  assert.match(readme, /<img[^>]+para11ax-readme-hero-v6\.gif/i);
  assert.doesNotMatch(readme, /<picture>/i);
  assert.doesNotMatch(readme, /para11ax-readme-hero-(?:mobile-)?v5\.gif/i);
  assert.doesNotMatch(readme, /INTELLIGENCE\.\s*ENRICHED\.\s*OPERATIONAL\./i);

  assert.equal(existsSync(hero), true, `${hero} must exist`);
  const gif = readFileSync(hero);
  assert.equal(gif.subarray(0, 6).toString('ascii'), 'GIF89a');
  assert.match(gif.toString('latin1'), /NETSCAPE2\.0/);
  assert.equal(gif.readUInt16LE(6), 720, 'hero width must mirror the ger1e mobile-normalized banner');
  assert.equal(gif.readUInt16LE(8), 360, 'hero height must mirror the ger1e mobile-normalized banner');

  assert.match(readme, /Tooling smoke/i);
  assert.match(readme, /CodeQL/i);
  assert.match(readme, /ENTER ANALYST UI/i);
  assert.match(readme, /analyst@para11ax:~\$/i);
});
