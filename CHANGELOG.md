### Changelog

All notable repository changes should be recorded here. This project uses a lightweight chronological changelog rather than claiming semantic-versioning guarantees for personal lab workflows.

#### Unreleased

##### Added

- Native bounded Shodan analyst-shell surface with authenticated `shodan host`, `shodan search`, `shodan count`, `shodan stats`, `shodan domain`, and `shodan info` commands through same-origin `POST /api/para11ax/shodan`.
- Fixed Shodan shell egress to `https://api.shodan.io` with server-side-only `SHODAN_API_KEY`, first-page-only search, capped normalized results, raw banner stripping, disabled `download`/arbitrary paging, and explicit query-credit impact.
- First-class `docs/SHODAN-SHELL.md` operator guide plus README, landing, API, architecture, providers, operations, security controls, threat model, security policy, QA/release, and documentation-contract synchronization for the Shodan surface.
- V8 Train 4 browser-local case workspace with IndexedDB persistence, bounded `.para11ax` bundles, snapshots/semantic diffs, exact typed cross-case index and local case graph projection.
- V8 Train 5 canonical Evidence Graph v1.0 and Guidance v1.0 projections, additively attached to normalized `ok`/`partial` enrichments without replacing the existing decision contract or error envelopes.
- V8 Train 6 certificate Maltego parity across all nine gateway workflow types, with `EnrichCertificate` preserving explicit `cert-sha256:` semantics separately from file-hash transforms.
- Executable documentation-contract drift checks for canonical workflow types, provider count, API routes, evidence projection versions, Maltego coverage, production identity, v8 capabilities, User Scanner, and native Shodan shell facts.
- Evidence-oriented QA report and proof-state model separating repository, CI, deployment, live-public and credential-dependent verification.
- Public-release safety audit and publication checklist.
- Architecture, trust-boundary, security-control, governance, contribution, and issue/PR documentation.
- Dependency-free `para11ax` operator CLI for doctor, provider inventory/environment templates, setup/repair, Maltego checks, release verification and frozen-snapshot report compile/diff workflows.
- Canonical provider manifest used as policy source for provider metadata, credential inventory and distribution classification.
- Deterministic frozen-snapshot intelligence reporting with HTML, PDF, text, JSON, STIX 2.1, CSV, KQL and ATT&CK Navigator artifacts plus SHA-256 manifests.
- Read-only GitHub governance verifier and branded browser-safe HTTP error pages.

##### Changed

- Analyst-shell documentation now distinguishes three separate paths: canonical Evidence v2 enrichment, isolated User Scanner active OSINT, and bounded native Shodan operator lookups. Shodan shell output leaves the current Evidence v2 result unchanged.
- Landing-page terminal/capability surfaces now show the six Shodan commands, fixed egress, server-side key boundary, credit behavior and disabled bulk download directly.
- Completed the breaking PARA11AX identity migration across repository/package metadata, CLI, bearer/env names, API paths, Maltego properties, GitHub links and `https://para11ax.vercel.app`; legacy aliases remain unsupported.
- Hardened the landing/analyst UI first-paint path so source-final content and one deterministic stylesheet cascade own initial presentation.
- Expanded the canonical observable surface to nine bounded workflows: IP, domain, URL, file hash, CVE, ATT&CK, ASN, CIDR and explicit certificate SHA-256.
- Documentation distinguishes `decision.entityGraph`, top-level Evidence Graph v1.0 and browser-local case graph.
- npm dependency state is lockfile-backed; CI performs deterministic install/audit.
- Report generation is offline-only, bounded and deterministic for a frozen evidence snapshot and supplied generation timestamp.
- Error content negotiation and unexpected-handler telemetry remain fail-closed/correlation-safe.

##### Security

- Shodan shell accepts only the approved six commands, rejects caller-selected URLs/methods/pages/credentials, exposes no on-demand scan submission, keeps `SHODAN_API_KEY` server-side, and surfaces rate/credit state without converting failures into negative Evidence v2.
- Shodan search is first-page only; result/service arrays are bounded; large raw service banners are removed before browser rendering; `shodan download` is disabled.
- Shodan service/exposure context is explicitly excluded from automatic maliciousness, compromise, ownership and attribution claims; native operator output is not silently promoted into Evidence v2/case/STIX/graph state.
- Browser-local cases remain IndexedDB-only; active case/auth state is runtime-only and the workspace adds no server-side IOC history.
- Evidence Graph/Guidance projection modules add no provider egress, secret lookup, dependency or persistence surface.
- Certificate Maltego parity changes only explicit client transport semantics and does not expose provider credentials or reinterpret bare file hashes.
- Public publication remains a separate review event; file-based controls complement external GitHub/Vercel account settings.
- Raw report snapshots are secret-scanned; sharing presets fail closed on restricted/unknown distribution; CSV exports neutralize formula prefixes; report quality gates reject unsafe claims/provenance/attribution/timestamps/references.
- Governance verification requires strict `Tooling smoke`, PR-only changes, stale-review dismissal, administrator enforcement, linear history, resolved conversations and disabled force-push/deletion.

#### 1.0.0

Initial personal-research implementation of the read-only PARA11AX gateway, bounded Maltego client, provider normalization layer, CI verification and Vercel bootstrap/deployment workflow.