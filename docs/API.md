### API

All responses are JSON unless a documented human-facing error representation is explicitly negotiated. Production clients should use HTTPS. The gateway bearer is `Authorization: Bearer <PARA11AX_TOKEN>`.

#### Canonical Evidence v2 workflows

Supported indicator types are `ip`, `domain`, `url`, `hash`, `cve`, `attack`, `asn`, `cidr`, and `certificate`. Certificate input is explicit: `cert-sha256:<64-hex>`. Fixed profiles are `fast`, `standard`, and `full`; callers cannot select arbitrary Evidence v2 providers.

Email/username User Scanner operations and native Shodan commands are separate analyst utilities. They do not become canonical Evidence v2 workflow types and do not replace the current Evidence v2 result.

#### Route inventory

- `GET /api/para11ax/meta` — public static capabilities and hard limits.
- `GET /api/para11ax/health` — bearer-protected readiness; `Cache-Control: no-store`.
- `GET /api/para11ax/status` — bearer-protected count-only runtime state; `Cache-Control: no-store`.
- `POST /api/para11ax/enrich` — one canonical indicator.
- `POST /api/para11ax/batch` — 1–20 indicators; max 3 active indicators / 200 provider calls.
- `POST /api/para11ax/stix` — enrich then export bounded STIX 2.1.
- `POST /api/para11ax/user-scanner` — isolated bounded email/username active OSINT.
- `POST /api/para11ax/shodan` — bounded authenticated native Shodan operator commands.

Unknown `/api/para11ax/*` paths fail closed.

#### `POST /api/para11ax/enrich`

```json
{"indicator":"evil.example","profile":"standard"}
```

Normalized `ok`/`partial` results retain Evidence v2 and `decision` while additively exposing Evidence Graph v1.0 and Guidance v1.0. Error envelopes do not manufacture those projections.

#### `POST /api/para11ax/batch`

```json
{"indicators":["192.0.2.44","evil.example"],"profile":"standard"}
```

Limits: 1..20 strings, max 3 active indicators, max 200 provider calls globally, one shared deadline, canonical de-duplication, and no provider override.

#### `POST /api/para11ax/stix`

Uses the same single-indicator request contract as `/enrich`. The gateway enriches first and then maps the bounded result to STIX 2.1; caller-supplied enrichment objects are rejected.

#### `POST /api/para11ax/user-scanner`

Separate active-OSINT capability used by the `user-scanner` command and `osint` / `identity` aliases.

```json
{"scanType":"username","target":"kaifcodec","crossScan":false,"noNsfw":true}
```

The caller cannot select the worker URL, proxy, concurrency, arbitrary destination or timeout. Output remains separate from Evidence v2.

#### `POST /api/para11ax/shodan`

Bearer required. The browser sends a normalized Shodan operator request to the same-origin route. The gateway reads `SHODAN_API_KEY` server-side and contacts only `https://api.shodan.io`.

Approved shell commands and equivalent request shapes:

```text
shodan host <ip>
shodan search <query>
shodan count <query>
shodan stats <query> [--facets <fields>]
shodan domain <domain>
shodan info
```

```json
{"command":"host","target":"8.8.8.8"}
```

```json
{"command":"search","query":"product:FortiGate country:HU"}
```

```json
{"command":"count","query":"port:443 country:HU"}
```

```json
{"command":"stats","query":"product:nginx","facets":"country:20,org:10"}
```

```json
{"command":"domain","target":"example.com"}
```

```json
{"command":"info"}
```

Unknown fields and unsupported commands/options are rejected. Caller-selected URLs, pages, methods, credentials and arbitrary Shodan operations are not accepted. `shodan download` is disabled.

Response envelope:

```json
{
  "requestId":"<uuid>",
  "source":"shodan",
  "command":"stats",
  "input":{"query":"product:nginx","facets":"country:20,org:10"},
  "creditImpact":"none",
  "data":{},
  "durationMs":42
}
```

`creditImpact` is explicit:

- `host` — `none`
- `count` — `none`
- `stats` — `none`
- `info` — `none`
- `domain` — `consumes_query_credit`
- `search` — `may_consume_query_credit`

Search is first-page only. Search results and host-service lists are bounded; large raw banners/service bodies are removed before the response reaches the browser. Shodan operator output is terminal/operator context and leaves the current Evidence v2 enrichment result unchanged.

#### Common errors

- `400` — invalid request/indicator/profile/batch or invalid Shodan command/target/query/facets.
- `401 unauthorized`.
- `405 method_not_allowed`.
- `413 payload_too_large`.
- `415 unsupported_media_type`.
- User Scanner uses controlled `502`/`503`/`504` worker errors.
- Shodan missing configuration fails closed with controlled `503`; upstream rate limiting is returned explicitly rather than converted into empty/negative evidence.

#### Security invariants

Caller input never selects arbitrary provider hosts, Shodan hosts, worker hosts, methods, provider secrets, `SHODAN_API_KEY`, or arbitrary adapters. Evidence v2 provider egress remains fixed through `safeFetch`; User Scanner and Shodan use separate bounded authenticated routes with server-configured destinations. See `THREAT-MODEL.md`, `SECURITY-CONTROLS.md`, and `SHODAN-SHELL.md`.