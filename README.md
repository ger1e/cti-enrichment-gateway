<div align="center">

<picture>
  <source media="(max-width: 640px)" srcset="assets/brand/para11ax-hero-mobile.svg">
  <img src="assets/brand/parallax-hero.svg" alt="PARA11AX — CTI Evidence Gateway" width="100%" />
</picture>

[![Tooling smoke](https://github.com/ger1e/cti-enrichment-gateway/actions/workflows/tooling-smoke.yml/badge.svg)](https://github.com/ger1e/cti-enrichment-gateway/actions/workflows/tooling-smoke.yml)
[![CodeQL](https://github.com/ger1e/cti-enrichment-gateway/actions/workflows/codeql.yml/badge.svg)](https://github.com/ger1e/cti-enrichment-gateway/actions/workflows/codeql.yml)

**37 fixed sources · Evidence v2 · STIX 2.1 · Node.js 24.x**

[Landing page](https://cti-enrichment-gateway.vercel.app/) · [Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Providers](docs/PROVIDERS.md) · [Evidence](docs/EVIDENCE-SCHEMA.md) · [Security](SECURITY.md)

</div>

> [!IMPORTANT]
> Personal research / lab surface. Do not send commercial-client, internal-enterprise, restricted, or otherwise sensitive data without explicit authorization and suitable data handling.

**ONE-SCREEN MODEL**

- **Input:** IP · domain · URL · hash · CVE · ATT&CK ID · ASN · CIDR.
- **Profiles:** `fast` · `standard` · `full`; callers cannot choose arbitrary providers.
- **Boundary:** `safeFetch` fixed egress + provider-specific parsing.
- **Output:** Evidence v2 · typed correlation · JSON · batch · STIX 2.1 · deterministic offline reports.
- **Identity:** PARA11AX is the visual/product identity. Compatibility surfaces remain `cti-enrichment-gateway`, `cti`, `CTI_GATEWAY_TOKEN`, and `/api/*`.

![PARA11AX request path](assets/brand/para11ax-architecture.svg)

`safeFetch` is the trust boundary: callers cannot choose arbitrary destinations, protocols, methods, headers, redirects, provider credentials, or custom egress. Upstream responses remain untrusted until a provider parser validates and normalizes them.

**Read-only:** no scanning, detonation, submission, sample download, takedown, remediation, or arbitrary proxy routes.

**SEMANTIC FIREWALL**

![PARA11AX semantic firewall](assets/brand/para11ax-semantic-firewall.svg)

- **Absence ≠ benign:** `not_listed`, `not_found`, `no_result`, and `no_association` remain absence semantics.
- **Context ≠ reputation:** registration, routing, exposure, Tor, scanners, Modat, and ATT&CK cannot vote an IOC malicious.
- **Claims ≠ compromise proof:** community and ransomware reporting remain claim/report evidence.
- **Infrastructure ≠ attribution:** hosting, ASN, DNS, certificates, or malware proximity do not manufacture actor attribution.
- **KEV ≠ EPSS ≠ CVSS:** exploitation status, probability, and severity remain separate axes.
- **Failure ≠ negative evidence:** timeout, 429, 5xx, parser failure, and circuit-open states remain explicit coverage failures.

Full semantics: [`docs/EVIDENCE-SCHEMA.md`](docs/EVIDENCE-SCHEMA.md).

**API SURFACE**

- `GET /api/meta` — public static capabilities and hard limits.
- `GET /api/health` — bearer-protected readiness.
- `GET /api/status` — bearer-protected aggregate runtime state.
- `POST /api/enrich` — one indicator, fixed workflow/profile only.
- `POST /api/batch` — 1–20 indicators; max 3 active indicators / 200 calls.
- `POST /api/stix` — enrich then export STIX 2.1; max 100 objects.
- Unknown `/api/*` — controlled fail-closed API 404; browser content negotiation never changes API status semantics.

Example:

```json
{"indicator":"203.0.113.10","profile":"standard"}
```

Complete contract: [`docs/API.md`](docs/API.md).

<details>
<summary><strong>37 upstream APIs and feeds</strong></summary>

**Identity / routing / exposure:** IPinfo · RDAP · RIPEstat · Shodan · Censys · Modat Magnify · Cloudflare Radar · Tor Exit · Spamhaus DROP / ASN-DROP.

**Threat / IOC:** DShield · Feodo Tracker · ThreatMiner · CIRCL MISP OSINT · Botvrij MISP OSINT · GreyNoise · AbuseIPDB · VirusTotal · OTX · ThreatFox · urlscan.io · Webamon · Pulsedive · OpenPhish · URLhaus · TweetFeed.

**File / malware:** CIRCL Hashlookup · MalwareBazaar · Malpedia · Hybrid Analysis.

**Vulnerability / ATT&CK:** CISA KEV · FIRST EPSS · CIRCL Vulnerability-Lookup · NVD · OSV · MITRE ATT&CK TAXII.

**Ransomware:** RansomLook · Ransomware.live API-PRO.

[`config/providers.json`](config/providers.json) is the machine-readable policy for supported types, evidence semantics, tiers, timeouts, pacing, cache TTLs, response ceilings, fixed hosts/methods/protocols, parser versions, source URLs, and distribution rules.

**Implemented ≠ configured ≠ production-verified.** Source presence, runtime secret state, and exact-deployment acceptance remain separate facts.

</details>

<details>
<summary><strong>Security and resilience</strong></summary>

- Bearer authentication protects private API surfaces; `/api/meta` is intentionally public.
- Provider secrets stay server-side; Maltego receives only the gateway bearer.
- Exact fixed HTTPS hosts and declared methods/protocols; redirects refused.
- Streamed upstream bodies are byte-capped before parsing.
- Provider timeout + 20 s request deadline; max 4 providers concurrently.
- At most one retry for explicitly retryable conditions.
- Bounded instance-local circuit breaker and bounded LRU/TTL cache.
- Provider failures are never cached as negative evidence.
- Operational telemetry is allowlisted; raw indicators are excluded by default.
- Error responses are `no-store`, correlation-safe, and do not expose raw provider exceptions.

Security detail: [`docs/SECURITY-CONTROLS.md`](docs/SECURITY-CONTROLS.md) · [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md) · [`SECURITY.md`](SECURITY.md).

</details>

<details>
<summary><strong>Operator CLI, Maltego, and deterministic reports</strong></summary>

```text
cti doctor
cti providers list
cti providers env-template
cti providers probe --all
cti maltego check
cti release verify
cti report compile <snapshot.json> --out <dir> [--preset <name>]
cti report diff <before.json> <after.json>
```

Maltego crosses one credential boundary only: `CTI_GATEWAY_TOKEN`. Vendor credentials never enter the MTZ or transform output. See [`maltego/README.md`](maltego/README.md).

Report rendering never calls providers. It compiles frozen evidence through a canonical `ReportModel` and hard quality gate into deterministic HTML, PDF, text, JSON/STIX, CSV, KQL, ATT&CK Navigator, and SHA-256 manifest artifacts.

The gate rejects missing provenance, unsafe attribution, malformed ATT&CK IDs, impossible timestamps, duplicate observables, unsafe references, secret material, stale evidence presented as current, and unsafe sharing of restricted evidence.

</details>

<details>
<summary><strong>Verification and deployment</strong></summary>

Protected `main` requires the bounded `Tooling smoke` gate; CodeQL runs alongside it. The tooling gate performs repository invariants, deterministic dependency install/audit, Node tests, Maltego regression tests, Python compilation, shell checks, and PowerShell parsing.

Vercel Git deployment is disabled for `**` and enabled only for `main`. Repository-complete, configured, and production-complete are distinct states; production acceptance requires the exact deployed source SHA.

Full process: [`docs/OPERATIONS.md`](docs/OPERATIONS.md). Release identity: [`release-manifest.json`](release-manifest.json).

</details>

**DEEP DOCS**

- [`docs/BRAND.md`](docs/BRAND.md) — PARA11AX identity and compatibility rules.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — execution model and trust boundaries.
- [`docs/END-TO-END-EXAMPLE.md`](docs/END-TO-END-EXAMPLE.md) — IOC → evidence → export walkthrough.
- [`docs/EVIDENCE-SCHEMA.md`](docs/EVIDENCE-SCHEMA.md) — Evidence v2 and correlation semantics.
- [`docs/PROVIDERS.md`](docs/PROVIDERS.md) — source semantics and provider state model.
- [`docs/API.md`](docs/API.md) — endpoint contracts and hard limits.
- [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md) — threats, residual risk, executable checks.
- [`docs/SECURITY-CONTROLS.md`](docs/SECURITY-CONTROLS.md) — control-to-risk mapping.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — CI, production acceptance, incident behavior.
- [`SECURITY.md`](SECURITY.md) — repository security policy.
- [`docs/PUBLIC-RELEASE-CHECKLIST.md`](docs/PUBLIC-RELEASE-CHECKLIST.md) — public-extraction gate.
- [`release-manifest.json`](release-manifest.json) — deterministic release identity.

**DELIBERATE GAPS**

No TLS/JA3 without a bounded source that passes the source gate. No deprecated SSLBL C2 path. No stale SecurityTrails configuration. No unbounded ATT&CK relationship download. No ransomware-wide enumeration in per-indicator enrichment. No Modat bulk export/broad history path. **No universal maliciousness score.**

---

<div align="center">

<img src="assets/brand/parallax-mark.svg" alt="PARA11AX mark" width="52" />

**OBSERVED ≠ INFERRED ≠ CONTEXTUAL**

Preserve provenance · keep semantics separate · fail closed · make uncertainty visible

</div>
