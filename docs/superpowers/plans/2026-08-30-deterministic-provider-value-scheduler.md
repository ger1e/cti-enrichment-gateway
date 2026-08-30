# Deterministic Provider Value Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tier-only execution ordering with a deterministic, auditable provider/type value queue that prioritizes the highest-value admitted IP sources first without changing provider admission, egress, retries, concurrency, deadlines, or the fixed provider set.

**Architecture:** Keep profile admission in `src/profiles.js`, keep execution mechanics in `src/core/scheduler.js`, and add a pure `src/core/provider-priority.js` policy/comparator. Provider/type descriptors live declaratively in `config/providers.json`, are sanitized by `src/providers/manifest.js`, and are copied onto adapters by `src/providers/metadata.js`. `runScheduledProviders()` consumes a ranked queue rather than tier barriers. Capability metadata exposes the normalized descriptor, scheduler policy version, fallback state, and execution rationale. No runtime learning or result-conditioned suppression is allowed.

**Tech Stack:** Node.js 24, ECMAScript modules, `node:test`, JSON provider manifest, existing PARA11AX scheduler/orchestrator/capability registry.

**Spec:** `docs/superpowers/specs/2026-08-30-unified-intelligence-kernel-design.md`

## Global Constraints

- Do not add providers, hosts, protocols, dependencies, or active network behavior.
- Preserve `PROVIDER_CONCURRENCY_MAX = 4`, `PROVIDER_MAX_ATTEMPTS = 2`, and `REQUEST_DEADLINE_MS = 20_000`.
- Preserve profile admission semantics: `fast`, `standard`, and `full` decide admission before value ranking.
- Preserve the workflow call budget of `providers.length * 2`.
- The priority algorithm must be deterministic and must not use runtime latency, reliability history, previous results, cache state, or provider names.
- Production IP provider/type descriptors must be complete. Missing, incomplete, or invalid descriptors on synthetic/legacy inputs must not stop execution.
- A fallback descriptor is surfaced as `legacy_priority_fallback`.
- Valid descriptors sort by the approved categorical comparator. Fallback entries are isolated after valid entries and sort among themselves by `tier -> original workflow index`; this preserves a total deterministic order while limiting a metadata defect to the affected provider/type pair.
- The ranked queue preserves concurrency: do not serialize execution by creating one barrier per priority vector.
- Follow strict TDD for every behavior change: write the failing test, run it and confirm the expected failure, add the minimum implementation, rerun, then commit.

---

## Task 1: Add the pure scheduler policy and comparator

**Files**
- Create: `src/core/provider-priority.js`
- Create: `test/provider-priority.test.js`

**Interfaces**

```js
export const PROVIDER_SCHEDULER_POLICY_VERSION = '1.0';

export function providerPriority(adapter, type, workflowIndex) {
  // -> deeply frozen normalized priority record
}

export function rankProvidersForExecution({ providers, type }) {
  // -> frozen array of { adapter, priority }
}
```

Normalized priority shape:

```js
{
  version: '1.0',
  type: 'ip',
  provider: 'threatfox',
  fallback: false,
  rationale: 'authorityClass', // first comparator dimension that separated this entry from the next entry, assigned after ranking
  descriptor: {
    authorityClass: 'specialist',
    semanticUniqueness: 'unique',
    intelligenceValue: 'direct',
    pivotValue: 'high',
    latencyClass: 'normal'
  },
  costClass: 'quota',
  tier: 3,
  workflowIndex: 20
}
```

Approved descending categorical order:

```js
const RANK = Object.freeze({
  authorityClass: Object.freeze({ authoritative: 0, first_party: 1, specialist: 2, aggregator: 3, community: 4, contextual: 5 }),
  semanticUniqueness: Object.freeze({ unique: 0, complementary: 1, duplicative: 2 }),
  intelligenceValue: Object.freeze({ direct: 0, supporting: 1, contextual: 2 }),
  pivotValue: Object.freeze({ high: 0, medium: 1, low: 2, none: 3 }),
  latencyClass: Object.freeze({ fast: 0, normal: 1, slow: 2 }),
  costClass: Object.freeze({ free: 0, quota: 1, scarce: 2 })
});
```

- [ ] Write `test/provider-priority.test.js` with one pairwise test for every comparator dimension. Hold all preceding dimensions equal so each test proves the exact precedence of the dimension under test.
- [ ] Add a deterministic-tie test proving `tier` precedes `workflowIndex` after all categorical dimensions tie.
- [ ] Add a test proving identical input produces byte-equivalent normalized priority records and identical provider order.
- [ ] Add a fallback test for absent, incomplete, and invalid `schedulerByType.ip`. Assert `fallback === true`, `rationale === 'legacy_priority_fallback'`, and that fallback providers order by tier then original workflow index.
- [ ] Add a mixed valid/fallback test proving valid descriptors retain value ordering and fallback entries are placed after valid entries, ordered only by tier/index.
- [ ] Run `node --test test/provider-priority.test.js` and confirm failure because the module does not exist.
- [ ] Implement only the enum validation, normalization, comparator, fallback record, stable ranking, and rationale derivation required by the tests. Do not import provider adapters or runtime telemetry.
- [ ] Deep-freeze returned priority records and arrays.
- [ ] Run `node --test test/provider-priority.test.js` and confirm all tests pass.
- [ ] Commit with message `feat: add deterministic provider priority policy`.

## Task 2: Extend provider manifest metadata without making scheduler metadata fatal

**Files**
- Modify: `src/providers/manifest.js`
- Modify: `src/providers/metadata.js`
- Create: `test/provider-manifest-scheduler.test.js`

**Interfaces**

Each provider may include:

```json
"schedulerByType": {
  "ip": {
    "authorityClass": "specialist",
    "semanticUniqueness": "unique",
    "intelligenceValue": "direct",
    "pivotValue": "high",
    "latencyClass": "normal"
  }
}
```

Manifest sanitation result on an adapter:

```js
adapter.schedulerByType.ip
adapter.schedulerMetadataInvalidTypes // frozen string array; normally []
```

- [ ] Write tests proving a valid `schedulerByType.ip` descriptor is normalized and frozen.
- [ ] Write tests proving scheduler metadata for a type not present in `provider.types` is ignored and recorded as invalid rather than widening provider coverage.
- [ ] Write tests proving an unknown enum, missing field, non-object descriptor, or malformed `schedulerByType` does not throw `invalid provider manifest`; instead the affected type is omitted from normalized descriptors and recorded in `schedulerMetadataInvalidTypes`.
- [ ] Write a regression assertion that existing required manifest fields remain strict and still throw on invalid `tier`, host, method, protocol, credential, source role, and execution policy.
- [ ] Run `node --test test/provider-manifest-scheduler.test.js test/provider-manifest-v8.test.js test/provider-contract-manifest.test.js` and confirm the new tests fail for missing scheduler support.
- [ ] Add non-throwing scheduler metadata sanitation to `manifest.js` while leaving all pre-existing validation paths strict.
- [ ] Pass `schedulerByType` and `schedulerMetadataInvalidTypes` through `withProviderMetadata()` in `metadata.js`.
- [ ] Rerun the three test files and confirm green.
- [ ] Commit with message `feat: add provider scheduler metadata contract`.

## Task 3: Populate deterministic IP scheduler descriptors

**Files**
- Modify: `config/providers.json`
- Modify: `test/provider-manifest-scheduler.test.js`
- Modify: `test/workflows.test.js`

**Exact IP descriptor table**

Use the following values for every provider in the current IP workflow. These values are policy, not inferred runtime attributes.

| Provider | authorityClass | semanticUniqueness | intelligenceValue | pivotValue | latencyClass |
| --- | --- | --- | --- | --- | --- |
| `ipinfo` | `first_party` | `complementary` | `contextual` | `medium` | `fast` |
| `rdap` | `authoritative` | `unique` | `contextual` | `medium` | `fast` |
| `ripestat` | `first_party` | `unique` | `contextual` | `high` | `fast` |
| `dshield` | `community` | `complementary` | `supporting` | `low` | `fast` |
| `spamhaus-drop` | `specialist` | `unique` | `direct` | `medium` | `fast` |
| `tor-exit` | `authoritative` | `unique` | `contextual` | `low` | `fast` |
| `feodo-tracker` | `specialist` | `unique` | `direct` | `high` | `fast` |
| `threatminer` | `aggregator` | `complementary` | `supporting` | `high` | `fast` |
| `misp-circl-osint` | `community` | `complementary` | `supporting` | `high` | `normal` |
| `misp-botvrij-osint` | `community` | `duplicative` | `supporting` | `high` | `normal` |
| `tweetfeed` | `community` | `complementary` | `supporting` | `medium` | `fast` |
| `ransomlook` | `contextual` | `unique` | `supporting` | `medium` | `fast` |
| `greynoise` | `specialist` | `unique` | `supporting` | `medium` | `fast` |
| `abuseipdb` | `specialist` | `unique` | `direct` | `medium` | `fast` |
| `shodan` | `specialist` | `complementary` | `contextual` | `high` | `normal` |
| `censys` | `specialist` | `complementary` | `contextual` | `high` | `normal` |
| `modat` | `specialist` | `complementary` | `contextual` | `high` | `normal` |
| `cloudflare-radar` | `first_party` | `complementary` | `contextual` | `medium` | `fast` |
| `virustotal` | `aggregator` | `unique` | `direct` | `high` | `normal` |
| `otx` | `aggregator` | `complementary` | `supporting` | `high` | `normal` |
| `threatfox` | `specialist` | `unique` | `direct` | `high` | `normal` |
| `urlscan` | `specialist` | `complementary` | `supporting` | `high` | `normal` |
| `webamon` | `specialist` | `unique` | `supporting` | `high` | `slow` |
| `pulsedive` | `aggregator` | `complementary` | `supporting` | `high` | `normal` |

- [ ] Add a failing test that iterates `WORKFLOWS.ip` and asserts every configured IP provider has a complete valid `schedulerByType.ip` descriptor and no IP scheduler metadata error.
- [ ] Add a failing test that asserts no descriptor changes `types`, `fixedHosts`, `methods`, `protocols`, or credential requirements.
- [ ] Run `node --test test/provider-manifest-scheduler.test.js test/workflows.test.js` and confirm the descriptor-completeness assertion fails.
- [ ] Add exactly the table above to `config/providers.json`; do not add descriptors for non-IP types in this task.
- [ ] Rerun the tests and confirm green.
- [ ] Commit with message `feat: classify IP provider execution value`.

## Task 4: Make profile selection admission-only and preserve original workflow order

**Files**
- Modify: `src/profiles.js`
- Modify: `test/profiles.test.js`
- Modify: `test/provider-admission-v8.test.js`

**Required behavior**

`selectProviders()` decides only whether an adapter is admitted by profile. For admitted providers, return names in their original workflow order. Value ordering happens later in the scheduler.

- [ ] Add a failing test with deliberately scrambled tiers proving `selectProviders()` returns admitted provider names in workflow order rather than tier order.
- [ ] Keep tests proving `fast` excludes `scarce` and admits tier <= 2 / knowledge-only according to current rules, `standard` excludes `scarce`, and `full` admits all matching providers.
- [ ] Add a regression test proving a scheduler descriptor cannot re-admit a provider excluded by profile.
- [ ] Run `node --test test/profiles.test.js test/provider-admission-v8.test.js` and confirm only the new ordering expectation fails.
- [ ] Remove the tier sort from `selectProviders()` while retaining every current admission predicate.
- [ ] Rerun tests and confirm green.
- [ ] Commit with message `refactor: separate provider admission from scheduling`.

## Task 5: Replace tier barriers with one ranked concurrent queue

**Files**
- Modify: `src/core/scheduler.js`
- Modify: `test/scheduler.test.js`
- Create: `test/scheduler-value-priority.test.js`

**Interface change**

```js
await runScheduledProviders({
  providers,
  type: 'ip',
  concurrency: 4,
  deadlineMs: 20_000,
  ...
});
```

If `type` is omitted, preserve legacy tier/index ordering so generic scheduler callers and old tests remain compatible.

- [ ] Write a failing test proving the first four started providers are the first four entries from `rankProvidersForExecution()` even when their numeric tiers would have ordered them differently.
- [ ] Write a failing test proving completion of one high-priority request releases the next ranked provider immediately; execution must not wait for every provider in the same priority class to finish.
- [ ] Write a test proving peak concurrency never exceeds four.
- [ ] Retain all current retry, Retry-After, deadline exhaustion, circuit breaker, and explicit skip tests from `test/scheduler.test.js` unchanged.
- [ ] Write a test proving every admitted provider is either attempted or receives an explicit scheduler skip; a prior positive result cannot suppress later providers.
- [ ] Run `node --test test/scheduler.test.js test/scheduler-value-priority.test.js` and confirm the value-order tests fail against tier batching.
- [ ] Remove `groupByTier()` barriers for typed value scheduling. Build one ranked work queue once, then feed it to the existing concurrency pool.
- [ ] Preserve call-limit accounting, retry accounting, deadline checks, circuit checks, and result freezing exactly.
- [ ] For calls without a `type`, retain the legacy tier/index queue to avoid unrelated semantic change.
- [ ] Rerun both scheduler test files and confirm green.
- [ ] Commit with message `feat: execute providers by deterministic value queue`.

## Task 6: Wire the observable type through orchestration and preserve call-budget semantics

**Files**
- Modify: `src/core/orchestrator.js`
- Modify: `test/orchestrator.test.js`
- Modify: `test/cost-control.test.js`

- [ ] Add a failing orchestrator test using synthetic adapters whose tier order conflicts with scheduler value order. Assert execution starts in the value order for `type: 'ip'`.
- [ ] Add a regression test proving `callLimit` remains unchanged and at most two calls per admitted provider are possible.
- [ ] Add a regression test proving provider output aggregation remains in the expected provider/workflow surface order even though execution starts in value order; execution priority must not make report ordering nondeterministic.
- [ ] Run `node --test test/orchestrator.test.js test/cost-control.test.js` and confirm the value-order integration test fails.
- [ ] Pass `type` from `enrich()` into `runScheduledProviders()`; do not modify egress, cache, provider runner, or retry semantics.
- [ ] If scheduled results are returned in execution order, continue assembling final evidence/failure output through the existing provider-name/record map so response ordering stays stable.
- [ ] Rerun tests and confirm green.
- [ ] Commit with message `feat: wire value scheduling into enrichment`.

## Task 7: Expose scheduler policy and rationale through capability metadata

**Files**
- Modify: `src/core/capability-registry.js`
- Modify: `src/app.js`
- Modify: `test/capability-registry-v8.test.js`
- Modify: `test/meta-status.test.js`

**Capability shape**

For a provider with a valid IP descriptor expose:

```js
{
  scheduler: {
    version: '1.0',
    byType: {
      ip: {
        authorityClass: 'specialist',
        semanticUniqueness: 'unique',
        intelligenceValue: 'direct',
        pivotValue: 'high',
        latencyClass: 'normal',
        fallback: false
      }
    }
  }
}
```

For an absent/invalid descriptor expose `fallback: true` and `rationale: 'legacy_priority_fallback'` for the affected supported type. Do not expose secrets or credentials.

- [ ] Add failing capability-registry tests for scheduler version, normalized IP descriptor, and fallback status.
- [ ] Add a failing `/meta` test proving public provider metadata includes scheduler policy but still excludes secret values.
- [ ] Add a test proving profile-specific ranks are derived only when a calling surface supplies a workflow/profile; the static capability registry must not pretend runtime rank exists without those inputs.
- [ ] Run `node --test test/capability-registry-v8.test.js test/meta-status.test.js` and confirm failures.
- [ ] Add scheduler metadata to capability registry provider projections and the public `/meta` provider projection.
- [ ] Reuse `PROVIDER_SCHEDULER_POLICY_VERSION`; do not duplicate the version string.
- [ ] Rerun tests and confirm green.
- [ ] Commit with message `feat: expose deterministic scheduler capability metadata`.

## Task 8: Lock Stage 1 scheduler invariants and run repository verification

**Files**
- Modify as needed only for test assertions: `test/workflows.test.js`, `test/execution-policy-v8.test.js`, `test/fuzz-deterministic.test.js`
- No production changes unless a failing invariant demonstrates a scheduler-specific defect.

- [ ] Add/extend deterministic fuzz coverage: randomize the input adapter array while preserving explicit workflow indexes, then assert the final ranking is identical for the same descriptors/indexes.
- [ ] Assert the IP workflow provider set is byte-for-byte unchanged from before this feature.
- [ ] Assert `WORKFLOW_CALL_LIMITS.ip === WORKFLOWS.ip.length * 2`.
- [ ] Assert execution constants remain concurrency 4, attempts 2, deadline 20,000 ms.
- [ ] Run the focused scheduler suite:

```bash
node --test \
  test/provider-priority.test.js \
  test/provider-manifest-scheduler.test.js \
  test/profiles.test.js \
  test/provider-admission-v8.test.js \
  test/scheduler.test.js \
  test/scheduler-value-priority.test.js \
  test/orchestrator.test.js \
  test/cost-control.test.js \
  test/capability-registry-v8.test.js \
  test/meta-status.test.js \
  test/workflows.test.js \
  test/execution-policy-v8.test.js \
  test/fuzz-deterministic.test.js
```

Expected: all pass.

- [ ] Run `npm test`. Expected: full Node suite passes.
- [ ] Run `npm run check`. Expected: shell syntax, ShellCheck, repository verification, public-release audit, and Node tests all pass.
- [ ] Review the diff and confirm no new provider, hostname, protocol, dependency, environment variable, or outbound action was introduced.
- [ ] Commit any test-only invariant additions with message `test: lock deterministic provider scheduler invariants`.

## Completion Gate

Do not start the Intelligence Kernel/IP plan until this scheduler plan is green. Record the scheduler policy version and the exact resulting IP execution order in the implementation PR description so reviewers can verify the policy change independently from analytical changes.
