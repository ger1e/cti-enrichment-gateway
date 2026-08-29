# PARA11AX v8 Train 5 — Guidance and Evidence Graph Design

Date: 2026-08-29
Status: approved design pending implementation
Scope: deterministic analyst guidance and evidence-graph projections over existing Evidence v2, Train 3 semantic diffs, and Train 4 local cases

## 1. Objective

Train 5 adds a stable, deterministic guidance contract and an explicit evidence graph without introducing another enrichment engine, a graph database, new provider calls, or opaque scoring.

The train consumes the gateway's existing normalized Evidence v2 response, correlation output, decision support, semantic diffs, and browser-local case snapshots. It produces two pure projections:

1. a canonical evidence graph that exposes only explicit, evidence-backed relationships; and
2. versioned analyst guidance that explains the current disposition, supporting evidence, limitations, contradictions, freshness, coverage loss, and meaningful semantic changes.

Success means an analyst can inspect why PARA11AX recommends `hunt_now`, `investigate`, `monitor`, `context_only`, or `insufficient`, traverse the exact evidence relationships behind that guidance, and see cross-case context without any hidden inference or server-side state.

## 2. Hard invariants

1. No new provider calls, outbound hosts, network paths, or credentials.
2. No database, graph service, cloud sync, scheduler, or server-side case persistence.
3. No universal maliciousness, risk, confidence, or vendor-vote numeric score.
4. KEV, EPSS, CVSS, provider verdicts, infrastructure context, ATT&CK knowledge, and sandbox behavior remain semantically distinct.
5. Existing decision dispositions remain the only top-level analyst dispositions: `hunt_now`, `investigate`, `monitor`, `context_only`, `insufficient`.
6. Infrastructure-only evidence cannot become a threat conclusion.
7. Attribution appears only when explicit evidence or relationships already support it.
8. Graph nodes and edges are created only from explicit subject, evidence, relationship, ATT&CK, actor, malware, provider, and case-sighting facts already present in normalized inputs.
9. No fuzzy entity matching, similarity matching, name guessing, NLP entity extraction, or inferred relationship expansion.
10. Output ordering and identities are deterministic for identical inputs.
11. Every collection is bounded. Limits are enforced before returning output.
12. Train 4 browser-local persistence remains the only persistence path consumed by this train.
13. Maltego certificate parity remains deferred to Train 6.
14. Existing gateway, shell, CLI, API, report, and Maltego contracts remain compatible unless this spec explicitly adds an additive field or helper.

## 3. Chosen architecture

The existing `src/core/decision-engine.js` remains the source of current decision support. Train 5 does not replace it.

Add two focused pure modules:

- `src/core/evidence-graph.js` — canonical evidence graph construction.
- `src/core/guidance.js` — versioned guidance projection that wraps the existing decision output and semantic-change context.

Browser-local case graphing is implemented as a separate pure adapter:

- `app/case-evidence-graph.js` — projects Train 4 case pins, snapshots, diffs, and exact typed sightings into the same graph vocabulary without importing browser persistence into core modules.

The gateway may expose the new core projections additively in normalized enrichment responses only after their contracts are stable and tested. Local case code consumes the pure helpers and existing IndexedDB repository; it never sends cases to the server.

## 4. Canonical evidence graph

### 4.1 Interface

`buildEvidenceGraph({ indicator, type, evidence, relationships, correlation, decision })`

Returns:

```js
{
  schemaVersion: '1.0',
  rootId: 'observable:<type>:<stable-id>',
  nodes: [...],
  edges: [...],
  counts: { nodes, edges },
  truncated: false
}
```

The returned object and all nested nodes/edges are deeply frozen.

### 4.2 Node types

Supported node types are exactly:

- `observable`
- `evidence`
- `provider`
- `attack`
- `actor`
- `malware`
- `case`
- `snapshot`

Core gateway graph construction uses all types except `case` and `snapshot`; those are introduced only by the browser-local case adapter.

### 4.3 Node identity

Stable IDs use canonical typed material and never array position.

- observable: `observable:${type}:${sha256(type + '\0' + value).slice(0,24)}`
- evidence: `evidence:${integrity.fingerprint.toLowerCase()}`
- provider: `provider:${provider}`
- ATT&CK: `attack:${attackId.toUpperCase()}`
- actor: `actor:${sha256(actor).slice(0,24)}`
- malware: `malware:${sha256(malware).slice(0,24)}`
- case: `case:${caseId}`
- snapshot: `snapshot:${snapshotId}`

Raw observable values remain in node data when already part of the enrichment response. IDs do not embed full raw observable values.

### 4.4 Edge types

Supported edge types are exactly:

- `has_evidence`
- `reported_by`
- `related_to`
- `mapped_to_attack`
- `reported_actor_context`
- `reported_malware_context`
- `case_contains`
- `case_snapshot`
- `snapshot_subject`
- `cross_case_sighting`

Provider-derived relationships preserve their original semantic relationship name in `data.relationshipType`; the canonical graph edge type remains `related_to`.

### 4.5 Evidence rules

- Every evidence node must have a valid 64-hex integrity fingerprint.
- Every evidence node must link to its provider using `reported_by`.
- Subject-to-evidence edges use `has_evidence`.
- ATT&CK edges are created only from explicit ATT&CK IDs in evidence attributes or existing decision mappings.
- Actor and malware nodes are created only from explicit evidence fields or explicit normalized relationships.
- Relationship targets use an explicit `targetType` when present. Existing deterministic type mapping may be used only for already-normalized relationship types such as `hostname -> domain`; arbitrary string guessing is forbidden.
- Duplicate nodes and edges collapse by exact stable identity.

### 4.6 Ordering and limits

Stable order:

1. nodes sorted by `type`, then `id`;
2. edges sorted by `type`, then `source`, then `target`, then provider/relationship metadata.

Hard limits:

- maximum nodes: 256
- maximum edges: 512
- maximum evidence nodes: 100
- maximum ATT&CK nodes: 64
- maximum actor nodes: 32
- maximum malware nodes: 32

When an input would exceed a hard limit, construction fails closed with a stable error code such as `evidence_graph_node_limit` or `evidence_graph_edge_limit`. It must not silently truncate semantic evidence. `truncated` therefore remains `false` for successful graphs.

## 5. Guidance contract

### 5.1 Interface

`buildGuidance({ decision, correlation, semanticDiff = null, evidenceGraph })`

Returns:

```js
{
  schemaVersion: '1.0',
  disposition,
  confidence,
  reasons,
  evidenceFingerprints,
  contradictions,
  limitations,
  freshness,
  coverage,
  telemetry,
  attackMappings,
  hunts,
  change: null | {
    attentionRequired,
    categories,
    explanations
  }
}
```

### 5.2 Disposition and confidence

`disposition` is copied from the existing decision engine and must be one of:

- `hunt_now`
- `investigate`
- `monitor`
- `context_only`
- `insufficient`

`confidence` is copied from the existing decision engine. Train 5 does not calculate a second confidence model.

### 5.3 Evidence linkage

`evidenceFingerprints` is the sorted union of valid fingerprints referenced by:

- decision hunt plans;
- decision ATT&CK mappings;
- graph evidence nodes relevant to the subject.

No guidance item may cite an evidence fingerprint absent from the graph.

### 5.4 Semantic-change attention

Train 3 semantic diffs remain authoritative for change categories. Train 5 adds only an analyst-attention projection.

`attentionRequired` is `true` when the semantic diff contains at least one of:

- `decision_changed`
- `contradiction_changed`
- `semantic_claim_changed`
- `provider_state_changed`
- `attack_mapping_changed`
- `huntability_changed`
- `telemetry_changed`

The following categories alone do not force analyst attention:

- `evidence_added`
- `evidence_removed`
- `provider_coverage_changed`
- `relationship_added`
- `relationship_removed`
- `freshness_changed`

They remain visible in `categories` and `explanations`.

Train 5 does not invent significance scores or weighted change severity.

## 6. Case evidence graph

### 6.1 Interface

`buildCaseEvidenceGraph(caseValue, { sightings = [] })`

Consumes one validated Train 4 case plus optional exact typed sightings already returned by the local case index.

### 6.2 Case projection

- root node is the case.
- each pin becomes an observable node linked with `case_contains`.
- each stored snapshot becomes a snapshot node linked with `case_snapshot` and `snapshot_subject`.
- each snapshot's Evidence v2 envelope is projected through `buildEvidenceGraph` and merged by exact graph identity.
- cross-case sightings become `cross_case_sighting` edges only when both type and value exactly match the indexed observable.
- note text is not graph material and is never parsed for entities.
- semantic diff objects are not converted into relationship nodes; they feed guidance/change views only.

### 6.3 Isolation

`app/case-evidence-graph.js` imports pure graph helpers and case validation only. It must not import IndexedDB, gateway credentials, session state, fetch, or server APIs.

## 7. Gateway integration

After pure contracts pass tests, `src/app.js` may add two optional top-level fields to successful/partial enrichment responses:

- `evidenceGraph`
- `guidance`

They are derived after existing correlation and decision support.

Failure to build a graph or guidance object because of an internal invariant violation must fail the request through the existing sanitized internal-error surface; it must not return contradictory partial guidance.

Provider failures and ordinary partial coverage do not constitute graph-construction failures. They remain represented through the existing evidence/correlation/decision inputs.

## 8. Security and privacy

- No credential field or request bearer may enter graph/guidance inputs or outputs.
- Evidence references remain subject to existing sanitization.
- Stable IDs use SHA-256 only for identity construction; they are not security claims.
- Graph/guidance modules perform no logging, file writes, network calls, timers, persistence, or environment-variable reads.
- Browser case graph code performs no network or persistence operations; callers supply already-loaded case objects and sightings.
- Existing local case security guards must include the new `app/case-evidence-graph.js` surface.

## 9. Compatibility

- Evidence schema v2 remains unchanged.
- Existing `decision` output remains present and retains current semantics.
- `evidenceGraph` and `guidance` are additive.
- Existing report compiler may continue consuming `decision` directly. A later change may consume guidance, but Train 5 does not require report schema changes.
- Existing shell commands remain unchanged in this train.
- Existing API request grammar remains unchanged.
- Maltego transform inventory remains unchanged.

## 10. Testing strategy

### 10.1 Evidence graph tests

Prove:

- deterministic byte-equivalent JSON for reordered set-like inputs;
- deep immutability;
- stable IDs independent of array order;
- exact deduplication;
- provider/evidence provenance edges;
- ATT&CK, actor, malware, and typed relationship projection only from explicit facts;
- no fuzzy string inference;
- hard node/edge/evidence bounds fail closed;
- no score fields.

### 10.2 Guidance tests

Prove:

- disposition/confidence are inherited, not recalculated;
- infrastructure-only decisions remain `context_only`;
- evidence fingerprints all resolve to graph evidence nodes;
- contradiction, limitation, freshness, coverage, telemetry, ATT&CK, and hunt data remain distinct;
- semantic-diff attention mapping follows the exact category allowlist above;
- no weighted severity or universal risk score exists.

### 10.3 Case graph tests

Prove:

- pins and snapshots merge deterministically;
- exact typed cross-case sightings only;
- same value with different type does not create a cross-case edge;
- notes are never entity-parsed;
- case graph code contains no credential/session/network/persistence primitives;
- deleted or absent sightings disappear when the caller rebuilds from current index input.

### 10.4 Integration and regression tests

Prove:

- successful and partial gateway responses contain additive `evidenceGraph` and `guidance`;
- error responses do not manufacture guidance;
- existing decision-engine tests remain unchanged and green;
- Train 1 compatibility, Train 2 routing, Train 3 semantic diff, Train 4 case/security, Tooling smoke, and CodeQL remain green.

## 11. Non-goals

Train 5 does not add:

- graph visualization UI;
- graph database persistence;
- graph query language;
- new shell commands;
- report schema migration;
- API graph traversal endpoints;
- provider discovery or enrichment;
- active scanning;
- AI/LLM-generated analysis;
- automatic entity extraction from prose;
- Maltego certificate support;
- threat/risk scoring.

## 12. Acceptance criteria

Train 5 is complete only when:

1. pure evidence graph, guidance, and case graph modules exist with the contracts above;
2. all new behavior was introduced through observed RED then GREEN tests;
3. existing v8 contracts remain green;
4. gateway integration is additive and exact-head Tooling smoke passes;
5. CodeQL passes on the exact PR head;
6. changed-file review shows no new secret, persistence, egress, dependency, or active-operation surface;
7. the verified PR head is synchronized with current `main` before merge;
8. branch protection merges only the verified head;
9. merged `main` receives a fresh successful Tooling smoke run.
