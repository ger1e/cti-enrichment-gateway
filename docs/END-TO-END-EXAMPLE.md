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

Each selected adapter executes through the central `safeFetch` boundary. The boundary enforces:

- HTTPS only and exact allowlisted hosts;
- declared methods only;
- no redirects;
- request/response byte ceilings;
- bounded timeout/retry behavior;
- provider concurrency of at most four.

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
  },
  "decision": {
    "disposition": "context_only",
    "confidence": "low",
    "reasons": ["<machine-readable reason>"],
    "huntPlan": []
  },
  "evidenceGraph": {
    "schemaVersion": "1.0",
    "nodes": [],
    "edges": []
  },
  "guidance": {
    "schemaVersion": "1.0",
    "disposition": "context_only",
    "confidence": "low"
  }
}
```

The graph/guidance fragments are intentionally abbreviated. Their important contract is additive and provenance-preserving:

```text
evidence
  -> typed correlation
  -> bounded decision support
  -> Evidence Graph v1.0 + Guidance v1.0 projections
  -> analyst interpretation/export
```

`decision`, `evidenceGraph`, and `guidance` answer different questions:

- `decision` provides the existing bounded operational disposition, confidence, limitations, telemetry needs and hunt-plan templates.
- `evidenceGraph` provides deterministic explicit investigation facts/relationships with stable identities; it does not infer entities from arbitrary prose or infrastructure proximity.
- `guidance` explains the existing decision/evidence context and approved semantic changes; it does not create a second score or decision engine.

For `status: "error"`, the graph/guidance projections are absent and the legacy error envelope remains unchanged.

The important analytical property is what the gateway **does not** do: routing/registration context, certificate metadata, scanner activity, Tor-exit status, reputation, ransomware claims and ATT&CK knowledge are not collapsed into a universal maliciousness score. Generated KQL or `hunt_now` guidance is a hunting hypothesis, not proof that the asset is compromised.

#### 5. Browser-local case workspace

The analyst UI can capture successful Evidence v2 results into a local case. Case snapshots, semantic diffs, exact typed cross-case sightings and `.para11ax` bundles live in the browser-local workspace. IndexedDB is the case persistence adapter; the gateway does not become a server-side case database.

Free-form case notes are not parsed into graph entities. Certificate snapshots retain explicit certificate identity and restore `cert-sha256:` when replayed through the gateway.

#### 6. Optional STIX export

The same input can be sent to the bounded STIX surface:

```bash
curl --fail-with-body \
  -H 'Authorization: Bearer <PARA11AX_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"indicator":"203.0.113.10","profile":"standard"}' \
  https://<gateway>/api/para11ax/stix
```

The gateway enriches first and then maps only defensible evidence into a STIX 2.1 Bundle. Callers cannot inject their own enrichment object into the exporter. The bundle is capped at 100 objects.

#### 7. Offline report path

A frozen gateway evidence snapshot can be compiled without any network calls:

```bash
para11ax report compile snapshot.json --out ./report --preset all
```

The report quality gate runs before artifacts are written. The resulting bundle can contain deterministic HTML/PDF/text, evidence JSON, STIX, observables CSV, KQL hunt material, ATT&CK Navigator data and a SHA-256 manifest.

Complete auditable path:

```text
indicator
  -> canonical classification
  -> fixed workflow/profile
  -> bounded provider fanout
  -> provider-specific parsing
  -> Evidence v2 provenance
  -> typed correlation
  -> bounded decision support
  -> Evidence Graph v1.0 + Guidance v1.0
  -> JSON/STIX
  -> optional browser-local case capture
  -> optional frozen offline report
```
