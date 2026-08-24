### End-to-end enrichment example

This is a **sanitized structural example**, not captured production telemetry and not a claim about a live IOC. It uses the documentation-only address `203.0.113.10` so the flow can be understood without publishing sensitive or operational data.

#### 1. Request

```bash
curl --fail-with-body \
  -H 'Authorization: Bearer <CTI_GATEWAY_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"indicator":"203.0.113.10","profile":"standard"}' \
  https://<gateway>/api/enrich
```

The caller supplies only an indicator and a fixed profile. It cannot select an upstream provider, host, method, header or provider credential.

#### 2. Classification and routing

The gateway canonicalizes the input as:

```json
{
  "indicator": "203.0.113.10",
  "type": "ip",
  "profile": "standard"
}
```

The IP workflow then selects only the statically registered providers allowed by the `standard` profile. Missing credentials reduce coverage explicitly; they do not cause hidden fallback to an unregistered source.

#### 3. Fixed-egress provider execution

Each selected adapter executes through the central `safeFetch` boundary. The boundary enforces:

- HTTPS only and exact allowlisted hosts;
- declared methods only;
- no redirects;
- request/response byte ceilings;
- bounded timeout/retry behavior;
- provider concurrency of at most four.

Upstream responses remain untrusted until the provider parser validates and normalizes them.

#### 4. Evidence-v2 normalization

A successful response has the Evidence Schema v2 envelope. The trimmed example below is illustrative; provider availability, observations, timings, hashes and counts vary by request.

```json
{
  "schemaVersion": "2.0",
  "gatewayVersion": "2.0.0",
  "requestId": "<bounded-correlation-id>",
  "indicator": "203.0.113.10",
  "type": "ip",
  "profile": "standard",
  "status": "ok",
  "providerSummary": {
    "ok": 3,
    "failed": 0,
    "skipped": 2,
    "cached": 0
  },
  "evidence": [
    {
      "provider": "rdap",
      "indicator": "203.0.113.10",
      "type": "ip",
      "observation": {
        "kind": "registration",
        "verdict": "observed",
        "attributes": {}
      },
      "relationships": [],
      "references": ["https://<authoritative-rdap-reference>"],
      "retrievedAt": "<iso8601>",
      "cacheState": "miss",
      "durationMs": 42,
      "integrity": {
        "parserVersion": "<adapter-version>",
        "rawHash": "<sha256>",
        "fingerprint": "<sha256>"
      }
    }
  ],
  "relationships": [],
  "failures": [],
  "correlation": {
    "corroboration": [],
    "contradictions": [],
    "freshness": "unknown",
    "huntability": {
      "level": "<bounded-level>",
      "rationale": []
    }
  }
}
```

The important analytical property is what the gateway **does not** do: routing/registration context, scanner activity, Tor-exit status, reputation, ransomware claims and ATT&CK knowledge are not collapsed into a universal maliciousness score.

#### 5. Optional STIX export

The same input can be sent to the bounded STIX surface:

```bash
curl --fail-with-body \
  -H 'Authorization: Bearer <CTI_GATEWAY_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"indicator":"203.0.113.10","profile":"standard"}' \
  https://<gateway>/api/stix
```

The gateway enriches first and then maps only defensible evidence into a STIX 2.1 Bundle. Callers cannot inject their own enrichment object into the exporter. The bundle is capped at 100 objects.

#### 6. Offline report path

A frozen gateway evidence snapshot can be compiled without any network calls:

```bash
cti report compile snapshot.json --out ./report --preset all
```

The report quality gate runs before artifacts are written. The resulting bundle can contain deterministic HTML/PDF/text, evidence JSON, STIX, observables CSV, KQL hunt material, ATT&CK Navigator data and a SHA-256 manifest.

This gives a complete auditable path:

```text
indicator
  -> canonical classification
  -> fixed workflow/profile
  -> bounded provider fanout
  -> provider-specific parsing
  -> evidence-v2 provenance
  -> typed correlation
  -> JSON/STIX
  -> optional frozen offline report
```
