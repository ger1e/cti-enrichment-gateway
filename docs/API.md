### API

All responses are JSON unless a documented human-facing error representation is explicitly negotiated. Production clients should use HTTPS. The gateway bearer is `Authorization: Bearer <PARA11AX_TOKEN>`.

#### Supported indicator types

The canonical gateway workflows are:

- `ip`
- `domain`
- `url`
- `hash`
- `cve`
- `attack`
- `asn`
- `cidr`
- `certificate`

Certificate input is explicit rather than inferred from a bare hash: `cert-sha256:<64-hex>`. A bare SHA-256 remains a file `hash`. Optional request `type` is accepted only when it exactly matches canonical classification.

Fixed profiles are `fast`, `standard`, and `full`. Callers cannot select arbitrary providers.

Email and username enumeration are not canonical Evidence v2 indicator workflows. They are exposed separately through the authenticated User Scanner active-OSINT route described below.

#### `GET /api/para11ax/meta`

Public static capability metadata only. No authentication required.

Returns gateway/schema versions, supported indicator types, fixed profiles, hard limits and static provider capabilities. It does not expose credential names, credential values or whether a secret is configured.

#### `GET /api/para11ax/health`

Bearer required. `Cache-Control: no-store`.

Returns operational readiness and provider configuration booleans without returning credential values. It is intentionally protected because configuration state is operational metadata rather than a public capability contract.

#### `GET /api/para11ax/status`

Bearer required. `Cache-Control: no-store`.

Returns count-only runtime state: uptime, provider configuration booleans/parser versions, bounded cache counters, circuit-breaker counters and telemetry counters. Cache state includes entry/in-flight counts, hit/miss/eviction/expiration counters, approximate retained serialized bytes, and the hard aggregate byte ceiling; it never returns cached values. The endpoint does not return prior raw indicators or credentials.

#### `POST /api/para11ax/enrich`

Bearer required. JSON body:

```json
{"indicator":"evil.example","profile":"standard"}
```

Certificate example:

```json
{"indicator":"cert-sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","type":"certificate","profile":"standard"}
```

Optional `type` is accepted only when it exactly matches canonical classification. Optional `profile` is one of `fast`, `standard`, `full`. Provider overrides are not accepted.

The response is the Evidence Schema v2 envelope described in `EVIDENCE-SCHEMA.md`.

For normalized `status: "ok"` and `status: "partial"` enrichment responses, Train 5 adds two top-level projections without replacing existing fields:

- `evidenceGraph` — deterministic Evidence Graph v1.0 built only from explicit normalized facts and relationships.
- `guidance` — deterministic Guidance v1.0 that inherits the existing decision/correlation semantics and may include semantic-change attention context.

These fields are additive. Error envelopes do not gain `evidenceGraph` or `guidance`, and the existing `decision` field remains authoritative for the bounded disposition vocabulary.

#### `POST /api/para11ax/batch`

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

Successful individual results retain the same enrichment contract, including additive graph/guidance projections where applicable.

#### `POST /api/para11ax/stix`

Bearer required. JSON body is the same single-indicator request contract as `/api/para11ax/enrich`.

The gateway performs normal enrichment first, then maps the result to a dependency-free STIX 2.1 Bundle. Max 100 objects. Caller-supplied enrichment objects are rejected.

Defensible mappings include IP/domain/URL/hash/ASN Indicators, CVE Vulnerability SDOs and preserved MITRE ATT&CK source objects. CIDR is not fabricated into an unsupported pattern. Certificate context is not fabricated into a STIX object when no defensible mapping exists. Actor/malware SDOs require explicit supported relationships.

#### POST `/api/para11ax/user-scanner`

Bearer required. This is a separate active OSINT capability used by the existing analyst shell command `user-scanner` and its `osint` / `identity` aliases. It does not enter the Evidence v2 enrichment/correlation path and does not become the current enrichment result.

Example username request:

```json
{"scanType":"username","target":"kaifcodec","crossScan":false,"noNsfw":true}
```

Example email request scoped to one category:

```json
{"scanType":"email","target":"analyst@example.com","category":"social","crossScan":false,"noNsfw":true}
```

Request contract:

- `scanType` — required; `email` or `username`.
- `target` — required non-empty string, max 320 characters.
- `category` — optional safe module-category name, max 64 characters.
- `module` — optional safe module name, max 64 characters; mutually exclusive with `category`.
- `crossScan` — optional boolean; cross-scan remains explicitly opt-in.
- `noNsfw` — optional boolean; defaults to `true`.
- Unknown fields are rejected.

The gateway never accepts a caller-selected worker URL, proxy, concurrency, arbitrary destination or timeout. It forwards a normalized request only to the server-configured `PARA11AX_USER_SCANNER_URL`, with optional worker bearer `PARA11AX_USER_SCANNER_TOKEN`. HTTPS is required except for loopback HTTP in local development.

Successful responses are bounded User Scanner envelopes rather than Evidence v2. They include `scanId`, `scanType`, `target`, a summary (`totalScanned`, `found`, `notFound`, `errors`, `skipped`), bounded `results`, bounded `erroredSites`, `durationMs`, and `source: "user-scanner"`. A `Found`/registration result is platform-account OSINT evidence only; it is not proof of identity, account control, compromise, maliciousness or attribution. Worker/module errors remain errors rather than negative evidence.

The gateway caps the request body at 4 KiB, worker response at 2 MiB, normalized results at 1000 entries and errored-site names at 512 entries. The gateway-side worker deadline defaults to 55 seconds.

Hosted deployment requires the isolated worker to be deployed separately and the PARA11AX project to configure:

```text
PARA11AX_USER_SCANNER_URL=https://user-scanner-kappa.vercel.app
PARA11AX_USER_SCANNER_TOKEN=<optional matching worker bearer>
```

#### Common errors

- `400 invalid_request`, `invalid_indicator`, `indicator_type_mismatch`, `invalid_profile`, `invalid_batch`, `unsupported_request_field`
- User Scanner validation: `invalid_scan_type`, `invalid_target`, `invalid_category`, `invalid_module`, `category_module_conflict`, `invalid_cross_scan`, `invalid_no_nsfw`
- `401 unauthorized`
- `405 method_not_allowed`
- `413 payload_too_large`
- `415 unsupported_media_type`
- User Scanner runtime: `503 user_scanner_unconfigured` / `user_scanner_misconfigured`, `502 user_scanner_worker_error` / `user_scanner_unavailable`, `504 user_scanner_timeout`

Provider failures inside a successful enrichment API request are represented in the evidence envelope as partial/error coverage rather than reflected raw exception text. User Scanner worker failures are returned as controlled route errors and never converted into not-found results.

#### Security invariants

Caller input never selects an outbound host, method, provider secret or arbitrary adapter. Redirects are refused at the provider egress boundary. Request bodies are capped, and upstream response bodies are byte-bounded while streaming before parsing. The User Scanner route preserves a separate boundary: the browser calls only the same-origin gateway route, the worker destination is server-configured, and active OSINT output remains separate from Evidence v2. See `THREAT-MODEL.md`.
