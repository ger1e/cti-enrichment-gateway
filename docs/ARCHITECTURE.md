### PARA11AX Architecture

#### Purpose

PARA11AX is a public-source CTI evidence gateway and analyst-operations surface for personal research/lab use. The canonical Evidence v2 core accepts one bounded indicator or batch, chooses a fixed workflow/profile, queries only predeclared provider destinations, normalizes provider-native evidence, correlates compatible observations, and returns provenance-preserving analytical/export projections.

Two analyst utilities intentionally sit beside—not inside—the Evidence v2 / Intelligence Kernel path:

1. **User Scanner** — active OSINT for email/username enumeration through an isolated server-configured Python worker.
2. **Shodan analyst shell** — bounded explicit Shodan host/search/count/stats/domain/info operations through a dedicated authenticated route.

Neither utility automatically becomes Evidence v2 evidence, Intelligence Kernel input, reputation voting, case evidence, STIX, or attribution.

#### Architecture at a glance

![PARA11AX request path](../assets/brand/para11ax-readme-architecture-v4.svg)

#### Passive Evidence v2 request path

```text
Client / Maltego / analyst UI
  -> API auth and request limits (except public /api/para11ax/meta)
  -> strict canonical indicator classifier
  -> fixed workflow + fast|standard|full profile admission
  -> configured-provider filter
  -> Provider Value Scheduler v1.0
  -> central safeFetch fixed-egress boundary
  -> provider parser
  -> bounded cache
  -> Evidence Schema v2 normalization + integrity fingerprint
  -> typed correlation / freshness / evidence quality / huntability
  -> Intelligence Kernel v1.0 (IP reference policy)
  -> deterministic Decision Support
  -> Evidence Graph v1.0 + Guidance v1.0 on ok/partial results
  -> JSON, bounded batch, deterministic report, or STIX 2.1
```

`safeFetch` is the hard egress boundary for the passive core. Callers cannot choose an arbitrary provider, destination, protocol, method, header, credential, redirect target, or proxy route. The scheduler and Kernel add no new egress.

#### Provider Value Scheduler v1.0

Provider admission remains owned by the fixed workflow/profile rules. Scheduler v1.0 only decides the deterministic attempt order among already-admitted providers.

The ordered comparator is static and inspectable. Its policy uses declarative provider/type metadata rather than returned evidence or runtime learning: authority, semantic uniqueness, direct threat value, pivot value, latency class, cost class, existing tier, then workflow order as deterministic fallback.

Current IP reference invariants:

- **24-provider IP workflow** — provider membership is unchanged.
- **48-call ceiling** — 24 providers × maximum two attempts.
- **max concurrency 4**.
- **request deadline 20 seconds**.
- profile admission remains separate from execution order.
- every admitted provider remains scheduled; evidence does not suppress later providers.
- missing/invalid scheduler metadata falls back deterministically rather than preventing execution.
- scheduler metadata is capability/audit metadata, not a threat score or analytical conclusion.

The exact IP v1 execution order is:

```text
rdap
-> tor-exit
-> ripestat
-> ipinfo
-> cloudflare-radar
-> feodo-tracker
-> threatfox
-> spamhaus-drop
-> abuseipdb
-> webamon
-> greynoise
-> urlscan
-> shodan
-> censys
-> modat
-> virustotal
-> threatminer
-> pulsedive
-> otx
-> misp-circl-osint
-> tweetfeed
-> dshield
-> misp-botvrij-osint
-> ransomlook
```

#### Intelligence Kernel v1.0

The Kernel is a pure deterministic analysis layer between normalized evidence/correlation and downstream analyst projections. The current reference implementation is IP-specific; the contract is reusable but does not impose IP semantics on other observable types.

Kernel v1.0 derives bounded context including:

- `evidenceStrength`: none / weak / moderate / strong;
- source diversity and independent-vs-duplicate corroboration;
- contradiction severity and explicit conflicting providers/evidence;
- temporal relevance from observation timestamps, not retrieval time;
- explicit relationship value and stable relationship identities;
- bounded passive **one-hop pivots** only from explicit normalized relationships;
- threat context separated into direct/supporting/contextual evidence;
- hunt relevance and telemetry requirements;
- capability-aware coverage impact;
- analyst priority: immediate / investigate / monitor / contextual / insufficient;
- explicit limitations and deterministic trace rule IDs.

Kernel output is **derived context, not Evidence v2**. It does not fetch, mutate evidence, parse free text into new entities, invent relationships, perform provider calls, read credentials, write persistence, learn from runtime behavior, or use an LLM. A Kernel failure cannot invalidate otherwise usable enrichment: the result keeps Evidence v2 and records `intelligence_projection_unavailable` rather than manufacturing a failed provider or benign conclusion.

#### Downstream projection boundaries

- **Evidence v2** — authoritative normalized provider observations, relationships, provenance and failures.
- **correlation** — typed compatibility/freshness/evidence-quality layer retained for compatibility.
- **Intelligence Kernel v1.0** — deterministic derived analyst context; currently IP reference policy.
- **Decision Support** — consumes a compatible same-type Kernel projection when present; otherwise keeps the established deterministic fallback.
- **Evidence Graph v1.0** — canonical graph over explicit Evidence v2 facts/relationships. Kernel-derived relationships do not become graph evidence.
- **Guidance v1.0** — can expose a bounded Kernel summary while existing Evidence Graph fingerprint validation remains authoritative.
- **IP analyst report** — consumes the same Kernel-backed model for executive assessment, relationships/pivots, contradiction severity, temporal context, hunt relevance and coverage; it does not re-reason independently in the browser.
- **STIX 2.1** — remains evidence-derived and does not promote Kernel conclusions to new evidence/attribution objects.

#### User Scanner request path

```text
PARA11AX analyst shell
  -> gateway bearer authentication
  -> bounded user-scanner grammar
  -> POST /api/para11ax/user-scanner
  -> scanType/target/category/module/crossScan/noNsfw validation
  -> server-configured PARA11AX_USER_SCANNER_URL only
  -> optional PARA11AX_USER_SCANNER_TOKEN
  -> isolated Python worker
  -> bounded result normalization
  -> terminal output
  -> Evidence v2 / intelligence state unchanged
```

User Scanner is an explicit active OSINT exception to passive provider behavior, but not to destination control. The browser cannot choose the worker host, proxy, concurrency, timeout, arbitrary module path, or bulk file.

#### Shodan analyst-shell request path

```text
PARA11AX analyst shell
  -> gateway bearer authentication
  -> fixed shodan command grammar
  -> POST /api/para11ax/shodan
  -> command/target/query/facets validation
  -> server-side SHODAN_API_KEY
  -> fixed https://api.shodan.io origin only
  -> bounded upstream request
  -> response normalization / banner stripping / list caps
  -> terminal output + explicit creditImpact
  -> Evidence v2 / intelligence state unchanged
```

Approved commands are exactly:

```text
shodan host <ip>
shodan search <query>
shodan count <query>
shodan stats <query> [--facets <fields>]
shodan domain <domain>
shodan info
```

The route is not a wrapper around arbitrary local shell execution and does not spawn the Python Shodan CLI. Caller-selected URLs, arbitrary pages/methods, `download`, scan submission, and unsupported options are rejected. Search is first-page only; returned matches/services are capped and large raw banner/service bodies are removed. The handler emits explicit `creditImpact`.

#### Trust boundaries

##### Caller -> gateway

Bearer authentication protects enrichment, batch, STIX, status, health, User Scanner, and Shodan operator surfaces. Request/media/input validation occurs before external execution. Caller input never chooses arbitrary provider hosts, User Scanner worker hosts, Shodan hosts, methods, credentials, scheduler rank, or proxy routes.

##### Gateway -> Evidence v2 provider

`safeFetch` enforces exact declared hosts, HTTPS methods/protocols, redirect refusal, timeouts, and response ceilings. Provider credentials remain server-side. Scheduler ordering does not weaken these controls.

##### Evidence v2 -> Intelligence Kernel

This is an in-process deterministic read-only boundary. Kernel code consumes normalized evidence/relationships/correlation/coverage plus subject/type and an injected time reference. It performs no network access, environment/secret reads or persistence and creates no new Evidence v2 items.

##### Gateway -> User Scanner worker

The destination comes only from `PARA11AX_USER_SCANNER_URL`. HTTPS is required except loopback HTTP in local development. Worker output is untrusted, byte-bounded, normalized, and kept separate from Evidence v2.

##### Gateway -> Shodan

The origin is fixed to `https://api.shodan.io`; the API key comes only from `SHODAN_API_KEY`. The route exposes no host/URL override. Missing configuration fails closed. Upstream 429/rate-limit state remains explicit rather than becoming an empty or benign result.

##### Upstream data -> analyst

All provider, User Scanner, and Shodan responses are untrusted. Provider parsers preserve evidence semantics; User Scanner preserves account-enumeration semantics; Shodan preserves infrastructure/exposure semantics.

A Shodan service, port, product, DNS record, organization, tag, or exposure observation is context—not proof of maliciousness, exploitability, compromise, ownership, current reachability, or actor attribution.

#### Evidence and graph boundaries

Normalization preserves provider, parser version, retrieval time, cache state, duration, source role/capability coverage where approved, and integrity fingerprint. Correlation is typed. Contextual routing/registration/Tor/scanner/Shodan/certificate/ATT&CK information cannot silently become a malware-reputation vote.

Graph concepts remain distinct:

```text
decision.entityGraph  -> compact decision-support pivots
evidenceGraph         -> canonical Evidence Graph v1.0
browser case graph    -> local-only case/snapshot/exact-sighting projection
```

Kernel `relationshipValue` / `pivotCandidates` are a separate derived context surface and do not become Evidence Graph edges. User Scanner and Shodan operator outputs are separate non-graph terminal surfaces unless a future explicit typed design introduces promotion/pinning.

#### Browser-local workspace

Cases, exact typed sightings, snapshots, semantic diffs, case graph state, and `.para11ax` bundles persist only in browser-local IndexedDB. Active-case selection and gateway bearer state are runtime-only. Neither User Scanner nor Shodan operator output is silently persisted into case evidence.

#### Scheduling and resilience

- Evidence v2 provider concurrency: max 4.
- Evidence v2 request deadline: 20 seconds.
- Retry: maximum two attempts/provider under the current execution policy.
- IP reference workflow: 24 providers / 48-call ceiling.
- Circuit breaker/cache: bounded, instance-local; provider failures never become cached negative evidence.
- Batch: max 20 inputs, max 3 active indicators, max 200 provider calls.
- STIX: max 100 generated objects.
- Kernel projection failure is isolated from usable Evidence v2.
- User Scanner: independently bounded request/response/deadline path.
- Shodan shell: one bounded explicit API operation per command; search fixed to first page; host/search output arrays capped; raw banners removed; `download` disabled.

#### Analytical model

There is deliberately no universal maliciousness score. Evidence stays in semantic classes, contradictions stay explicit, and absence is not benignness. There is also **no LLM** in the deterministic enrichment/analysis path.

For CVEs, KEV, EPSS, and CVSS remain separate axes. Huntability is operational mapping, not threat-confidence or attribution. Infrastructure proximity—including Shodan-visible services—does not manufacture actor attribution.

Guidance v1.0 inherits the existing bounded disposition vocabulary (`hunt_now`, `investigate`, `monitor`, `context_only`, `insufficient`). Kernel `analystPriority` is a separate derived analyst-priority field and is mapped deterministically rather than acting as a hidden numeric score.

User Scanner and Shodan operator output do not participate in that analytical vocabulary automatically.

#### Canonical Evidence v2 indicator types

- `ip`
- `domain`
- `url`
- `hash`
- `cve`
- `attack`
- `asn`
- `cidr`
- `certificate`

Certificate classification is explicit: `cert-sha256:<64-hex>`. Email/username targets and Shodan shell commands are not new Evidence v2 workflow types.

#### State labels

- **Implemented:** present in source and repository verification.
- **Configured:** required runtime secret/environment state exists.
- **Production-verified:** the exact deployed source SHA passed the specific authenticated/live checks being claimed.
- **Gap/omitted:** intentionally absent because source, semantics, or boundedness did not meet the design gate.

A READY deployment does not prove `SHODAN_API_KEY`, other provider credentials, User Scanner wiring, or authenticated enrichment readiness. See `OPERATIONS.md`, `SECURITY-CONTROLS.md`, and `QA-REPORT.md`.
