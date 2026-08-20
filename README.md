# cti-enrichment-gateway

Private, read-only CTI enrichment gateway for Vercel.

## Provider scope

Primary/implemented or planned enrichment sources include:

- abuse.ch / ThreatFox
- AbuseIPDB
- GreyNoise
- VirusTotal
- Hybrid Analysis
- urlscan.io — historical search/result retrieval only; no scan submission
- Webamon Pro — search/retrieval only; no scans or takedowns
- AlienVault OTX
- Shodan
- Censys
- Pulsedive
- SecurityTrails
- IPinfo
- NVD
- Cloudflare Radar
- Sentry — monitoring only

The gateway is intentionally read-only. Development tooling in Codespaces does not change that application boundary.

## Environment variables

Use `.env.example` as the local template. Production values belong in Vercel environment variables/secrets.

Never commit API keys, tokens, certificates, packet captures, malware samples, or other sensitive analysis artifacts to this repository. See `SECURITY.md` for the standing security policy.

## FINAL MAXX development environment

Runtime parity is intentional: Vercel, `package.json`, `.nvmrc`, Codespaces, CI, and the Windows bootstrap all target Node.js 24.x. `.npmrc` enforces the Node engine contract and deterministic npm defaults. The Codespaces/devcontainer baseline also provisions GitHub CLI and a bounded CTI/development/forensics toolkit.

The Linux bootstrap is Debian/Ubuntu-family only, idempotent, retries transient apt failures, skips distro-unavailable optional packages, and verifies the required toolchain after installation. The Windows/Vercel bootstrap refuses runtime drift and aligns Node.js to major 24 before touching project configuration.

Commands:

```bash
npm run bootstrap
npm run verify:tooling
npm run verify:repo
npm run lint:shell
npm run check
npm test
```

Set `MAXX_SKIP_OPTIONAL=1` when you want the required baseline without optional analysis utilities:

```bash
MAXX_SKIP_OPTIONAL=1 npm run bootstrap
```

The bootstrap is intended for CTI enrichment development and artifact inspection. It is not a malware detonation environment and does not install a full offensive-security distribution.

## Repository guardrails

- `.env` and derivative local environment files are ignored; `.env.example` is the only committed template.
- Local captures, samples, analysis artifacts, private keys, certificates, Vercel state, dependency directories, and common tooling caches are ignored.
- `.npmrc` uses `engine-strict=true`, auditing, disabled funding prompts, and exact dependency saves.
- `verify-repo.sh` enforces Node 24 parity, npm policy, SHA-pinned GitHub Actions, the pinned Vercel CLI bootstrap, security-policy presence, ignore rules, and the absence of tracked sensitive artifact classes.
- GitHub Actions uses least-privilege repository permissions, disables checkout credential persistence, validates Bash and PowerShell syntax, validates the MAXX invariants, and publishes an explicit `Tooling smoke` commit status.
- External CI actions are pinned to immutable commit SHAs. `actions/setup-node` is temporarily pinned to the upstream commit containing the post-v7 fix for GHSA-3jxr-9vmj-r5cp until that fix is included in an immutable release.
- The Windows bootstrap pins Vercel CLI `58.4.4` for reproducibility; update the pin deliberately after review rather than floating on `latest`.
- Dependabot checks GitHub Actions and npm dependencies weekly.
- The scheduled smoke workflow runs once daily as a fallback validation path in addition to push, pull-request, and manual dispatch triggers.
