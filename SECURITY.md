### Security policy

This repository is public. PARA11AX is a read-only CTI enrichment platform for personal research/lab use, and every commit, pull request, workflow artifact, issue, and release must be treated as potentially public information.

#### Supported use

Do not route commercial-client, internal-enterprise, restricted, or otherwise sensitive data through providers unless their licensing, data-handling terms, and the relevant client authorization have been explicitly reviewed. Provider enrichment is evidence, not attribution.

#### Secrets

- Never commit API keys, tokens, credentials, private keys, certificates, `.env` files, packet captures, malware samples, or sensitive analysis artifacts.
- Use Vercel environment variables/secrets for production and `.env.example` only as a non-secret template.
- The only credential a Maltego client should know is `PARA11AX_TOKEN`; vendor credentials remain server-side.
- API and health responses must never return environment-variable values.
- Provider errors must not reflect credential-bearing URLs, headers, or arbitrary upstream exception text.
- Unexpected handler-error telemetry is correlation-only and must not contain exception messages, stacks, request bodies or raw indicators.
- If a secret is ever committed or exposed, treat it as compromised: revoke/rotate it first, then remove it from repository history as needed.

#### Application boundary

- Provider integrations are retrieval/enrichment only unless the repository explicitly documents otherwise.
- Do not add scan submission, takedown, rescan, file upload, malware submission, sample download, detonation, arbitrary HTTP proxying, arbitrary outbound headers, shell execution, or secret-read/list endpoints without an explicit design change and security review.
- Provider endpoints must remain fixed and indicator input must never control the outbound host.
- Missing provider credentials must degrade to skipped/partial coverage rather than unsafe fallback behavior.
- Preserve provider semantics; never turn heterogeneous provider results into a simple malicious-vendor vote.
- Absence from a feed is not benign evidence.
- Treat infrastructure proximity, certificate reuse, shared ASN/hosting, and graph pivots as investigative relationships rather than actor attribution.
- `config/providers.json` is the canonical static provider policy. Runtime metadata, environment/bootstrap credential inventory, fixed transport policy and report distribution state must not drift from it.

#### Evidence, graph and guidance boundary

- Evidence Graph v1.0 and Guidance v1.0 are deterministic projections over existing normalized evidence/correlation/decision inputs; they do not perform provider calls, secret lookup, arbitrary network access, or persistence.
- Guidance inherits the existing bounded disposition vocabulary and must not introduce a second universal threat/risk score.
- Graph entities/edges come only from supported explicit facts/relationships. Free-form strings, shared hosting, certificate reuse or infrastructure proximity must not manufacture actor attribution.
- Error enrichments do not manufacture top-level `evidenceGraph` or `guidance` fields.

#### Browser-local case boundary

- Train 4 case persistence is browser-local IndexedDB state, not server-side case/IOC storage.
- Active case selection and gateway authentication remain runtime-only and must not be serialized into case metadata.
- Case notes and semantic-diff prose must not be parsed into graph entities.
- Case/index/graph modules must not introduce direct network persistence paths or credential/session properties.
- Export/import bundles remain bounded, typed and secret-key screened before persistence.

#### API and error boundary

- `POST /api/para11ax/enrich`, `/api/para11ax/batch`, and `/api/para11ax/stix` require `Authorization: Bearer <PARA11AX_TOKEN>`.
- `GET /api/para11ax/health` and `/api/para11ax/status` are bearer-protected; `/api/para11ax/meta` is intentionally public static metadata.
- Explicit non-JSON request content types are rejected.
- Indicator types and sizes are validated before provider calls. Certificate SHA-256 requires explicit `cert-sha256:` classification and does not steal bare file hashes.
- Authenticated responses use `Cache-Control: no-store` and defensive response headers.
- Gateway bearer comparison remains constant-time.
- Provider calls use bounded response sizes, explicit timeouts, structured rate-limit handling, and redirect restrictions.
- Unknown `/api/para11ax/*` routes fail closed.
- Error content negotiation honors `Accept` quality values, defaults safely to JSON, and uses HTML only when `text/html` has a strictly stronger positive preference.
- Error pages/responses must never reflect exception text, request bodies, provider configuration state, credentials, or upstream URLs.

#### Reporting boundary

- Reports compile only from bounded frozen snapshots and must not perform network/provider calls.
- The raw snapshot is scanned for known secret identifiers and high-confidence secret-like values before any artifact is written.
- The ReportModel quality gate rejects orphan claims, missing provenance, malformed ATT&CK IDs, contextual-as-observed claims, duplicate observables, impossible timestamps, unsafe references, unsupported attribution and stale evidence without an explicit limitation.
- The `sharing` preset fails closed for unknown providers or providers whose manifest distribution policy is not `shareable`; there is no automatic licensing downgrade or silent redaction bypass.
- CSV exports neutralize spreadsheet formula prefixes before RFC-style quoting.
- KQL is an analyst artifact, not an execution channel; report compilation never executes generated queries.
- Artifact manifests contain deterministic SHA-256 digests. Identical frozen input plus supplied generation/source identity must produce deterministic outputs.

#### Maltego

- Remote gateway URLs must use HTTPS; HTTP is allowed only for localhost development.
- Redirects are refused by the local gateway client so the bearer is not forwarded to another host.
- The Windows local token store uses current-user DPAPI protection.
- macOS first-write credentials use the native Keychain terminal prompt; Linux uses Secret Service/libsecret and fails closed if no secure backend exists.
- Generated `.mtz` packages are local artifacts and must not be committed.
- MTZ verification derives vendor credential identifiers from the canonical provider manifest and rejects archive traversal, symlinks, duplicate entries, unsafe sizes, loopback/dev URLs and credential identifiers.
- Graph expansion is bounded and deduplicated.
- Certificate parity changes only the explicit client transport mapping: `EnrichCertificate` adds `cert-sha256:`. It does not expose provider credentials or change file-hash semantics.

#### Supply chain and governance

- GitHub Actions must remain pinned to immutable commit SHAs.
- Runtime parity is Node.js 24.x across Vercel, CI, Codespaces, and local bootstrap flows.
- `package-lock.json` is mandatory even with an empty dependency set; CI uses deterministic `npm ci --ignore-scripts` and runs a real `npm audit --omit=dev`.
- The Windows Vercel bootstrap uses the repository-pinned CLI version rather than `vercel@latest`.
- `Tooling smoke` is bounded to one Ubuntu runner and validates repository invariants, Node tests, Maltego tests, Python compilation, shell syntax/ShellCheck and PowerShell syntax. CodeQL performs JavaScript/TypeScript static analysis separately.
- Authoritative `Tooling smoke` must fail closed if any summarized validation step fails, must publish status against the exact PR head SHA, and must attest the exact merged `main` SHA on push before production finalization.
- The intended `main` release policy includes PR-only changes, strict `Tooling smoke`, stale-review dismissal, admin enforcement, linear history, resolved review conversations, force-push denial and deletion denial.
- Repository files describe that governance contract but do not prove current GitHub settings. `npm run verify:governance` is the read-only verification path and must fail nonzero on drift.
- `scripts/finalize.ps1` is the authoritative admin write/read-back path and refuses production deployment if governance or exact-main identity is not satisfied.
- Vercel Git deployment is fail-closed for feature branches. A production build is accepted only when its Git metadata SHA equals the exact verified `main` SHA.

#### Validation

Run before accepting changes:

```bash
npm run check
npm run verify:deps
npm run verify:tooling
cd maltego && python3 -m unittest discover -s tests -v
cd .. && python3 -m compileall -q maltego
```

When authenticated GitHub access is available, also run:

```bash
npm run verify:governance
```

A public READY Vercel deployment does not by itself prove authenticated health/status or provider readiness. Those claims require an authorized bearer/provider probe against the exact deployed SHA.
