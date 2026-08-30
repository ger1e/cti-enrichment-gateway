# Intelligence Kernel IP Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Intelligence Kernel v1.0 as a pure deterministic projection over normalized Evidence v2, explicit relationships, correlation, and coverage; integrate it first for IP enrichment so Decision Support, Guidance, and the existing IP analyst report derive stronger, source-traceable conclusions from the same evidence without changing raw evidence or adding external data.

**Architecture:** Add `src/core/intelligence-kernel.js` plus a focused `src/core/intelligence-policy/ip.js`. The kernel is invoked by `src/core/orchestrator.js` after correlation/coverage and before Decision Support. Decision Support consumes kernel output when valid and retains its existing fallback path otherwise. Guidance may project a bounded kernel summary but continues validating all evidence references against Evidence Graph. The WebUI reuses the existing IP report sections and renders kernel-backed facts rather than creating a new parallel report system.

**Tech Stack:** Node.js 24, ECMAScript modules, `node:test`, existing Evidence v2 normalization, correlation, Decision Support v1.0, Guidance v1.0, Evidence Graph, browser-side view model/renderers.

**Spec:** `docs/superpowers/specs/2026-08-30-unified-intelligence-kernel-design.md`

## Global Constraints

- Complete the deterministic provider value scheduler plan first; this plan assumes the provider set and execution boundary are already stable.
- No network access, provider imports, environment reads, persistence, active pivots, runtime learning, or LLM calls in the kernel or IP policy.
- Do not mutate normalized Evidence v2, correlation, relationships, coverage, or caller inputs.
- The only clock input is injected `now`; identical inputs plus identical policy versions must produce identical output.
- Every material derived conclusion must cite evidence fingerprints, explicit relationship provenance/IDs, or deterministic rule IDs.
- Provider failures, skips, credential absence, circuit state, and deadline state are coverage facts only; they must never become negative reputation evidence.
- Missing observation time remains `unknown`; `retrievedAt` must never be promoted into `firstSeen`/`lastSeen`.
- Contradictions remain visible and must not be silently resolved.
- Raw Evidence v2 remains authoritative. Kernel output is derived context and must never be inserted into the evidence array.
- Preserve existing correlation, decision, guidance, evidence graph, raw export, and cached/legacy envelope compatibility.
- Follow strict TDD for every behavior change: failing test first, confirm expected failure, minimum implementation, rerun, commit.

---

## Task 1: Define the IP intelligence policy as data and pure classifiers

**Files**
- Create: `src/core/intelligence-policy/ip.js`
- Create: `test/intelligence-policy-ip.test.js`

**Interfaces**

```js
export const IP_INTELLIGENCE_POLICY_VERSION = '1.0';
export const IP_INTELLIGENCE_POLICY = Object.freeze({ type: 'ip', version: '1.0', ... });

export function ipEvidenceCategory(kind) {
  // -> direct_threat | supporting_threat | scanner_noise | tor_proxy |
  //    infrastructure | exposure | other
}

export function ipRelationshipClass(relationship) {
  // -> direct | supporting | contextual | low_value
}

export function ipPivotPriority(relationship) {
  // -> high | medium | low | none
}
```

**Exact evidence-kind policy**

```js
const DIRECT_THREAT_KINDS = new Set([
  'reputation',
  'ioc_reputation',
  'abuse_reports',
  'drop_netblock',
  'botnet_c2',
  'malware_association',
  'misp_feed_hit'
]);

const SUPPORTING_THREAT_KINDS = new Set([
  'threat_context',
  'community_ioc_report',
  'web_intelligence',
  'ransomware_post_reference'
]);

const SCANNER_NOISE_KINDS = new Set(['scanner_activity', 'internet_noise']);
const TOR_PROXY_KINDS = new Set(['tor_exit']);
const INFRASTRUCTURE_KINDS = new Set(['network_identity', 'registration', 'routing', 'passive_dns']);
const EXPOSURE_KINDS = new Set(['internet_exposure', 'web_scan_history']);
```

Relationship classification:

- `direct`: explicit relationship from the IP subject to another IP/domain/URL/hash with a threat-bearing relation such as `c2`, `malware`, `resolves_to`, `communicates_with`, or provider-normalized equivalent already present in `rel.type`.
- `supporting`: explicit hostname/domain/certificate/passive-DNS relationship useful for a concrete pivot.
- `contextual`: ASN/CIDR/netblock/registration/nameserver/MX/ownership context.
- `low_value`: any explicit relationship that is valid but not in the preceding classes.
- Never infer a relationship from string shape except to normalize an already-explicit `targetType` when the existing relationship contract requires it.

Pivot eligibility is limited to explicit targets whose resolved type is one of `ip`, `domain`, `url`, `hash`, `cve`. No pivot is executed by the kernel.

- [ ] Write tests covering every evidence-kind category above and an unknown kind returning `other`.
- [ ] Write tests covering direct/supporting/contextual/low-value relationship classes with explicit relationship fixtures.
- [ ] Write tests proving a bare string in an observation attribute does not become a relationship or pivot.
- [ ] Run `node --test test/intelligence-policy-ip.test.js` and confirm failure because the module is absent.
- [ ] Implement only constants and pure classification helpers. Freeze all exported policy structures.
- [ ] Rerun and confirm green.
- [ ] Commit with message `feat: define IP intelligence policy`.

## Task 2: Define Intelligence Kernel v1.0 output, provenance helpers, and immutability

**Files**
- Create: `src/core/intelligence-kernel.js`
- Create: `test/intelligence-kernel-ip.test.js`

**Public interface**

```js
export const INTELLIGENCE_KERNEL_SCHEMA_VERSION = '1.0';

export function buildIntelligenceKernel({
  indicator,
  type,
  evidence = [],
  relationships = [],
  correlation = {},
  coverage = {},
  now,
  policy
} = {}) {
  // -> deeply frozen kernel projection
}
```

**Required output shape**

```js
{
  schemaVersion: '1.0',
  policy: { type: 'ip', version: '1.0' },
  indicator,
  type: 'ip',
  evidenceStrength: {
    level: 'none|weak|moderate|strong',
    reasons: ['rule-id'],
    providers: [],
    evidenceFingerprints: []
  },
  sourceDiversity: {
    providerCount: 0,
    providers: [],
    sourceRoles: [],
    semanticClasses: [],
    evidenceCategories: [],
    capabilityGroups: []
  },
  corroboration: [],
  contradiction: { level: 'none|low|medium|high', items: [] },
  temporalRelevance: {
    firstSeen: null,
    lastSeen: null,
    ageDays: null,
    activeSpanDays: null,
    overall: 'current|aging|stale|unknown',
    distribution: { current: 0, aging: 0, stale: 0, unknown: 0 }
  },
  relationshipValue: [],
  pivotCandidates: [],
  threatContext: {
    state: 'supported|single_source|contradicted|negative|context_only|insufficient',
    direct: [],
    supporting: [],
    scannerNoise: [],
    torProxy: [],
    infrastructure: [],
    exposure: []
  },
  huntRelevance: {
    level: 'high|medium|low|none',
    directSearch: false,
    telemetry: [],
    pivotCount: 0,
    evidenceFingerprints: [],
    ruleIds: []
  },
  coverageImpact: {
    level: 'material|degraded|none',
    uniqueCapabilityLoss: [],
    duplicateCoverageLoss: [],
    reasons: []
  },
  analystPriority: {
    level: 'immediate|investigate|monitor|contextual|insufficient',
    reasons: [],
    evidenceFingerprints: []
  },
  limitations: [],
  trace: { ruleIds: [] }
}
```

- [ ] Write a minimal empty-evidence test asserting `evidenceStrength.level === 'none'`, `analystPriority.level === 'insufficient'`, empty provenance, and a deeply frozen return value.
- [ ] Write a mutation test: deep-clone evidence/relationships/correlation/coverage before invocation and assert byte-equivalent equality after invocation.
- [ ] Write a determinism test invoking the kernel twice with the same injected `now` and asserting `deepStrictEqual` outputs.
- [ ] Write a provenance test rejecting/ignoring malformed evidence fingerprints rather than emitting invented fingerprints.
- [ ] Run `node --test test/intelligence-kernel-ip.test.js` and confirm failure because the kernel does not exist.
- [ ] Implement schema validation, safe fingerprint extraction, stable unique/sort helpers, deep freeze, and the empty/default projection only.
- [ ] Keep `now` required for time-dependent calculations; if absent, temporal state must remain `unknown` rather than reading `Date.now()` inside the kernel.
- [ ] Rerun and confirm the initial tests pass.
- [ ] Commit with message `feat: add immutable intelligence kernel contract`.

## Task 3: Implement source diversity, corroboration, contradiction, and temporal relevance

**Files**
- Modify: `src/core/intelligence-kernel.js`
- Modify: `test/intelligence-kernel-ip.test.js`

**Rules**

Source diversity uses normalized Evidence v2 fields already present on each item:

```js
item.provider
item.semantics.sourceRole
item.semantics.semanticClass
item.observation.kind
item.integrity.fingerprint
```

Corroboration groups only decisive semantic findings. For each group emit semantic class/category, polarity, providers, source roles, evidence fingerprints, and:

```js
independence: 'independent' | 'same_capability'
```

Use `independent` when corroboration spans more than one source role or more than one evidence kind/capability within the same semantic claim; use `same_capability` when multiple providers supply the same kind from the same source role. Provider count alone is not evidence-strength equivalence.

Contradiction severity:

- `high`: positive and negative decisive evidence in a direct-threat category from different providers.
- `medium`: positive and negative decisive evidence in a supporting-threat category.
- `low`: contradiction exists only in contextual/non-threat categories.
- `none`: no contradiction.

Temporal classes use observation time only:

- `current`: age <= 7 days.
- `aging`: age > 7 and <= 30 days.
- `stale`: age > 30 days.
- `unknown`: no valid observation timestamp.

`retrievedAt` may be retained as provenance elsewhere but must not determine observation recency.

- [ ] Add failing tests for diverse independent corroboration versus same-capability duplicate corroboration.
- [ ] Add failing tests for high, medium, low, and no contradiction.
- [ ] Add failing tests for current, aging, stale, mixed, and unknown observation timestamps using a fixed `now`.
- [ ] Add a test with only `retrievedAt` asserting temporal observation state stays `unknown`.
- [ ] Run `node --test test/intelligence-kernel-ip.test.js` and confirm the new assertions fail.
- [ ] Implement source-diversity projection, corroboration projection, contradiction severity, and temporal projection using existing `semanticClass()` / `polarity()` helpers where appropriate.
- [ ] Sort all emitted provider/fingerprint/category arrays deterministically.
- [ ] Rerun and confirm green.
- [ ] Commit with message `feat: derive evidence diversity and temporal context`.

## Task 4: Extend generic coverage detail so the kernel can distinguish unique versus duplicate capability loss

**Files**
- Modify: `src/core/orchestrator.js`
- Modify: `test/orchestrator.test.js`
- Modify: `test/intelligence-kernel-ip.test.js`

**Additive coverage fields**

Preserve all existing coverage fields and add:

```js
coverage.providerCapabilities = [
  {
    provider: 'threatfox',
    state: 'ok|failed|skipped|cached',
    observationTypes: ['ioc_reputation'],
    semanticClassHints: ['reputation'],
    sourceRole: 'first_party'
  }
];
```

The kernel derives capability loss from those records:

- `uniqueCapabilityLoss`: an expected observation type has no successful/cached provider remaining.
- `duplicateCoverageLoss`: one or more providers for an observation type failed/skipped but at least one successful/cached provider still covers that observation type.
- `coverageImpact.level = 'material'` when at least one direct-threat or supporting-threat observation capability is uniquely lost.
- `coverageImpact.level = 'degraded'` when only duplicate or contextual/exposure/scanner capability is lost.
- `coverageImpact.level = 'none'` when no admitted capability is lost.

This kernel projection does not replace existing `coverage.materialLoss` in v1.0; both remain available for compatibility.

- [ ] Add a failing orchestrator test asserting `providerCapabilities` contains the admitted provider's declared observation types, semantic hints, source role, and final state.
- [ ] Add failing kernel tests for unique direct-threat loss, duplicate reputation loss, contextual-only loss, and no loss.
- [ ] Add a test proving a timed-out provider does not create `threatContext.negative` or any negative verdict.
- [ ] Run `node --test test/orchestrator.test.js test/intelligence-kernel-ip.test.js` and confirm failures.
- [ ] Extend `buildCoverage()` using adapter metadata from the existing registry. Keep the existing summary/material-loss fields unchanged.
- [ ] Implement the kernel coverage projection from `coverage.providerCapabilities` and the IP policy categories.
- [ ] Rerun and confirm green.
- [ ] Commit with message `feat: expose capability-aware coverage impact`.

## Task 5: Derive explicit relationship value and bounded pivots

**Files**
- Modify: `src/core/intelligence-kernel.js`
- Modify: `test/intelligence-kernel-ip.test.js`

**Relationship ID**

Derive a stable ID only from an already-explicit relationship:

```js
const relationshipId = sha256(JSON.stringify({
  type: rel.type ?? 'related_to',
  source: rel.source ?? indicator,
  target: rel.target ?? rel.value,
  targetType: rel.targetType ?? null,
  provider: rel.provider ?? null
}));
```

This ID identifies the explicit relation; it is not new evidence.

Each `relationshipValue` item must include:

```js
{
  id,
  class: 'direct|supporting|contextual|low_value',
  type,
  source,
  target,
  targetType,
  provider,
  evidenceFingerprints,
  ruleId
}
```

Each pivot candidate must include:

```js
{
  targetType,
  target,
  relationshipId,
  provider,
  priority: 'high|medium|low',
  evidenceFingerprints,
  ruleId
}
```

Bound to at most 32 relationship-value items and 16 pivot candidates in v1.0, sorted by priority/class then type/value/provider for deterministic output.

- [ ] Add failing tests for explicit IP/domain/hash pivots, contextual ASN/CIDR relationships, deduplication, stable IDs, and bounds.
- [ ] Add a failing test proving an observation attribute that looks like a domain/IP does not become a pivot without an explicit relationship.
- [ ] Add a test proving malformed relationships are ignored rather than causing fabricated targets.
- [ ] Run `node --test test/intelligence-kernel-ip.test.js` and confirm failures.
- [ ] Implement stable relationship IDs, policy classification, provider-linked evidence fingerprint lookup, deterministic dedupe/sort, and bounded pivots.
- [ ] Rerun and confirm green.
- [ ] Commit with message `feat: derive explicit infrastructure pivots`.

## Task 6: Derive threat context, evidence strength, hunt relevance, analyst priority, and limitations

**Files**
- Modify: `src/core/intelligence-kernel.js`
- Modify: `test/intelligence-kernel-ip.test.js`
- Modify: `test/decision-grade-semantics-regression.test.js`

**Threat-context state**

Use decisive polarity from existing semantics; never invent a malicious verdict.

- `supported`: positive direct-threat evidence from >= 2 providers and no high contradiction.
- `single_source`: positive direct-threat evidence from exactly 1 provider and no negative direct-threat evidence.
- `contradicted`: positive and negative direct-threat evidence coexist.
- `negative`: explicit negative direct-threat evidence exists and no positive direct-threat evidence exists.
- `context_only`: evidence exists, but no decisive direct-threat evidence exists.
- `insufficient`: no evidence.

**Evidence strength rules**

Evaluate in this order and emit the matching rule ID:

1. `strong` / `ip_strength_strong_independent_direct`: threat state `supported`, at least two providers, at least two capability groups or source roles, temporal state not `stale`, no high contradiction, and no material direct-threat coverage loss.
2. `moderate` / `ip_strength_moderate_direct`: threat state is `supported` or `single_source`, or fresh/aging direct C2/malware evidence exists, unless high contradiction forces `weak`.
3. `weak` / `ip_strength_weak_context_or_conflict`: evidence exists but is context-only, stale-only, or materially contradicted/degraded.
4. `none` / `ip_strength_none`: no evidence.

**Hunt relevance rules**

For IP:

- `high`: decisive positive direct-threat evidence and direct network search is available.
- `medium`: supporting threat evidence, meaningful explicit pivots, or current scanner/noise evidence is available.
- `low`: infrastructure/exposure/TOR context only.
- `none`: no evidence.

Use telemetry `['DeviceNetworkEvents', 'CommonSecurityLog']`, set `directSearch: true` for any non-empty IP evidence projection, and retain `environmentValidated: false` in the rule trace/notes. Do not claim tables exist in the user's environment.

**Analyst-priority rules**

Evaluate in this order:

1. `immediate` / `ip_priority_immediate`: `evidenceStrength === 'strong'`, hunt relevance `high`, temporal state `current` or `aging`, and contradiction is not `high`.
2. `investigate` / `ip_priority_investigate`: evidence strength `moderate` or `strong`, high contradiction, or fresh direct C2/malware evidence.
3. `monitor` / `ip_priority_monitor`: explicit negative direct-threat state with no positive evidence, or current scanner/noise-only state.
4. `contextual` / `ip_priority_contextual`: evidence exists but consists only of infrastructure/exposure/TOR/other context.
5. `insufficient` / `ip_priority_insufficient`: no evidence.

**Normalized limitations**

Emit these exact identifiers when applicable:

- `single_source_threat_support`
- `contradictory_threat_evidence`
- `stale_evidence_only`
- `unknown_observation_time`
- `infrastructure_only_evidence`
- `material_coverage_loss`

- [ ] Add a failing Case A fixture: two independent positive reputation/direct sources + fresh Feodo/C2-like evidence + huntability. Assert `strong` and `immediate`.
- [ ] Add a failing Case B fixture: multiple infrastructure providers + exposed ports + scanner activity only. Assert it does not exceed `weak` and priority is `monitor` for current scanner-only evidence or `contextual` when scanner evidence is absent.
- [ ] Add failing tests for single-source direct support, explicit negative reputation, contradiction, stale-only, infrastructure-only, and material coverage loss.
- [ ] Add a test proving `analystPriority` reasons are rule IDs and every material priority carries evidence fingerprints when evidence-backed.
- [ ] Run `node --test test/intelligence-kernel-ip.test.js test/decision-grade-semantics-regression.test.js` and confirm failures.
- [ ] Implement threat context, evidence strength, hunt relevance, analyst priority, limitations, and `trace.ruleIds` exactly as above.
- [ ] Rerun and confirm green.
- [ ] Commit with message `feat: derive IP analyst priority from evidence`.

## Task 7: Integrate the kernel into orchestration with fail-safe fallback

**Files**
- Modify: `src/core/orchestrator.js`
- Modify: `test/orchestrator.test.js`
- Create: `test/intelligence-kernel-failure-isolation.test.js`

**Integration point**

Target sequence:

```js
const rawCorrelation = correlateEvidence(...);
const coverage = buildCoverage(...);
const limitations = mergeLimitations(...);

let intelligence = null;
try {
  if (type === 'ip') {
    intelligence = projectIntelligence({
      indicator,
      type,
      evidence,
      relationships,
      correlation: rawCorrelation,
      coverage,
      now,
      policy: IP_INTELLIGENCE_POLICY
    });
  }
} catch {
  limitations.push('intelligence_projection_unavailable');
}

const decision = buildDecisionSupport({ ..., intelligence });
```

Add an injectable function to `enrich()` for testing:

```js
projectIntelligence = buildIntelligenceKernel
```

Do not expose internal exception messages in the public response.

- [ ] Add a failing happy-path test asserting an IP envelope contains `intelligence.schemaVersion === '1.0'` and that the object is separate from `evidence`.
- [ ] Add a failing failure-isolation test injecting `projectIntelligence: () => { throw new Error('boom') }`. Assert provider evidence remains successful/partial as before, `decision` still exists through fallback logic, and limitations contain exactly `intelligence_projection_unavailable`.
- [ ] Add a test proving non-IP types do not invoke the IP policy in Stage 1 and continue existing behavior unchanged.
- [ ] Add a test proving the failure message `boom` is not reflected in the public response.
- [ ] Run `node --test test/orchestrator.test.js test/intelligence-kernel-failure-isolation.test.js` and confirm failures.
- [ ] Wire the pure kernel and IP policy into the orchestration point, with the injectable projection function and narrow `try/catch` around derivation only.
- [ ] Deduplicate/sort limitations after adding the exact failure identifier.
- [ ] Rerun and confirm green.
- [ ] Commit with message `feat: project IP intelligence during enrichment`.

## Task 8: Make Decision Support prefer valid kernel semantics while preserving the old path

**Files**
- Modify: `src/core/decision-engine.js`
- Modify: `test/decision-engine.test.js`
- Modify: `test/decision-engine-integration.test.js`

**Interface**

```js
buildDecisionSupport({
  indicator,
  type,
  evidence,
  relationships,
  correlation,
  coverage,
  limitations,
  intelligence = null,
  now
})
```

**Kernel-to-decision mapping**

When `intelligence.schemaVersion === '1.0'` and `intelligence.type === type`:

```js
const DISPOSITION = {
  immediate: 'hunt_now',
  investigate: 'investigate',
  monitor: 'monitor',
  contextual: 'context_only',
  insufficient: 'insufficient'
};

const CONFIDENCE = {
  strong: 'high',
  moderate: 'medium',
  weak: 'low',
  none: 'low'
};
```

Use kernel priority/strength as the primary disposition/confidence basis, but keep existing telemetry templates, ATT&CK mappings, entity graph, and hunt-plan assembly. Decision reasons include kernel priority/strength rule IDs plus normalized limitations. Add:

```js
assessment.intelligenceVersion = '1.0';
assessment.intelligencePolicyVersion = '1.0';
```

When kernel output is absent, malformed, wrong-type, or wrong-version, execute the existing Decision Support logic byte-for-byte as the compatibility path.

- [ ] Add failing tests for each analyst-priority -> disposition mapping and strength -> confidence mapping.
- [ ] Add a failing test proving ATT&CK mappings, entity graph, telemetry, and hunt plan still come from current deterministic Decision Support machinery.
- [ ] Add compatibility fixtures calling `buildDecisionSupport()` without intelligence and assert current expected decisions are unchanged.
- [ ] Add wrong-version/wrong-type tests asserting fallback rather than failure.
- [ ] Run `node --test test/decision-engine.test.js test/decision-engine-integration.test.js` and confirm only kernel-aware assertions fail.
- [ ] Implement the guarded kernel-aware branch with a small predicate such as `isCompatibleIntelligence(intelligence, type)`; leave legacy helpers in place.
- [ ] Rerun and confirm green.
- [ ] Commit with message `feat: make decision support kernel aware`.

## Task 9: Project kernel semantics through Guidance without weakening evidence-reference validation

**Files**
- Modify: `src/core/guidance.js`
- Modify: `src/core/orchestrator.js`
- Modify: `test/guidance-v8.test.js`
- Modify: `test/guidance-graph-integration-v8.test.js`

**Guidance interface**

```js
buildGuidance({
  decision,
  correlation,
  semanticDiff = null,
  evidenceGraph,
  intelligence = null
})
```

Add a bounded derived summary only when compatible intelligence exists:

```js
intelligence: {
  schemaVersion: '1.0',
  evidenceStrength: 'strong',
  analystPriority: 'immediate',
  threatState: 'supported',
  coverageImpact: 'none',
  limitations: [],
  ruleIds: []
}
```

Do not copy raw observations or relationships into Guidance. Keep current `decisionReferences()` and graph-fingerprint validation authoritative for hunt/ATT&CK evidence references.

- [ ] Add a failing test proving the bounded intelligence summary is deep-frozen and contains only derived fields/rule IDs.
- [ ] Add a regression test proving a decision hunt/ATT&CK fingerprint absent from Evidence Graph still throws `guidance_evidence_reference_invalid`, even when intelligence is present.
- [ ] Add a compatibility test proving no-intelligence guidance remains unchanged except for the absence of the optional field.
- [ ] Run `node --test test/guidance-v8.test.js test/guidance-graph-integration-v8.test.js` and confirm the new summary test fails.
- [ ] Implement optional intelligence projection and pass `intelligence` from orchestrator into `buildGuidance()`.
- [ ] Rerun and confirm green.
- [ ] Commit with message `feat: expose kernel context in analyst guidance`.

## Task 10: Upgrade the existing IP analyst report and copy/export view to consume kernel-backed context

**Files**
- Modify: `app/view-model.js`
- Modify only if needed for existing components: `app/renderers.js`
- Modify only if needed for layout regressions: `app/analyst-facts.css`
- Modify: `test/ip-report-depth-ux.test.mjs`
- Modify: `test/ip-report-max.test.mjs`
- Modify: `test/ip-report-fact-quality.test.mjs`

**Rendering rule**

Do not create a second IP report. Feed kernel context into the existing sections:

- `EXECUTIVE ASSESSMENT`: analyst priority, evidence strength, threat state, direct/supporting basis, key limitations, kernel/policy version.
- `RELATED INFRASTRUCTURE`: ranked `relationshipValue` and `pivotCandidates`, with provider/evidence provenance.
- `CORROBORATION / CONTRADICTIONS`: independence class, contradiction severity, supporting providers/fingerprints.
- `TEMPORAL CONTEXT`: kernel temporal relevance and unknown-time count.
- `ANALYST NEXT ACTIONS`: current Decision Support hunt plan, annotated with kernel hunt relevance/priority basis; do not generate new KQL in the browser.
- `HUNTABILITY`: kernel hunt-relevance level plus existing telemetry readiness/environment-validation state.
- `COVERAGE / LIMITATIONS`: unique capability loss versus duplicate coverage loss plus normalized limitations.

Provider detail cards and raw Evidence v2 remain separate and unchanged in meaning.

- [ ] Add a failing report fixture containing a full kernel projection and assert executive assessment uses kernel priority/strength rather than recomputing provider-count heuristics.
- [ ] Add a failing test proving relationship/pivot provenance and contradiction severity appear in the appropriate existing sections.
- [ ] Add a failing test proving `renderIpAnalystReportText()` / copy-report output contains the same kernel-backed priority, temporal, relationship, and coverage conclusions shown in the structured report.
- [ ] Add a compatibility fixture with no `envelope.intelligence` and assert the existing Decision/Correlation report path still renders.
- [ ] Add a regression test proving kernel data is never labeled raw evidence and provider failures remain `NOT RUN`/`UPSTREAM` coverage states rather than benign/malicious conclusions.
- [ ] Run `node --test test/ip-report-depth-ux.test.mjs test/ip-report-max.test.mjs test/ip-report-fact-quality.test.mjs` and confirm the kernel-specific assertions fail.
- [ ] Add `intelligence` to `buildOverview()`/the IP report model and map it into existing sections with current fact/card primitives. Prefer no CSS changes; if existing components can render the data, do not add styling.
- [ ] Ensure copy/text rendering consumes the same report model rather than separate reasoning logic.
- [ ] Rerun and confirm green.
- [ ] Commit with message `feat: render kernel-backed IP analyst report`.

## Task 11: Lock raw/export/graph compatibility and deterministic regression behavior

**Files**
- Modify: `test/evidence-v2.test.js`
- Modify: `test/evidence-graph-v8.test.js`
- Modify: `test/report-bundle.test.js`
- Modify: `test/stix-export.test.js`
- Modify: `test/fuzz-deterministic.test.js`
- Modify: `test/train-5-compatibility-v8.test.mjs`

- [ ] Add a regression assertion that normalized evidence fingerprints and Evidence v2 payloads are unchanged when intelligence projection is enabled.
- [ ] Assert Evidence Graph evidence nodes still correspond only to Evidence v2 items; kernel conclusions do not create evidence nodes.
- [ ] Assert STIX export remains based on existing evidence/relationship semantics and does not silently serialize kernel-derived conclusions as CTI objects.
- [ ] Assert report bundles may include the additive `intelligence` object when the envelope includes it, while old bundles without the field remain readable.
- [ ] Add deterministic fuzz coverage that permutes evidence/relationship input order and asserts stable kernel arrays/order after canonical sorting.
- [ ] Add a cached/legacy envelope fixture with no intelligence field and assert report/decision/guidance compatibility.
- [ ] Run:

```bash
node --test \
  test/evidence-v2.test.js \
  test/evidence-graph-v8.test.js \
  test/report-bundle.test.js \
  test/stix-export.test.js \
  test/fuzz-deterministic.test.js \
  test/train-5-compatibility-v8.test.mjs
```

Expected: all pass.

- [ ] Fix only compatibility defects directly caused by Intelligence Kernel integration; do not broaden scope into Stage 2 observable migrations.
- [ ] Commit with message `test: lock intelligence kernel compatibility invariants`.

## Task 12: Full Stage 1 verification and release evidence

**Files**
- No production edits unless a verification failure demonstrates an in-scope defect.

- [ ] Run the focused kernel/integration suite:

```bash
node --test \
  test/intelligence-policy-ip.test.js \
  test/intelligence-kernel-ip.test.js \
  test/intelligence-kernel-failure-isolation.test.js \
  test/orchestrator.test.js \
  test/decision-engine.test.js \
  test/decision-engine-integration.test.js \
  test/decision-grade-semantics-regression.test.js \
  test/guidance-v8.test.js \
  test/guidance-graph-integration-v8.test.js \
  test/ip-report-depth-ux.test.mjs \
  test/ip-report-max.test.mjs \
  test/ip-report-fact-quality.test.mjs \
  test/evidence-v2.test.js \
  test/evidence-graph-v8.test.js \
  test/report-bundle.test.js \
  test/stix-export.test.js \
  test/fuzz-deterministic.test.js
```

Expected: all pass.

- [ ] Run `npm test`. Expected: full Node suite passes.
- [ ] Run `npm run check`. Expected: shell syntax, ShellCheck, repository verification, public-release audit, and Node tests all pass.
- [ ] Run the repository's existing Maltego verification path if present in CI/tooling and confirm no regression.
- [ ] Run CodeQL on the implementation PR and require green status before merge.
- [ ] Review the final diff and confirm there are no new provider hosts, dependencies, credentials, environment variables, fetch calls, persistence surfaces, or active-pivot paths.
- [ ] After production deployment, verify the deployment points to the exact merged SHA, `/app/`, `/app/view-model.js`, `/app/renderers.js`, and `/app/analyst-facts.css` return expected assets, and runtime error telemetry is clean.
- [ ] Only claim authenticated protected enrichment as verified if an authenticated live request was actually executed. Static deployment/asset/runtime checks are not a substitute.
- [ ] Record in the PR/release notes: Intelligence Kernel schema version, IP policy version, scheduler policy version, compatibility fallback behavior, and any live-verification limitation.

## Stage 2 Gate

Do not migrate domain, URL, hash, CVE, or certificate in this plan. Stage 2 starts only after the IP reference implementation is merged, production-verified, deterministic regression fixtures are stable, and the user explicitly approves the next observable migration. The subsequent order remains: domain -> URL -> hash -> CVE -> certificate.
