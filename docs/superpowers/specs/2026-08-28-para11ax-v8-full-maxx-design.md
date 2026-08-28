# PARA11AX v8 Full MAXX — Architecture Design

Status: Approved in design review on 2026-08-28  
Base branch: `main`  
Base commit: `ecec52e0180f074f4762bb585c0a021944fc595b`  
Release model: staged, additive v8 train

## 1. Purpose

PARA11AX v8 expands the existing bounded CTI evidence gateway into a stronger analyst investigation platform without weakening its core trust model. The release must deepen intelligence coverage, evidence quality, temporal reasoning, deterministic decision support, case handling, shell ergonomics, reporting, integrations, mobile behavior, accessibility, security, resilience, and documentation while preserving read-only fixed-egress operation and backward compatibility.

The core principle remains: evidence first, bounded always, operational when supported.

## 2. Non-negotiable decisions

The following design choices are locked for v8:

- PARA11AX remains a read-only fortress. No scanning, detonation, submission, blocking, remediation, arbitrary proxying, autonomous action, or user-controlled egress is introduced.
- Provider growth is curated rather than count-driven. New sources must pass the same semantics, provenance, parser, licensing, and bounded-egress admission gate as existing sources.
- Investigation state is local to the analyst browser. The server remains stateless for case content.
- Browser persistence uses plain IndexedDB. Case data is not encrypted by PARA11AX at rest; local browser-profile protection is an accepted tradeoff.
- Case portability is explicit export/import only. There is no sync service, account layer, or collaboration backend.
- The interaction model remains shell-first with contextual terminal-native panes and overlays. No dashboard, permanent sidebar, or card-grid UI is introduced.
- Successful enrichments are automatically captured only while a case is active. Outside an active case, the shell remains transient.
- Successive case snapshots receive automatic semantic diffs.
- Cross-case intelligence is a browser-local evidence-backed index, not a server knowledge base.
- Case re-enrichment is manual and bounded through commands such as `case refresh` and `case refresh --stale`. No unattended monitoring or scheduler is introduced.
- Decision support is expanded but deterministic, explainable, and evidence-backed. No opaque AI score, LLM verdict, or autonomous action is introduced.
- The free/public core remains fully functional. Commercial read-only providers may be optional adapters behind server-side credentials.
- Observable classes expand only when classification, provider coverage, normalization, semantics, and bounded handling are defensible.
- Relationship visualization is an on-demand contextual evidence graph, not a permanent investigation canvas.
- Evidence v2 and current API/CLI contracts evolve backward-compatibly. New structures are additive or explicitly versioned.
- Substantive functionality is shared-core: shell, API, CLI, and relevant integrations may present differently but must not implement different semantics.
- Provider credentials remain server-side deployment/runtime secrets only.
- Operational telemetry is privacy-minimal and excludes observables, evidence payloads, case content, notes, bearer tokens, and provider secrets.
- Authentication remains the current single deployment bearer model using `PARA11AX_TOKEN`; no RBAC, OIDC, account system, or scoped-token layer is added.
- Delivery is staged. `main` must remain deployable after every merge.

## 3. High-level architecture

The v8 server path is:

```text
request
  -> bearer/auth limits
  -> strict observable classification
  -> profile + request budget
  -> curated source plan
  -> bounded provider execution
  -> normalized Evidence v2
  -> relationships + correlation
  -> deterministic guidance
  -> versioned output adapters
```

The browser-local investigation path is separate:

```text
active case
  -> immutable evidence snapshots
  -> semantic diff engine
  -> pins + analyst notes
  -> local cross-case index
  -> contextual evidence graph
  -> explicit .para11ax export/import
```

Server enrichment and local case management must remain independently understandable and testable. Case storage must never become an implicit dependency of server-side enrichment, provider execution, authentication, or reporting APIs.

## 4. Provider registry and source admission

Each provider adapter must declare a machine-readable contract covering:

- provider identifier and display name;
- supported observable classes;
- exact allowed HTTPS hosts;
- allowed HTTP methods;
- credential requirement and configuration state;
- timeout, retry, response-size, concurrency, and call-budget constraints;
- source authority/context semantics;
- parser and normalization contract;
- provenance fields;
- freshness semantics;
- partial-failure and unavailable-state behavior;
- licensing and export restrictions;
- deterministic fixtures and contract tests.

A source is admitted only when its behavior is both useful and bounded. A source that has poor or ambiguous semantics, requires uncontrolled URLs, cannot be constrained to fixed hosts/methods, cannot produce defensible provenance, or cannot be tested deterministically must not enter the provider registry.

Provider count is not a KPI.

Commercial providers are optional. Missing credentials produce explicit coverage state such as unavailable/unconfigured rather than a false negative or global enrichment failure. Browser clients see capability/configuration state but never provider secrets.

The provider registry becomes the canonical source for generated capability documentation, `/meta` provider/type claims, CLI help, operator documentation, and README capability tables where practical.

## 5. Observable type expansion

Existing observable classes remain first-class. New classes may be added only when all of the following exist:

1. deterministic classification and canonicalization;
2. at least one defensible bounded source;
3. explicit evidence semantics;
4. parser and normalization tests;
5. export behavior or an explicit decision not to export to STIX;
6. clear failure and unsupported states.

Likely candidates include email addresses, certificate fingerprints, malware/sample identifiers, and selected infrastructure identifiers. TLS/JA3/JA4, package identifiers, cloud-resource identifiers, or other specialized types are not admitted merely because they are syntactically recognizable; they require a useful bounded evidence model first.

Generic arbitrary-string routing is prohibited.

## 6. Evidence model evolution

Evidence v2 remains the canonical external contract. V8 extends it additively and may introduce explicitly versioned substructures where necessary.

Internally, the evidence model must distinguish:

- observed facts;
- normalized provider claims;
- contextual intelligence;
- derived relationships.

Derived data must retain evidence references sufficient to explain why it exists. Provider failure, absent credentials, stale data, unsupported types, and missing coverage are coverage states, not benign indicators.

The existing doctrine remains enforced:

- absence is not benign;
- context is not reputation;
- claims are not compromise proof;
- infrastructure is not attribution;
- KEV, EPSS, and CVSS are distinct concepts;
- provider failure is not negative evidence.

No universal maliciousness score is introduced.

## 7. Correlation and relationship semantics

V8 correlation is deterministic and bounded. Supported correlation inputs include:

- exact canonical observables;
- normalized infrastructure entities;
- explicit provider-supplied relationships;
- ATT&CK mappings;
- temporal evidence changes;
- prior local case sightings;
- explicit case references.

Correlation must not silently convert weak co-occurrence into identity or attribution. Cross-case recurrence is contextual evidence only and cannot independently raise severity, establish compromise, or establish actor attribution.

Relationship objects must expose provenance or the evidence references that justify them.

## 8. Semantic diff engine

When the same observable is enriched again inside an active case, v8 compares the new immutable snapshot with the previous applicable snapshot using normalized semantic content rather than raw JSON equality.

Diff categories include:

- evidence added or removed;
- provider coverage gained or lost;
- provider state changed;
- semantic claim changed;
- relationship appeared or disappeared;
- freshness materially changed;
- contradiction appeared or resolved;
- ATT&CK/context mapping changed;
- deterministic disposition or guidance changed;
- huntability changed;
- telemetry requirements changed.

The engine ignores non-semantic churn such as retrieval timestamps, provider ordering, formatting changes, and stable metadata serialization differences.

Every diff entry must identify the before/after semantic value and the evidence/provider context that caused the change.

## 9. Deterministic analyst guidance

Decision support remains deterministic and explainable. It may produce:

```text
disposition
confidence basis
supporting evidence
contradictions
missing evidence
coverage gaps
telemetry gaps
suggested pivots
prioritized hunt actions
why-this-changed explanation
```

Each recommendation must be reproducible from normalized evidence, correlation, declared coverage state, relationships, or telemetry requirements. Guidance cannot invent evidence, execute hunts, modify systems, block indicators, submit samples, or remediate anything.

No hidden weighting model, LLM verdict, or autonomous agent enters the decision path.

## 10. Local analyst workspace

The browser gains a dedicated IndexedDB-backed investigation subsystem. It is isolated from authentication and server/provider state.

A case contains:

- stable local case ID;
- title and local metadata;
- creation/update timestamps;
- explicit analyst notes;
- pinned observables;
- immutable enrichment snapshots;
- semantic diff records;
- references used by the local cross-case index;
- schema/version metadata.

Successful enrichments auto-capture only when a case is active. Notes and pins remain explicit analyst actions. Without an active case, enrichment remains transient.

Deleting a case removes its contribution from the local index. The index is derived state and must be rebuildable from saved cases.

Local case data is not encrypted by PARA11AX. This is an explicit v8 design tradeoff. Documentation must state that browser-profile/device security protects local case content.

## 11. Case commands and refresh behavior

The shell should provide coherent commands including, subject to final implementation naming:

```text
case new
case open
case close
case list
case show
case refresh
case refresh --stale
case export
case import
pin
unpin
note
diff
graph
```

`case refresh` re-enriches saved observables only on explicit analyst request. It uses the normal provider scheduler, configured profile semantics, concurrency/call budgets, request deadlines, and circuit state. It appends new immutable snapshots and generates semantic diffs.

No background browser timer, service worker, server scheduler, or unattended monitoring is added.

## 12. Cross-case local index

V8 maintains a browser-local index over saved cases for analyst recall. The index may contain canonical observable references, explicit relationship fingerprints, ATT&CK mappings, evidence fingerprints, and case IDs sufficient to surface prior sightings.

The index stores derived references, not a separate authoritative copy of case evidence. It must be rebuildable and disposable.

Cross-case results must identify which local case(s) support the match. Fuzzy attribution, hidden clustering, and unsupported inference are excluded.

## 13. Contextual evidence graph

The graph is an on-demand terminal-native overlay for tasks that are materially harder to understand as linear text.

It may render:

- observables;
- providers;
- explicit relationships;
- ATT&CK mappings;
- supported pivots;
- local prior-case references.

Edges exist only when backed by explicit evidence or declared deterministic mapping. No inferred/fuzzy edges are drawn. Graph expansion is bounded by hard node/edge/depth/call limits. Opening or traversing the graph does not bypass normal provider-call controls.

The graph is contextual and dismissible. It does not become a permanent canvas, dashboard, sidebar, or second product navigation system.

## 14. API, CLI, shell, and integrations

Substantive server-side v8 semantics live in shared core modules. Shell, API, CLI, reporting, STIX, and relevant integrations adapt those semantics rather than reimplement them.

Current endpoints and Evidence v2 behavior remain compatible for existing callers. New functionality is additive through optional fields, additive endpoints where justified, or explicitly versioned nested structures.

The browser shell is the richest interactive client. Commands may include `explain`, `compare`, `pivot`, `coverage`, `hunt`, `graph`, and `report`, but their intelligence semantics must match API/CLI equivalents.

CLI parity applies to server-side capabilities such as enrichment, comparison, explanation, relationships, hunt guidance, coverage diagnostics, and deterministic reports. Browser-local case state is not silently mirrored into a hidden CLI database. File-oriented CLI support for explicit `.para11ax` bundles is allowed where useful.

Integrations such as Maltego remain thin adapters. Integration-specific verdict logic is prohibited.

## 15. Reporting and STIX

Reports are deterministic outputs generated from already captured normalized evidence. Report rendering must not call providers, refresh evidence, or silently alter case state.

A v8 analyst report may include:

- executive findings;
- observable inventory;
- evidence and provenance inventory;
- provider coverage and gaps;
- contradictions;
- temporal/semantic changes;
- explicit relationships;
- ATT&CK context;
- telemetry requirements and gaps;
- prioritized hunt guidance;
- appendices.

STIX remains an interoperability output, not the internal domain model. New observables and relationships are mapped to STIX only when the mapping is semantically defensible. Unsupported concepts remain represented in PARA11AX JSON rather than being forced into misleading STIX objects.

## 16. `.para11ax` bundle format

Case portability is explicit export/import only.

A bundle contains case metadata, notes, pins, immutable evidence snapshots, semantic diffs, and sufficient schema/version metadata for validation and migration. It must never contain `PARA11AX_TOKEN`, provider API credentials, deployment secrets, or browser auth state.

Import must validate:

- bundle/schema version;
- structural integrity;
- type/field constraints;
- maximum total size;
- maximum record/snapshot counts;
- supported observable types;
- migration compatibility.

Malformed or oversized bundles are rejected before IndexedDB mutation.

No sync endpoint or collaboration protocol is added.

## 17. Security and privacy

Existing trust controls become explicit regression contracts. Tests must protect:

- exact-host fixed egress;
- HTTPS-only provider access;
- allowed-method restrictions;
- redirect rules;
- body and response-size caps;
- bounded concurrency and global call reservations;
- timeout/retry/circuit behavior;
- strict observable classification;
- bearer enforcement;
- provider-secret isolation;
- browser credential non-persistence;
- report/export secret exclusion;
- privacy-minimal logging.

Operational telemetry may include request ID, route class, timings, provider/circuit state, status/error class, and aggregate utilization. It must not log raw observables, evidence payloads, case contents, notes, bearer tokens, or provider secrets.

The authentication model remains one deployment bearer through `PARA11AX_TOKEN`. V8 does not add named users, scopes, RBAC, OIDC, or server-side case identity.

## 18. Resilience and failure semantics

V8 must preserve partial progress without misrepresenting confidence. Provider timeout, malformed upstream data, rate limiting, circuit-open state, missing credentials, unsupported types, IndexedDB failure, bundle corruption, or interrupted case refresh must surface as explicit states.

A provider failure must not convert an indicator to benign. A local storage failure must not change the server enrichment result. An interrupted refresh must not overwrite the previous immutable snapshot.

Provider parsers require tests for malformed, partial, empty, oversized, and schema-drift responses.

## 19. Performance and boundedness

V8 optimizes bounded usefulness, not maximum concurrency.

Existing provider concurrency and request budgets remain authoritative unless separately justified and approved during implementation. New local features must also be bounded:

- incremental semantic diffs;
- incremental/rebuildable local indexing;
- hard graph limits;
- bounded bundle sizes;
- bounded case-refresh fanout;
- deferred or virtualized rendering for large evidence/JSON views where necessary.

Case refresh must share the normal scheduler rather than introducing a parallel ungoverned execution path.

## 20. UX, mobile, accessibility, and brand

The v7 terminal-first brand remains the foundation. V8 improves capability without turning PARA11AX into a conventional SaaS dashboard.

Required UX properties:

- hierarchy remains status line -> evidence/scrollback -> prompt;
- contextual panes and overlays appear only when useful and dismiss cleanly;
- one-column mobile behavior remains first-class;
- JSON and dense evidence remain inspectable without breaking viewport layout;
- keyboard operation covers shell and contextual workspace functions;
- focus state is visible;
- native text selection remains available;
- overlays receive usable screen-reader labels/semantics;
- contrast remains sufficient for phosphor/white/red states;
- no information is conveyed only by color or animation;
- reduced-motion mode disables nonessential motion;
- Matrix/radar/glitch effects remain atmosphere, not interaction dependencies.

Landing-page capability claims must be backed by public or deterministic product metadata. No fabricated uptime, latency, provider state, or investigation metrics are introduced.

Error surfaces should converge on the canonical black/phosphor/white/sparse-red brand and inherit shared favicon/cursor behavior where technically appropriate.

## 21. Documentation and capability truth

Machine-readable registries should drive provider/type capability documentation where practical. Generated or validated documentation should keep the following aligned:

- provider registry;
- observable registry;
- `/meta` output;
- CLI help;
- operator documentation;
- README capability matrices;
- integration documentation.

Documentation must distinguish `implemented`, `configured`, and `production-verified` capability state.

## 22. Testing strategy

Implementation follows test-first development. The v8 suite must cover, as applicable:

- observable classifier/canonicalizer tests;
- provider admission/contract tests;
- fixed-egress and SSRF regressions;
- parser fixtures including malformed/schema-drift responses;
- Evidence v2 backward-compatibility fixtures;
- correlation and relationship provenance tests;
- semantic-diff golden tests;
- deterministic guidance provenance/reproducibility tests;
- IndexedDB case lifecycle and migration tests;
- active-case auto-capture behavior;
- cross-case index build/rebuild/delete behavior;
- `.para11ax` bundle validation and secret-exclusion tests;
- bounded refresh and interrupted-refresh behavior;
- graph node/edge/depth limits;
- shell/API/CLI semantic parity tests;
- report determinism tests;
- STIX semantic mapping regressions;
- auth and secret non-persistence tests;
- privacy-minimal logging tests;
- mobile layout and accessibility checks;
- reduced-motion behavior;
- generated documentation consistency checks.

Existing CI gates remain required unless explicitly superseded by a reviewed replacement.

## 23. Staged delivery

V8 is delivered as a sequence of independently testable, deployable trains:

1. **Core contracts and registries** — formalize provider/type contracts, capability truth, and supporting test infrastructure without changing external behavior.
2. **Curated providers and observable types** — add only sources/types that pass the admission gate.
3. **Evidence evolution and semantic diffs** — additive Evidence v2 structures, normalized diff engine, correlation refinements.
4. **Local cases and cross-case index** — IndexedDB workspace, active-case capture, immutable snapshots, export/import, local recall.
5. **Deterministic guidance and contextual graph** — explainability, missing-evidence/telemetry guidance, pivots/hunts, bounded graph.
6. **Shared surface parity** — shell/API/CLI/reporting/STIX/integration exposure over shared core semantics.
7. **Visual, mobile, accessibility, docs, and operations polish** — terminal-native UX, error surfaces, generated documentation, performance and observability hardening.
8. **Production acceptance** — full repository/CI/deployment verification and capability-state audit.

Every train must leave `main` deployable. Breaking migrations between trains are prohibited unless separately reviewed and approved.

## 24. Production acceptance

A feature is not considered production-ready merely because code exists. Acceptance distinguishes:

- **implemented** — code and deterministic tests exist;
- **configured** — required deployment configuration/credentials exist;
- **production-verified** — the capability has been exercised successfully against the deployed production commit where live verification is possible and safe.

Final v8 acceptance must verify:

- repository and CI state;
- deployed production SHA;
- public landing behavior;
- protected terminal/API behavior;
- fixed-egress and auth boundaries;
- provider/type capability claims;
- free-core behavior when commercial credentials are absent;
- local case persistence and export/import behavior;
- semantic diffs and cross-case recall;
- deterministic guidance provenance;
- graph boundedness;
- report/STIX determinism;
- mobile and accessibility behavior;
- generated documentation consistency;
- absence of unintended secret or investigation-data persistence on the server.

## 25. Explicit non-goals

V8 does not add:

- active scanning;
- malware detonation;
- sample or URL submission;
- indicator blocking;
- remediation;
- takedown;
- autonomous hunts;
- arbitrary proxying;
- dynamic provider plugins;
- arbitrary user-defined provider URLs;
- browser-stored provider credentials;
- server-side case storage;
- case synchronization;
- real-time collaboration;
- user accounts or SSO;
- RBAC/scoped bearer tokens;
- server background monitoring;
- generic arbitrary-string observable routing;
- a universal maliciousness score;
- an LLM or opaque model in the evidence/decision path;
- unsupported or inferred graph edges.

## 26. Success criteria

V8 succeeds when PARA11AX can support deeper investigations and longer analyst workflows while preserving the trust properties of the current gateway. Specifically:

- existing clients continue to work without Evidence v2/API/CLI breakage;
- every new provider/type has a bounded, testable contract;
- case workflows remain local and explicit;
- repeated enrichment produces useful semantic change intelligence rather than raw JSON churn;
- cross-case recall is evidence-backed and local;
- deterministic guidance can explain every recommendation;
- shell/API/CLI/integrations do not disagree on substantive semantics;
- optional commercial coverage never becomes a dependency of the free core;
- security/privacy boundaries are regression-tested;
- mobile/accessibility behavior remains functional under the richer workspace;
- documentation claims match machine-readable capability state;
- production verification can distinguish what is implemented, configured, and actually live.
