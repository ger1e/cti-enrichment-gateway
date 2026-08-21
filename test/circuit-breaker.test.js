import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker } from '../src/core/circuit-breaker.js';

test('circuit opens after three consecutive retryable failures for sixty seconds', () => {
  let now = 1000;
  const circuit = new CircuitBreaker({ failureThreshold: 3, openMs: 60_000, now: () => now });
  assert.equal(circuit.canRun('p').allowed, true);
  circuit.recordFailure('p', { retryable: true });
  circuit.recordFailure('p', { retryable: true });
  assert.equal(circuit.canRun('p').allowed, true);
  circuit.recordFailure('p', { retryable: true });
  assert.equal(circuit.canRun('p').allowed, false);
  now += 59_999;
  assert.equal(circuit.canRun('p').allowed, false);
  now += 1;
  assert.equal(circuit.canRun('p').allowed, true);
});

test('success resets failure state and non-retryable errors do not open the circuit', () => {
  const circuit = new CircuitBreaker();
  circuit.recordFailure('p', { retryable: true });
  circuit.recordFailure('p', { retryable: true });
  circuit.recordSuccess('p');
  assert.equal(circuit.state('p').consecutiveFailures, 0);
  circuit.recordFailure('p', { retryable: false });
  circuit.recordFailure('p', { retryable: false });
  circuit.recordFailure('p', { retryable: false });
  assert.equal(circuit.canRun('p').allowed, true);
});

test('circuit state is bounded and count-only stats contain no indicator data', () => {
  const circuit = new CircuitBreaker({ maxProviders: 2 });
  circuit.recordFailure('a', { retryable: true });
  circuit.recordFailure('b', { retryable: true });
  circuit.recordFailure('c', { retryable: true });
  assert.equal(circuit.stats().providers <= 2, true);
  assert.deepEqual(Object.keys(circuit.stats()).sort(), ['open', 'providers']);
});
