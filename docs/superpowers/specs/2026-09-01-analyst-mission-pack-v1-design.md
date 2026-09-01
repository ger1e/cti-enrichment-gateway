<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Document status:** Historical design record. Preserved for implementation history; current behavior is defined by [docs/ARCHITECTURE.md](https://github.com/ger1e/para11ax/blob/main/docs/ARCHITECTURE.md) and the current README.

# Analyst Mission Pack v1 — Design

## Purpose

Analyst Mission Pack v1 closes the operational gap between decision-grade public-source intelligence and an analyst-executable threat-hunting workflow without weakening PARA11AX Evidence v2 semantics.

The feature is additive. It does not replace Evidence v2, the Intelligence Kernel, Decision Support, Evidence Graph, Guidance, case storage, or existing report compilation. It adds deterministic client-context relevance, hunt-package construction, KQL quality validation, bounded result import/analysis, and ServiceNow-ready projection.

## Non-negotiable boundaries

- No LLM is introduced into the canonical deterministic analysis path.
- No new network egress or provider destination is introduced.
- No server-side client-profile persistence is introduced.
- Client environment facts are explicit caller inputs or browser-local case context only.
- External/provider data remains untrusted data and cannot alter policy, routing, persistence, or executable instructions.
- Relevance is an operational fit measure, not maliciousness, attribution, compromise, or threat probability.
- Unknown telemetry/table/column semantics fail closed as `SCHEMA_UNVERIFIED`.
- Absence of returned hunt results is never converted into a benign conclusion.
- ServiceNow output is a projection only; no ticket is submitted automatically.

## Core objects

### ClientProfile v1

A bounded normalized structure containing explicit environment facts:

- `id`, `name`
- `industries[]`
- `geographies[]`
- `technologies[]`
- `attackPaths[]`
- `priorityActors[]`
- `telemetry[]`
- `crownJewels[]`

Normalization is deterministic: trim, case-normalize where semantically safe, deduplicate, sort, reject overlong/invalid structures, and freeze returned data.

### RelevanceAssessment v1

Deterministically compares a threat/hunt context with an explicit ClientProfile.

The score is a 0–100 operational relevance index with visible factor contributions:

- technology overlap: 25
- observed exploitation relevance: 20
- industry relevance: 15
- geography relevance: 10
- attack-path overlap: 10
- actor relevance: 10
- telemetry huntability: 5
- evidence confidence: 5

Every component must expose its numerator/weight/rationale. A score without factor evidence is invalid. Unknown factors contribute zero and are reported as gaps rather than silently assumed.

Labels:

- 80–100 `immediate`
- 60–79 `high`
- 40–59 `moderate`
- 20–39 `low`
- 0–19 `contextual`

These labels describe client relevance only.

### HuntPackage v1

A bounded package constructed from explicit threat context, client profile and optional relevance assessment:

- stable deterministic `id`
- `hypothesis`
- `subject`
- `attackIds[]`
- `requiredTelemetry[]`
- `availableTelemetry[]`
- `telemetryGaps[]`
- `evidenceFingerprints[]`
- `sourceReferences[]`
- `relevance`
- `kqlCandidates[]`
- `limitations[]`
- `state`

State is `READY`, `TELEMETRY_GAP`, `SCHEMA_UNVERIFIED`, or `INSUFFICIENT_EVIDENCE`.

A package cannot be `READY` unless it has a non-empty hypothesis, at least one evidence fingerprint or defensible source reference, required telemetry, and no unresolved schema failure for included KQL.

### KQL Validation v1

Validation is deliberately conservative. It is not a live Microsoft tenant compiler.

The validator:

- rejects empty/oversized KQL;
- recognizes an explicit static table/column catalog maintained in repository source;
- reports referenced tables;
- reports unknown tables/columns when deterministically extractable;
- blocks unsupported destructive/control commands and unsafe query-management forms;
- flags expensive broad patterns such as wildcard table unions and unbounded `search *`;
- returns `VALID`, `VALID_WITH_WARNINGS`, or `SCHEMA_UNVERIFIED`.

The catalog initially covers the Microsoft tables used by PARA11AX hunt templates and is intentionally smaller than the full Sentinel/Defender schema. Unknown is not guessed.

### Result Import v1

Analyst result ingestion is local/deterministic and bounded:

- JSON array/object rows;
- CSV with bounded rows/columns/field lengths;
- no formula execution;
- no network access;
- no automatic evidence promotion.

The analyzer emits row count, non-empty signal count, matched observable fields where explicitly configured, and a finding state:

- `RESULTS_PRESENT`
- `NO_RESULTS`
- `IMPORT_EMPTY`
- `IMPORT_INVALID`

`NO_RESULTS` means only that the supplied query result set contained no rows. It is not a clean-environment verdict.

### ServiceNow Projection v1

A deterministic text/JSON projection from a hunt package plus optional result analysis:

- title
- severity suggestion
- summary
- affected/client context
- evidence references
- observed/result state
- ATT&CK mapping
- telemetry gaps
- KQL validation state
- recommended actions
- confidence/limitations
- provenance

No API call or ticket creation occurs in v1.

## Integration

### Report model

Existing `huntOpportunities` remain compatible. Mission-pack metadata is optional and additive. Existing report renderers must remain deterministic.

### Shell

The first integration target is the existing command fabric. Commands are additive and must preserve browser/node parity:

- `mission profile validate <json>`
- `mission relevance <profile-json> <context-json>`
- `mission hunt build <json>`
- `mission kql validate <query>`
- `mission result analyze <json-or-csv>`
- `mission servicenow <json>`

If shell wiring would materially expand the patch surface, the core APIs ship first and shell commands follow as a separately verified train.

## Security properties

- Inputs are bounded before processing.
- Returned objects contain no executable callbacks or hidden runtime state.
- No dynamic `eval`, `Function`, child process, filesystem write, arbitrary URL fetch, or environment-secret read.
- CSV parsing cannot execute spreadsheet formulas; output renderers retain existing formula neutralization.
- KQL validation does not execute queries.
- ServiceNow projection does not send data.
- Deterministic IDs are content-derived and reproducible.

## Definition of done

The v1 core is complete when a test fixture can deterministically execute:

explicit client profile
→ relevance assessment
→ hunt package
→ KQL validation
→ bounded imported result analysis
→ ServiceNow-ready projection

with no external network access, no LLM call, no new dependency, explicit fail-closed states, and all repository checks passing.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
