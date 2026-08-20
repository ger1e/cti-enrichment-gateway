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

Never commit API keys, tokens, certificates, packet captures, malware samples, or other sensitive analysis artifacts to this repository.

## MAXX development environment

The Codespaces/devcontainer baseline provisions Node.js 22, GitHub CLI, and a bounded CTI/development/forensics toolkit. The Linux bootstrap is Debian/Ubuntu-family only, idempotent, retries transient apt failures, skips distro-unavailable optional packages, and verifies the required toolchain after installation.

Commands:

```bash
npm run bootstrap
npm run verify:tooling
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
- GitHub Actions validates shell syntax, ShellCheck, JSON configuration, the Node.js runtime floor, and project tests on pushes and pull requests.
