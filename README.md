# CTI Enrichment Gateway

[![Tooling smoke](https://github.com/ger1e/cti-enrichment-gateway/actions/workflows/tooling-smoke.yml/badge.svg)](https://github.com/ger1e/cti-enrichment-gateway/actions/workflows/tooling-smoke.yml)
[![CodeQL](https://github.com/ger1e/cti-enrichment-gateway/actions/workflows/codeql.yml/badge.svg)](https://github.com/ger1e/cti-enrichment-gateway/actions/workflows/codeql.yml)

Private, read-only CTI enrichment gateway for Vercel with bounded batch/STIX APIs, a local Maltego Graph Desktop client, deterministic operator tooling, and an offline decision-grade report compiler.

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
- unknown `/api/*` — controlled fail-closed 404 surface

Profiles are fixed: `fast`, `standard`, `full`. Callers cannot select individual providers, outbound hosts, arbitrary methods, arbitrary headers or provider credentials.

## Error contract

Errors use the same status semantics for humans and machine clients. JSON is the safe default for absent, wildcard, tied or JSON-preferred `Accept` headers. Explicit browser preference for `text/html` receives a branded hardened HTML page. Quality values are honored, JSON wins ties, and explicit HTML rejection is respected.

Controlled errors cover 400, 401, 403, 404, 405, 408, 413, 415, 422, 429 and safe 5xx classes. Error responses are `no-store`, frame-denied, nosniff, CSP-locked, correlation-ID tagged and never reflect provider exception text, request bodies, credentials or upstream URLs. Unexpected handler failures emit only correlation-safe operational telemetry; exception text and indicators are not logged by that event.

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
- npm dependency state is lockfile-backed; CI uses `npm ci --ignore-scripts` and a real `npm audit --omit=dev`.
- Maltego knows only the gateway bearer; provider secrets never enter the MTZ/project output.

## Evidence and provider policy

The gateway deliberately has no master maliciousness score. Registration, routing, scanner activity, Tor status, reputation, phishing/malware associations, vulnerability metadata, exploit probability, KEV and ATT&CK knowledge remain separate semantic classes.

Evidence v2 preserves provider, parser version, retrieval time, cache state, duration, source references and integrity fingerprints. Compatible evidence can corroborate; incompatible observations do not vote together; contradictions remain explicit. Absence from a feed is not benign evidence. For CVEs, KEV, EPSS and CVSS stay separate axes.

`config/providers.json` is the canonical static provider-policy source for supported types, semantic classes, credential identifiers, tier/cost, timeouts, cache/response ceilings, fixed hosts, methods/protocols, parser versions, source URLs and report-distribution policy. Runtime provider metadata, environment/bootstrap parity and Maltego secret-denylist checks are derived from or tested against that source.

## Operator CLI

The dependency-free `cti` control plane keeps routine operations behind bounded commands rather than ad-hoc scripts:

```text
cti doctor
cti providers list
cti providers env-template
cti maltego check
cti release verify
cti setup
cti repair
cti report compile <snapshot.json> --out <dir> [--preset <name>]
cti report diff <before.json> <after.json>
```

`doctor` reports configuration presence/counts only and never secret values. Setup/repair delegate to the existing hardened Maltego bootstrap; they do not introduce another credential store. Report inputs are bounded regular JSON files and report output directories must be empty, non-symlink targets.

## Decision-grade offline reports

Reports compile from a frozen evidence snapshot only. Renderers never call providers or the network. The canonical `ReportModel` separates observed evidence, inferred next-step behavior and contextual-not-observed material, then runs a hard quality gate before any artifact is written.

The gate rejects orphan claims, missing provenance, malformed ATT&CK identifiers, contextual behavior represented as observed, duplicate observables, impossible timestamps, unsafe references, unsupported attribution, stale evidence without an explicit limitation, known secret material and overly complex/circular raw snapshots.

The `all` bundle can emit:

```text
report.html
report.pdf
report.txt
evidence.json
intelligence.stix.json
observables.csv
hunts.kql
attack-navigator.json
manifest.json
```

Outputs are deterministic for identical input plus supplied generation/source identity. `manifest.json` records SHA-256 for emitted artifacts. CSV export neutralizes spreadsheet formula prefixes. The `sharing` preset fails closed when evidence comes from an unknown, `internal`, or `internal_only` provider instead of silently packaging it for external distribution. Semantic snapshot diffing reports added/removed/changed evidence, observables, providers, verdicts, relationships, ATT&CK mappings, hunts, status and limitations without inventing a significance/risk score.

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

The executable provider registry, canonical provider manifest, workflows and release manifest are authoritative. Documentation does not replace runtime/configuration checks.

## Development and verification

```bash
npm run bootstrap
npm run verify:tooling
npm run verify:repo
npm run verify:deps
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

## Configuration and release governance

`.env.example` is the only committed environment template. Never commit populated environment files, tokens, private keys, samples, packet captures or sensitive analysis artifacts.

`CTI_GATEWAY_TOKEN` protects the private API surface. Provider credentials are independently optional/required according to the provider manifest. Missing credentials reduce coverage explicitly rather than triggering hidden fallbacks.

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

The authenticated read-only branch-protection verifier can also be run independently:

```bash
npm run verify:governance
```

The required `main` policy is: PR-only changes, strict `Tooling smoke`, stale-review dismissal, admin enforcement, linear history, resolved review conversations, no force pushes and no branch deletion. The bootstrap/finalizer requires a clean checkout matching fetched `origin/main`, verifies the exact status SHA, applies and reads back branch protection, stores the gateway bearer with current-user DPAPI locally, writes production secrets to the deployment platform rather than Git, and refuses deployment if governance drifts.

## Deliberate gaps

No TLS/JA3 indicator class is shipped because no current fixed, bounded source met the v2 source gate. Deprecated SSLBL C2 paths and stale SecurityTrails configuration are not active. ATT&CK relationship expansion is omitted where it would require unbounded collection retrieval.

Repository-complete, configured and production-verified are distinct states. Production is accepted only when the deployed source SHA equals the exact verified `main` SHA and production smoke tests pass. See `docs/OPERATIONS.md`.
