# Security policy

This repository is a private, read-only CTI enrichment gateway. Security controls are intentionally conservative.

## Supported use

The current gateway is for personal research and lab use. Do not route commercial-client, internal-enterprise, restricted, or otherwise sensitive data through providers unless their licensing, data-handling terms, and the relevant client authorization have been explicitly reviewed. Provider enrichment is evidence, not attribution.

## Secrets

- Never commit API keys, tokens, credentials, private keys, certificates, `.env` files, packet captures, malware samples, or sensitive analysis artifacts.
- Use Vercel environment variables/secrets for production and `.env.example` only as a non-secret template.
- The only credential a Maltego client should know is `CTI_GATEWAY_TOKEN`; vendor credentials remain server-side.
- API and health responses must never return environment-variable values.
- Provider errors must not reflect credential-bearing URLs, headers, or arbitrary upstream exception text.
- If a secret is ever committed or exposed, treat it as compromised: revoke/rotate it first, then remove it from repository history as needed.

## Application boundary

- Provider integrations are retrieval/enrichment only unless the repository explicitly documents otherwise.
- Do not add scan submission, takedown, rescan, file upload, malware submission, sample download, detonation, arbitrary HTTP proxying, arbitrary outbound headers, shell execution, or secret-read/list endpoints without an explicit design change and security review.
- Provider endpoints must remain fixed and indicator input must never control the outbound host.
- Missing provider credentials must degrade to skipped/partial coverage rather than unsafe fallback behavior.
- Preserve provider semantics; never turn heterogeneous provider results into a simple malicious-vendor vote.
- Treat infrastructure proximity, certificate reuse, shared ASN/hosting, and graph pivots as investigative relationships rather than actor attribution.

## API boundary

- `POST /api/enrich` requires `Authorization: Bearer <CTI_GATEWAY_TOKEN>`.
- Explicit non-JSON request content types are rejected.
- Indicator types and sizes are validated before provider calls.
- Authenticated responses use `Cache-Control: no-store` and defensive response headers.
- Gateway bearer comparison remains constant-time.
- Provider calls use bounded response sizes, explicit timeouts, structured rate-limit handling, and redirect restrictions.

## Maltego

- Remote gateway URLs must use HTTPS; HTTP is allowed only for localhost development.
- Redirects are refused by the local gateway client so the bearer is not forwarded to another host.
- The Windows local token store uses current-user DPAPI protection.
- Generated `.mtz` packages are local artifacts and must not be committed.
- Graph expansion is bounded and deduplicated.

## Supply chain

- GitHub Actions must remain pinned to immutable commit SHAs.
- Runtime parity is Node.js 24.x across Vercel, CI, Codespaces, and local bootstrap flows.
- Keep deterministic dependency/tool pins where practical and review automated dependency updates before merge.
- The Windows Vercel bootstrap uses the repository-pinned CLI version rather than `vercel@latest`.
- CI runs the Node suite, repository invariants, Maltego standard-library tests, Python compilation, and PowerShell syntax validation.

## Validation

Run before accepting changes:

```bash
npm run check
npm run verify:tooling
cd maltego && python3 -m unittest discover -s tests -v
cd .. && python3 -m compileall -q maltego
```

Production deployment additionally requires preview verification, safe health output, authentication checks, invalid-input checks, controlled live provider smoke tests where credentials are configured, and confirmation that logs/responses contain no secret values.
