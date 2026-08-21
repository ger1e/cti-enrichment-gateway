# CTI Enrichment Gateway — Final Boundary Hardening Design

Date: 2026-08-21
Status: approved design, pending implementation plan
Base: `main` at `71c2bf331d279fb7a0ddd3532ffb4909ab0a6042`
Scope: personal, read-only CTI enrichment gateway

## 1. Objective

Perform one final bounded hardening pass over the production v2 gateway. The goal is to fix confirmed boundary defects, add adversarial regression coverage, and stop when further changes would add disproportionate complexity or expand the product beyond its existing read-only enrichment purpose.

This is not a feature expansion. Provider count, API surface, evidence model, profiles, STIX semantics, Maltego entity model, Vercel architecture and zero-runtime-dependency posture remain unchanged unless a verified defect requires a narrowly-scoped correction.

## 2. Non-negotiable invariants

1. The gateway remains read-only. No submission, detonation, scanning, blocking, takedown, remediation or write-back behavior is added.
2. Outbound destinations remain fixed by provider metadata and enforced centrally.
3. Provider/gateway secrets never enter Git, responses, logs, errors, telemetry, evidence, generated artifacts or command output.
4. Every request remains bounded by hard byte, call, concurrency and time ceilings.
5. Partial provider failure remains explicit and never becomes synthetic negative intelligence.
6. No arbitrary provider selection, URL, method, header or egress host becomes caller-controlled.
7. No aggregate maliciousness score is introduced.
8. Runtime behavior changes require RED-to-GREEN tests before merge.
9. Merge requires the complete repository gate, exact PR-head CI verification and exact-head merge protection.
10. Production acceptance requires exact Git/Vercel SHA parity plus live public/protected boundary checks.

## 3. Mandatory hardening changes

### 3.1 True streaming enforcement of upstream response ceilings

#### Confirmed defect

`safeFetch()` currently checks declared `Content-Length`, then calls `response.text()`, then measures the decoded body. If an upstream omits `Content-Length`, uses chunked transfer, lies about its length, or otherwise returns more data than declared, the full body can be buffered before the configured ceiling is enforced.

The current behavior rejects oversized data semantically, but does not provide a strict memory bound at the central egress boundary.

#### Design

Introduce one internal bounded body reader in `src/core/egress.js`.

Behavior:

- Preserve the existing early `Content-Length` rejection.
- When `response.body.getReader()` is available, consume chunks incrementally.
- Track raw bytes, not character count.
- Abort/cancel the stream immediately when cumulative bytes exceed the effective response limit.
- Never concatenate beyond the configured ceiling.
- Decode only the already-bounded byte buffer as UTF-8 after successful completion.
- Preserve existing `responseView()` behavior for callers.
- Retain a compatibility fallback for response fixtures/environments without a readable stream; the fallback remains post-read bounded but must not be the normal Node 24 production path.
- Do not change provider-specific size limits.

The resulting failure remains normalized as `provider_response_too_large` and must never expose response content.

#### Tests

RED tests must establish all of the following before implementation:

- an oversized chunked stream without `Content-Length` is rejected;
- the reader is cancelled/stops consuming once the ceiling is crossed;
- an exact-limit body succeeds;
- a multi-byte UTF-8 body is bounded by bytes rather than JavaScript string length;
- an incorrect small `Content-Length` does not bypass the streamed ceiling;
- current redirect, host, method, request-body and credential-redaction invariants remain unchanged.

### 3.2 Restore the production health/finalizer contract

#### Confirmed defect

`/api/health` is now application-bearer protected, but `scripts/bootstrap-vercel.ps1` still verifies it through `vercel curl` without supplying the gateway Authorization header. `vercel curl` can satisfy Vercel Deployment Protection, but does not satisfy the gateway's own bearer check by itself.

The next full local finalization can therefore fail at the post-deployment health step even when production is healthy.

#### Design

Keep the existing DPAPI trust boundary and use the already-stored gateway token only in memory for the production acceptance call.

Behavior:

- `Verify-ProductionHealth` receives or obtains the current DPAPI-protected gateway token without printing it.
- Invoke `vercel curl` against `/api/health` and pass native curl flags after `--`, including `Authorization: Bearer <token>`.
- Preserve `--deployment` and `--scope` so Vercel Deployment Protection and project scoping remain handled by the CLI.
- Parse JSON exactly as today and require `status == ok` and `gatewayAuthConfigured == true`.
- Clear the plaintext variable immediately after use.
- Error text must not contain the token or complete Authorization header.
- Do not place the bearer in command-line logging or repository files.

The implementation plan must verify the exact Vercel CLI syntax against current official documentation before committing the final command form.

#### Tests

Strengthen `test/production-health.test.js` so it fails unless the production-health function:

- uses `vercel curl`;
- targets `/api/health` through the production deployment alias;
- supplies an application Authorization header via native curl flags;
- obtains the value through the existing DPAPI token path rather than an environment-file secret;
- never contains a literal token value;
- retains JSON/status/auth-configuration verification.

### 3.3 Fail-closed batch accounting on unknown consumption

#### Confirmed defect

`runBatch()` reserves a provider-call allowance for an indicator. If `enrichOne()` throws before returning an enrichment envelope, the code treats observed provider calls as zero and refunds the entire reservation. Because actual upstream consumption is unknowable after an unexpected exception, later indicators could theoretically consume additional calls beyond the intended global budget.

#### Design

Make accounting conservative only for the exceptional unknown-consumption path.

Behavior:

- Normal successful/partial/error enrichment envelopes continue reporting and refunding unused reservations according to `enrichment.budget.providerCalls`.
- When `enrichOne()` throws and no trustworthy budget envelope exists, charge the full reserved amount as consumed.
- Return the existing per-item `batch_enrichment_error` result; do not expose exception text.
- Do not retry the failed item at the batch layer.
- Preserve the global hard ceiling of 200 calls and existing maximum of 3 concurrent indicators.

#### Tests

RED tests must prove:

- a throwing enrichment consumes its full reservation;
- later indicators cannot exceed the remaining global budget;
- the reported `providerCalls` remains `<= providerCallLimit`;
- normal successful reservations still reclaim genuinely unused calls;
- duplicates remain single-work items and retain original-order reassociation.

### 3.4 Support both legal HTTP `Retry-After` forms

#### Confirmed defect

The scheduler only handles numeric `Retry-After` seconds. An HTTP-date value converts to `NaN`, producing an immediate retry even when the server requested a future retry time.

#### Design

Add a deterministic helper in `src/core/scheduler.js` that accepts both RFC-compatible forms:

- non-negative delta-seconds;
- HTTP-date.

Rules:

- Parse relative delay against the scheduler's injected `nowMs()` clock so tests are deterministic.
- Negative, malformed or already-expired dates yield zero delay.
- Delay is integer milliseconds and never extends beyond the existing request deadline.
- If the requested delay is greater than or equal to remaining request time, do not retry.
- Preserve the existing maximum of one retry.
- Do not introduce exponential backoff or additional retry classes.

#### Tests

RED tests must cover:

- delta-seconds;
- future HTTP-date;
- expired HTTP-date;
- malformed value;
- future HTTP-date beyond the request deadline preventing retry;
- maximum one retry remains true.

## 4. Conditional bounded-cache byte ceiling

The existing cache is bounded by 500 LRU entries but not aggregate retained bytes. This can become a memory-pressure risk because provider result sizes vary significantly.

This is explicitly conditional, not mandatory.

Proceed only if the implementation remains dependency-free, deterministic and small enough to preserve the cache's current clarity. The preferred design, if accepted during implementation planning, is:

- add an optional `maxBytes` constructor limit;
- derive entry weight from a deterministic serialized-size approximation at insertion time;
- track total retained bytes;
- evict LRU entries until both `maxEntries` and `maxBytes` are satisfied;
- never cache a single object larger than `maxBytes`;
- expose only count/byte totals in `stats()`;
- preserve current TTL, namespace and in-flight semantics.

Stop and omit this enhancement if accurate accounting requires deep custom object traversal, mutation tracking, compression semantics, dependency additions or significant cache refactoring. Entry-count bounding remains an acceptable deliberate limit for the current single-user deployment if the byte-bound implementation ceases to be simple.

## 5. Explicitly rejected changes

The hardening pass must not add any of the following without new evidence:

- additional CTI providers merely for breadth;
- TLS/JA3 enrichment without a fixed bounded defensible source;
- ATT&CK collection-wide relationship expansion;
- MISP/TAXII writes;
- sample submission, detonation or scanning;
- durable queues, Redis, databases or vector stores;
- a generic proxy or caller-defined egress;
- a master reputation/maliciousness score;
- broad refactors unrelated to the confirmed defects;
- new API endpoints;
- breaking changes to the evidence schema;
- stricter client requirements such as mandatory request `Content-Type` when current compatible behavior is intentional and not a demonstrated security defect.

## 6. Files expected to change

Mandatory scope is expected to stay within:

- `src/core/egress.js`
- `test/egress-policy.test.js` and/or `test/chaos-provider.test.js`
- `scripts/bootstrap-vercel.ps1`
- `test/production-health.test.js`
- `src/core/batch.js`
- `test/batch-api.test.js`
- `src/core/scheduler.js`
- `test/scheduler.test.js`
- relevant operational documentation only where runtime/acceptance behavior materially changes

Conditional cache scope, if retained:

- `src/core/cache.js`
- `test/cache-v2.test.js`
- observability/API docs only if a new byte-count statistic is exposed through authenticated status.

Any need to touch provider adapters, the evidence schema, STIX exporter, Maltego mapper, public API shape or workflow manifests is a scope-expansion signal and must be justified by a newly reproduced defect.

## 7. Test and release strategy

Implementation is test-driven. For each defect:

1. Add the narrowest regression test and demonstrate RED against the current branch state.
2. Implement the smallest correction.
3. Run the focused test to GREEN.
4. Run adjacent subsystem tests.
5. After all changes, run the complete repository acceptance suite.

Required final gates:

- Node.js 24 test suite: zero failures/skips/todos unless an existing explicit skip is already part of the baseline;
- `npm run check`;
- shell syntax and ShellCheck;
- repository invariant verification;
- public-release audit;
- release-manifest parity;
- Maltego Python unit tests;
- Python compileall;
- PowerShell syntax for bootstrap/finalizer/Maltego installer;
- exact PR-head `Tooling smoke` success;
- no unexpected open PR conflict;
- squash merge only with the expected reviewed head SHA;
- post-merge final `main` status success;
- production Vercel deployment `READY` on the exact final `main` SHA;
- live `/api/meta` 200;
- live unauthenticated `/api/health` and `/api/status` 401 with `Cache-Control: no-store`;
- current production runtime error check clean.

A positive authenticated live smoke remains restricted to a trusted context that can use the DPAPI-protected gateway bearer without exposing it to chat or connector output. The repository bootstrap/finalizer is the canonical place for that acceptance check.

## 8. Diminishing-returns stop condition

The hardening tranche is complete when all mandatory defects are fixed, all new adversarial tests pass, full CI is green, production is on the exact merged SHA, and no remaining review finding meets all three criteria below:

1. reproducible against current code or production behavior;
2. meaningful impact to security, correctness, boundedness, evidence integrity or operational reliability;
3. fixable without disproportionate complexity or scope expansion.

Ideas that are merely stylistic, theoretical without a reachable path, dependent on unavailable credentials/external state, or that create new infrastructure/product surface are recorded as deliberate gaps rather than implemented.
