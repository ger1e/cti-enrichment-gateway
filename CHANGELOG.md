### Changelog

All notable repository changes should be recorded here. This project uses a lightweight chronological changelog rather than claiming semantic-versioning guarantees for personal lab workflows.

#### Unreleased

##### Added

- V8 Train 4 browser-local case workspace with IndexedDB persistence, bounded `.para11ax` bundles, snapshots/semantic diffs, exact typed cross-case index and local case graph projection.
- V8 Train 5 canonical Evidence Graph v1.0 and Guidance v1.0 projections, additively attached to normalized `ok`/`partial` enrichments without replacing the existing decision contract or error envelopes.
- V8 Train 6 certificate Maltego parity across all nine gateway workflow types, with `EnrichCertificate` preserving explicit `cert-sha256:` semantics separately from file-hash transforms.
- Executable documentation-contract drift checks for canonical workflow types, provider count, API routes, evidence projection versions, Maltego coverage, production identity and v8 changelog coverage.
- Evidence-oriented QA report and proof-state model separating repository, CI, deployment, live-public and credential-dependent verification.
- Public-release safety audit for blocked artifacts, common high-confidence credential patterns and optional forbidden terms.
- Public-release checklist for secrets, licensing, restricted data, Git history and sanitized extraction.
- Architecture and trust-boundary documentation.
- Security-control matrix covering implemented and settings-dependent controls.
- GitHub governance layer: CODEOWNERS, contribution guidance, pull-request template and structured issue forms.
- Dependency-free `para11ax` operator CLI for doctor, provider inventory/environment templates, setup/repair, Maltego checks, release verification and frozen-snapshot report compile/diff workflows.
- Canonical provider manifest used as the policy source for provider metadata, credential inventory and distribution classification.
- Deterministic frozen-snapshot intelligence reporting with HTML, PDF, text, JSON, STIX 2.1, CSV, KQL and ATT&CK Navigator artifacts plus SHA-256 integrity manifests.
- Read-only GitHub governance verifier for the required `main` branch-protection contract.
- Branded browser-safe HTTP error pages while preserving JSON error semantics for API, CLI and Maltego callers.

##### Changed

- Completed the breaking PARA11AX identity migration across repository/package metadata, the `para11ax` CLI, `PARA11AX_TOKEN` / `PARA11AX_URL`, `/api/para11ax/*`, `para11ax-local.mtz`, Maltego properties, GitHub links and `https://para11ax.vercel.app`; legacy aliases are intentionally unsupported.
- Hardened the v7 landing/analyst UI first-paint path so source-final content and one deterministic render-blocking stylesheet cascade own initial presentation; post-start stylesheet marker scheduling and legacy first-paint mutations were removed.
- Expanded the canonical observable surface to nine bounded workflows: IP, domain, URL, file hash, CVE, ATT&CK, ASN, CIDR and explicit certificate SHA-256.
- Documentation now distinguishes `decision.entityGraph`, top-level Evidence Graph v1.0 and the browser-local case graph instead of treating them as one graph contract.
- npm dependency state is lockfile-backed and CI performs deterministic `npm ci --ignore-scripts` plus `npm audit --omit=dev`.
- Report generation is offline-only, bounded and deterministic for a frozen evidence snapshot and supplied generation timestamp.
- Error content negotiation honors media-type quality values and defaults safely to JSON on ties, wildcards and absent `Accept` headers.
- Unexpected handler failures emit correlation-safe telemetry without reflecting exception text or indicators.

##### Security

- Browser-local cases remain IndexedDB-only; active case/auth state is runtime-only and the workspace adds no server-side IOC history or direct network persistence path.
- Evidence Graph/Guidance projection modules add no provider egress, secret lookup, dependency or persistence surface.
- Certificate Maltego parity changes only explicit client transport semantics and does not expose provider credentials or reinterpret bare file hashes.
- Public publication is explicitly treated as a separate review event rather than a repository-visibility change.
- File-based controls are documented as complementary to GitHub account/repository settings such as rulesets, required checks, secret scanning and signed-commit enforcement.
- Raw report snapshots are scanned for secret material before any artifact is written.
- Sharing-report presets fail closed when evidence is internal, internal-only or from an unknown provider distribution class.
- CSV exports neutralize spreadsheet formula prefixes before quoting/serialization.
- Report quality gates reject orphan material claims, missing provenance, malformed ATT&CK mappings, contextual-as-observed claims, unsupported attribution, unsafe references, duplicate observables, impossible timestamps and stale evidence represented as current without a limitation.
- Governance verification requires strict `Tooling smoke`, PR-only changes, stale-review dismissal, administrator enforcement, linear history, resolved review conversations and disabled force-push/deletion.

#### 1.0.0

Initial personal-research implementation of the read-only PARA11AX gateway, bounded Maltego client, provider normalization layer, CI verification and Vercel bootstrap/deployment workflow.
