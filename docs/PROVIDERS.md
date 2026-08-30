### Providers

The executable provider registry is the source of truth for the canonical Evidence v2 enrichment fabric. The active registry contains **38 providers**. `release-manifest.json` records every active adapter/parser version, and `/api/para11ax/meta` exposes static capabilities without credential values or secret configuration state.

#### Registry contract

Every active Evidence v2 provider declares and is validated for supported indicator/observation types, tier/cost class, timeout/cache policy, response ceiling, exact fixed host(s), allowed methods/protocols, parser version, source URL, and credential posture.

A canonical workflow cannot route to an unregistered provider or a provider that does not support that indicator type. The nine Evidence v2 workflows are `ip`, `domain`, `url`, `hash`, `cve`, `attack`, `asn`, `cidr`, and `certificate`.

#### Current provider fabric

**Identity / routing / exposure:** IPinfo · RDAP · RIPEstat · Shodan · Censys · Modat Magnify · Cloudflare Radar · Cloudflare DNS · Tor Exit · Spamhaus DROP / ASN-DROP.

**Threat / IOC:** DShield · Feodo Tracker · ThreatMiner · CIRCL MISP OSINT · Botvrij MISP OSINT · GreyNoise · AbuseIPDB · VirusTotal · OTX · ThreatFox · urlscan.io · Webamon · Pulsedive · OpenPhish · URLhaus · TweetFeed.

**File / malware:** CIRCL Hashlookup · MalwareBazaar · Malpedia · Hybrid Analysis.

**Vulnerability / ATT&CK:** CISA KEV · FIRST EPSS · CIRCL Vulnerability-Lookup · NVD · OSV · MITRE ATT&CK TAXII.

**Ransomware:** RansomLook · Ransomware.live API-PRO.

#### Shodan: two distinct surfaces

Shodan appears in PARA11AX in two deliberately separate ways.

1. **Evidence v2 provider adapter** — Shodan is one of the 38 fixed providers used where the canonical workflow/profile allows it. Its observations enter the normal provider parser/evidence/correlation path with provider-native exposure semantics.
2. **Native analyst-shell utility** — `POST /api/para11ax/shodan` implements explicit bounded operator lookups for `shodan host`, `shodan search`, `shodan count`, `shodan stats`, `shodan domain`, and `shodan info`.

The shell utility does **not** add a 39th provider, does not change the provider registry, and does not automatically promote its output into Evidence v2.

Both surfaces use the server-side `SHODAN_API_KEY`; the browser never receives that key. The analyst-shell route contacts only `https://api.shodan.io`, rejects arbitrary destinations/options, caps returned data, removes large raw service/banner bodies, keeps search first-page only, and disables `shodan download`.

Credit handling is explicit on the shell route: host/count/stats/info are classified as no-query-credit operations; domain is marked as consuming a query credit; search is marked as potentially consuming a query credit. See `SHODAN-SHELL.md` for the operator contract.

#### Source semantics

Provider observations preserve their own meaning. Examples:

- RDAP: registration context.
- RIPEstat: routing context.
- Shodan/Censys/Modat: service/infrastructure exposure context.
- DShield: scanner activity.
- Spamhaus DROP/ASN-DROP: netblock/ASN listing context.
- Tor exit: Tor infrastructure context.
- CISA KEV: known exploited status.
- EPSS: exploitation probability.
- NVD/CIRCL/OSV: vulnerability metadata.
- MITRE ATT&CK TAXII: knowledge/mapping context.
- reputation/malware services: provider-specific threat observations.
- RansomLook/ransomware.live: victim-claim/reporting context rather than compromise proof.

These classes are not interchangeable. A Shodan-visible service, Tor exit, scanner hit, registration record, certificate record, community IOC report, ransomware claim, infrastructure exposure record, or ATT&CK technique is not automatically a malware-reputation vote.

#### Certificate semantics

Certificate lookup is explicit and contextual. The canonical classifier requires `cert-sha256:<64-hex>` so a certificate fingerprint cannot silently steal a bare SHA-256 from the file-hash workflow. Certificate subject/issuer names, reuse, infrastructure proximity, or mere presence are investigative context rather than reputation or attribution proof.

#### Public feed hardening

Public feed parsers reject malformed content rather than manufacture `not_listed` results. MISP feed hash-cache hits are verified against exact event attributes; deleted attributes are excluded; composite attribute types compare only the corresponding component; event fetches are bounded.

ATT&CK TAXII uses fixed MITRE collection IDs and server-side type filtering. Relationship expansion remains omitted where collection-wide retrieval would violate boundedness.

#### Network indicator support

ASN/CIDR support is deliberately narrow and fixed-source: RDAP autnum/network registration, RIPEstat AS/Prefix Overview, and Spamhaus ASN-DROP / IPv4/IPv6 DROP. No active scanning is performed by the Evidence v2 provider fabric.

The Shodan analyst-shell surface performs only the documented Shodan API lookups; it does not expose Shodan on-demand scan submission or arbitrary scanning.

#### State model

A provider can be:

- **Implemented** — adapter exists and repository tests pass.
- **Configured** — required runtime secret is present; inspect authenticated health/status/probes.
- **Production-verified** — an authorized smoke operation succeeded against the exact deployed source SHA.
- **Unavailable/gap** — omitted, unconfigured, or failed its source/boundedness gate.

Implemented does not imply configured, and configured does not imply production-verified. The same proof-state rule applies to the Shodan shell: source presence does not prove production `SHODAN_API_KEY` availability or account credits.

#### Intentionally omitted

- SecurityTrails stale/paid assumptions.
- Deprecated SSLBL C2 path.
- TLS/JA3 indicator class without a suitable fixed bounded source.
- Unbounded ATT&CK relationship download.
- Ransomware-wide unbounded enumeration in per-indicator enrichment.
- Modat bulk export/broad history in normal enrichment.
- Shodan arbitrary paging, bulk `download`, caller-selected URLs, and on-demand scan submission through the analyst shell.

Run `node scripts/generate-release-manifest.mjs --check` to detect registry/parser-version drift. Documentation-contract tests separately detect drift in externally documented workflow/provider/operator facts.