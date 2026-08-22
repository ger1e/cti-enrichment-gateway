# Decision-Grade Evidence MAX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make gateway enrichment decision-grade by separating threat assessment, evidence quality, infrastructure context, coverage, limitations, and provider outcomes while preserving every existing endpoint and provider boundary.

**Architecture:** Extend the current `correlate.js`, `orchestrator.js`, and `telemetry.js` flows instead of adding parallel subsystems. Correlation owns semantic interpretation; orchestration owns execution coverage; telemetry owns count-only operational aggregates. Existing scheduler, provider runner, normalization, cache, circuit breaker, manifest, auth, and Vercel secret handling remain authoritative.

**Tech Stack:** Node.js 24, ES modules, `node:test`, Vercel Functions, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-22-decision-grade-evidence-max-design.md`

## Global Constraints
- Preserve `/api/enrich`, `/api/batch`, `/api/stix`, `/api/meta`, `/api/health`, and `/api/status` paths and methods.
- Changes are additive only; preserve existing response fields.
- No new providers, frameworks, databases, queues, cache services, ML/LLM verdicting, client-side secrets, or public endpoint paths.
- Keep provider concurrency <= 4 and request deadline <= 20 seconds.
- Infrastructure/passive-DNS/routing/registration/exposure facts must never become reputation votes.
- Default telemetry retains counts only and no indicator, URL, header, secret, raw response, or exception text.
- Deterministic sorting and existing output caps remain mandatory.

---

### Task 1: Decision-grade correlation semantics

**Files:**
- Modify: `src/core/correlate.js`
- Test: `test/correlation.test.js`

**Interfaces:**
- Consumes normalized evidence `{provider, observation, retrievedAt, relationships}` and deduplicated relationships.
- Produces existing correlation fields plus `threatAssessment`, tightened `infrastructureContext`, observation/retrieval freshness, and deterministic `limitations` that can be derived from evidence alone.

- [ ] Add failing tests for: two independent positive reputation providers -> `supported`; one positive -> `insufficient`; positive + negative -> `contradicted`; negative only -> `negative`; ATT&CK-only -> `not_applicable`; infrastructure-only -> never `supported`.
- [ ] Add failing tests proving duplicate records from one provider do not count as independent threat corroboration.
- [ ] Add failing freshness tests proving `lastSeen` then `firstSeen` drive `observationClass`, while `retrievedAt` drives only `retrievalClass`; missing observation timestamps remain `unknown` even after fresh retrieval.
- [ ] Add failing infrastructure tests proving only `asn`, `hostname`, `domain`, `ip`, `cidr`, `netblock`, `registration`, `nameserver`, `mx`, and `certificate` may enter `corroboratedFacts`.
- [ ] Run `node --test test/correlation.test.js` and confirm RED for the new fields/semantics.
- [ ] Implement `threatAssessment` with states `supported|contradicted|negative|insufficient|not_applicable`, bounded/sorted `assessmentBasis`, and no global score.
- [ ] Replace retrieval-fallback observation freshness with explicit `observationClass` and `retrievalClass`; keep `freshness.overall` observation-oriented.
- [ ] Restrict infrastructure relationship corroboration to the approved allowlist and at least two distinct providers.
- [ ] Emit evidence-derived limitations deterministically: `single_source_threat_support`, `contradictory_threat_evidence`, `stale_evidence_only`, `unknown_observation_time`, `infrastructure_only_evidence`.
- [ ] Run `node --test test/correlation.test.js` and confirm GREEN.
- [ ] Commit `feat(correlation): add decision-grade threat semantics`.

### Task 2: Operational coverage and coverage limitations

**Files:**
- Modify: `src/core/orchestrator.js`
- Test: `test/orchestrator.test.js`
- Test: `test/meta-status.test.js` only if additive response assertions belong there.

**Interfaces:**
- Consumes resolved `providerNames`, provider records/results, registry metadata, correlation output.
- Produces top-level `coverage = {selected, executed, succeeded, failed, skipped, materialLoss}` and merges operational limitations into the final correlation/output limitations without changing provider result semantics.

- [ ] Add failing orchestrator tests for exact coverage counts across cache hit, executed success, explicit failure, unsupported/skipped, circuit/deadline skip.
- [ ] Add failing test for `materialLoss` when `(failed + skipped) / selected > 0.25`.
- [ ] Add failing test for semantic-class material loss where all selected providers for an available workflow semantic class fail/skip.
- [ ] Add failing tests that partial failure emits `partial_provider_failure` and material loss emits `material_coverage_loss`, with deduplicated/sorted limitations capped at 16.
- [ ] Run targeted orchestrator tests and confirm RED.
- [ ] Implement a small deterministic coverage builder in `orchestrator.js`; cached successful results count as succeeded but not executed, while actual provider invocations count as executed.
- [ ] Derive semantic-class availability from selected provider manifest observation types/registered metadata; do not infer coverage from provider brand names.
- [ ] Merge coverage limitations with correlation limitations as additive bounded strings without altering `status`, `failures`, `providerSummary`, or `providerHealth` contracts.
- [ ] Run targeted orchestrator tests and confirm GREEN.
- [ ] Commit `feat(orchestrator): expose execution coverage and limitations`.

### Task 3: Count-only provider outcome telemetry

**Files:**
- Modify: `src/core/telemetry.js`
- Modify only where necessary: `src/core/orchestrator.js` and/or `src/core/provider-runner.js` to emit normalized provider outcome events already allowed by telemetry sanitization.
- Test: `test/telemetry.test.js`
- Test: `test/meta-status.test.js`

**Interfaces:**
- Consumes sanitized telemetry events with `provider` and normalized outcome `status`.
- Produces existing stats plus `providerOutcomes[provider] = {success,failure,timeout,rate_limited,skipped}`.

- [ ] Add failing telemetry test emitting representative provider outcomes and asserting exact deterministic aggregate counts.
- [ ] Add failing adversarial test with indicator/secret-shaped arbitrary input proving stats cannot retain them.
- [ ] Add failing `/api/status` test proving authenticated status exposes only aggregate provider outcome counts and unauthenticated status remains 401.
- [ ] Run telemetry/status tests and confirm RED.
- [ ] Implement bounded provider outcome maps only for the five approved statuses; ignore unknown statuses for this aggregate while preserving existing `byStatus` behavior.
- [ ] Ensure provider execution paths emit normalized countable outcomes without adding raw error text or provider payload data.
- [ ] Run telemetry/status tests and confirm GREEN.
- [ ] Commit `feat(telemetry): add secret-free provider outcome aggregates`.

### Task 4: Adversarial compatibility and release verification

**Files:**
- Test: `test/modat-provider.test.js`
- Test: `test/correlation.test.js`
- Test: `test/orchestrator.test.js`
- Test: `test/telemetry.test.js`
- Test: `test/meta-status.test.js`
- Verify: existing scheduler, manifest, STIX, auth, secret-invariant, batch, API, and Maltego suites.

**Interfaces:**
- Consumes final implementation from Tasks 1-3.
- Produces proof that new semantics are additive, bounded, deterministic, and secret-safe.

- [ ] Add/verify scenario: Modat + Shodan + Censys infrastructure agreement and no threat source => `threatAssessment.state !== 'supported'` and `infrastructure_only_evidence` exists.
- [ ] Add/verify scenario: VirusTotal malicious + ThreatFox malicious => `supported` with two providers in `assessmentBasis`.
- [ ] Add/verify stale-only, unknown-observation-time, partial outage, semantic-class coverage loss, duplicate provider evidence, arbitrary relationship type, and telemetry secret-retention cases.
- [ ] Run `npm run check` and require all Node tests, repository invariants, public-release audit, and shell checks to pass.
- [ ] Verify no provider ordering, concurrency, deadline, endpoint, secret, or manifest drift unless intentionally required by this plan.
- [ ] Commit any test-only compatibility adjustments as `test: lock decision-grade evidence invariants`.

### Task 5: PR, merge, and production gate

**Files:** none unless CI exposes a concrete defect.

**Interfaces:**
- Consumes the verified feature branch.
- Produces merged `main` and verified Vercel production release.

- [ ] Open PR from `feat/decision-grade-evidence-max` to `main` summarizing semantic boundaries, coverage model, telemetry privacy, and verification.
- [ ] Require Tooling smoke success across core validation, Linux, macOS, and Windows plus Vercel preview success.
- [ ] Review final diff for secret leakage, unbounded collections, arbitrary scoring, provider-order drift, endpoint breakage, or accidental client-side credentials.
- [ ] Squash merge only the exact verified head SHA.
- [ ] Require fresh `main` Tooling smoke success after merge.
- [ ] Verify Vercel production is `READY` from the exact merge SHA.
- [ ] Verify live `/api/meta` returns 200 with no secret/config state and unauthenticated `/api/status` returns 401.
- [ ] Verify production runtime error clusters are zero; investigate any cluster before completion is claimed.
