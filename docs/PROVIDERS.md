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

These classes are not interchangeable. A Tor exit, scanner hit, registration record or ATT&CK technique is not a malware-reputation vote.

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

Run `node scripts/generate-release-manifest.mjs --check` to detect registry/parser-version drift.
