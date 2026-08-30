### Threat Model

#### Assets

- gateway bearer token;
- provider API credentials, including `SHODAN_API_KEY`;
- normalized CTI evidence and provenance;
- provider quotas/availability and Shodan query-credit state;
- repository, CI and deployment integrity;
- analyst privacy: queried indicators/targets should not leak through operational surfaces;
- browser-local case/snapshot content where the analyst chooses to persist it.

#### Adversaries and failure sources

The design assumes an untrusted caller may control indicator text, Shodan query text, and request timing; upstream providers may be malformed/compromised/unavailable; credentials can be exposed outside the application; browser-local state can be read by a compromised local profile; and repository/deployment supply chains can drift or be compromised.

#### Threats, controls and tests

| Threat | Primary controls | Executable evidence |
|---|---|---|
| Leaked gateway bearer | bearer auth on sensitive APIs; no token reflection; rotation through secret store | auth/API tests; public-release audit |
| Provider/Shodan secret compromise | server-side-only credentials; no caller-selected headers; status/meta expose booleans not values; browser never receives `SHODAN_API_KEY` | meta/status, Shodan terminal and credential-boundary tests |
| Evidence-v2 SSRF / arbitrary proxying | static provider registry; exact hosts/methods/protocols; `safeFetch`; no provider override | egress-policy/manifest tests |
| Shodan SSRF / arbitrary API proxying | exact `https://api.shodan.io` origin; six-command allowlist; validated IP/domain/query/facets; no URL/method/page/endpoint override | `shodan-terminal.test.mjs` |
| Shodan active-scan abuse | on-demand scan submission absent; arbitrary API methods/endpoints and `download` rejected | shell parser/handler tests |
| Shodan quota amplification | first-page search only; no arbitrary paging/download; credit impact explicit; count/stats/info/host available as no-query-credit paths | Shodan endpoint/credit tests |
| Oversized Shodan response/banner exposure | bounded search/service lists; minified search; raw banner/service bodies stripped | Shodan response-bounds tests |
| Shodan rate-limit confusion | explicit rate-limit error; no conversion to empty/not-found/benign evidence | Shodan throttling tests |
| Redirect credential exfiltration | Evidence v2 redirects refused; Shodan host fixed by handler construction | egress/Shodan tests |
| Malicious or malformed upstream | response ceilings; parser/normalizer validation; fail-closed handling | public-feed, Shodan, MISP and chaos tests |
| Quota/latency amplification | Evidence v2 fixed profiles/tier scheduler/call ceilings/deadline; Shodan fixed single operation and bounded output | scheduler/profile/batch/Shodan tests |
| Provider outage / rate limiting | explicit partial failures; bounded retry/circuit behavior | scheduler/circuit/chaos tests |
| Cache poisoning / stale outage state | bounded namespaced cache; provider failures never cached | cache/chaos tests |
| Provenance confusion | parser version, retrieval time, provider, raw-result hash and evidence fingerprint preserved | Evidence v2/release-manifest tests |
| False corroboration | typed semantic classes; routing/scanner/Tor/Shodan/certificate/ATT&CK context excluded from reputation votes | correlation/Shodan semantics docs/tests |
| False attribution | hosting/certificate/Shodan exposure relationships are pivots/context only; attribution requires explicit supported evidence | correlation/STIX/Evidence Graph tests |
| Ambiguous certificate/hash classification | explicit `cert-sha256:` transport | classifier/browser/Maltego tests |
| Graph over-inference | Evidence Graph uses supported explicit facts/relationships only; free-form notes not entity sources | Evidence Graph/case graph tests |
| Shodan operator result promoted as Evidence v2 | dedicated response envelope; shell renderer states Evidence v2 unchanged; no automatic correlation/case/STIX path | Shodan shell/client/UI tests |
| Guidance as hidden scoring | Guidance inherits existing disposition/confidence and evidence refs | guidance tests |
| Browser case leakage/server persistence | IndexedDB-only case state; auth runtime-only; secret-bearing structural keys rejected | case storage/security/bundle tests |
| Malicious MISP content | exact attribute semantics; deleted=false; bounded event fetches | MISP tests |
| Unbounded ATT&CK expansion | fixed collection IDs/type filtering; unbounded relationships omitted | TAXII tests |
| Log/telemetry leakage | allowlisted telemetry; raw indicators excluded by default; no-store count-only status | telemetry/status tests |
| STIX overclaiming | export only from gateway-generated Evidence v2; explicit relationship gate; max 100 objects | STIX tests |
| Documentation drift | executable documentation checks include Shodan route/commands/key/fixed-host/credit/isolation semantics | documentation-contract tests |
| Actions supply-chain compromise | pinned GitHub Actions; repository invariant checks | Tooling smoke |
| Deployment/source drift | production acceptance compares exact deployed SHA; credentialed surfaces verified separately | operations/finalizer contract |

#### Shodan-specific residual risk

- Shodan can return semantically wrong, stale, or incomplete exposure data even when the response is syntactically valid.
- An exposed service does not prove current reachability, exploitability, compromise, maliciousness, ownership, or actor attribution.
- Query-credit/account policy is external and can change independently of repository source.
- Authorized search/domain use may consume credits even though the route is bounded.
- A stolen `SHODAN_API_KEY` remains usable until revoked/rotated at Shodan.
- Shodan receives the operator's approved query/target because that is necessary to perform the lookup; analysts must respect authorization/data-handling requirements.

#### General residual risk

- Provider APIs can return semantically wrong but syntactically valid data.
- In-memory gateway cache/circuit state is instance-local and non-durable.
- Browser-local cases are durable inside the browser profile by design.
- A stolen gateway bearer remains usable until rotation/revocation.
- A compromised repository/deployment administrator can bypass application controls.
- Source coverage changes over time; absence is not benignness.
- Documentation-contract tests protect selected machine-readable facts, not every prose nuance.

#### Out of scope by design

Malware submission/detonation, remediation, credential testing, arbitrary web fetching, arbitrary shell execution, caller-controlled proxying, Shodan on-demand scan submission, Shodan bulk `download`, arbitrary Shodan paging/endpoints, unbounded graph crawling, server-side case persistence, and automated attribution are not PARA11AX gateway capabilities.