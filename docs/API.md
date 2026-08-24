### API

All responses are JSON. Production clients should use HTTPS. The gateway bearer is `Authorization: Bearer <CTI_GATEWAY_TOKEN>`.

#### `GET /api/meta`

Public static capability metadata only. No authentication required.

Returns gateway/schema versions, supported indicator types, fixed profiles, hard limits and static provider capabilities. It does not expose credential names, credential values or whether a secret is configured.

#### `GET /api/health`

Bearer required. `Cache-Control: no-store`.

Returns operational readiness and provider configuration booleans without returning credential values. It is intentionally protected because configuration state is operational metadata rather than a public capability contract.

#### `GET /api/status`

Bearer required. `Cache-Control: no-store`.

Returns count-only runtime state: uptime, provider configuration booleans/parser versions, bounded cache counters, circuit-breaker counters and telemetry counters. Cache state includes entry/in-flight counts, hit/miss/eviction/expiration counters, approximate retained serialized bytes, and the hard aggregate byte ceiling; it never returns cached values. The endpoint does not return prior raw indicators or credentials.

#### `POST /api/enrich`

Bearer required. JSON body:

```json
{"indicator":"evil.example","profile":"standard"}
```

Optional `type` is accepted only when it exactly matches canonical classification. Optional `profile` is one of `fast`, `standard`, `full`. Provider overrides are not accepted.

The response is the Evidence Schema v2 envelope described in `EVIDENCE-SCHEMA.md`.

#### `POST /api/batch`

Bearer required. JSON body:

```json
{"indicators":["192.0.2.44","evil.example"],"profile":"standard"}
```

Hard limits:

- 1..20 strings
- max 3 active indicators
- max 200 provider calls globally
- one shared deadline
- canonical duplicates execute provider work once and are re-associated to input order
- invalid individual indicators are represented independently
- no provider override field

#### `POST /api/stix`

Bearer required. JSON body is the same single-indicator request contract as `/api/enrich`.

The gateway performs normal enrichment first, then maps the result to a dependency-free STIX 2.1 Bundle. Max 100 objects. Caller-supplied enrichment objects are rejected.

Defensible mappings include IP/domain/URL/hash/ASN Indicators, CVE Vulnerability SDOs and preserved MITRE ATT&CK source objects. CIDR is not fabricated into an unsupported pattern. Actor/malware SDOs require explicit supported relationships.

#### Common errors

- `400 invalid_request`, `invalid_indicator`, `indicator_type_mismatch`, `invalid_profile`, `invalid_batch`, `unsupported_request_field`
- `401 unauthorized`
- `405 method_not_allowed`
- `413 payload_too_large`
- `415 unsupported_media_type`

Provider failures inside a successful API request are represented in the evidence envelope as partial/error coverage rather than reflected raw exception text.

#### Security invariants

Caller input never selects an outbound host, method, provider secret or arbitrary adapter. Redirects are refused at the provider egress boundary. Request bodies are capped, and upstream response bodies are byte-bounded while streaming before parsing. See `THREAT-MODEL.md`.
