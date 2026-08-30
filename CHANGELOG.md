<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
### Changelog

All notable repository changes should be recorded here. This project uses a lightweight chronological changelog rather than claiming semantic-versioning guarantees for personal lab workflows.

#### Unreleased

##### Added

- **Provider Value Scheduler v1.0** with deterministic static execution ordering over already-admitted providers. The current 24-provider IP workflow remains unchanged, with a 48-call ceiling, max concurrency 4, maximum two attempts/provider and 20-second request deadline.
- Declarative scheduler metadata for provider authority, semantic uniqueness, direct threat value, pivot value, latency and cost classes, with deterministic fallback and public capability projection that excludes credentials/internal runtime rank state.
- **Intelligence Kernel v1.0** IP reference projection for deterministic evidence strength, source diversity/independence, corroboration, contradiction severity, temporal relevance, explicit relationship value, bounded one-hop pivots, threat context, hunt relevance, capability-aware coverage impact, analyst priority, limitations and trace rule IDs.
- Kernel-aware Decision Support mapping with guarded legacy fallback for absent/malformed/wrong-version/wrong-type intelligence.
- Bounded Intelligence Kernel summary in Guidance while Evidence Graph fingerprint validation remains authoritative.
- Kernel-backed IP analyst report using one shared deterministic model for executive assessment, relationships/pivots, contradiction severity, temporal context, hunt relevance, coverage and copy/text output.
- Compatibility locks keeping Evidence v2 authoritative, Evidence Graph/STIX isolated from Kernel-derived conclusions, legacy/cached envelopes valid, and deterministic outputs permutation-safe.
- Repository-wide **GER1E/PARA11AX documentation standard v1** across every tracked Markdown surface: shared standard marker/footer, current terminology and proof-state vocabulary, GER1E-normalized README sizing, supporting README/template parity, and explicit historical-status banners on preserved Superpowers plans/specs.
- GER1E-normalized README sizing contract: 720px SVG family, 102px hero mark, 22px headings, 17px body, 15px microtype, 13/12px hero rain, and full-width 720×300 terminal footer with `PER ASPERA AD ASTRA`.
- Native bounded Shodan analyst-shell surface with authenticated `shodan host`, `search`, `count`, `stats`, `domain`, and `info` commands through same-origin `POST /api/para11ax/shodan`.
- Fixed Shodan shell egress to `https://api.shodan.io` with server-side-only `SHODAN_API_KEY`, first-page-only search, capped normalized results, raw banner stripping, disabled `download`/arbitrary paging, and explicit query-credit impact.
- V8 Train 4 browser-local case workspace with IndexedDB persistence, bounded `.para11ax` bundles, snapshots/semantic diffs, exact typed cross-case index and local case graph projection.
- V8 Train 5 canonical Evidence Graph v1.0 and Guidance v1.0 projections.
- V8 Train 6 certificate Maltego parity across all nine gateway workflow types with explicit `cert-sha256:` semantics.
- Executable documentation-contract drift checks for workflow types, provider count, scheduler/Kernel contracts, API routes, evidence projection versions, Maltego coverage, production identity, User Scanner, Shodan shell, README visual sizing, and repository-wide Markdown standardization.
- Evidence-oriented QA report and proof-state model separating repository, CI, deployment, live-public and credential-dependent verification.
- Public-release safety audit/checklist, architecture/trust-boundary/security-control docs, contribution guidance and operator CLI/report workflows.

##### Changed

- Public README and all current deep docs now describe the merged deterministic Scheduler/Kernel architecture instead of the retired provider-order wording.
- Every tracked Markdown document now uses the same GER1E/PARA11AX standard; historical Superpowers plans/specs retain their original technical record but are explicitly labeled historical and point to the current architecture.
- Evidence v2 remains the authoritative provider-normalized record; Intelligence Kernel output is explicitly documented as derived context rather than new evidence.
- Provider execution ordering is now separated from profile admission. Scheduler priority cannot broaden provider membership or use earlier evidence to suppress admitted sources.
- IP reporting, Decision Support and Guidance consume a compatible Intelligence Kernel v1.0 projection while preserving established fallbacks.
- Documentation distinguishes four relationship/graph surfaces: Evidence v2 relationships, Kernel derived relationship/pivot context, `decision.entityGraph`, canonical Evidence Graph v1.0, plus the separate browser-local case graph.
- Analyst-shell documentation distinguishes canonical Evidence v2 enrichment, isolated User Scanner active OSINT, and bounded native Shodan operator lookups. Shodan shell output leaves Evidence v2 / Kernel state unchanged.
- Completed the PARA11AX identity migration across repository/package metadata, CLI, bearer/env names, API paths, Maltego properties, GitHub links and `https://para11ax.vercel.app`; legacy aliases remain unsupported.
- Hardened landing/analyst UI first-paint behavior and expanded the canonical observable surface to nine bounded workflows: IP, domain, URL, file hash, CVE, ATT&CK, ASN, CIDR and explicit certificate SHA-256.
- npm dependency state is lockfile-backed; CI performs deterministic install/audit.
- Report generation remains offline-only, bounded and deterministic for a frozen gateway snapshot and supplied generation timestamp.

##### Security

- Provider Value Scheduler v1.0 changes only deterministic attempt order among admitted providers; it adds no provider, host, credential, method, protocol or evidence-dependent suppression path.
- Intelligence Kernel v1.0 is deterministic/read-only and adds no network egress, secret/environment read, dependency or persistence surface. It uses no LLM, runtime learning or universal maliciousness score.
- Kernel projection failure is isolated: usable Evidence v2 survives and the missing projection is surfaced as an explicit limitation.
- Provider failures/skips remain coverage facts; capability-aware coverage impact never converts unavailable sources into benign/negative threat evidence.
- Kernel pivots are explicit one-hop normalized relationships only; free text cannot manufacture related infrastructure; Evidence Graph/STIX do not promote Kernel-derived conclusions as new evidence.
- Shodan shell accepts only six approved commands, rejects caller-selected URLs/methods/pages/credentials, exposes no on-demand scan submission, keeps `SHODAN_API_KEY` server-side, and surfaces rate/credit state without converting failures into negative Evidence v2.
- Shodan search is first-page only; result/service arrays are bounded; large raw service banners are removed; `shodan download` is disabled.
- Browser-local cases remain IndexedDB-only; active case/auth state is runtime-only and the workspace adds no server-side IOC history.
- Public publication remains a separate review event; file-based controls complement external GitHub/Vercel account settings.
- Raw report snapshots are secret-scanned; sharing presets fail closed on restricted/unknown distribution; CSV exports neutralize formula prefixes; report quality gates reject unsafe claims/provenance/attribution/timestamps/references.

##### Verification note — 2026-08-30

Provider Value Scheduler v1.0 + Intelligence Kernel v1.0 merged as `11d7b861d9f626c45f44c138c8d72cee9493efdf` and passed Tooling smoke 1374 plus CodeQL 962. Vercel then rejected the production deployment on a Hobby-plan build/deployment rate limit; the latest READY production at that audit point remained `2acc19f0558b1c3bbbcd96b47b8da69a25192c55`. Repository/CI proof therefore did not equal production deployment proof, and authenticated protected enrichment was not claimed as exercised.

#### 1.0.0

Initial personal-research implementation of the read-only PARA11AX gateway, bounded Maltego client, provider normalization layer, CI verification and Vercel bootstrap/deployment workflow.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
