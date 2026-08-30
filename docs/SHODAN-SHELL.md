# Shodan analyst shell

PARA11AX exposes a bounded native Shodan command surface inside the existing authenticated analyst shell. It is an operator utility, not a second Evidence v2 enrichment pipeline.

## Commands

```text
shodan host <ip>
shodan search <query>
shodan count <query>
shodan stats <query> [--facets <fields>]
shodan domain <domain>
shodan info
```

Examples:

```text
shodan host 8.8.8.8
shodan search product:"FortiGate" country:HU
shodan count port:443 country:HU
shodan stats product:nginx --facets country:20,org:10
shodan domain example.com
shodan info
```

## Boundary

The browser calls only the same-origin authenticated endpoint `POST /api/para11ax/shodan`. The gateway reads `SHODAN_API_KEY` server-side and sends requests only to the fixed upstream origin `https://api.shodan.io`. The caller cannot select an arbitrary URL, host, page, HTTP method, credential, proxy, or provider destination.

Shodan operator results are rendered in terminal scrollback and leave the current Evidence v2 enrichment result unchanged. They are not promoted into Evidence v2 correlation, case evidence, STIX, or provider voting automatically.

## Bounded behavior

- `host` performs one exact IP lookup and does not consume a query credit under the Shodan API credit model.
- `count` and `stats` use the count endpoint and are classified as no-query-credit operations by PARA11AX.
- `info` retrieves account/API plan and remaining-credit metadata and is classified as no-query-credit.
- `domain` is explicitly marked as consuming a query credit.
- `search` is first-page only and is marked as potentially consuming a query credit depending on Shodan plan/query behavior.
- Search results are capped and large raw banners/service bodies are removed before returning to the browser.
- `download`, arbitrary paging, caller-selected URLs and unsupported options are disabled.

The terminal surfaces the returned `creditImpact` classification so the analyst can see whether a command is free, credit-consuming, or potentially credit-consuming before treating it as a routine workflow.

## Authentication and configuration

The route requires the normal PARA11AX gateway bearer:

```text
Authorization: Bearer <PARA11AX_TOKEN>
```

Production configuration requires:

```text
SHODAN_API_KEY=<server-side Shodan API key>
```

Never expose or commit the Shodan key. Missing configuration fails closed with a controlled service-unavailable response. Shodan rate limiting is returned explicitly rather than converted into empty/negative evidence.

## Semantics

Shodan host, service, DNS, organization and exposure data are infrastructure/exposure context. They do not by themselves prove compromise, maliciousness, attribution, ownership, exploitability, or current reachability.

The dedicated shell surface is separate from the normal Shodan Evidence v2 provider adapter. The provider adapter remains governed by the fixed provider registry and Evidence v2 semantics; the analyst-shell commands are explicit operator lookups with their own bounded response envelope.
