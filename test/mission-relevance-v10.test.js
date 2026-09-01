import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClientProfile } from '../src/core/mission/client-profile.js';
import { assessClientRelevance } from '../src/core/mission/relevance.js';

test('client profile normalization trims, canonicalizes, deduplicates, sorts, and freezes facts', () => {
  const profile = normalizeClientProfile({
    id: '  EXAMPLE-EU  ',
    name: '  Example Industrial  ',
    industries: [' Chemicals ', 'chemicals', 'Energy'],
    geographies: ['EU', ' Austria '],
    technologies: [' Fortinet ', 'Microsoft Defender', 'fortinet'],
    attackPaths: [' Remote Access ', 'identity'],
    priorityActors: [' Example Actor ', 'example actor'],
    telemetry: [' DeviceNetworkEvents ', 'SigninLogs'],
    crownJewels: [' Active Directory ', 'OT Boundary'],
  });

  assert.equal(profile.id, 'example-eu');
  assert.equal(profile.name, 'Example Industrial');
  assert.deepEqual(profile.industries, ['chemicals', 'energy']);
  assert.deepEqual(profile.geographies, ['austria', 'eu']);
  assert.deepEqual(profile.technologies, ['fortinet', 'microsoft defender']);
  assert.deepEqual(profile.telemetry, ['devicenetworkevents', 'signinlogs']);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.technologies), true);
  assert.throws(() => profile.technologies.push('zscaler'), TypeError);
});

test('client profile normalization rejects invalid or oversized inputs', () => {
  assert.throws(() => normalizeClientProfile(null), /client profile/i);
  assert.throws(() => normalizeClientProfile({ id: '', name: 'x' }), /id/i);
  assert.throws(() => normalizeClientProfile({ id: 'x', name: '' }), /name/i);
  assert.throws(() => normalizeClientProfile({ id: 'x', name: 'x', technologies: Array.from({ length: 65 }, (_, i) => `tech-${i}`) }), /technologies/i);
  assert.throws(() => normalizeClientProfile({ id: 'x', name: 'x', telemetry: ['x'.repeat(257)] }), /telemetry/i);
});

test('relevance assessment exposes deterministic weighted factor contributions', () => {
  const profile = normalizeClientProfile({
    id: 'example-eu',
    name: 'Example Industrial',
    industries: ['chemicals'],
    geographies: ['eu'],
    technologies: ['fortinet', 'microsoft defender'],
    attackPaths: ['remote access'],
    priorityActors: ['example actor'],
    telemetry: ['devicenetworkevents', 'signinlogs'],
    crownJewels: ['active directory'],
  });

  const assessment = assessClientRelevance(profile, {
    technologies: ['Fortinet', 'Ivanti'],
    observedExploitation: true,
    industries: ['chemicals'],
    geographies: ['EU'],
    attackPaths: ['Remote Access'],
    actors: ['Example Actor'],
    requiredTelemetry: ['DeviceNetworkEvents', 'DeviceProcessEvents'],
    evidenceConfidence: 0.8,
  });

  assert.equal(assessment.score, 84);
  assert.equal(assessment.label, 'immediate');
  assert.deepEqual(assessment.factors.map(item => [item.id, item.score, item.weight]), [
    ['technology', 12.5, 25],
    ['observed_exploitation', 20, 20],
    ['industry', 15, 15],
    ['geography', 10, 10],
    ['attack_path', 10, 10],
    ['actor', 10, 10],
    ['telemetry', 2.5, 5],
    ['evidence_confidence', 4, 5],
  ]);
  assert.deepEqual(assessment.gaps, []);
  assert.equal(Object.isFrozen(assessment), true);
  assert.equal(Object.isFrozen(assessment.factors), true);
});

test('unknown relevance factors score zero and remain explicit gaps', () => {
  const profile = normalizeClientProfile({ id: 'x', name: 'X', technologies: ['fortinet'] });
  const assessment = assessClientRelevance(profile, { technologies: ['fortinet'] });

  assert.equal(assessment.score, 25);
  assert.equal(assessment.label, 'low');
  assert.deepEqual(assessment.gaps, [
    'actor',
    'attack_path',
    'evidence_confidence',
    'geography',
    'industry',
    'observed_exploitation',
    'telemetry',
  ]);
});

test('relevance labels use stable operational boundaries', () => {
  const empty = normalizeClientProfile({ id: 'empty', name: 'Empty' });
  assert.equal(assessClientRelevance(empty, {}).label, 'contextual');

  const exploitationOnly = normalizeClientProfile({ id: 'exp', name: 'Exploitation' });
  assert.equal(assessClientRelevance(exploitationOnly, { observedExploitation: true }).label, 'low');

  const moderate = normalizeClientProfile({ id: 'mod', name: 'Moderate', technologies: ['fortinet'] });
  assert.equal(assessClientRelevance(moderate, { technologies: ['fortinet'], observedExploitation: true }).label, 'moderate');

  const high = normalizeClientProfile({ id: 'high', name: 'High', technologies: ['fortinet'], industries: ['chemicals'] });
  assert.equal(assessClientRelevance(high, { technologies: ['fortinet'], observedExploitation: true, industries: ['chemicals'] }).label, 'high');

  const immediate = normalizeClientProfile({
    id: 'imm', name: 'Immediate', technologies: ['fortinet'], industries: ['chemicals'], geographies: ['eu'], attackPaths: ['remote access'],
  });
  assert.equal(assessClientRelevance(immediate, {
    technologies: ['fortinet'], observedExploitation: true, industries: ['chemicals'], geographies: ['eu'], attackPaths: ['remote access'],
  }).label, 'immediate');
});
