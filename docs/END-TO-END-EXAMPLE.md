### End-to-end enrichment example

This is a **sanitized structural example**, not captured production telemetry and not a claim about a live IOC. It uses the documentation-only address `203.0.113.10` so the flow can be understood without publishing sensitive or operational data.

#### 1. Request

```bash
curl --fail-with-body \
  -H 'Authorization: Bearer <PARA11AX_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"indicator":"203.0.113.10","profile":"standard"}' \
  https://<gateway>/api/para11ax/enrich
```

The caller supplies only an indicator and a fixed profile. It cannot select an upstream provider, host, method, header or provider credential.

The same classifier supports nine explicit workflow types: `ip`, `domain`, `url`, `hash`, `cve`, `attack`, `asn`, `cidr`, and `certificate`. Certificate SHA-256 is explicit as `cert-sha256:<64-hex>`; a bare SHA-256 remains a file hash.

#### 2. Classification and routing

The gateway canonicalizes the example input as:

```json
{
  "indicator": "203.0.113.10",
  "type": "ip",
  "profile": "standard"
}
```

The IP workflow then selects only statically registered providers allowed by the `standard` profile. Missing credentials reduce coverage explicitly; they do not cause hidden fallback to an unregistered source.

#### 3. Fixed-egress provider execution

Each selected adapter executes through the central `safeFetch` boundary. The boundary enforces HTTPS only, exact allowlisted hosts, declared methods, no redirects, request/response ceilings, bounded timeout/retry behavior, and provider concurrency of at most four.

Upstream responses remain untrusted until the provider parser validates and normalizes them.

#### 4. Evidence v2, correlation and decision support

A successful response uses the Evidence Schema v2 envelope. The trimmed example below is illustrative; provider availability, observations, timings, hashes and counts vary by request.

```json
{
  "schemaVersion": "2.0",
  "gatewayVersion": "2.0.0",
  "requestId": "<bounded-correlation-id>",
  "indicator": "203.0.113.10",
  "type": "ip",
  "profile": "standard",
  "status": "ok",
  "providerSummary": {"ok": 3, "failed": 0, "skipped": 2, "cached": 0},
  "evidence": [],
  "relationships": [],
  "failures": [],
  "correlation": {
    "corroboration": [],
    "contradictions": [],
    "freshness": "unknown",
    "huntability": {"level": "<bounded-level>", "rationale": []}
  },
  "decision": {
    "disposition": "context_only",
    "confidence": "low",
    "reasons": ["<machine-readable reason>"],
    "huntPlan": []
  },
  "evidenceGraph": {"schemaVersion": "1.0", "nodes": [], "edges": []},
  "guidance": {"schemaVersion": "1.0", "disposition": "context_only", "confidence": "low"}
}
```

The important analytical property is what the gateway **does not** do: routing/registration context, Shodan/Censys exposure, certificate metadata, scanner activity, Tor-exit status, reputation, ransomware claims and ATT&CK knowledge are not collapsed into a universal maliciousness score. Generated KQL or `hunt_now` guidance is a hunting hypothesis, not proof of compromise.

#### 5. Browser-local case workspace

The analyst UI can capture successful Evidence v2 results into a local case. Case snapshots, semantic diffs, exact typed cross-case sightings and `.para11ax` bundles live in browser-local IndexedDB. The gateway does not become a server-side case database.

User Scanner and native Shodan analyst-shell output are terminal/operator surfaces and are **not** automatically persisted into Evidence v2 case evidence.

#### 6. Native Shodan operator path

The analyst can make an explicit bounded Shodan lookup without replacing the current Evidence v2 result:

```text
analyst@para11ax:~$ shodan host 203.0.113.10
```

Equivalent HTTP request:

```bash
curl --fail-with-body \
  -H 'Authorization: Bearer <PARA11AX_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"command":"host","target":"203.0.113.10"}' \
  https://<gateway>/api/para11ax/shodan
```

Request path:

```text
analyst shell
  -> same-origin /api/para11ax/shodan
  -> bearer authentication
  -> fixed command/argument validation
  -> server-side SHODAN_API_KEY
  -> fixed https://api.shodan.io
  -> bounded normalization
  -> terminal output + creditImpact
  -> Evidence v2 state unchanged
```

The same bounded command surface supports:

```text
shodan host <ip>
shodan search <query>
shodan count <query>
shodan stats <query> [--facets <fields>]
shodan domain <domain>
shodan info
```

`shodan search` is first-page only; returned match/service arrays are capped and large raw banners are removed. `shodan download`, arbitrary paging, caller-selected URLs and on-demand scan submission are disabled. Host/count/stats/info are classified as no-query-credit operations, domain consumes a query credit, and search may consume a query credit.

A Shodan-visible service remains exposure context rather than proof of compromise, exploitability, ownership or attribution.

#### 7. Optional STIX export

The Evidence v2 input can be sent to the bounded STIX surface:

```bash
curl --fail-with-body \
  -H 'Authorization: Bearer <PARA11AX_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"indicator":"203.0.113.10","profile":"standard"}' \
  https://<gateway>/api/para11ax/stix
```

The gateway enriches first and maps only defensible Evidence v2 into a STIX 2.1 Bundle. Native Shodan shell output is not silently included in that bundle.

#### 8. Offline report path

A frozen Evidence v2 snapshot can be compiled without network calls:

```bash
para11ax report compile snapshot.json --out ./report --preset all
```

Complete auditable separation:

```text
canonical indicator -> Evidence v2 -> correlation/decision -> graph/guidance -> JSON/STIX/report
explicit User Scanner command -> isolated active OSINT -> terminal only
explicit Shodan command -> fixed Shodan API -> bounded operator result -> terminal only
```
