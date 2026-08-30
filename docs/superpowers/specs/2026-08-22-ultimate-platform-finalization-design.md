<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Document status:** Historical design record. Preserved for implementation history; current behavior is defined by [docs/ARCHITECTURE.md](https://github.com/ger1e/para11ax/blob/main/docs/ARCHITECTURE.md) and the current README.

# Ultimate Platform Finalization Design

## Goal

Close the remaining high-value gaps without turning the gateway into a larger distributed system. The release adds enforced release governance, one canonical provider manifest, a small cross-platform operator CLI, a deterministic report compiler with fail-closed quality gates and case diffing, a dependency lock/audit gate, and the approved negotiated custom error surface.

## Constraints

- Preserve the existing gateway API contract, evidence schema v2, provider order, scheduler ceilings, egress allowlist, secret boundary, Maltego transform surface, and fail-closed provider semantics.
- No database, queue, Kubernetes, dashboard, microservice split, universal risk score, or new analytical framework.
- Vendor secrets remain server-side only. Maltego/local clients use only `PARA11AX_TOKEN` through the existing native credential-store boundary.
- All new collections and outputs are bounded. Reports render only from a frozen evidence snapshot; renderers never re-query providers.
- Important claims must be traceable to evidence IDs or explicitly labelled inference/context. Absence is never benign evidence.
- Cross-platform support remains Windows PowerShell, macOS zsh/bash, and Linux bash/zsh.

## 1. Release governance

`main` must be PR-only with strict `Tooling smoke`, stale-review dismissal, admin enforcement, conversation resolution, linear history, no force-push, and no deletion. The existing `scripts/finalize.ps1` remains the authoritative write path and verifies protection after applying it. CI must continue to fail closed and publish status to the exact PR head SHA.

Because repository-administration mutation is not available through every automation connector, the repo also carries a read-only policy verifier. Production finalization refuses to proceed when protection is absent.

## 2. Canonical provider manifest

Create `config/providers.json` as the machine-readable source of provider identity and static policy. Each provider entry contains display name, credential env name or null, optional-credential flag, auth type, tier, cost class, supported types, observation types, semantic class hints, timeout/cache/negative-cache/max-response ceilings, fixed hosts, methods, protocols, parser version, source URL, and distribution policy where needed.

Runtime metadata loading, provider manifest exposure, environment-template verification, bootstrap secret inventory, release-manifest verification, and operator CLI all derive from or are checked against this file. Provider implementation code keeps only behavior-specific code and request parsing.

## 3. Operator control plane

Add a dependency-free Node 24 CLI at `bin/para11ax.mjs` with bounded commands:

- `para11ax doctor` — read-only repository/runtime/configuration diagnostics.
- `para11ax providers list` and `para11ax providers env-template` — manifest-driven provider inventory and secret template.
- `para11ax maltego check` — delegates to the existing cross-platform secure Maltego bootstrap check.
- `para11ax release verify` — executes repository verification without mutating deployment state.
- `para11ax report compile <snapshot.json> --out <dir> [--preset ...]` — compile frozen evidence into deterministic artifacts.
- `para11ax report diff <a.json> <b.json>` — deterministic snapshot comparison.

`para11ax setup` and `para11ax repair` remain thin dispatchers to the hardened platform-native setup paths; they never implement a second credential store.

## 4. Canonical ReportModel

A report is compiled from one frozen gateway evidence snapshot into a format-neutral `ReportModel`. Required domains are report identity, subject, executive assessment, scope, key findings, suspicious behavior watchlist, observables, threat context, relationships, timeline, framework mappings, hunt opportunities, contradictions, actions, gaps, confidence/limitations, sources/provenance, and reproducibility/integrity.

Every material claim has `evidenceIds` or an explicit mapping state of `INFERRED` or `CONTEXTUAL_NOT_OBSERVED`. Suspicious behavior uses only `OBSERVED`, `LOOK_FOR_NEXT`, and `CONTEXTUAL_NOT_OBSERVED`. ATT&CK, Kill Chain, Pyramid of Pain, and Diamond Model remain separate analytical axes.

## 5. Report quality gate

Compilation fails before rendering when any hard violation exists:

- orphan material claim;
- evidence missing provenance/provider/source semantics;
- contextual TTP represented as observed;
- unsupported attribution;
- stale evidence treated as current without limitation;
- malformed ATT&CK IDs;
- duplicate canonical observables;
- impossible timestamps;
- unsafe external references;
- secret-like values or known secret environment identifiers in output;
- invalid STIX generation;
- public-safe output containing internal-only fields.

Warnings are allowed only for explicit uncertainty/coverage gaps and are included in the report model.

## 6. Renderers and bundle

Required deterministic outputs:

- `report.html` — richest human renderer, no remote assets/scripts.
- `report.txt` — clean UTF-8 SOC/ticket rendering.
- `evidence.json` — canonical lossless snapshot copy.
- `intelligence.stix.json` — semantically strict existing STIX export where applicable.
- `observables.csv` — bounded tabular observables.
- `hunts.kql` — emitted only for defensible hypotheses already present in the model; otherwise an explanatory comment.
- `attack-navigator.json` — ATT&CK coverage layer.
- `report.pdf` — deterministic minimal archival PDF generated from the same model without network access.
- `manifest.json` — compiler/report schema versions, source/gateway/schema versions, snapshot hash, generated time supplied by caller, and SHA-256 for every artifact.

Presets: `quick`, `analyst`, `case`, `soc`, `sharing`, `evidence`, `all`. Renderers never fetch network data.

## 7. Snapshot diff

`report diff` compares canonical snapshots/report models and returns deterministic additions/removals/changes for evidence IDs, observables, provider outcomes, threat assessment state, contradictions, relationships, ATT&CK mappings, and limitations. It never invents significance; it reports structural change and confidence context.

## 8. Dependency determinism

Commit `package-lock.json` even if the runtime dependency set is empty. CI uses `npm ci`/lockfile validation and runs `npm audit --omit=dev` when a lockfile exists. No third-party package is introduced solely for reporting; HTML/TXT/JSON/CSV/KQL/Navigator/STIX and the minimal archival PDF remain implemented with Node standard-library primitives.

## 9. Custom error surface

The approved bounded design is part of this release. API/CLI callers retain JSON; browser clients requesting HTML get branded fail-closed pages. Supported status catalogue: 400, 401, 403, 404, 405, 408, 413, 415, 422, 429, 500, 502, 503, 504. Error responses include only a bounded request ID and safe code/message, use `no-store`, CSP, frame denial, nosniff, and never reflect exception text, bodies, secrets, provider configuration, or upstream URLs. Unknown `/api/para11ax/*` paths route to the controlled 404 handler.

## Acceptance

The exact PR head must pass repository invariants, dependency lock/audit validation, all Node tests, all Maltego tests, Python compile, bash/zsh/ShellCheck, PowerShell syntax, Linux/macOS/Windows jobs, Vercel preview, report fixture determinism, secret/public-release audit, and final security diff review. Merge uses the exact verified head SHA; production is accepted only after exact-main Vercel `READY`, `/api/para11ax/meta` 200, protected unauthenticated endpoints 401/no-store, custom browser 401 and unknown-route 404 behavior, and zero new runtime error clusters.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
