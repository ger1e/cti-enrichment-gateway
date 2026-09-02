<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
# Investigation Workspace v2 Design

> **Historical design record.** This document defines the approved Investigation Workspace v2 target. After implementation, [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md) remains authoritative for the deployed system.

## Purpose

Investigation Workspace v2 turns PARA11AX's existing enrichment, browser-local case, Mission Workspace, result-analysis, and report capabilities into one coherent analyst lifecycle. A case becomes the authoritative local investigation container while Evidence v2 remains the authoritative enrichment record.

The release optimizes analyst continuity and auditability. It does not add provider egress, automatic KQL execution, ticket submission, server-side case storage, runtime learning, an LLM dependency, or a universal maliciousness score.

## Problem

PARA11AX currently exposes strong but adjacent workflows:

- enrichment can be captured into a browser-local case;
- Mission Workspace can produce relevance, hunt, KQL, result, and ServiceNow projections;
- reports can render current result or mission state;
- User Scanner and Shodan remain isolated operator outputs.

The analyst must manually transfer context between case and mission state. The system does not provide one investigation status, dependency graph, stale-artifact model, or portable bundle containing the complete defensible workflow. This creates avoidable context switching and allows an old hunt or report to appear current after upstream scope changes.

## Selected approach

Extend the existing case model into a versioned investigation aggregate and embed a Mission Workspace-derived workflow inside it. Existing pure mission functions remain the only engines for relevance, hunt construction, KQL validation, result analysis, and ServiceNow projection. The integration layer coordinates state and provenance; it does not duplicate analytical logic.

Rejected alternatives:

1. **Add an LLM copilot first.** This would add injection, provenance, cost, governance, and hallucination risk before the deterministic workflow is coherent.
2. **Add more providers or commands.** The current 38-source fabric is already broad. Additional sources do not solve investigation continuity.
3. **Keep cases and missions separate and add copy helpers.** This preserves the underlying stale-state and audit-fragmentation problem.

## Architecture

```text
canonical observable
  -> Evidence v2 enrichment
  -> explicit case capture
  -> investigation scope/profile
  -> deterministic relevance
  -> evidence-bound hunt package
  -> conservative KQL validation
  -> analyst executes externally
  -> bounded result import/analysis
  -> explicit analyst disposition
  -> report + ServiceNow projection
  -> portable investigation bundle
```

The implementation has four bounded units:

1. **Investigation model** — schema, validation, migration, revisions, artifact dependencies, and deterministic status.
2. **Investigation reducer** — atomic commands and dependency invalidation over detached frozen state.
3. **Case repository integration** — one serialized read-modify-write per successful mutation through the existing IndexedDB adapter.
4. **Shell/report projection** — shared Web/CLI command semantics, analyst-readable status, and deterministic export surfaces.

## Authoritative-state hierarchy

The aggregate preserves explicit authority boundaries:

| Layer | Authority | May derive from | Must not become |
|---|---|---|---|
| Evidence snapshot | Evidence v2 | provider observations | analyst assertion |
| Intelligence/decision/guidance | deterministic derived context | compatible evidence snapshot | new Evidence v2 item |
| Investigation scope | explicit analyst input | client/environment facts | provider observation |
| User Scanner/Shodan capture | contextual operator artifact | explicit capture action | Evidence v2 or identity proof |
| Hunt package/KQL validation | deterministic mission projection | scope plus evidence references | executed detection result |
| Imported result analysis | bounded analyst-supplied data | external query output | benign or malicious evidence by itself |
| Analyst disposition | explicit analyst judgment | all visible artifacts | automated provider fact |
| Report/ticket projection | deterministic presentation | current non-stale artifacts | automatic submission |

## Investigation schema

The bundle format is `para11ax-investigation-v2.0`. The browser persistence record uses the same logical schema with adapter metadata kept outside exported content.

Top-level fields:

- `format`, `version`, `id`, `title`, `createdAt`, `updatedAt`, `revision`;
- `scope` — normalized client profile and explicit threat/relevance context;
- `observables[]` — exact typed pinned observables;
- `evidenceSnapshots[]` — bounded Evidence v2 snapshots and semantic diffs;
- `operatorArtifacts[]` — explicitly captured Shodan/User Scanner outputs with source type and limitations;
- `workflow` — relevance, hunt package, KQL validations, result analysis, disposition, and ServiceNow projection;
- `notes[]`, `timeline[]` — bounded explicit analyst records;
- `freshness` — dependency hashes and stale reasons;
- `status` — deterministic readiness projection;
- `limitations[]` — deduplicated bounded limitations.

No bearer, provider secret, environment-variable name, runtime handle, IndexedDB key material, arbitrary executable content, or server-side credential may enter the aggregate.

### Bounds

Existing case and Mission Workspace limits remain the default ceilings. New aggregate limits are explicit:

- maximum encoded bundle: 4 MiB;
- maximum 64 observables;
- maximum 128 evidence snapshots;
- maximum 32 operator artifacts;
- maximum 16 KQL validations;
- maximum one current result analysis and one current disposition;
- maximum 256 timeline records and 128 notes;
- maximum 64 limitations;
- strings retain the stricter limit of their originating subsystem.

Imports exceeding any hard bound fail before persistence or state mutation. The design does not silently truncate authoritative content.

## Identity and revisions

- Investigation IDs use the existing case identity strategy and remain stable across export/import.
- `revision` increases exactly once per successful domain mutation.
- Artifact IDs are content-derived from canonical normalized inputs plus their artifact type.
- Timestamps record the mutation time supplied by the runtime boundary; pure functions accept an injected clock value.
- Canonical export ordering is deterministic. Set-like arrays are normalized, deduplicated, and sorted where order has no analyst meaning.
- Evidence fingerprints remain the link from downstream projections to Evidence v2.

## Dependency and staleness model

Every derived artifact stores a deterministic dependency fingerprint. The fingerprint covers only the authoritative inputs that can change that artifact.

| Change | Invalidated or marked stale |
|---|---|
| Client profile/context | relevance, hunt, KQL/result linkage, disposition, report, ServiceNow |
| Pinned observable set | hunt, disposition, report, ServiceNow |
| Evidence snapshot | hunt, result linkage, disposition, report, ServiceNow |
| Hunt package | result linkage, disposition, report, ServiceNow |
| KQL validation | result linkage when query identity changes; disposition/report/ServiceNow |
| Imported results | disposition, report, ServiceNow |
| Analyst disposition | report and ServiceNow only |
| Note | timeline/report presentation only |

Invalidated artifacts are retained for audit history only when their provenance remains bounded and their `stale` state is explicit. Current projections never consume stale artifacts. A rebuild creates a new current artifact; it does not rewrite history.

## Deterministic investigation status

`investigation status` returns one bounded projection:

- `phase`: `SCOPING | EVIDENCE | HUNT_DESIGN | EXECUTION_PENDING | RESULTS | DISPOSITION | REPORT_READY`;
- `readiness`: `BLOCKED | INCOMPLETE | READY`;
- `currentArtifacts[]`;
- `staleArtifacts[]` with exact reason codes;
- `gaps[]`;
- `nextActions[]`, selected from a fixed rule catalog;
- `exportReady` and `reportReady` booleans;
- `limitations[]`.

Status is workflow readiness, not incident severity or compromise probability. A no-results import never produces a benign disposition.

## Explicit promotion gates

Nothing crosses semantic boundaries implicitly.

- Enrichment enters the case only through existing explicit capture/pin behavior.
- Shodan and User Scanner outputs enter `operatorArtifacts[]` only through `investigation capture operator` while their source result is current.
- Operator artifacts remain contextual and cannot satisfy Evidence v2 fingerprint requirements.
- Imported query rows remain result-analysis input and cannot create Evidence v2 items.
- Analyst disposition requires an explicit command and records author-supplied conclusion, confidence, rationale, and limitations as analyst judgment.
- Report and ServiceNow generation consume only current artifacts and refuse stale required dependencies.

## Analyst disposition

The disposition vocabulary is deliberately small:

- `CONFIRMED_MALICIOUS`
- `SUSPICIOUS`
- `BENIGN_EXPLAINED`
- `NO_EVIDENCE_IDENTIFIED`
- `INCONCLUSIVE`

Required fields are `state`, `confidence`, and `rationale`. Confidence is `LOW | MEDIUM | HIGH` and is explicitly analyst-supplied. `NO_EVIDENCE_IDENTIFIED` is distinct from benign. `BENIGN_EXPLAINED` requires a rationale and at least one linked current artifact or note; the system does not infer it from empty results.

## Command contract

Existing `case` and `mission` commands remain compatible during migration. The new canonical namespace is `investigation`; alias `inv` is allowed.

```text
investigation new <title>
investigation open <id>
investigation close
investigation list
investigation show
investigation status
investigation scope set <json>
investigation observable add <type> <value>
investigation observable remove <type> <value>
investigation capture evidence
investigation capture operator
investigation relevance
investigation hunt build <json>
investigation kql validate <query>
investigation result import
investigation disposition set <json>
investigation report
investigation servicenow
investigation timeline
investigation export
investigation import
investigation clear
```

Web-only file actions use the existing explicit hidden picker/download callbacks. CLI import/result transport accepts only exact `--file <path>` or `--stdin`; stdin is never consumed implicitly. Commands that need browser persistence are unavailable on CLI unless an explicit file-backed invocation supplies the investigation bundle for that process.

## Web UX

The terminal remains the primary interface. No dashboard or card-based parallel application is introduced.

- `investigation status` renders a compact terminal section showing phase, readiness, stale dependencies, gaps, and next actions.
- Mutating commands append one concise receipt containing investigation ID, new revision, and invalidated artifacts.
- `investigation show` renders current state first and history in bounded expandable sections.
- The status line shows the active investigation ID and phase without displacing auth/profile state.
- Mobile preserves the dedicated bottom command bar and scrollable transcript.
- Screen-reader announcements report mutation success/failure and phase changes without replaying the full investigation.

## Migration and compatibility

### Case v8.1 to Investigation v2

Existing case bundles and IndexedDB records migrate in memory through a pure function:

- case identity, title, timestamps, notes, pins, snapshots, diffs, and timeline are preserved;
- mission workflow starts empty;
- migration adds a timeline record with the source format and migration version;
- no evidence or operator artifact is synthesized;
- the original record is replaced only after the migrated object passes full validation and one repository write succeeds.

### Mission Workspace v1

Standalone mission bundles remain importable into an active investigation through an explicit command. Authoritative profile/context inputs are adopted only after validation; derived mission fields are reconstructed. Conflicts require a stable error and no mutation. Existing `mission` commands remain functional for one compatibility release and are documented as standalone/volatile.

### Export/import

Investigation export is canonical JSON with a trailing newline. Import rejects unknown top-level keys, unsupported versions, duplicate identities, prototype-pollution keys, secret-bearing structural keys, malformed evidence fingerprints, unsafe URLs, invalid timestamps, stale-state forgery, and inconsistent derived projections. Derived fields are reconstructed and compared rather than trusted.

## Failure handling

- All mutations are atomic: validate and derive on a detached candidate, then persist once.
- Repository writes are serialized to prevent lost updates.
- Missing active investigation returns `INVESTIGATION_REQUIRED`.
- Stale downstream generation returns `STALE_DEPENDENCY` with bounded reason codes.
- Invalid semantic promotion returns `PROMOTION_NOT_ALLOWED`.
- Invalid or oversized imports fail before parsing deeper content where byte bounds permit.
- Browser storage failures collapse to `INVESTIGATION_STORAGE_FAILED` without exposing underlying platform text.
- Report or ServiceNow projection failure cannot corrupt investigation state.
- Enrichment/provider failure remains Evidence v2 coverage state and never becomes a negative or benign conclusion.

## Security and privacy

- Browser persistence remains same-origin IndexedDB only.
- Authentication remains volatile and outside the investigation object.
- No investigation module may call `fetch`, read environment variables, execute dynamic code, spawn a process, or submit a ticket/query.
- Operator outputs are treated as untrusted structured input and normalized under strict schemas.
- Notes and imported values render only through safe DOM text APIs.
- Exported bundles may contain research data; the UI repeats the existing prohibition on commercial-client or restricted data without suitable handling.
- Static response CSP and security headers remain enforced at deployment.

## Testing strategy

### Pure model tests

- schema acceptance/rejection and hard bounds;
- canonical identity and export determinism;
- every dependency invalidation edge;
- status phase/readiness/next-action rules;
- disposition semantic constraints;
- case and mission migration fixtures;
- tamper reconstruction and prototype-pollution rejection.

### Reducer/repository tests

- one revision and one persistence write per successful mutation;
- failed mutations leave byte-identical state;
- concurrent mutations serialize without loss;
- stale artifacts never feed current report projections;
- storage failures normalize safely.

### Shell parity tests

- registry, parser, autocomplete, help, alias, Web/CLI capability gates;
- exact file/stdin transport and byte limits;
- secret/history safety;
- mobile command-bar and transcript invariants.

### Integration tests

- observable through evidence capture, hunt, result, disposition, report, and export;
- changed evidence invalidates downstream artifacts;
- no-results remains non-benign;
- operator capture remains contextual;
- v8.1 case round-trip migration;
- deterministic ServiceNow projection without submission.

### Release verification

- complete Node and Maltego suites;
- dependency and public-release audits;
- JavaScript, shell, Python, and PowerShell syntax gates;
- Tooling smoke and CodeQL on the exact PR head and merged main SHA;
- exact-SHA production deployment;
- desktop/mobile/reduced-motion live terminal acceptance;
- credential-dependent acceptance remains separately evidenced.

## Acceptance criteria

Investigation Workspace v2 is complete only when:

1. One active investigation carries scope, evidence references, hunt, KQL validation, result analysis, disposition, and report readiness without manual JSON transfer between case and mission systems.
2. Every derived artifact has explicit authoritative dependencies and deterministic stale-state behavior.
3. No operator/result/derived content silently becomes Evidence v2.
4. Case v8.1 and Mission Workspace v1 inputs migrate or import without losing authoritative content.
5. Web and CLI expose the same applicable deterministic command semantics with explicit capability differences.
6. A portable bundle reconstructs all derived state and rejects tampering.
7. Empty results cannot produce benign state automatically.
8. Report and ServiceNow projections refuse stale required dependencies and never submit externally.
9. Existing enrichment, case, mission, report, Shodan, User Scanner, mobile, security, and evidence contracts remain green.
10. CI, deployment, and live acceptance are proven on exact source identities.

## Delivery sequence

1. Investigation schema, validator, migration, and canonical export.
2. Dependency fingerprints, reducer, and deterministic status.
3. Repository integration and case migration.
4. Shared shell commands and Web/CLI transport gates.
5. Evidence/operator capture and mission-function composition.
6. Disposition, report, and ServiceNow projections.
7. Documentation, adversarial QA, CI, deployment, and live acceptance.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
