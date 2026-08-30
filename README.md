<p align="center">
  <img src="assets/brand/para11ax-readme-hero-v8.svg" alt="PARA11AX — provenance-first CTI enrichment and analyst operations" width="100%">
</p>

<p align="center">
  <a href="https://github.com/ger1e/para11ax/actions/workflows/tooling-smoke.yml"><img src="https://github.com/ger1e/para11ax/actions/workflows/tooling-smoke.yml/badge.svg" alt="Tooling smoke"></a>
  <a href="https://github.com/ger1e/para11ax/actions/workflows/codeql.yml"><img src="https://github.com/ger1e/para11ax/actions/workflows/codeql.yml/badge.svg" alt="CodeQL"></a>
</p>

<p align="center"><sub>
  <a href="https://para11ax.vercel.app/app/"><strong>ENTER ANALYST UI</strong></a> ·
  <a href="https://para11ax.vercel.app/">LANDING</a> ·
  <a href="docs/API.md">API</a> ·
  <a href="docs/ARCHITECTURE.md">ARCHITECTURE</a> ·
  <a href="docs/PROVIDERS.md">PROVIDERS</a> ·
  <a href="docs/SHODAN-SHELL.md">SHODAN SHELL</a> ·
  <a href="SECURITY.md">SECURITY</a>
</sub></p>

> [!IMPORTANT]
> Personal research / lab surface. Do not send commercial-client, internal-enterprise, restricted, or otherwise sensitive data without explicit authorization and suitable data handling. User Scanner is active OSINT and Shodan operator commands can consume account query credits; use both only for authorized defensive research.

<sub><strong>01 // SYSTEM PROFILE</strong></sub>

PARA11AX combines a bounded, read-only CTI enrichment/correlation core with isolated analyst utilities. Canonical observables enter fixed Evidence v2 workflows. User Scanner performs bounded email/username active OSINT through an isolated worker. Native Shodan operator commands provide explicit infrastructure/exposure lookups through the same authenticated analyst shell while remaining separate from the current Evidence v2 result.

<sub><strong>STATE</strong> — OPERATIONAL CORE<br/>
<strong>INPUTS</strong> — `ip` · `domain` · `url` · `hash` · `cve` · `attack` · `asn` · `cidr` · `certificate` (`cert-sha256:&lt;64-hex&gt;`)<br/>
<strong>IDENTITY OSINT</strong> — `user-scanner email|username &lt;target&gt;` · aliases `osint` / `identity`<br/>
<strong>SHODAN OPS</strong> — `shodan host|search|count|stats|domain|info` · fixed upstream · server-side key · explicit credit impact<br/>
<strong>PROFILES</strong> — `fast` · `standard` · `full`; callers cannot select arbitrary Evidence v2 providers<br/>
<strong>OUTPUT</strong> — Evidence v2 · Evidence Graph v1.0 · Guidance v1.0 · deterministic decision support · JSON · batch · STIX 2.1 · deterministic reports<br/>
<strong>LOCAL</strong> — browser-local cases · snapshots/diffs · exact typed cross-case index · case graph · `.para11ax` bundles; no server-side case persistence<br/>
<strong>IDENTITY</strong> — repository/package/CLI `para11ax` · bearer `PARA11AX_TOKEN` · API `/api/para11ax/*`</sub>

<sub><strong>02 // REQUEST PATH</strong></sub>

<p align="center"><img src="assets/brand/para11ax-readme-architecture-v4.svg" alt="PARA11AX bounded request path from caller through safeFetch to Evidence v2" width="100%"></p>

`safeFetch` is the hard egress boundary for the passive Evidence v2 core. Callers cannot choose arbitrary destinations, protocols, methods, headers, redirects, provider credentials or custom proxy routes. Upstream responses remain untrusted until a provider parser validates and normalizes them.

Two operator paths are intentionally separate from Evidence v2 correlation:

- User Scanner: same-origin authenticated route to the server-configured isolated Python worker.
- Shodan shell: same-origin authenticated route to a bounded server-side Shodan command handler using only `https://api.shodan.io` and `SHODAN_API_KEY`.

Neither operator path silently replaces or mutates the current Evidence v2 enrichment result.

<details>
<summary><strong>API surface</strong></summary>

- `GET /api/para11ax/meta` — public static capabilities and hard limits.
- `GET /api/para11ax/health` — bearer-protected readiness.
- `GET /api/para11ax/status` — bearer-protected aggregate runtime state.
- `POST /api/para11ax/enrich` — one indicator, fixed workflow/profile only.
- `POST /api/para11ax/batch` — 1–20 indicators; max 3 active indicators / 200 calls.
- `POST /api/para11ax/stix` — enrich then export STIX 2.1; max 100 objects.
- `POST /api/para11ax/user-scanner` — bounded email/username active OSINT through the configured worker.
- `POST /api/para11ax/shodan` — bounded native Shodan operator commands; authenticated; fixed upstream; separate result envelope.
- Unknown `/api/para11ax/*` — controlled fail-closed API 404.

Evidence v2 example:

```json
{"indicator":"203.0.113.10","profile":"standard"}
```

Shodan request example:

```json
{"command":"stats","query":"product:nginx","facets":"country:20,org:10"}
```

Complete contracts: [`docs/API.md`](docs/API.md) and [`docs/SHODAN-SHELL.md`](docs/SHODAN-SHELL.md).

</details>

<sub><strong>03 // ANALYST SURFACE</strong></sub>

**ANALYST SURFACE** — [https://para11ax.vercel.app/app/](https://para11ax.vercel.app/app/)

The production terminal keeps the gateway bearer in volatile memory only, exposes bounded command grammars and evidence views, and preserves the API semantic model. The IndexedDB-backed case workspace is browser-local; active-case state and gateway authentication remain runtime-only.

User Scanner examples:

```text
user-scanner username kaifcodec
user-scanner email analyst@example.com
osint username kaifcodec --module github
identity username kaifcodec --category dev --cross-scan
```

Native Shodan commands:

```text
shodan host 8.8.8.8
shodan search product:"FortiGate" country:HU
shodan count port:443 country:HU
shodan stats product:nginx --facets country:20,org:10
shodan domain example.com
shodan info
```

Shodan behavior is deliberately bounded. `host`, `count`, `stats` and `info` are classified as no-query-credit operations by PARA11AX; `domain` is marked as consuming a query credit; `search` is first-page only and marked as potentially consuming a query credit. Search/service output is capped and large raw banners are removed. `shodan download`, arbitrary paging, caller-selected URLs and arbitrary Shodan operations are disabled.

The browser never receives `SHODAN_API_KEY`, never chooses the Shodan origin, and never calls Shodan directly. Every command goes through `POST /api/para11ax/shodan`, and the result is rendered as operator output while the current Evidence v2 result remains unchanged.

<sub><strong>PROMPT</strong> — `analyst@para11ax:~$`<br/>
<strong>WORKSPACE</strong> — local cases · pins · snapshots · semantic diffs · exact sightings · case graph<br/>
<strong>ACTIVE OSINT</strong> — User Scanner email/username enumeration, separate from Evidence v2<br/>
<strong>SHODAN</strong> — bounded infrastructure/exposure operator lookups, separate from Evidence v2<br/>
<strong>BOUNDARY</strong> — not a general-purpose shell or arbitrary network client</sub>

<details>
<summary><strong>Operator CLI</strong></summary>

```text
para11ax doctor
para11ax providers list
para11ax providers env-template
para11ax providers probe --all
para11ax maltego check
para11ax release verify
para11ax report compile <snapshot.json> --out <dir> [--preset <name>]
para11ax report diff <before.json> <after.json>
```

</details>

<sub><strong>04 // SEMANTIC FIREWALL</strong></sub>

<p align="center"><img src="assets/brand/para11ax-readme-semantics-v4.svg" alt="PARA11AX semantic firewall separating context, reputation, vulnerability axes, failures and attribution" width="100%"></p>

<sub><strong>ABSENCE ≠ BENIGN</strong> — `not_listed`, `not_found`, `no_result` and `no_association` remain absence semantics<br/>
<strong>CONTEXT ≠ REPUTATION</strong> — routing, registration, Tor, scanners, Shodan exposure, certificates and ATT&CK cannot vote an IOC malicious<br/>
<strong>IDENTITY HIT ≠ IDENTITY PROOF</strong> — matching usernames or registration signals do not prove same-person identity, ownership or compromise<br/>
<strong>CLAIMS ≠ COMPROMISE PROOF</strong> — community and ransomware reporting remain claim/report evidence<br/>
<strong>INFRASTRUCTURE ≠ ATTRIBUTION</strong> — hosting, ASN, DNS, Shodan services, certificates and malware proximity do not manufacture actor attribution<br/>
<strong>KEV ≠ EPSS ≠ CVSS</strong> — exploitation status, probability and severity remain separate axes<br/>
<strong>FAILURE ≠ NEGATIVE EVIDENCE</strong> — timeout, 429, 5xx, parser/module failure and circuit-open states remain explicit coverage failures</sub>

**No universal maliciousness score. No universal identity score.** Full evidence semantics: [`docs/EVIDENCE-SCHEMA.md`](docs/EVIDENCE-SCHEMA.md).

<sub><strong>05 // PROVIDER FABRIC</strong></sub>

PARA11AX has **38 upstream APIs and feeds** — 38 sources in the canonical Evidence v2 provider fabric. Shodan is one of those fixed providers for canonical enrichment, while the native Shodan shell route is a distinct explicit operator surface and does not increase the provider count.

<details>
<summary><strong>38 upstream APIs and feeds</strong></summary>

**Identity / routing / exposure:** IPinfo · RDAP · RIPEstat · Shodan · Censys · Modat Magnify · Cloudflare Radar · Cloudflare DNS · Tor Exit · Spamhaus DROP / ASN-DROP.

**Threat / IOC:** DShield · Feodo Tracker · ThreatMiner · CIRCL MISP OSINT · Botvrij MISP OSINT · GreyNoise · AbuseIPDB · VirusTotal · OTX · ThreatFox · urlscan.io · Webamon · Pulsedive · OpenPhish · URLhaus · TweetFeed.

**File / malware:** CIRCL Hashlookup · MalwareBazaar · Malpedia · Hybrid Analysis.

**Vulnerability / ATT&CK:** CISA KEV · FIRST EPSS · CIRCL Vulnerability-Lookup · NVD · OSV · MITRE ATT&CK TAXII.

**Ransomware:** RansomLook · Ransomware.live API-PRO.

</details>

[`config/providers.json`](config/providers.json) is the machine-readable Evidence v2 provider policy. Shodan shell semantics are documented separately because that route does not participate in provider selection/correlation.

<sub><strong>06 // SECURITY & VERIFICATION</strong></sub>

<sub><strong>AUTH</strong> — bearer protects private API surfaces including User Scanner and Shodan shell; `/api/para11ax/meta` is intentionally public<br/>
<strong>EGRESS</strong> — Evidence v2 uses exact declared provider hosts; Shodan shell uses exact `https://api.shodan.io`; User Scanner uses its server-configured worker only<br/>
<strong>SECRETS</strong> — `SHODAN_API_KEY` and all provider/worker credentials remain server-side<br/>
<strong>SHODAN LIMITS</strong> — fixed subcommands · first-page search · bounded responses · banners stripped · no `download` · explicit credit impact<br/>
<strong>STATE</strong> — Shodan and User Scanner operator output do not silently mutate Evidence v2 state<br/>
<strong>CI</strong> — protected `main` requires Tooling smoke; CodeQL runs alongside it<br/>
<strong>DEPLOY</strong> — Vercel Git deployment is enabled only for protected `main`</sub>

For exact security and operational contracts see [`docs/SECURITY-CONTROLS.md`](docs/SECURITY-CONTROLS.md), [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md), [`docs/OPERATIONS.md`](docs/OPERATIONS.md), and [`docs/SHODAN-SHELL.md`](docs/SHODAN-SHELL.md).

<sub><strong>07 // DEEP DOCS</strong></sub>

<sub>[BRAND](docs/BRAND.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [END-TO-END](docs/END-TO-END-EXAMPLE.md) · [EVIDENCE](docs/EVIDENCE-SCHEMA.md) · [PROVIDERS](docs/PROVIDERS.md) · [API](docs/API.md) · [SHODAN SHELL](docs/SHODAN-SHELL.md) · [THREAT MODEL](docs/THREAT-MODEL.md) · [SECURITY CONTROLS](docs/SECURITY-CONTROLS.md) · [OPERATIONS](docs/OPERATIONS.md) · [QA](docs/QA-REPORT.md) · [PUBLIC RELEASE](docs/PUBLIC-RELEASE-CHECKLIST.md) · [MANIFEST](release-manifest.json)</sub>

---

<p align="center">
  <code>analyst@para11ax:~$ _</code><br/><br/>
  <strong>OBSERVED ≠ INFERRED ≠ CONTEXTUAL</strong><br/><br/>
  <sub>Preserve provenance · keep semantics separate · fail closed · make uncertainty visible</sub><br/><br/>
  <img src="assets/brand/para11ax-radar-lockup.svg" alt="PARA11AX" width="320">
</p>