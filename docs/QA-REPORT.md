<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
# PARA11AX QA Report

## Scope and audit baseline

Audit date: 2026-09-02.

This report covers the current repository, browser surfaces, deterministic intelligence runtime, Maltego integration, CI controls, deployment metadata, public production behavior, and static-response security boundary. Repository source, CI, deployment metadata, live public checks, and credential-bearing probes remain separate proof states.

The audited protected-`main` baseline is:

```text
bfb8bd03c410ab2d0e15d3c64fbb2747730d9503
```

External verification on that exact SHA:

```text
Tooling smoke — PASS
Vercel para11ax — READY / PASS
Vercel user-scanner — PASS
```

The accepted PARA11AX production deployment is:

```text
dpl_538ViS14ukerEUYWBDkX9EPF4NX2
```

Vercel reports that deployment as `READY`, production-targeted, and sourced from the exact audited SHA. Live browser QA exercised the landing page, app boot, boot skip/handoff, terminal help, and public provider discovery without application-origin console errors. Vercel reported no grouped runtime errors for the PARA11AX or User Scanner projects over the preceding seven days. Authenticated protected enrichment was not exercised because this audit did not use bearer or provider credentials.

Local verification on the audited tree completed 1,011 Node tests, 66 Maltego unit tests, Python compilation, repository invariants, the dependency audit, and the public-release audit. The local environment did not include ShellCheck, so the aggregate `npm run check` wrapper stopped at that preflight; the exact-main Tooling smoke status independently passed the ShellCheck-bearing CI gate.

Historical Scheduler/Kernel closure remains recorded for traceability: `11d7b861d9f626c45f44c138c8d72cee9493efdf`, Tooling smoke 1374 — PASS, CodeQL 962 — PASS, while production was still `2acc19f0558b1c3bbbcd96b47b8da69a25192c55` under the earlier deployment-rate limit. Those values are evidence for the 2026-08-30 checkpoint, not the current deployment state above.

## Proof-state definitions

- **Repository-proven:** static source/tests executed for one exact Git tree/SHA.
- **CI-proven:** a GitHub workflow completed successfully for one exact SHA.
- **Deployment-proven:** Vercel reports a deployment in `READY` state whose `githubCommitSha` equals the expected exact SHA.
- **Live-public-proven:** public unauthenticated routes return expected status/content from the accepted deployment.
- **Credential-dependent / not proven by public QA:** authenticated health/status, provider secret configuration, User Scanner wiring, `SHODAN_API_KEY` configuration, Shodan account/credit state, and credentialed upstream readiness unless an authorized check actually executes.

These states are intentionally not interchangeable.

## Current architecture QA contract

### Provider Value Scheduler v1.0

The implementation and documentation must agree that:

- provider admission remains fixed by workflow/profile;
- the Scheduler deterministically orders already-admitted providers;
- the current IP reference path is a **24-provider IP workflow**;
- the IP **48-call ceiling** remains 24 × maximum two attempts;
- max provider concurrency remains 4;
- request deadline remains 20 seconds;
- no evidence-dependent source suppression is allowed;
- malformed/missing scheduler descriptors fall back deterministically;
- scheduler metadata does not add hosts, credentials, methods or a threat score.

### Intelligence Kernel v1.0

The implementation and documentation must agree that:

- Kernel output is deterministic derived context, not Evidence v2;
- Evidence v2 remains authoritative;
- current reference policy is IP-first;
- source diversity distinguishes independent corroboration from duplicate capability;
- contradictions stay explicit and carry severity;
- temporal relevance uses observation timestamps rather than retrieval time;
- relationships/pivots are explicit, stable and bounded to one hop;
- provider failures/skips become coverage impact only, never benign/negative threat evidence;
- Decision Support consumes a compatible Kernel projection with guarded legacy fallback;
- Evidence Graph remains isolated from Kernel-derived relationships;
- Guidance exposes only a bounded Kernel summary with existing evidence-fingerprint validation;
- IP structured/copy report output consumes the same Kernel-backed model;
- no new network, credential/environment, persistence or dependency surface exists;
- no LLM, runtime learning or universal maliciousness score exists.

## Findings and dispositions

### QA-001 — architecture omitted the certificate workflow

**Disposition:** fixed. Documentation and executable checks cover all nine Evidence v2 workflow types.

### QA-002 — Evidence Graph/Guidance contracts were under-documented

**Disposition:** fixed with first-class projection documentation and explicit error-envelope boundaries.

### QA-003 — Maltego documentation lagged certificate parity and CI topology

**Disposition:** fixed. Maltego covers all nine workflow types, explicit `cert-sha256:` transport, and bounded Ubuntu Tooling smoke topology.

### QA-004 — changelog lagged major V8 capabilities

**Disposition:** fixed and covered by drift checks.

### QA-005 — contribution/security prose contained stale repository-state language

**Disposition:** fixed. Repository files distinguish governance intent from external GitHub/Vercel state.

### QA-006 — public/operator docs under-described graph/local-state boundaries

**Disposition:** fixed by separating decision-local graph, canonical Evidence Graph, browser-local case graph, Guidance and persistence boundaries.

### QA-007 — Shodan runtime existed before public/operator documentation caught up

**Disposition:** fixed. README, landing, API, architecture, providers, operations, security controls, threat model, security policy, changelog, QA/release guidance and dedicated `docs/SHODAN-SHELL.md` describe the bounded six-command Shodan surface and Evidence v2 isolation.

### QA-008 — Provider Scheduler / Intelligence Kernel merged before public docs were current

**Proof:** merge `11d7b861d9f626c45f44c138c8d72cee9493efdf` introduced deterministic scheduling and Intelligence Kernel v1.0, while the public README/deep docs still described the older provider-order/correlation path and architecture artwork still used retired scheduler wording.

**RED evidence:** documentation-normalization PR #182 added `test/docs-current-ger1e-normalization.test.mjs` before public-doc changes. Tooling smoke run 1400 reached 835 Node tests with 830 passing and exactly five new documentation/GER1E contract tests failing. Existing runtime tests remained green; failures were limited to the missing full-width footer, stale README/architecture/provider content and missing Kernel/security documentation.

**Disposition:** fixed. The public documentation and README SVG family now describe the Scheduler/Kernel architecture using the GER1E 720px / 102-22-17-15 / 13-12 sizing system, with executable drift checks in the Node suite.

### QA-009 — static browser responses lacked an explicit security-header policy

**Proof:** the live root response exposed HSTS but no explicit CSP, clickjacking, MIME-sniffing, referrer, cross-origin isolation, or permissions policy. API JSON already applied its own response controls, leaving the HTML/static boundary inconsistent.

**Disposition:** fixed at the Vercel deployment boundary with one global policy covering landing, app, assets, and branded error pages. The policy constrains scripts, connections, objects, framing, forms, referrers, cross-origin embedding, and browser device capabilities. A regression test parses the deployable configuration and requires the complete policy.

## Shodan shell QA contract

Public/operator documentation must continue to agree on:

```text
shodan host <ip>
shodan search <query>
shodan count <query>
shodan stats <query> [--facets <fields>]
shodan domain <domain>
shodan info
```

- browser path: same-origin authenticated `POST /api/para11ax/shodan`;
- upstream origin: fixed `https://api.shodan.io`;
- credential: server-side-only `SHODAN_API_KEY`;
- no arbitrary URL/host/method/page/endpoint selection;
- no Shodan on-demand scan submission;
- `shodan download` disabled;
- search first-page only;
- host/search result arrays bounded and large raw banners removed;
- host/count/stats/info: no-query-credit classification;
- domain: consumes a query credit;
- search: may consume a query credit;
- native Shodan operator output leaves Evidence v2 / Intelligence Kernel state unchanged.

## README/brand QA contract

README presentation is normalized to the GER1E profile README geometry while keeping PARA11AX colors/identity:

- all README panels 720px wide;
- hero `720 × 360`;
- hero primary mark 102px;
- hero rain 13px / 12px;
- panel headings 22px;
- panel body 17px;
- microtype 15px;
- architecture `720 × 760`;
- semantics `720 × 820`;
- terminal footer `720 × 300`;
- old 16px PARA11AX panel-body tier retired;
- footer contains `PER ASPERA AD ASTRA`;
- README text remains exact/searchable so SVG art never becomes the only documentation source.

## Repository/static verification

Final candidates must run the complete repository gate:

```bash
npm ci --ignore-scripts
npm audit --omit=dev
npm run check
cd maltego
python3 -m unittest discover -s tests -v
cd ..
python3 -m compileall -q maltego
python3 -m compileall -q workers/user-scanner
```

## CI verification

Authoritative CI surfaces:

- `Tooling smoke` — branch-required exact-head status; bounded Ubuntu job covering dependency audit, repository checks, Node tests, Maltego Python tests, Python compile, shell/ShellCheck and PowerShell parsing.
- `CodeQL` — separate JavaScript/TypeScript analysis, required by PARA11AX QA/release procedure.

For closure, verify the **current exact PR head** has both passing, then verify the accepted merge/main tree has fresh push runs. Do not reuse an earlier green run after the head changes.

## Deployment and live-public verification

After merge, accept production only when:

1. GitHub reports the expected exact `main` SHA.
2. Vercel production deployment metadata reports the same `githubCommitSha` and `READY` state.
3. public root/app/meta endpoints return the expected build.
4. if the release contains the Kernel, live source/authorized API output demonstrates that exact deployed source rather than the previous READY build.

A build-rate/deployment-rate limit is a failed deployment attempt. It does not invalidate green repository CI, but it also does not make the new code live.

## Credential-dependent surfaces not proven by public QA

Unless an authorized bearer/provider-secret environment is explicitly used, the following remain **not proven by public QA**:

- authenticated `/api/para11ax/health`;
- authenticated `/api/para11ax/status`;
- production provider secret configuration;
- credentialed provider enrichment health;
- User Scanner worker wiring;
- `SHODAN_API_KEY` production configuration;
- Shodan account plan/credits/rate state and production shell readiness;
- protected live IP enrichment producing Intelligence Kernel v1.0 on the exact deployment;
- complete `para11ax providers probe --all` readiness.

Not proven is not equivalent to failed, healthy, configured, or unconfigured.

## Residual risks and deliberate gaps

- Upstream sources can be semantically wrong while syntactically valid.
- Provider/Shodan coverage, quota, auth and rate state can change independently of source.
- Deterministic Kernel rules can still encode an imperfect analyst policy; traceability/versioning makes that reviewable rather than infallible.
- Browser-local case data is durable inside the browser profile and can be exposed by local profile compromise.
- Documentation tests protect bounded canonical facts, not every prose nuance.
- GitHub/Vercel settings are external state requiring API/settings verification when those claims matter.
- No TLS/JA3 workflow without a bounded source that passes the source gate.
- No LLM, malware detonation/submission/download, credential testing, remediation, arbitrary proxying, arbitrary shell execution, Shodan on-demand scan submission, Shodan bulk `download`, arbitrary Shodan paging/endpoints, server-side case database, or universal maliciousness score.

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

When credential-bearing verification is authorized, run protected health/status, provider probes, User Scanner acceptance where applicable, bounded Shodan acceptance, and representative IP Kernel acceptance. Never reinterpret missing credentials, provider errors, Shodan rate limits, depleted credits, feed absence or Kernel projection failure as benign evidence.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
