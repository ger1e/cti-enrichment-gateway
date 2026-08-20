# Security policy

This repository is a private, read-only CTI enrichment gateway. Security controls are intentionally conservative.

## Secrets

- Never commit API keys, tokens, credentials, private keys, certificates, `.env` files, packet captures, malware samples, or sensitive analysis artifacts.
- Use Vercel environment variables/secrets for production and `.env.example` only as a non-secret template.
- If a secret is ever committed, treat it as compromised: revoke/rotate it first, then remove it from repository history as needed.

## Application boundary

- Provider integrations are retrieval/enrichment only unless the repository explicitly documents otherwise.
- Do not add scan submission, takedown, destructive, or state-changing provider actions without an explicit design change and review.
- Preserve least-privilege credentials and provider scopes.

## Supply chain

- GitHub Actions must remain pinned to immutable commit SHAs.
- Runtime parity is Node.js 24.x across Vercel, CI, Codespaces, and local bootstrap flows.
- Keep deterministic dependency/tool pins where practical and review automated dependency updates before merge.

## Validation

Run before accepting changes:

```bash
npm run check
npm run verify:tooling
```

CI additionally parses the PowerShell bootstrap and validates repository invariants.
