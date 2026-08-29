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
  <a href="SECURITY.md">SECURITY</a>
</sub></p>

> [!IMPORTANT]
> Personal research / lab surface. Do not send commercial-client, internal-enterprise, restricted, or otherwise sensitive data without explicit authorization and suitable data handling. User Scanner is active OSINT and contacts third-party services; use it only for authorized defensive research.

<sub><strong>01 // SYSTEM PROFILE</strong></sub>

PARA11AX combines a bounded, read-only CTI enrichment/correlation core with one explicitly isolated active OSINT capability for email and username enumeration. Canonical observables enter fixed Evidence v2 workflows; User Scanner runs separately through the same analyst shell without being reinterpreted as CTI evidence.

<sub><strong>STATE</strong> — OPERATIONAL CORE<br/>
<strong>INPUTS</strong> — `ip` · `domain` · `url` · `hash` · `cve` · `attack` · `asn` · `cidr` · `certificate` (`cert-sha256:&lt;64-hex&gt;`)<br/>
<strong>IDENTITY OSINT</strong> — `user-scanner email|username &lt;target&gt;` · aliases `osint` / `identity` · isolated active OSINT worker<br/>
<strong>PROFILES</strong> — `fast` · `standard` · `full`; callers cannot select arbitrary providers<br/>
<strong>OUTPUT</strong> — Evidence v2 · Evidence Graph v1.0 · Guidance v1.0 · deterministic decision support · JSON · batch · STIX 2.1 · deterministic reports<br/>
<strong>LOCAL</strong> — browser-local cases · snapshots/diffs · exact typed cross-case index · case graph · `.para11ax` bundles; no server-side case persistence<br/>
<strong>IDENTITY</strong> — repository/package/CLI `para11ax` · bearer `PARA11AX_TOKEN` · API `/api/para11ax/*`</sub>

<sub><strong>02 // REQUEST PATH</strong></sub>

<p align="center"><img src="assets/brand/para11ax-readme-architecture-v4.svg" alt="PARA11AX bounded request path from caller through safeFetch to Evidence v2" width="100%"></p>

`safeFetch` is the hard egress boundary for the passive CTI core. Callers cannot choose arbitrary destinations, protocols, methods, headers, redirects, provider credentials or custom proxy routes. Upstream responses remain untrusted until a provider parser validates and normalizes them.

**Read-only core means read-only:** no detonation, submission, sample download, takedown, remediation or arbitrary proxying. User Scanner is the explicit exception to passive network behavior: it performs active email/username OSINT behind a separate authenticated route and isolated Python worker. Its output stays separate from Evidence v2.

<details>
<summary><strong>API surface</strong></summary>

- `GET /api/para11ax/meta` — public static capabilities and hard limits.
- `GET /api/para11ax/health` — bearer-protected readiness.
- `GET /api/para11ax/status` — bearer-protected aggregate runtime state.
- `POST /api/para11ax/enrich` — one indicator, fixed workflow/profile only.
- `POST /api/para11ax/batch` — 1–20 indicators; max 3 active indicators / 200 calls.
- `POST /api/para11ax/stix` — enrich then export STIX 2.1; max 100 objects.
- `POST /api/para11ax/user-scanner` — bounded email/username active OSINT through the server-configured isolated worker; separate from Evidence v2.
- Unknown `/api/para11ax/*` — controlled fail-closed API 404; browser content negotiation never changes API status semantics.

```json
{"indicator":"203.0.113.10","profile":"standard"}
```

User Scanner example:

```json
{"scanType":"username","target":"kaifcodec","crossScan":false,"noNsfw":true}
```

Normalized `ok`/`partial` enrichments retain Evidence v2 and `decision` while additively exposing `evidenceGraph` (v1.0) and `guidance` (v1.0). Error envelopes do not manufacture those projections. User Scanner returns its own bounded OSINT envelope and never becomes the current Evidence v2 result.

Complete contract: [`docs/API.md`](docs/API.md).

</details>

<sub><strong>03 // ANALYST SURFACE</strong></sub>

**ANALYST SURFACE** — [https://para11ax.vercel.app/app/](https://para11ax.vercel.app/app/)

The production terminal keeps the gateway bearer in volatile memory only, exposes bounded shell commands and evidence views, and preserves the API semantic model. The IndexedDB-backed case workspace is browser-local; active-case state and gateway authentication remain runtime-only.

User Scanner is integrated into this same shell rather than a separate UI. The command grammar is bounded, authenticated and explicit:

```text
user-scanner username kaifcodec
user-scanner email analyst@example.com
osint username kaifcodec --module github
identity username kaifcodec --category dev --cross-scan
```

`category` and `module` are mutually exclusive. Cross-scan is opt-in. NSFW modules are excluded by default unless explicitly requested. The browser cannot select the worker URL, proxy, concurrency, arbitrary destinations or worker timeout.

A username/email hit is platform-specific account-registration/profile OSINT. Matching handles do not prove same-person identity; registration evidence does not prove current account ownership/control; module errors are coverage failures, not negative evidence.

<sub><strong>PROMPT</strong> — `analyst@para11ax:~$`<br/>
<strong>WORKSPACE</strong> — local cases · pins · snapshots · semantic diffs · exact sightings · case graph<br/>
<strong>ACTIVE OSINT</strong> — User Scanner email/username enumeration in the same analyst shell, separate from Evidence v2<br/>
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
<strong>CONTEXT ≠ REPUTATION</strong> — routing, registration, Tor, scanners, certificate metadata and ATT&CK cannot vote an IOC malicious<br/>
<strong>IDENTITY HIT ≠ IDENTITY PROOF</strong> — matching usernames or registration signals do not prove same-person identity, ownership or compromise<br/>
<strong>CLAIMS ≠ COMPROMISE PROOF</strong> — community and ransomware reporting remain claim/report evidence<br/>
<strong>INFRASTRUCTURE ≠ ATTRIBUTION</strong> — hosting, ASN, DNS, certificates and malware proximity do not manufacture actor attribution<br/>
<strong>KEV ≠ EPSS ≠ CVSS</strong> — exploitation status, probability and severity remain separate axes<br/>
<strong>FAILURE ≠ NEGATIVE EVIDENCE</strong> — timeout, 429, 5xx, parser/module failure and circuit-open states remain explicit coverage failures</sub>

**No universal maliciousness or identity score.** Correlation, decision support, graphs and guidance keep analytical dimensions separate. User Scanner results remain analyst-facing OSINT rather than CTI reputation votes. Full evidence semantics: [`docs/EVIDENCE-SCHEMA.md`](docs/EVIDENCE-SCHEMA.md).

<sub><strong>05 // PROVIDER FABRIC</strong></sub>

PARA11AX has **38 configured sources** across network identity, threat/IOC context, malware intelligence, vulnerability knowledge and ransomware reporting. Configuration, implementation and production verification remain distinct states. User Scanner is deliberately not counted as a 39th Evidence v2 provider; it is an isolated active OSINT worker with a separate contract.

<details>
<summary><strong>38 upstream APIs and feeds</strong></summary>

**Identity / routing / exposure:** IPinfo · RDAP · RIPEstat · Shodan · Censys · Modat Magnify · Cloudflare Radar · Cloudflare DNS · Tor Exit · Spamhaus DROP / ASN-DROP.

**Threat / IOC:** DShield · Feodo Tracker · ThreatMiner · CIRCL MISP OSINT · Botvrij MISP OSINT · GreyNoise · AbuseIPDB · VirusTotal · OTX · ThreatFox · urlscan.io · Webamon · Pulsedive · OpenPhish · URLhaus · TweetFeed.

**File / malware:** CIRCL Hashlookup · MalwareBazaar · Malpedia · Hybrid Analysis.

**Vulnerability / ATT&CK:** CISA KEV · FIRST EPSS · CIRCL Vulnerability-Lookup · NVD · OSV · MITRE ATT&CK TAXII.

**Ransomware:** RansomLook · Ransomware.live API-PRO.

[`config/providers.json`](config/providers.json) is the machine-readable policy for supported types, evidence semantics, tiers, timeouts, pacing, cache TTLs, response ceilings, fixed hosts/methods/protocols, parser versions, source URLs and distribution rules.

**Implemented ≠ configured ≠ production-verified.** Source presence, runtime secret state and exact-deployment acceptance remain separate facts.

</details>

<sub><strong>06 // SECURITY & VERIFICATION</strong></sub>

<sub><strong>AUTH</strong> — bearer protects private API surfaces including User Scanner; `/api/para11ax/meta` is intentionally public<br/>
<strong>EGRESS</strong> — Evidence v2 uses exact fixed HTTPS hosts and declared methods/protocols; redirects refused; streamed bodies byte-capped before parsing<br/>
<strong>ACTIVE OSINT</strong> — User Scanner worker URL is server-configured only; browser cannot choose worker/proxy/concurrency/timeout; worker output is bounded and separate from Evidence v2<br/>
<strong>EXECUTION</strong> — passive core: 20 s request deadline · max 4 providers concurrently · at most one retry for explicitly retryable conditions; User Scanner gateway deadline is independently bounded<br/>
<strong>STATE</strong> — bounded instance-local circuit breaker and bounded LRU/TTL cache; provider failures never become cached negative evidence<br/>
<strong>TELEMETRY</strong> — allowlisted operational fields; raw indicators excluded by default; error responses are `no-store` and correlation-safe<br/>
<strong>CI</strong> — protected `main` requires Tooling smoke; CodeQL runs alongside it<br/>
<strong>DEPLOY</strong> — Vercel Git deployment is disabled for feature branches and enabled only for `main`; User Scanner worker is deployed separately</sub>

Hosted User Scanner wiring for the main PARA11AX project:

```text
PARA11AX_USER_SCANNER_URL=https://user-scanner-kappa.vercel.app
PARA11AX_USER_SCANNER_TOKEN=<optional matching worker bearer>
```

The URL is configuration, not caller input. A `READY` User Scanner Vercel deployment does not by itself prove the main PARA11AX project is wired to it; an authorized end-to-end scan through the same shell is the acceptance proof.

<details>
<summary><strong>Maltego and deterministic reports</strong></summary>

Maltego crosses one credential boundary only: `PARA11AX_TOKEN`. Vendor credentials never enter the MTZ or transform output. All nine gateway Evidence v2 workflow types have intended transform coverage; certificate SHA-256 uses `EnrichCertificate` and explicit `cert-sha256:` transport while file hashes retain `EnrichHash` semantics. User Scanner is not silently treated as a tenth Maltego Evidence v2 workflow. See [`maltego/README.md`](maltego/README.md).

Report rendering never calls providers. It compiles frozen evidence through a canonical `ReportModel` and hard quality gate into deterministic HTML, PDF, text, JSON/STIX, CSV, KQL, ATT&CK Navigator and SHA-256 manifest artifacts.

The gate rejects missing provenance, unsafe attribution, malformed ATT&CK IDs, impossible timestamps, duplicate observables, unsafe references, secret material, stale evidence presented as current and unsafe sharing of restricted evidence.

</details>

<sub>[SECURITY CONTROLS](docs/SECURITY-CONTROLS.md) · [THREAT MODEL](docs/THREAT-MODEL.md) · [SECURITY POLICY](SECURITY.md) · [OPERATIONS](docs/OPERATIONS.md) · [QA REPORT](docs/QA-REPORT.md) · [RELEASE IDENTITY](release-manifest.json)</sub>

<sub><strong>07 // DEEP DOCS</strong></sub>

<sub>[BRAND](docs/BRAND.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [END-TO-END](docs/END-TO-END-EXAMPLE.md) · [EVIDENCE](docs/EVIDENCE-SCHEMA.md) · [PROVIDERS](docs/PROVIDERS.md) · [API](docs/API.md) · [THREAT MODEL](docs/THREAT-MODEL.md) · [SECURITY CONTROLS](docs/SECURITY-CONTROLS.md) · [OPERATIONS](docs/OPERATIONS.md) · [QA](docs/QA-REPORT.md) · [PUBLIC RELEASE](docs/PUBLIC-RELEASE-CHECKLIST.md) · [MANIFEST](release-manifest.json)</sub>

<details>
<summary><strong>Deliberate gaps</strong></summary>

No TLS/JA3 without a bounded source that passes the source gate. No deprecated SSLBL C2 path. No stale SecurityTrails configuration. No unbounded ATT&CK relationship download. No ransomware-wide enumeration in per-indicator enrichment. No Modat bulk export/broad history path. No automatic User Scanner-to-Evidence-v2 promotion. **No universal maliciousness score.**

</details>

---

<p align="center">
  <code>analyst@para11ax:~$ _</code><br/><br/>
  <strong>OBSERVED ≠ INFERRED ≠ CONTEXTUAL</strong><br/><br/>
  <sub>Preserve provenance · keep semantics separate · fail closed · make uncertainty visible</sub><br/><br/>
  <img src="assets/brand/para11ax-radar-lockup.svg" alt="PARA11AX" width="320">
</p>
