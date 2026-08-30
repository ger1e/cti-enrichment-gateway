### Security controls

This document maps PARA11AX controls to the risks they reduce. It is descriptive, not a compliance attestation.

| Area | Control | Security effect | Residual risk |
| --- | --- | --- | --- |
| Authentication | Gateway bearer required for enrichment/health/status/User Scanner/Shodan shell | Prevents unauthenticated provider-backed, operational and analyst-utility use | A stolen bearer remains usable until rotated |
| Public metadata | `/api/para11ax/meta` is static and intentionally unauthenticated | Capability discovery without exposing credential values | Public metadata reveals product capability shape |
| Provider secrets | Vendor credentials remain server-side | Prevents browser/Maltego disclosure | Runtime compromise can still expose secrets |
| Shodan secret | `SHODAN_API_KEY` is read only server-side by the provider/shell paths | Prevents the analyst browser from receiving the Shodan credential | Runtime compromise can expose the key |
| User Scanner secret | Optional `PARA11AX_USER_SCANNER_TOKEN` remains server-side | Prevents worker-bearer disclosure to browser | Gateway compromise can expose it |
| Evidence input | Deterministic indicator classification and syntax/size validation | Reduces parser ambiguity and malformed-input abuse | Valid adversarial indicators still reach bounded adapters |
| User Scanner input | Only bounded email/username/category/module/boolean fields; unknown fields rejected | Prevents arbitrary worker invocation | Authorized enumeration remains noisy/third-party constrained |
| Shodan input | Fixed `host`, `search`, `count`, `stats`, `domain`, `info` grammar; validated target/query/facets; unknown fields/options rejected | Prevents the shell route becoming arbitrary Shodan/API invocation | Valid searches can still be expensive or reveal broad public exposure data |
| Certificate identity | Explicit `cert-sha256:` transport | Prevents bare SHA-256 ambiguity | Analyst may explicitly select wrong type |
| Evidence egress | Exact provider hosts/methods/protocols through `safeFetch` | Prevents arbitrary SSRF/proxying in Evidence v2 | Provider-side behavior remains an upstream risk |
| User Scanner egress | Worker destination comes only from server configuration | Contains high-fan-out active OSINT behind one controlled boundary | Worker intentionally contacts many third parties |
| Shodan egress | Native shell origin fixed to `https://api.shodan.io`; no caller-selected URL/host/method/proxy | Prevents Shodan shell from becoming a generic proxy or arbitrary fetcher | Shodan itself remains an external dependency |
| Shodan operation scope | No on-demand scan submission, arbitrary paging, bulk `download`, or arbitrary endpoint selection | Limits quota/resource amplification and active behavior | Approved search/domain operations may consume query credits |
| Shodan response bounds | First-page search, capped match/service arrays, large banner/service bodies removed | Limits response amplification and browser exposure of excessive raw data | Even bounded service metadata can be sensitive in an investigation |
| Provider handling | Timeouts, bounded bodies, structured 429 handling | Limits resource exhaustion and uncontrolled upstream behavior | Provider outage can produce partial results |
| Shodan rate handling | Missing config fails closed; rate limiting remains explicit | Prevents empty/rate-limited response becoming false negative evidence | Account credits/rate limits remain external operational state |
| Error handling | Raw upstream exception text/credential-bearing URLs not reflected | Reduces secret/internal leakage | Logs still require safe handling |
| Evidence semantics | Provider-native semantics and provenance preserved | Reduces false certainty and naive vendor voting | Analysts can over-interpret correlations |
| Shodan semantics | Service/exposure observations remain context; shell output leaves Evidence v2 unchanged | Prevents Shodan exposure from silently becoming maliciousness, attribution, or case evidence | Analysts may manually over-correlate exposed services |
| Identity semantics | User Scanner results remain separate from Evidence v2 | Prevents registration/handle hits becoming threat/identity proof | Manual over-correlation remains possible |
| Evidence Graph | Explicit deterministic bounded facts/relationships only | Prevents free-form graph inference | Explicit upstream relationships can still be wrong |
| Guidance | Inherits existing decision vocabulary/evidence references | Prevents a second hidden scoring engine | Analysts can over-weight guidance |
| Attribution | Infrastructure/certificate/Shodan proximity is not actor attribution | Reduces unsupported attribution | Human judgment remains a risk |
| Browser cases | IndexedDB-only case persistence; active case/auth runtime-only | Prevents server-side IOC history/bearer persistence | Local browser compromise can expose cases |
| Browser utilities | User Scanner/Shodan terminal output is not automatically persisted as typed Evidence v2 case material | Prevents untyped utility results silently entering case evidence | Analysts can manually copy results elsewhere |
| HTTP response | Authenticated responses use defensive headers/no-store where applicable | Reduces accidental caching/exposure | Downstream clients can persist data |
| Deployment | Production acceptance compares deployment metadata to exact verified `main` SHA | Reduces stale/unreviewed deployment acceptance | Compromised main/admin remains supply-chain risk |
| CI supply chain | Actions pinned to immutable SHAs; bounded Tooling smoke + CodeQL | Reduces mutable-action and drift risk | Pinned dependencies may later be found vulnerable |
| Repository hygiene | Secrets/captures/samples/generated sensitive artifacts blocked/ignored | Reduces accidental publication | Ignore rules do not remove history |
| Public release | `npm run audit:public` plus release checklist | Adds publication guardrail | Not complete DLP/licensing review |
| Documentation integrity | Executable documentation-contract tests include Shodan shell facts | Reduces silent operator-doc drift | Prose nuance still requires review |

#### Shodan analyst-shell boundary

The native Shodan command surface is an explicit analyst utility, not a general-purpose shell and not a caller-controlled proxy. The browser calls only same-origin `POST /api/para11ax/shodan`; the gateway authenticates the request, validates one of six approved commands, reads `SHODAN_API_KEY` server-side, and contacts only `https://api.shodan.io`.

Approved commands:

```text
shodan host <ip>
shodan search <query>
shodan count <query>
shodan stats <query> [--facets <fields>]
shodan domain <domain>
shodan info
```

`shodan download`, arbitrary paging, arbitrary URLs, unsupported options, caller-selected methods, and on-demand scan submission are disabled. Search is first-page only and normalized output is bounded. Large raw banners are intentionally omitted from the browser envelope.

Credit impact is surfaced explicitly: host/count/stats/info are classified as no-query-credit operations; domain consumes a query credit; search may consume a query credit depending on Shodan plan/query behavior. Operational smoke tests should prefer `info`, `host`, or `count` over credit-consuming operations when possible.

Shodan service/exposure metadata is contextual. A port/product/tag/DNS record does not itself prove compromise, exploitability, ownership, maliciousness, or attribution. Native shell output is not automatically injected into Evidence v2 correlation, decision, Evidence Graph, case graph, STIX, or browser case evidence.

#### User Scanner active OSINT boundary

User Scanner remains an explicitly active OSINT capability. The existing PARA11AX shell calls a same-origin authenticated route which forwards only to the server-configured isolated worker. Browser callers cannot set the worker URL/token, proxy routes, concurrency, or arbitrary destinations. Matching handles/registration signals are platform-specific OSINT, not same-person identity proof or compromise evidence.

#### External settings controls

The following require GitHub/Vercel/account settings and cannot be guaranteed by repository files alone:

- branch/ruleset protection for `main`;
- force-push/deletion restrictions;
- required status checks/reviews;
- signed-commit enforcement where practical;
- secret scanning/push protection;
- CodeQL/default code scanning;
- passkey/2FA/recovery hygiene;
- production environment-secret configuration including `SHODAN_API_KEY` and User Scanner wiring.

A Vercel `READY` deployment proves deployment/source identity only. Shodan/provider credential readiness and User Scanner wiring require authorized authenticated checks.