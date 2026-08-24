### Evidence Schema v2

The gateway returns provider evidence without collapsing different source semantics into one score. Current schema version is `2.0`.

#### Top-level enrichment envelope

Core fields:

- `schemaVersion`, `gatewayVersion`, `requestId`
- canonical `indicator` and `type`
- `queriedAt`, `profile`, `durationMs`
- `budget`: call limit/usage, request deadline and exhaustion flags
- `providerSummary`: `ok`, `failed`, `skipped`, `cached`
- `status`: `ok`, `partial` or `error`
- `evidence[]`, `relationships[]`, `failures[]`
- `correlation`
- `huntContext`
- `meta`: count/status-oriented cache and provider-health state for the request

`partial` means useful evidence exists but coverage was incomplete. A provider outage, timeout, rate limit or circuit-open state is not negative threat evidence.

#### Evidence item

Each evidence item contains:

- `provider`
- canonical `indicator` and `type`
- `observation`
- `relationships`
- `references`
- `retrievedAt`
- `cacheState`
- `durationMs`
- `integrity`

##### Observation

`observation.kind` preserves source semantics such as registration, routing, scanner activity, reputation, exploit probability, known-exploited status, sandbox metadata or ATT&CK knowledge.

Additional source-specific kinds include:

- `community_ioc_report` — TweetFeed.live community reporting context. `observed` means the IOC was reported, not independently confirmed malicious.
- `ransomware_post_reference` — RansomLook search located ransomware/DLS material referencing the pivot. It remains an adversary/public-source claim.
- `ransomware_victim_claim` — ransomware.live located an exact victim-website-domain claim. It remains an adversary claim rather than proof of compromise.

These claim/report kinds deliberately remain separate from malware-reputation semantics and use neutral `observed` verdicts for positive matches. Cross-source repetition is not automatically independent confirmation.

`observation.verdict` is provider/parser semantic output. It is not normalized into a global maliciousness value.

Optional fields include `confidence`, `firstSeen`, `lastSeen`, `tags`, `malwareFamily`, `actor` and bounded `attributes`.

##### Integrity

`integrity` contains:

- `parserVersion`: parser/source contract revision used for normalization
- `rawHash`: SHA-256 over the provider adapter result before evidence normalization, when available
- `fingerprint`: deterministic SHA-256 over canonical normalized evidence content and parser version

The fingerprint is a reproducibility/provenance control, not a signature or authenticity proof for the upstream source.

#### Relationships

Relationships are investigation pivots. They include a target type/value, relation semantics and provider provenance where available. Duplicate relationships are removed and the correlation layer caps output.

Ransomware groups referenced by the claim adapters use the `ransomware_group` target type rather than `actor`, so a leak-site claim cannot accidentally create attribution confidence.

Infrastructure proximity, shared ASN, hosting, certificate reuse or common malware does not by itself establish actor attribution. Attribution confidence is emitted only when an explicit actor relationship exists.

#### Correlation

The correlation object contains separate analytical dimensions:

- `corroboration[]`: compatible same-class observations from at least two providers
- `contradictions[]`: opposing observations in the same semantic class
- `freshness`: `current`, `aging`, `stale` or `unknown`
- `huntability`: bounded operational level and rationale
- de-duplicated `relationships`
- for CVEs, `riskAxes.kev`, `riskAxes.epss`, `riskAxes.cvss`
- optional `attributionConfidence` from explicit relationships

Scanner/noise, Tor, registration/routing and ATT&CK knowledge classes are excluded from malware-reputation corroboration. Community IOC reports and ransomware claims are separate semantic classes and positive matches are neutral observations, so they cannot become reputation votes merely by being present together.

#### Caching semantics

Only successful provider observations are cached. Successful semantic negatives such as `not_listed`, `not_found`, `no_result` and `no_association` use the adapter's shorter negative TTL. Timeout, HTTP, transport, parsing and provider failures are never cached.

`cacheState` is provenance about retrieval path, not source freshness. Source freshness is calculated separately.

#### Batch

Batch results preserve original input order. Canonically duplicated inputs reuse one enrichment result and contain `duplicateOf`. Invalid items have `status: invalid` independently; they do not reject otherwise valid batch work.

#### STIX export

STIX export is derived only from a gateway-generated enrichment object. It does not add threat confidence that the evidence did not contain. MITRE source STIX IDs are preserved when available; other object IDs are random valid STIX IDs. Object count is capped at 100.
