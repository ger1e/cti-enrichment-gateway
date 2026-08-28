# MAX Intelligence Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add evidence-quality scoring, infrastructure-context correlation, and richer sanitized provider telemetry without changing public gateway endpoints or adding infrastructure dependencies.

**Architecture:** Extend the existing correlation and telemetry modules rather than creating parallel subsystems. Existing scheduler, provider runner, normalization, caching, circuit breaking and Vercel secret handling remain authoritative.

**Tech Stack:** Node.js 24, ES modules, node:test, Vercel Functions, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-22-max-intelligence-enrichment.md`

## Global Constraints
- Preserve existing endpoint contracts and deterministic bounded output.
- No new framework, database, queue, cache service or client-side vendor credentials.
- Infrastructure context must never be counted as a malicious/reputation vote.
- Default telemetry must not include indicators or secrets.
- Keep scheduler concurrency <= 4 and request deadline 20 seconds.

---

### Task 1: Evidence quality and infrastructure correlation

**Files:**
- Modify: `src/core/correlate.js`
- Test: `test/correlation.test.js`

**Interfaces:**
- Consumes: normalized evidence `{ provider, observation, relationships, retrievedAt }`.
- Produces: existing correlation object plus `evidenceQuality` and, for network indicators, `infrastructureContext`.

- [ ] Write failing tests asserting evidence quality is independent from threat polarity and infrastructure observations never create reputation corroboration.
- [ ] Run `node --test test/correlation.test.js` and confirm RED.
- [ ] Implement deterministic quality levels from evidence count, provider diversity, freshness and contradictions; implement shared infrastructure-target corroboration with bounded sorted output.
- [ ] Run `node --test test/correlation.test.js` and confirm GREEN.
- [ ] Commit `feat(correlation): add evidence quality and infrastructure context`.

### Task 2: Provider telemetry aggregates

**Files:**
- Modify: `src/core/telemetry.js`
- Test: `test/telemetry.test.js`

**Interfaces:**
- Consumes: existing sanitized telemetry events.
- Produces: existing stats plus sorted `byProvider` and `byStatus` aggregate counts.

- [ ] Write failing tests for provider/status aggregation and secret/indicator exclusion.
- [ ] Run `node --test test/telemetry.test.js` and confirm RED.
- [ ] Implement bounded aggregate maps without changing emitted event payloads.
- [ ] Run `node --test test/telemetry.test.js` and confirm GREEN.
- [ ] Commit `feat(telemetry): add provider health aggregates`.

### Task 3: Regression and contract verification

**Files:**
- Test: `test/modat-provider.test.js`
- Test: `test/meta-status.test.js`
- Test: `test/final-hardening.test.js`
- Verify only unless a concrete regression requires a minimal fix.

**Interfaces:**
- Consumes: Tasks 1–2 outputs.
- Produces: proof that status remains authenticated/sanitized and Modat stays neutral/fail-closed.

- [ ] Run targeted tests: `node --test test/correlation.test.js test/telemetry.test.js test/modat-provider.test.js test/meta-status.test.js`.
- [ ] Run complete Node suite with the repository's existing test command or `node --test`.
- [ ] Run release-manifest check and existing tooling smoke workflow through GitHub Actions.
- [ ] Review diff for secrets, unbounded collections, API-shape breaks and unintended provider-order changes.

### Task 4: PR, merge and production verification

**Files:** none unless CI reveals a concrete defect.

**Interfaces:**
- Consumes: green branch from Tasks 1–3.
- Produces: merged `main` and verified Vercel production deployment.

- [ ] Open PR from `feat/max-intelligence-enrichment` to `main` with design/test summary.
- [ ] Require green CI and review final diff.
- [ ] Merge using the repository's existing safe merge path.
- [ ] Verify Vercel production deployment is `READY`, sourced from merged `main`, and has no new runtime error clusters.
- [ ] Verify public `/api/para11ax/meta` remains non-secret and authenticated health/status boundaries remain unchanged.