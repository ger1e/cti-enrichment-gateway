# PARA11AX QA Report

## Scope and audit baseline

Audit date: 2026-08-29.

This report covers the repository-wide QA and documentation consolidation performed after V8 Trains 1–6. It is evidence-oriented: it distinguishes what repository source proves from what CI, deployment metadata, live public HTTP checks, or credential-bearing probes prove.

Audit baseline before this QA branch:

- protected `main`: `d076f94b2a7dfe31220bc66c2feeeecaf0f4960c`
- V8 Train 5 Guidance + Evidence Graph: merged
- V8 Train 6 certificate Maltego parity: merged
- baseline production deployment: READY on the baseline SHA
- baseline protected-main Tooling smoke and CodeQL: passing

A tracked Markdown file cannot safely hard-code the SHA of the commit that contains itself. Therefore this report does **not** claim to embed its own final merge SHA. Reproduce exact current repository identity from GitHub and exact deployed identity from Vercel metadata as described below.

## Proof-state definitions

- **Repository-proven:** static source/tests executed for one exact Git tree/SHA.
- **CI-proven:** a GitHub workflow completed successfully for one exact SHA.
- **Deployment-proven:** Vercel reports a deployment in `READY` state whose `githubCommitSha` equals the expected exact SHA.
- **Live-public-proven:** public unauthenticated routes return the expected status/content from the accepted deployment.
- **Credential-dependent / not proven by public QA:** authenticated health/status, secret configuration and provider readiness unless an authorized bearer/provider probe is actually executed.

These states are intentionally not interchangeable.

## Findings and dispositions

### QA-001 — architecture omitted the certificate workflow

**Proof:** the baseline `docs/ARCHITECTURE.md` listed only `ip`, `domain`, `url`, `hash`, `cve`, `attack`, `asn`, and `cidr`, while `src/workflows.js` defined a ninth `certificate` workflow.

**RED evidence:** PR #156 Tooling smoke #1148 failed `architecture and API document all canonical workflow types` with `architecture workflow contract: missing \`certificate\``.

**Disposition:** fixed in documentation; executable documentation-contract test added.

### QA-002 — Evidence Graph/Guidance top-level response contracts were undocumented

**Proof:** baseline `docs/EVIDENCE-SCHEMA.md` documented `decision.entityGraph` but not the top-level Train 5 `evidenceGraph` and `guidance` objects present on normalized `ok`/`partial` enrichments.

**RED evidence:** Tooling smoke #1148 failed `current evidence projection versions are first-class documented contracts` with `missing Evidence Graph v1.0`.

**Disposition:** fixed with first-class Evidence Graph v1.0 and Guidance v1.0 sections, explicit error-envelope boundary, and distinction from `decision.entityGraph` and browser-local case graph.

### QA-003 — Maltego documentation lagged Train 6 and overstated hosted CI topology

**Proof:** baseline `maltego/README.md` omitted `EnrichCertificate`/`cert-sha256:` semantics and described cross-platform hosted CI on Ubuntu/macOS/Windows, while the authoritative `Tooling smoke` workflow is one bounded Ubuntu job that additionally parses/validates platform-specific installer code.

**RED evidence:** Tooling smoke #1148 failed `Maltego documentation covers every canonical workflow and certificate transport semantics`.

**Disposition:** fixed. Maltego docs now list all nine workflow types, separate certificate/file-hash transform semantics, and the actual Ubuntu CI topology.

### QA-004 — changelog did not record V8 Trains 4–6

**Proof:** baseline `CHANGELOG.md` lacked local cases/index/bundles, Evidence Graph v1.0, Guidance v1.0 and certificate Maltego parity.

**RED evidence:** Tooling smoke #1148 failed `changelog records completed v8 consolidation capabilities` with `missing local case`.

**Disposition:** fixed; drift guard added for the major externally meaningful v8 capabilities.

### QA-005 — contribution/security prose contained stale repository-state language

**Proof:** baseline `CONTRIBUTING.md` described the repository as private even though GitHub reports it public. Security-control prose also referred to CodeQL availability for a private repository.

**Disposition:** fixed. Documentation now treats the repository as public and explicitly states that repository files cannot prove external GitHub/Vercel account settings.

### QA-006 — public/operator docs under-described current local/projection boundaries

**Proof:** README/deep docs had partial post-v8 coverage and did not clearly separate decision-local graph, canonical Evidence Graph, browser-local case graph, Guidance, and server/local persistence boundaries.

**Disposition:** fixed without runtime changes.

## Repository/static verification

The initial RED QA run on PR #156 demonstrated that the repository was healthy outside the intentionally failing documentation checks:

- deterministic npm install/audit: 0 vulnerabilities
- repository invariants: passed
- release manifest consistency: passed
- public-release audit: passed for 424 tracked files at the RED head
- Node suite: 678 tests total, 674 passed, 4 intentional documentation-contract failures
- the four failures were exactly QA-001 through QA-004 above

The final candidate must rerun the complete repository gate after all documentation/report changes. Current status must be read from PR #156 checks rather than inferred from this historical RED evidence.

## CI verification

Authoritative CI surfaces:

- `Tooling smoke` — branch-required exact-head status; one bounded Ubuntu job; dependency audit, repository checks, Node tests, Maltego Python tests, Python compile, shell/ShellCheck, PowerShell parsing.
- CodeQL — separate JavaScript/TypeScript static analysis; required by the PARA11AX QA/release procedure even when not listed as a protected-branch required context.

RED run recorded for reproducibility:

- PR #156 Tooling smoke #1148 — expected failure caused only by the new documentation drift checks.

For closure, verify the **current exact PR head** has both Tooling smoke and CodeQL passing, then verify the **exact merged main SHA** has fresh push runs passing. Do not reuse an earlier green run after the head changes.

## Deployment and live-public verification

After merge, accept production only when:

1. GitHub reports the expected exact `main` SHA.
2. Vercel production deployment metadata reports the same `githubCommitSha` and `READY` state.
3. `https://para11ax.vercel.app/` returns HTTP 200.
4. `https://para11ax.vercel.app/app/` returns HTTP 200.
5. public `GET /api/para11ax/meta` returns the expected public static contract.
6. representative public static/error routing behaves as documented.

Deployment/live results belong to the post-merge closure record because editing this tracked report after every deployment would create a new commit and invalidate the exact-SHA evidence it tried to describe.

## Credential-dependent surfaces not proven here

Unless an authorized bearer/provider secret environment is explicitly used during the QA pass, the following remain **not proven by public QA**:

- authenticated `/api/para11ax/health`
- authenticated `/api/para11ax/status`
- actual production provider secret configuration
- credentialed provider enrichment health
- provider quota/account status
- complete `para11ax providers probe --all` readiness

Not proven is not equivalent to failed, healthy, configured or unconfigured.

## Residual risks and deliberate gaps

- Upstream sources can be semantically wrong while syntactically valid.
- Provider coverage/quota/auth state changes independently of repository source.
- Browser-local case data is durable inside the browser profile and can be exposed by local profile compromise.
- Repository documentation tests protect bounded canonical facts, not every prose nuance.
- GitHub branch protection, account security, secret scanning and Vercel project settings are external state and require API/settings verification when those claims matter.
- No TLS/JA3 workflow without a bounded source that passes the source gate.
- No active scanning, detonation, submission, malware/sample download, remediation, arbitrary proxying or server-side case database.
- No universal maliciousness score.

## Reproduction checklist

From a clean exact checkout:

```bash
npm ci --ignore-scripts
npm audit --omit=dev
npm run check
cd maltego
python3 -m unittest discover -s tests -v
cd ..
python3 -m compileall -q maltego
```

Then verify externally:

```text
GitHub exact main SHA
GitHub Tooling smoke result for that SHA
GitHub CodeQL result for that SHA
Vercel production deployment githubCommitSha + READY state
public root/app/meta HTTP behavior
```

When authorized credential-bearing verification is required, run the protected health/status smoke set and `para11ax providers probe --all` from the approved operator environment. Never reinterpret missing credentials, provider errors, rate limits or feed absence as benign evidence.
