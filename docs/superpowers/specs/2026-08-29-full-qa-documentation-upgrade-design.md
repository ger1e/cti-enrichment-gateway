# Full QA and Documentation Upgrade Design

## Goal

Perform a repository-wide QA and documentation hardening pass after completion of V8 Trains 1–6. The work must make the current implementation, tests, CI, Maltego surface, deployment state, and documentation agree with one another, and must add executable drift guards so the same classes of documentation mismatch cannot silently recur.

This is not a new numbered train and does not add a new product subsystem. It is a consolidation and truth-maintenance pass over the current PARA11AX platform.

## Current Baseline

Authoritative baseline at design time:

- protected `main`: `d076f94b2a7dfe31220bc66c2feeeecaf0f4960c`
- Train 5 Guidance + Evidence Graph: merged
- Train 6 Certificate Maltego parity: merged
- production alias: `https://para11ax.vercel.app`
- production deployment for the baseline SHA: READY
- protected-main `Tooling smoke`: passing
- CodeQL: passing

The QA pass must re-establish these facts on its own final exact head and must not treat this baseline evidence as proof of the later result.

## Existing Drift Already Identified

The initial audit found concrete documentation inconsistencies:

1. `docs/ARCHITECTURE.md` still describes only eight implemented indicator types and omits `certificate`, although the classifier/server workflow and Maltego now expose certificate SHA-256 as the ninth observable workflow.
2. `docs/EVIDENCE-SCHEMA.md` documents `decision.entityGraph` but does not document the Train 5 top-level `evidenceGraph` and `guidance` objects added to successful/partial normalized enrichment responses.
3. `CHANGELOG.md` does not record the completed V8 Train 4–6 capabilities, including local cases, Evidence Graph/Guidance, and certificate Maltego parity.
4. Current documentation relies heavily on manually repeated facts such as supported observable classes, provider count, versions, route lists, and compatibility coverage. Those duplicated facts are susceptible to drift.

The implementation plan may discover additional concrete inconsistencies. Any such defect must be recorded before modification and either fixed or explicitly documented as an accepted gap.

## Design Principles

### Source of truth over copied prose

Documentation should explain contracts, not independently redefine them. Machine-verifiable facts must be checked against canonical source/configuration where possible.

Examples:

- observable classes: classifier/workflow source
- provider inventory/count: `config/providers.json` / release manifest as appropriate
- schema versions: exported version constants
- API route set: canonical router/handler surfaces
- Maltego coverage: transform manifest plus server workflow set
- production identity: canonical `para11ax.vercel.app`

### QA evidence must name its proof boundary

The final QA report must distinguish:

- **repository-proven** — static checks/tests on an exact Git SHA
- **CI-proven** — GitHub workflow result on that exact SHA
- **deployment-proven** — Vercel metadata points to that exact SHA and deployment is READY
- **live-public-proven** — unauthenticated production routes return expected status/content
- **credential-dependent / not proven by public QA** — authenticated production readiness and provider credential health unless an authorized credential-bearing probe is actually executed

No documentation may blur these states into a single “production verified” claim.

### Commit identity is runtime evidence, not self-authored prose

A tracked Markdown file cannot safely hard-code the SHA of the commit that contains itself. `docs/QA-REPORT.md` therefore must not claim to embed its own final merge SHA. It records the immutable audit baseline, test/run identifiers where available, the verification procedure, discovered issues, and proof boundaries. The current exact repository SHA is obtained from Git/GitHub at verification time; the deployed exact SHA is obtained from Vercel metadata. Post-merge closure evidence is reported in the PR/release verification record and can be independently reproduced from those systems.

### No opportunistic product redesign

The pass must not change provider semantics, scoring, API compatibility, evidence meaning, security boundaries, UI visual design, routing model, or persistence architecture unless QA identifies a genuine correctness/security defect that cannot be fixed by documentation or tests alone.

### TDD for drift guards and behavioral fixes

Where documentation or implementation drift is machine-checkable, the first functional change is a failing test/assertion showing the mismatch. Documentation-only wording improvements that are not machine-checkable do not require artificial failing tests.

## QA Workstreams

### 1. Repository and CI QA

Verify the complete repository verification surface from a clean exact head:

- locked dependency install
- npm audit for production dependencies
- repository invariants
- public-release audit
- full Node test suite
- Maltego Python unit tests
- Python compilation
- bash syntax
- ShellCheck
- PowerShell parser checks
- release-manifest consistency
- GitHub governance verifier where permissions/environment allow a meaningful read
- CodeQL

Review GitHub workflow definitions for:

- exact-head status publication
- stale-success prevention
- cancellation/concurrency behavior
- pinned actions
- branch targeting
- minimum permissions
- timeout bounds

No hosted-runner expansion, schedules, or unnecessary CI churn are in scope.

### 2. Runtime and API Contract QA

Cross-check implementation and docs for:

- canonical indicator classifier and all nine supported workflows
- `fast`, `standard`, `full` profiles
- API route list and authentication status
- request/body limits
- batch limits
- STIX limits
- fixed-egress guarantees
- redirect behavior
- error envelope behavior
- `ok` / `partial` / `error` semantics
- Evidence Schema v2
- Evidence Graph v1.0
- Guidance v1.0
- decision support vocabulary
- separate KEV / EPSS / CVSS axes
- no universal maliciousness score
- no unsupported actor inference

Successful and partial enrichments must document and test the additive Train 5 fields. Error envelopes must remain unchanged by those projections.

### 3. Browser and Static-Surface QA

Validate source and production contracts for:

- landing page
- `/app/`
- `403.html`
- `404.html`
- `500.html`
- favicon/canonical metadata and public identity where applicable
- route configuration and compatibility aliases
- v7 source-before-paint state
- no runtime duplicate stylesheet scheduling
- no legacy first-paint mutation regressions
- mobile/desktop structural invariants already enforced by tests
- cache semantics on stable app compatibility assets

This pass may strengthen tests for discovered regressions but must not redesign the UI.

### 4. Maltego QA

Prove parity among:

- server workflow types
- `GatewayClient.SUPPORTED_INDICATOR_TYPES`
- transform imports/registration
- `transform-manifest.json`
- generated/discovered MTZ transform set
- credential boundary

All nine workflow types must have intended Maltego coverage. Certificate semantics remain explicit: raw SHA-256 `maltego.Hash` input is transported as `cert-sha256:<fingerprint>` only through the certificate transform; file-hash behavior remains unchanged.

Maltego must continue to receive only the gateway bearer, never provider credentials.

### 5. Security QA

Review the documented and executable security boundary for:

- bearer-protected routes
- public `/meta` boundary
- fixed hosts/methods/protocols
- redirect refusal
- bounded response streaming
- provider-secret isolation
- no raw provider exception reflection
- no raw IOC history in status/telemetry
- failure != negative evidence
- public-release secret scanning
- report/export formula/reference safety
- no new persistence/egress from Train 5 projection code
- Maltego credential confinement

Any wording that overstates a repository-file control as an account/repository-setting guarantee must be corrected.

## Documentation Upgrade

### README.md

Keep the README concise and operator-facing. Update it to reflect:

- nine observable workflows including certificate
- Evidence v2 + Evidence Graph v1.0 + Guidance v1.0
- local analyst cases/index/bundles where appropriate
- complete Maltego parity
- current verification model

Avoid duplicating full contracts that belong in deep docs.

### docs/ARCHITECTURE.md

Update the request path and indicator types to include:

- local case projection boundary where relevant
- top-level evidence graph/guidance projections
- certificate workflow
- distinction between decision `entityGraph`, canonical top-level Evidence Graph, and browser-local case evidence graph

### docs/API.md

Document the additive response fields for `ok`/`partial` enrichment and their absence from unchanged error envelopes. Explicitly document certificate input semantics and canonical type-matching behavior.

### docs/EVIDENCE-SCHEMA.md

Add first-class sections for:

- Evidence Graph v1.0
- Guidance v1.0
- their relationship to existing `decision`
- deterministic/stable identity and bounded output
- explicit-only relationship semantics
- semantic-diff attention inputs where applicable
- distinction from `decision.entityGraph`
- no new universal score

### docs/OPERATIONS.md

Upgrade exact-SHA QA/release instructions to include:

- documentation drift verification
- Maltego nine-workflow parity
- CodeQL as release verification even if not branch-required
- live public-surface checks
- explicit boundary between public QA and credential-bearing provider readiness

### docs/PROVIDERS.md

Verify provider count, categories, supported observable types and implemented/configured/production-verified language against canonical configuration. Do not manually claim credential readiness.

### Security documents

Review `SECURITY.md`, `docs/SECURITY-CONTROLS.md`, and `docs/THREAT-MODEL.md` for consistency with Trains 4–6 and current browser/local-case behavior. Add only materially missing controls or residual risks.

### CONTRIBUTING.md

Add or strengthen the rule that a change to canonical contracts must update both executable drift tests and relevant docs in the same PR.

### CHANGELOG.md

Record the completed v8 consolidation work without inventing semantic-version guarantees. Include at minimum:

- local case workspace/bundles/index
- canonical Evidence Graph v1.0
- Guidance v1.0
- additive gateway integration
- full nine-workflow Maltego parity including certificates
- deterministic first-paint/UI hardening where material

### maltego/README.md

Update transform list and certificate semantics. Confirm generated package/credential behavior remains accurately described.

### docs/END-TO-END-EXAMPLE.md

Upgrade the walkthrough to show current response shape and explain how an analyst should interpret decision, guidance, graph, limitations and evidence provenance without conflating them.

### QA report

Add `docs/QA-REPORT.md` as a durable current-state report. It must contain:

- audit date
- immutable audit baseline SHA
- tested surfaces and exact-SHA verification method
- discovered issues and dispositions
- repository test evidence
- CI evidence available at report-authoring time
- deployment/live evidence available at report-authoring time
- instructions for resolving the current exact Git and deployed SHAs
- explicitly unverified credential-dependent surfaces
- residual risks / deliberate gaps

It must not hard-code a self-referential “final SHA”. The report is evidence-oriented, not marketing copy.

## Drift-Prevention Tests

Add one focused documentation-contract test surface rather than many brittle prose snapshots.

Recommended file:

- `test/documentation-contracts.test.mjs`

It should verify machine-readable or tightly bounded statements, including:

1. all canonical observable types appear in the architecture/API contract section
2. certificate is included in the current supported set
3. README/documentation provider count matches canonical provider policy count
4. Evidence v2, Evidence Graph v1.0 and Guidance v1.0 are all documented
5. API route documentation covers the canonical public/protected endpoints
6. Maltego manifest coverage equals intended server workflow coverage
7. canonical production identity remains `https://para11ax.vercel.app`
8. Train 5 top-level additive fields are documented as successful/partial-only and not error fields
9. no documentation reintroduces a universal maliciousness/risk score claim

Tests should parse bounded headings/markers where possible rather than regex entire prose paragraphs. If required, add small stable documentation markers/comments whose sole role is defining machine-checkable contract sections.

Do not make documentation tests so brittle that normal wording edits require test rewrites.

## Production QA

After exact-head PR verification and merge, validate the exact merged SHA externally from the tracked QA report:

- protected `main` equals expected merge SHA
- Tooling smoke passes on that SHA
- CodeQL passes on that SHA
- Vercel production deployment metadata reports that SHA and READY state
- production alias returns HTTP 200 for `/` and `/app/`
- public `/api/para11ax/meta` returns its expected public contract
- error/static pages and route behavior are sampled as appropriate without credentials

Authenticated health/status/enrichment must only be claimed if an authorized bearer is actually used during the pass. Provider readiness must only be claimed if the authorized provider probe is executed.

## Change Management

Use one dedicated feature branch and one protected-main PR for the consolidation pass unless the diff grows beyond a reviewable size or an independent runtime defect is discovered. If a runtime defect is found that materially changes behavior, split it into a focused PR with its own TDD evidence rather than burying it inside a broad documentation diff.

Before merge:

- re-read current `main`
- compare branch to base
- ensure no unexpected concurrent changes are overwritten
- require exact PR-head Tooling smoke and CodeQL
- review changed filenames for scope/security leakage
- require no unresolved review threads
- merge with expected-head SHA

## Acceptance Criteria

The pass is complete only when all of the following are true:

- all identified documentation drift is corrected
- supported observable count/type documentation matches implementation
- Evidence Graph and Guidance contracts are fully documented
- current Maltego parity is documented and executable
- changelog reflects the completed v8 work
- drift-prevention tests fail on the old stale documentation and pass on the upgraded docs
- full repository verification passes on the exact PR head
- CodeQL passes on the exact PR head
- scope/security review is clean
- protected-main merge uses the expected tested head
- post-merge Tooling smoke passes
- post-merge CodeQL passes
- Vercel production deployment is READY on the exact merge SHA
- live public production checks pass
- `docs/QA-REPORT.md` clearly distinguishes proven from unverified states without self-referential commit claims

## Explicit Non-Goals

- no new provider
- no provider credential changes
- no arbitrary egress
- no server-side case persistence
- no UI redesign
- no new scoring model
- no LLM-generated analyst verdicts
- no semantic-versioning promise
- no unsupported production-readiness claim
- no new numbered V8 train

## Expected Outcome

After this pass, PARA11AX documentation becomes a maintained contract rather than a historical narrative: the major externally meaningful facts are either sourced from canonical code/configuration or protected by drift tests, and the QA report provides a defensible evidence trail for the repository and production state without pretending a tracked document can certify its own commit identity.