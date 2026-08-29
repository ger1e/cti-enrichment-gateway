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
- `decision`: bounded explainable analyst decision support derived from evidence and correlation
- `evidenceGraph`: Evidence Graph v1.0 on normalized `ok`/`partial` results
- `guidance`: Guidance v1.0 on normalized `ok`/`partial` results
- `huntContext`
- `meta`: count/status-oriented cache and provider-health state for the request

`partial` means useful evidence exists but coverage was incomplete. A provider outage, timeout, rate limit or circuit-open state is not negative threat evidence.

`evidenceGraph` and `guidance` are additive Train 5 projections. They are not added to `error` envelopes, and they do not replace `decision` or change the legacy failure contract.

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

`observation.kind` preserves source semantics such as registration, routing, scanner activity, reputation, exploit probability, known-exploited status, sandbox metadata, certificate metadata or ATT&CK knowledge.

Additional source-specific kinds include:

- `community_ioc_report` — TweetFeed.live community reporting context. `observed` means the IOC was reported, not independently confirmed malicious.
- `ransomware_post_reference` — RansomLook search located ransomware/DLS material referencing the pivot. It remains an adversary/public-source claim.
- `ransomware_victim_claim` — ransomware.live located an exact victim-website-domain claim. It remains an adversary claim rather than proof of compromise.
- `certificate_metadata` — contextual X.509 metadata from an explicit certificate SHA-256 lookup. Presence, reuse, subject/issuer names or associated infrastructure do not become a malware-reputation vote.

These claim/report/context kinds deliberately remain separate from malware-reputation semantics. Cross-source repetition is not automatically independent confirmation.

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

Ransomware groups referenced by claim adapters use the `ransomware_group` target type rather than `actor`, so a leak-site claim cannot accidentally create attribution confidence.

Infrastructure proximity, shared ASN, hosting, certificate reuse or common malware does not by itself establish actor attribution. Attribution confidence is emitted only when an explicit actor relationship exists.

#### Correlation

The correlation object contains separate analytical dimensions:

- `corroboration[]`: compatible same-class observations from at least two providers
- `contradictions[]`: opposing observations in the same semantic class
- `freshness`: `current`, `aging`, `stale` or `unknown`
- `evidenceQuality`: support quality based on provider diversity, freshness and contradictions; it is not maliciousness
- `threatAssessment`: typed support state for applicable reputation evidence
- `huntability`: bounded operational level and rationale
- `assessment`: compact mirror of the generated decision-support assessment for report compatibility
- de-duplicated `relationships`
- for CVEs, `riskAxes.kev`, `riskAxes.epss`, `riskAxes.cvss`
- optional `attributionConfidence` from explicit relationships

Scanner/noise, Tor, registration/routing, certificate context and ATT&CK knowledge classes are excluded from malware-reputation corroboration. Community IOC reports and ransomware claims are separate semantic classes and positive matches are neutral observations, so they cannot become reputation votes merely by being present together.

#### Decision support

`decision` is deterministic analyst decision support derived only from normalized evidence, typed correlation, coverage state and explicit relationships. It does not perform blocking, remediation or source submission and it does not introduce a universal threat score.

Core fields:

- `version`
- `disposition`: one of `hunt_now`, `investigate`, `monitor`, `context_only`, `insufficient`
- `confidence`: `high`, `medium` or `low`, based on evidence quality and downgraded by contradiction, staleness or material coverage loss
- `reasons[]`: explicit machine-readable reasons and limitations supporting the disposition
- `assessment`: compact disposition/confidence/freshness/huntability/coverage summary
- `telemetry`: required Microsoft hunting tables, readiness status, and `environmentValidated: false` until the analyst verifies table availability and retention
- `temporal`: evidence-derived first/last-seen and bounded age/span context
- `attackMappings[]`: ATT&CK IDs only when explicitly present in the subject or evidence fields
- `entityGraph`: compact bounded decision-local investigation pivots
- `huntPlan[]`: bounded schema-level KQL templates with telemetry, evidence fingerprints, false-positive notes and tuning guidance
- for CVEs only, the existing separate `riskAxes` are copied without combining KEV, EPSS and CVSS into a single value

Generated KQL is a starting hypothesis, not proof of compromise. `telemetry.environmentValidated` remains false because the gateway does not query the client SIEM schema, retention or ingestion health. Reports consume generated `decision.huntPlan` entries when no explicit `reportContext.huntOpportunities` override is supplied.

#### Evidence Graph v1.0

Top-level `evidenceGraph` is the canonical graph projection of the normalized response. Its schema version is `1.0`.

It is deliberately distinct from `decision.entityGraph`:

- `decision.entityGraph` is a compact decision-support view owned by the existing decision contract.
- `evidenceGraph` is a canonical stable projection over explicit Evidence v2 facts and supported relationships.
- the browser-local case graph is a third, separate projection over local case/snapshot/exact-sighting state.

Evidence Graph properties:

- deterministic SHA-256-derived stable node/edge identity
- deterministic ordering
- deeply frozen output in the projection implementation
- explicit-only observable, evidence, ATT&CK, actor and malware facts
- provider/evidence fingerprints retained where required for provenance
- bounded node/edge/fact categories with fail-closed validation
- no free-form entity extraction from notes or arbitrary relationship strings
- no infrastructure-to-actor inference
- no new provider call, credential lookup, network egress or persistence path

A graph edge means the supported source data expressed that relationship under the projection rules. It is not proof of compromise or attribution.

#### Guidance v1.0

Top-level `guidance` is a deterministic analyst guidance projection with schema version `1.0`.

Guidance does not recalculate a second disposition, confidence model or universal score. It inherits the existing decision vocabulary and keeps analytical axes separate. Core content can include:

- inherited `disposition` and `confidence`
- evidence fingerprints that resolve to canonical Evidence Graph evidence nodes
- reasons and limitations
- freshness and coverage context
- contradictions
- telemetry requirements/readiness context
- explicit ATT&CK mappings
- bounded hunt-plan context
- semantic-change attention context when a canonical semantic diff is supplied

Semantic-change attention uses only approved change categories from the deterministic semantic-diff layer. A change can warrant analyst attention without being a threat escalation. Transport/cache/timing noise does not become a semantic change.

Guidance is therefore an explanation/projection layer over existing evidence, correlation, decision and semantic-diff contracts, not a new evidence source.

#### Browser-local case graph

Train 4 cases are not part of the server response schema. Browser-local cases can retain bounded Evidence v2 snapshots and semantic diffs, build exact typed cross-case sightings, and project a local graph from pins/snapshots/supported facts. Free-form notes are not parsed into entities. IndexedDB is the case persistence adapter; this does not create server-side case persistence or IOC history.

#### Caching semantics

Only successful provider observations are cached. Successful semantic negatives such as `not_listed`, `not_found`, `no_result` and `no_association` use the adapter's shorter negative TTL. Timeout, HTTP, transport, parsing and provider failures are never cached.

`cacheState` is provenance about retrieval path, not source freshness. Source freshness is calculated separately.

#### Batch

Batch results preserve original input order. Canonically duplicated inputs reuse one enrichment result and contain `duplicateOf`. Invalid items have `status: invalid` independently; they do not reject otherwise valid batch work.

#### STIX export

STIX export is derived only from a gateway-generated enrichment object. It does not add threat confidence that the evidence did not contain. MITRE source STIX IDs are preserved when available; other object IDs are random valid STIX IDs. Object count is capped at 100.

There is no universal maliciousness score anywhere in Evidence v2, Evidence Graph v1.0 or Guidance v1.0.
