### Security policy

This repository is public. PARA11AX is a provenance-first CTI enrichment and bounded analyst-operations platform for personal research/lab use. Every commit, pull request, workflow artifact, issue, and release must be treated as potentially public information.

#### Supported use

Do not route commercial-client, internal-enterprise, restricted, or otherwise sensitive data through providers or analyst utilities unless their licensing/data-handling terms and the relevant authorization have been explicitly reviewed. Provider and Shodan data are evidence/context, not attribution.

#### Secrets

- Never commit API keys, tokens, credentials, private keys, certificates, `.env` files, packet captures, malware samples, or sensitive analysis artifacts.
- Use Vercel/project environment secrets for production and `.env.example` only as a non-secret template.
- The only credential a Maltego client should know is `PARA11AX_TOKEN`; vendor credentials remain server-side.
- `SHODAN_API_KEY` is server-side only. It must never appear in browser JavaScript, terminal output, documentation examples, screenshots, logs, or committed files.
- API/health/status responses must never return environment-variable values.
- Provider/Shodan errors must not reflect credential-bearing URLs, headers, arbitrary upstream exception text, or secrets.
- Unexpected handler telemetry is correlation-only and must not contain exception messages, stacks, request bodies, raw indicators, User Scanner targets, or Shodan credentials.
- If any secret is exposed, revoke/rotate it first, then remove it from repository history as needed.

#### Application boundary

- Evidence v2 provider integrations are retrieval/enrichment only unless explicitly documented otherwise.
- Do not add malware submission, detonation, sample download, takedown, credential testing, arbitrary HTTP proxying, arbitrary outbound headers, shell execution, secret-read/list endpoints, or autonomous remediation without an explicit design/security review.
- Provider endpoints must remain fixed and indicator input must never control the outbound host.
- Missing provider credentials must degrade to skipped/partial coverage rather than unsafe fallback.
- Preserve provider semantics; absence is not benign evidence; infrastructure proximity is not actor attribution.

#### Native Shodan analyst-shell boundary

PARA11AX exposes six bounded native Shodan operator commands in the authenticated analyst shell:

```text
shodan host <ip>
shodan search <query>
shodan count <query>
shodan stats <query> [--facets <fields>]
shodan domain <domain>
shodan info
```

The browser calls only same-origin `POST /api/para11ax/shodan`. The gateway validates the command and arguments, reads `SHODAN_API_KEY` server-side, and contacts only the fixed upstream origin `https://api.shodan.io`.

Security invariants:

- no caller-selected URL/host/method/credential/proxy;
- no arbitrary endpoint selection;
- no arbitrary paging;
- `shodan search` is first-page only;
- response arrays are bounded and large raw banner/service bodies are removed;
- `shodan download` is disabled;
- on-demand Shodan scan submission is not exposed;
- missing configuration fails closed;
- Shodan 429/rate-limit state remains explicit;
- Shodan operator output is not automatically converted into Evidence v2, case evidence, STIX, Evidence Graph, Guidance, reputation voting, or attribution.

Credit impact is explicit. Host/count/stats/info are classified as no-query-credit operations; domain consumes a query credit; search may consume a query credit depending on Shodan plan/query behavior. Prefer non-credit-consuming operations for routine health/wiring checks.

A Shodan-visible port/service/product/tag/DNS record is infrastructure/exposure context only. It does not by itself prove exploitability, compromise, maliciousness, ownership, current reachability, or actor attribution.

#### User Scanner boundary

User Scanner remains a separate active-OSINT capability. The browser calls same-origin `/api/para11ax/user-scanner`; the gateway forwards only to `PARA11AX_USER_SCANNER_URL` and optional server-side `PARA11AX_USER_SCANNER_TOKEN`. Callers cannot select the worker URL, proxy, concurrency, timeout, or arbitrary destination. Account/handle matches are not same-person identity proof or compromise evidence.

#### Evidence, graph and guidance boundary

- Evidence Graph v1.0 and Guidance v1.0 are deterministic projections over normalized Evidence v2/correlation/decision inputs; they perform no provider calls, secret lookup, arbitrary network access, or persistence.
- Guidance inherits the existing bounded disposition vocabulary and must not introduce a universal threat/risk score.
- Graph entities/edges come only from supported explicit facts/relationships.
- Error enrichments do not manufacture top-level `evidenceGraph` or `guidance` fields.
- User Scanner and Shodan analyst-shell output remain outside these projections unless a future explicit typed design changes that boundary.

#### Browser-local case boundary

- Case persistence is browser-local IndexedDB, not server-side IOC storage.
- Active case selection and gateway authentication remain runtime-only.
- Case notes/diff prose must not be parsed into graph entities.
- Case/index/graph modules must not introduce direct network persistence paths.
- Export/import bundles remain bounded, typed, and secret-key screened.
- User Scanner/Shodan terminal output is not automatically persisted as Evidence v2 case material.

#### API and error boundary

Bearer-protected private routes include:

- `POST /api/para11ax/enrich`
- `POST /api/para11ax/batch`
- `POST /api/para11ax/stix`
- `POST /api/para11ax/user-scanner`
- `POST /api/para11ax/shodan`
- `GET /api/para11ax/health`
- `GET /api/para11ax/status`

`GET /api/para11ax/meta` is intentionally public static metadata.

Explicit non-JSON request content types are rejected where JSON is required. Indicator and operator inputs are bounded before external calls. Authenticated operational responses use defensive headers/no-store as applicable. Gateway bearer comparison remains constant-time. Unknown `/api/para11ax/*` routes fail closed.

#### Reporting boundary

Reports compile only from bounded frozen Evidence v2 snapshots and must not perform network/provider/User Scanner/Shodan calls. Snapshot secret scanning and report quality gates remain mandatory. KQL is an analyst artifact, not an execution channel. Artifact manifests retain deterministic SHA-256 digests.

#### Maltego

Remote gateway URLs must use HTTPS except localhost development. Redirects are refused by the local gateway client. Local credential storage uses platform-appropriate secure storage. Generated `.mtz` packages remain untracked local artifacts.

Shodan analyst-shell commands are not silently converted into Maltego Evidence v2 transforms; Shodan's normal Evidence v2 provider behavior remains governed by the canonical provider fabric.

#### Supply chain and governance

- GitHub Actions remain pinned to immutable commit SHAs.
- Runtime parity remains Node.js 24.x across Vercel/CI/bootstrap flows.
- `package-lock.json` is mandatory; CI uses deterministic install/audit.
- `Tooling smoke` validates repository invariants, Node tests, Maltego tests, Python compilation, shell/ShellCheck, and PowerShell syntax. CodeQL runs separately.
- Protected `main` must use exact-head status checks and deployment/source identity verification.
- Repository files describe governance intent but do not prove current external GitHub/Vercel settings.

#### Validation

Run before accepting changes:

```bash
npm run check
npm run verify:deps
npm run verify:tooling
cd maltego && python3 -m unittest discover -s tests -v
cd .. && python3 -m compileall -q maltego
```

Authenticated production acceptance should additionally verify the exact deployed SHA and, when authorized, protected health/status, representative Evidence v2 enrichment, User Scanner wiring where expected, and Shodan shell wiring with a no-query-credit command such as `shodan info`, `shodan host <approved-ip>`, or `shodan count <approved-query>`.

A public READY deployment does not itself prove provider secrets, `SHODAN_API_KEY`, account credits, or User Scanner worker readiness.