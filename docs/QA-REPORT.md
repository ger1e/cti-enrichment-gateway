# PARA11AX QA Report

## Scope and audit baseline

Audit date: 2026-08-30.

This report covers the repository-wide QA/documentation consolidation after V8 Trains 1–6 and the native Shodan analyst-shell integration. It is evidence-oriented: repository source, CI, deployment metadata, live public HTTP checks, and credential-bearing probes are separate proof states.

A tracked Markdown file cannot safely hard-code the SHA of the commit that contains itself. Therefore this report does **not** claim to embed its own final merge SHA. Reproduce exact current repository identity from GitHub and exact deployed identity from Vercel metadata as described below.

## Proof-state definitions

- **Repository-proven:** static source/tests executed for one exact Git tree/SHA.
- **CI-proven:** a GitHub workflow completed successfully for one exact SHA.
- **Deployment-proven:** Vercel reports a deployment in `READY` state whose `githubCommitSha` equals the expected exact SHA.
- **Live-public-proven:** public unauthenticated routes return expected status/content from the accepted deployment.
- **Credential-dependent / not proven by public QA:** authenticated health/status, provider secret configuration, User Scanner wiring, `SHODAN_API_KEY` configuration, Shodan account/credit state, and credentialed upstream readiness unless an authorized check actually executes.

These states are intentionally not interchangeable.

## Findings and dispositions

### QA-001 — architecture omitted the certificate workflow

**Proof:** the baseline architecture listed eight workflows while `src/workflows.js` defined a ninth `certificate` workflow.

**Disposition:** fixed in documentation; executable documentation-contract coverage exists.

### QA-002 — Evidence Graph/Guidance top-level response contracts were undocumented

**Proof:** baseline evidence docs documented `decision.entityGraph` but not top-level Evidence Graph v1.0 / Guidance v1.0 on normalized `ok`/`partial` results.

**Disposition:** fixed with first-class projection documentation and explicit error-envelope boundaries.

### QA-003 — Maltego documentation lagged certificate parity and CI topology

**Disposition:** fixed. Maltego docs cover all nine workflow types, explicit `cert-sha256:` transport, and actual bounded Ubuntu Tooling smoke topology.

### QA-004 — changelog lagged major V8 capabilities

**Disposition:** fixed and covered by drift checks.

### QA-005 — contribution/security prose contained stale repository-state language

**Disposition:** fixed. Repository files no longer claim to prove external GitHub/Vercel settings.

### QA-006 — public/operator docs under-described current local/projection boundaries

**Disposition:** fixed by separating decision-local graph, canonical Evidence Graph, browser-local case graph, Guidance, and persistence boundaries.

### QA-007 — Shodan runtime existed before public/operator documentation caught up

**Proof:** PR #172 merged a bounded native Shodan command surface into the analyst shell with `host`, `search`, `count`, `stats`, `domain`, and `info`, fixed upstream `https://api.shodan.io`, server-side `SHODAN_API_KEY`, explicit credit-impact classes, first-page-only search, bounded normalized output, and Evidence v2 isolation. Immediately after merge, README/landing/deep docs still described Shodan only as an Evidence v2 exposure provider rather than as a distinct analyst-shell surface.

**RED evidence:** PR #173 added an executable documentation contract to `test/shodan-terminal.test.mjs`. Tooling smoke failed on the RED candidate while CodeQL remained green, proving the new checks exercised missing/stale documentation rather than runtime implementation failure.

**Disposition:** README, landing page, API, architecture, providers, operations, security controls, threat model, security policy, changelog, QA/release guidance, and dedicated `docs/SHODAN-SHELL.md` were synchronized. The documentation contract now requires the approved Shodan command list and the core endpoint/key/fixed-egress/credit/boundedness/isolation semantics.

## Shodan shell QA contract

The public/operator documentation must agree on these facts:

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
- `host`, `count`, `stats`, `info`: no-query-credit classification;
- `domain`: consumes a query credit;
- `search`: may consume a query credit;
- native Shodan operator output leaves the current Evidence v2 result unchanged and is not auto-promoted into Evidence Graph, STIX, case evidence, reputation voting, or attribution.

## Repository/static verification

The final candidate must rerun the complete repository gate after documentation/test changes:

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

The Shodan documentation test is intentionally colocated with the runtime/shell contract in `test/shodan-terminal.test.mjs`, so command grammar, endpoint behavior, and public documentation drift are reviewed together.

## CI verification

Authoritative CI surfaces:

- `Tooling smoke` — branch-required exact-head status; one bounded Ubuntu job; dependency audit, repository checks, Node tests, Maltego Python tests, Python compile, shell/ShellCheck, and PowerShell parsing.
- CodeQL — separate JavaScript/TypeScript analysis; required by PARA11AX QA/release procedure even when branch protection does not list it as the required context.

For closure, verify the **current exact PR head** has Tooling smoke and CodeQL passing, then verify the **exact merged main SHA** has fresh push runs passing. Do not reuse an earlier green run after the head changes.

## Deployment and live-public verification

After merge, accept production only when:

1. GitHub reports the expected exact `main` SHA.
2. Vercel production deployment metadata reports the same `githubCommitSha` and `READY` state.
3. `https://para11ax.vercel.app/` returns HTTP 200 and contains the Shodan analyst-ops section/commands.
4. `https://para11ax.vercel.app/app/` returns HTTP 200.
5. public `GET /api/para11ax/meta` returns the expected static contract.
6. representative public static/error routing behaves as documented.

Deployment/live results belong to post-merge closure because editing this tracked report after every deployment would create a new commit and invalidate the exact-SHA claim it tried to describe.

## Credential-dependent surfaces not proven by public QA

Unless an authorized bearer/provider-secret environment is explicitly used, the following remain **not proven by public QA**:

- authenticated `/api/para11ax/health`;
- authenticated `/api/para11ax/status`;
- actual production provider secret configuration;
- credentialed provider enrichment health;
- User Scanner worker wiring;
- `SHODAN_API_KEY` production configuration;
- Shodan account plan, remaining query/scan credits, rate-limit state, and production shell readiness;
- complete `para11ax providers probe --all` readiness.

Not proven is not equivalent to failed, healthy, configured, or unconfigured.

When authorized, Shodan production acceptance should prefer no-query-credit proof paths:

```text
shodan info
shodan host <approved-test-ip>
shodan count <approved-query>
```

Do not spend query credits merely to prove deployment wiring if a no-query-credit command is sufficient. If `shodan search` or `shodan domain` is intentionally used, record scope and the returned `creditImpact`.

## Residual risks and deliberate gaps

- Upstream sources, including Shodan, can be semantically wrong while syntactically valid.
- Provider/Shodan coverage, quota, auth and rate state can change independently of repository source.
- Shodan-visible exposure is context, not proof of exploitability, compromise, maliciousness, ownership or attribution.
- Browser-local case data is durable inside the browser profile and can be exposed by local profile compromise.
- Repository documentation tests protect bounded canonical facts, not every prose nuance.
- GitHub branch protection, account security, secret scanning and Vercel project settings are external state requiring API/settings verification when those claims matter.
- No TLS/JA3 workflow without a bounded source that passes the source gate.
- No malware detonation/submission/download, credential testing, remediation, arbitrary proxying, arbitrary shell execution, Shodan on-demand scan submission, Shodan bulk `download`, arbitrary Shodan paging/endpoints, or server-side case database.
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

When credential-bearing verification is authorized, run protected health/status, provider probes, User Scanner acceptance where applicable, and bounded Shodan shell acceptance. Never reinterpret missing credentials, provider errors, Shodan rate limits, depleted credits, or feed absence as benign evidence.
