# Providers

The executable provider registry is the source of truth. `release-manifest.json` records every active adapter and parser version; `/api/meta` exposes static capabilities without credential configuration state.

## Registry contract

Every active provider declares and is validated for:

- supported indicator types and observation types
- tier and cost class (`free`, `quota`, `scarce`)
- timeout and positive/negative cache TTLs
- maximum response bytes
- exact fixed outbound host(s)
- allowed HTTP method(s) and protocol(s)
- parser version
- authoritative/source documentation URL
- required or optional credential status

A workflow cannot route to an unregistered provider or a provider that does not support that indicator type. Repository tests enforce this invariant.

## Execution tiers

Tier is execution priority, not analytical authority. Lower tiers are cheap/contextual or core fixed-source lookups. Higher tiers can be quota-heavy, scarce or broad enrichment. Profiles reduce work by declared tier/cost policy; callers cannot select individual providers.

## Source semantics

Provider observations preserve their own meaning. Examples:

- RDAP: registration context
- RIPEstat: routing context
- DShield: scanner activity
- Spamhaus DROP/ASN-DROP: netblock/ASN listing context
- Tor exit: Tor infrastructure context
- CISA KEV: known exploited status
- EPSS: exploitation probability
- NVD/CIRCL/OSV: vulnerability metadata
- MITRE ATT&CK TAXII: knowledge/mapping context
- reputation/malware services: provider-specific threat observations
- Modat Magnify: host/service exposure and passive-DNS infrastructure context; an observed service, tag, CVE or DNS relationship is not by itself a maliciousness verdict
- TweetFeed.live: community-reported IOC context from exact IOC lookup; an observed report is a hunting/watchlist lead, not an automatic malicious verdict or block decision
- RansomLook: bounded public search across ransomware posts and related datasets; matched posts are adversary/public-source claims, not proof that the named organization or asset was compromised
- ransomware.live API-PRO: keyed victim-claim context for domain/URL workflows; search results are filtered to exact normalized victim website hosts before they become domain evidence

Modat Magnify uses authenticated read-only retrieval at the fixed `api.magnify.modat.io` host. IP enrichment uses the bounded `/host/{ip}/v1` endpoint and domain enrichment uses `/dns/zones/{fqdn}/v1`. Search, history and bulk-export endpoints are deliberately excluded from the normal per-indicator workflow. `MODAT_API_KEY` is sent only in the `Authorization` header and is never copied into evidence or references. Modat is tier 3 / quota, so it participates in `standard` and `full` profiles but not `fast`.

RansomLook and ransomware.live intentionally use different observation kinds. Two aggregators repeating the same leak-site post are not treated as independent compromise confirmation. Ransomware claims use the neutral `observed` verdict and remain outside reputation voting/corroboration.

TweetFeed.live uses the public no-auth exact IOC endpoint for IP, domain, URL, MD5 and SHA-256. SHA-1 is explicitly returned as unsupported/no-result rather than manufactured into a negative lookup. The adapter does not use TweetFeed blocklists for automatic prevention.

RansomLook uses the public no-auth `/api/search?query=` surface and requires the documented direct-array response shape. Malformed response shapes fail closed instead of becoming false `not_listed` evidence. Bulk export, authenticated administrative paths and unbounded crawling are outside the adapter.

ransomware.live uses API-PRO at `api-pro.ransomware.live` with `RANSOMWARE_LIVE_API_KEY` sent only in the `X-API-KEY` header. The adapter uses bounded `/victims/search?q=` retrieval for domain/URL context and does not enumerate all groups or IOC collections.

These classes are not interchangeable. A Tor exit, scanner hit, registration record, community IOC report, ransomware claim, infrastructure exposure record or ATT&CK technique is not a malware-reputation vote.

## Public feed hardening

Public feed parsers reject malformed content rather than manufacture `not_listed` results. MISP feed hash-cache hits are verified against exact event attributes. Deleted attributes are excluded. Supported composite attribute types compare only the corresponding component. MISP event fetches are bounded per query.

ATT&CK TAXII uses fixed MITRE collection IDs and server-side type filtering. Relationship expansion remains intentionally omitted where collection-wide retrieval would violate boundedness.

## Network indicator support

ASN/CIDR support is deliberately narrow and fixed-source:

- RDAP autnum/network registration
- RIPEstat AS/Prefix Overview
- Spamhaus ASN-DROP and IPv4/IPv6 DROP

No active scanning is performed.

## State model

A provider can be:

- **Implemented:** adapter exists and repository tests pass.
- **Configured:** required runtime secret is present; check authenticated `/api/status`.
- **Production-verified:** the provider completed a smoke enrichment on the exact deployed source SHA.
- **Unavailable/gap:** provider is intentionally omitted, unconfigured or failed the source/boundedness gate.

Implemented does not imply configured, and configured does not imply production-verified.

## Intentionally omitted

- SecurityTrails: removed from the active personal gateway configuration rather than retaining stale/paid assumptions.
- Deprecated SSLBL C2 provider path: excluded.
- TLS/JA3 indicator class: not added because no current fixed, bounded source satisfied the v2 source gate.
- Unbounded ATT&CK relationship download: omitted.
- Ransomware-wide unbounded group/IOC enumeration: omitted from per-indicator enrichment; only fixed bounded lookup surfaces are used.
- Modat bulk export, broad host/service search and history retrieval: omitted from ordinary enrichment to preserve fixed per-indicator call bounds.

Run `node scripts/generate-release-manifest.mjs --check` to detect registry/parser-version drift.
