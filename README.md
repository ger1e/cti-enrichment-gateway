# CTI Enrichment Gateway

Private, read-only CTI enrichment gateway for Vercel with bounded batch/STIX APIs and a local Maltego Graph Desktop client.

The gateway normalizes heterogeneous CTI sources behind fixed workflows. Provider credentials remain server-side. Callers receive evidence-v2 observations, provenance, relationships, typed correlation and explicit coverage failures rather than unrestricted provider access or a synthetic “vendors say malicious” score.

Current scope is personal research and lab use. Do not send commercial-client, internal-enterprise, restricted or otherwise sensitive data unless the relevant authorization, licensing and data-handling requirements have been explicitly satisfied.

## v2 capabilities

Supported indicator classes:

- IPv4 / IPv6
- domain / DNS name
- HTTP/HTTPS URL
- MD5 / SHA-1 / SHA-256
- CVE
- MITRE ATT&CK identifier
- ASN (`AS<number>`)
- canonical IPv4/IPv6 CIDR prefix

API surfaces:

- `GET /api/meta` — public static capabilities and hard limits
- `GET /api/health` — authenticated, `no-store` operational readiness/configuration state
- `GET /api/status` — authenticated, `no-store`, count-only runtime state
- `POST /api/enrich` — authenticated single-indicator enrichment
- `POST /api/batch` — authenticated 1..20 indicator batch with canonical dedupe, max-three indicator concurrency and global call budget
- `POST /api/stix` — authenticated enrichment followed by bounded STIX 2.1 export

Profiles are fixed: `fast`, `standard`, `full`. Callers cannot select individual providers, outbound hosts, arbitrary methods, arbitrary headers or provider credentials.

## Security and boundedness

- Read-only retrieval only: no scan/detonation/submission/download/takedown/remediation routes.
- Runtime parity is Node.js 24.x.
- Exact fixed provider hosts and declared HTTPS methods are enforced by a central egress boundary.
- Redirects are refused and upstream bodies are byte-capped.
- Provider concurrency is capped at 4 with a 20-second request deadline, static workflow call ceilings and at most one retry for retryable failures.
- Batch is capped at 20 inputs, three active indicators and 200 provider calls.
- Cache is bounded LRU/TTL with in-flight de-duplication. Provider/transport failures are never cached; successful semantic negatives use shorter negative TTLs.
- Malformed public feeds fail closed. MISP positives require exact non-deleted event attributes and bounded event retrieval.
- ATT&CK TAXII stays on fixed MITRE collections; unbounded relationship expansion is intentionally omitted.
- Operational telemetry is allowlisted and excludes raw indicators by default.
- GitHub Actions are pinned to immutable commit SHAs.
- Maltego knows only the gateway bearer; provider secrets never enter the MTZ/project output.

## Evidence model

The gateway deliberately has no master maliciousness score. Registration, routing, scanner activity, Tor status, reputation, phishing/malware associations, vulnerability metadata, exploit probability, KEV and ATT&CK knowledge remain separate semantic classes.

Evidence v2 preserves provider, parser version, retrieval time, cache state, duration, source references and integrity fingerprints. Compatible evidence can corroborate; incompatible observations do not vote together; contradictions remain explicit. For CVEs, KEV, EPSS and CVSS stay separate axes.

## Maltego one-command setup

After the gateway is provisioned, install the local Maltego transforms from `maltego/`:

macOS / Linux (bash or zsh):

```sh
cd maltego
./install.sh
```

Windows PowerShell:

```powershell
cd maltego
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install.ps1
```

The shared bootstrap enforces Python >=3.10 (prefers 3.12), repairs stale/broken venvs, installs pinned dependencies, runs tests, stores only `CTI_GATEWAY_TOKEN` in the native user credential store (DPAPI / macOS Keychain / Linux Secret Service), generates the MTZ, verifies transform inventory/archive safety/secret absence, and prints its SHA-256 and import path. Vendor API keys remain in Vercel.

See [`maltego/README.md`](maltego/README.md) for `--check`, `--repair`, `--update`, `--uninstall` and platform details.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — execution model and trust boundaries
- [`docs/EVIDENCE-SCHEMA.md`](docs/EVIDENCE-SCHEMA.md) — evidence-v2 semantics
- [`docs/PROVIDERS.md`](docs/PROVIDERS.md) — registry/source semantics and state model
- [`docs/API.md`](docs/API.md) — endpoint contracts and hard limits
- [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md) — threats, controls, residual risk and executable tests
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — repository/configuration/production acceptance and incident runbook
- [`SECURITY.md`](SECURITY.md) — repository security policy
- [`release-manifest.json`](release-manifest.json) — deterministic gateway/schema/provider-parser release identity
- [`PUBLIC-RELEASE-CHECKLIST.md`](PUBLIC-RELEASE-CHECKLIST.md) — sanitized public-extraction gate

The executable provider registry, workflows and release manifest are authoritative. Documentation does not replace runtime configuration checks.

## Development and verification

```bash
npm run bootstrap
npm run verify:tooling
npm run verify:repo
npm run lint:shell
npm run audit:public
npm run check
npm test
node scripts/generate-release-manifest.mjs --check
```

Maltego verification:

```bash
cd maltego
python3 -m unittest discover -s tests -v
cd ..
python3 -m compileall -q maltego
```

The authoritative `Tooling smoke` status aggregates repository/MAXX validation with Maltego regression tests on Ubuntu, macOS and Windows plus bash/zsh/ShellCheck/PowerShell syntax checks.

## Configuration

`.env.example` is the only committed environment template. Never commit populated environment files, tokens, private keys, samples, packet captures or sensitive analysis artifacts.

`CTI_GATEWAY_TOKEN` protects the private API surface. Provider credentials are independently optional/required according to the provider registry. Missing credentials reduce coverage explicitly rather than triggering hidden fallbacks.

On Windows, use the authorized provisioning/deployment path:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\bootstrap-vercel.ps1
```

For final repository/branch/deployment acceptance use:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\finalize.ps1
```

The bootstrap/finalizer uses pinned tooling, requires a clean checkout that matches fetched `origin/main`, stores the gateway bearer with current-user DPAPI locally, writes production secrets to the deployment platform rather than Git, and does not print secret values.

## Deliberate gaps

No TLS/JA3 indicator class is shipped because no current fixed, bounded source met the v2 source gate. Deprecated SSLBL C2 paths and stale SecurityTrails configuration are not active. ATT&CK relationship expansion is omitted where it would require unbounded collection retrieval.

Repository-complete, configured and production-verified are distinct states. Production is accepted only when the deployed source SHA equals the exact verified `main` SHA and production smoke tests pass. See `docs/OPERATIONS.md`.
