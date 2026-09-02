<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
### Threat Model

#### Assets

- gateway bearer token;
- provider API credentials, including `SHODAN_API_KEY`;
- normalized Evidence v2 and provenance;
- deterministic Scheduler/Kernel policy integrity;
- provider quotas/availability and Shodan query-credit state;
- repository, CI and deployment integrity;
- analyst privacy: queried indicators/targets should not leak through operational surfaces;
- browser-local case/snapshot content where the analyst chooses to persist it.

#### Adversaries and failure sources

The design assumes an untrusted caller may control indicator text, Shodan query text and request timing; upstream providers may be malformed/compromised/unavailable; credentials can be exposed outside the application; deterministic metadata/rules can be misconfigured; browser-local state can be read by a compromised local profile; and repository/deployment supply chains can drift or be compromised.

#### Threats, controls and tests

| Threat | Primary controls | Executable evidence |
|---|---|---|
| Leaked gateway bearer | bearer auth on sensitive APIs; no token reflection; rotation through secret store | auth/API tests; public-release audit |
| Provider/Shodan secret compromise | server-side-only credentials; no caller-selected headers; browser never receives `SHODAN_API_KEY` | meta/status, Shodan and credential-boundary tests |
| Evidence-v2 SSRF / arbitrary proxying | static provider registry; exact hosts/methods/protocols; `safeFetch`; no provider override | egress-policy/manifest tests |
| Scheduler broadens egress/admission | Provider Value Scheduler v1.0 receives only already-admitted adapters; static descriptors; `safeFetch` unchanged | scheduler/profile/orchestration/no-new-surface tests |
| Evidence-dependent source suppression | deterministic static ranking; every admitted provider remains scheduled under bounded policy | scheduler permutation/orchestration tests |
| Scheduler metadata drift | validated descriptors + deterministic fallback + capability metadata contract | provider-priority/metadata tests |
| Kernel becomes hidden active agent | Intelligence Kernel v1.0 is pure/read-only; no provider/network call, secret/env read, persistence or dependency | Kernel compatibility/no-new-surface tests |
| Kernel derived context masquerades as evidence | Evidence v2 remains authoritative; Kernel output top-level/separate; Evidence Graph/STIX isolation | evidence/kernel/graph/STIX compatibility tests |
| Kernel opaque model output | deterministic categorical rules/trace IDs; **no LLM** and no adaptive runtime learning | Kernel determinism/permutation tests |
| False independent corroboration | source-role/capability-aware diversity and typed semantics | Kernel correlation/source-diversity tests |
| Contradiction suppression | explicit contradiction severity and provider/evidence references | Kernel contradiction tests |
| Temporal fabrication | observation first/last-seen only; retrieval-only time remains unknown | Kernel temporal tests |
| Pivot over-inference | explicit normalized relationships only; stable IDs; one-hop bounded pivots; no free-text inference | Kernel relationship/pivot tests |
| Provider outage treated as benign | failed/skipped providers remain coverage state; capability-aware coverage impact | coverage/kernel tests |
| Kernel failure destroys evidence | projection exception isolated to `intelligence_projection_unavailable`; Evidence v2 preserved | orchestration isolation tests |
| Shodan SSRF / arbitrary API proxying | exact `https://api.shodan.io` origin; six-command allowlist; validated inputs | Shodan tests |
| Shodan active-scan abuse | on-demand scan submission absent; arbitrary endpoints and `download` rejected | shell parser/handler tests |
| Shodan quota amplification | first-page search; no arbitrary paging/download; credit impact explicit | Shodan endpoint/credit tests |
| Oversized Shodan response/banner exposure | bounded search/service lists; raw banner/service bodies stripped | response-bounds tests |
| Shodan rate-limit confusion | explicit rate-limit error; no conversion to benign/empty evidence | Shodan throttling tests |
| Redirect credential exfiltration | Evidence v2 redirects refused; Shodan host fixed by handler construction | egress/Shodan tests |
| Malicious or malformed upstream | response ceilings; parser/normalizer validation; fail-closed handling | public-feed, Shodan, MISP and chaos tests |
| Quota/latency amplification | fixed profiles; Provider Value Scheduler v1.0; call ceilings/deadline; bounded Shodan operations | scheduler/profile/batch/Shodan tests |
| Provider outage / rate limiting | explicit partial failures; bounded retry/circuit behavior | scheduler/circuit/chaos tests |
| Cache poisoning / stale outage state | bounded namespaced cache; provider failures never cached | cache/chaos tests |
| Provenance confusion | parser version, retrieval time, provider, raw-result hash and Evidence v2 fingerprint preserved | Evidence v2/release-manifest tests |
| False corroboration | typed semantic classes; routing/scanner/Tor/Shodan/certificate/ATT&CK context excluded from reputation votes | correlation semantics tests |
| False attribution | hosting/certificate/Shodan exposure relationships are pivots/context only; attribution requires explicit supported evidence | correlation/STIX/Evidence Graph tests |
| Ambiguous certificate/hash classification | explicit `cert-sha256:` transport | classifier/browser/Maltego tests |
| Graph over-inference | Evidence Graph uses supported explicit facts/relationships only; Kernel pivots excluded as evidence | Evidence Graph/Kernel/case graph tests |
| Shodan operator result promoted as evidence | dedicated response envelope; shell leaves Evidence v2/Kernel unchanged | Shodan shell/client/UI tests |
| Guidance as hidden scoring | Guidance inherits Decision vocabulary/evidence refs; Kernel summary bounded | guidance tests |
| Browser case leakage/server persistence | IndexedDB-only case state; auth runtime-only; secret-bearing structural keys rejected | case storage/security/bundle tests |
| Malicious MISP content | exact attribute semantics; deleted=false; bounded event fetches | MISP tests |
| Unbounded ATT&CK expansion | fixed collection IDs/type filtering; unbounded relationships omitted | TAXII tests |
| Log/telemetry leakage | allowlisted telemetry; raw indicators excluded by default; no-store count-only status | telemetry/status tests |
| STIX overclaiming | export only from gateway-generated Evidence v2; Kernel conclusions excluded as new evidence | STIX/Kernel-isolation tests |
| Documentation drift | executable docs checks cover Scheduler, Kernel, provider count, API, Shodan and GER1E README sizing | documentation-contract tests |
| Actions supply-chain compromise | pinned GitHub Actions; repository invariant checks | Tooling smoke |
| Deployment/source drift | production acceptance compares exact deployed SHA; credentialed surfaces verified separately | operations/QA contract |

#### Provider Value Scheduler v1.0 boundary

The Scheduler is deterministic orchestration, not threat reasoning. It changes order only after fixed workflow/profile admission. Current IP reference remains 24 providers, 48-call ceiling, maximum 4 concurrent providers, maximum two attempts/provider and 20-second deadline.

The Scheduler must never:

- add a provider/host/method/protocol/credential;
- use evidence from earlier results to suppress admitted sources;
- bypass `safeFetch`;
- turn execution rank into maliciousness/confidence;
- learn/adapt from prior runtime behavior.

Missing or malformed scheduling metadata falls back deterministically.

#### Intelligence Kernel v1.0 boundary

The Kernel is deterministic derived analysis over normalized Evidence v2/correlation/coverage. It adds **no new egress** and uses **no LLM**. It does not read secrets/environment, persist data, call providers, execute KQL, or mutate authoritative evidence.

Residual risk remains: deterministic policy can still be wrong or insufficient. Controls are explicit policy/versioning, evidence fingerprints/providers, deterministic rule IDs, categorical outputs, contradiction/coverage limitations, permutation tests and guarded downstream compatibility fallbacks.

#### Shodan-specific residual risk

- Shodan can return semantically wrong, stale, or incomplete exposure data even when syntactically valid.
- An exposed service does not prove reachability, exploitability, compromise, maliciousness, ownership, or actor attribution.
- Query-credit/account policy is external and can change independently of repository source.
- Authorized search/domain use may consume credits even though the route is bounded.
- A stolen `SHODAN_API_KEY` remains usable until revoked/rotated.
- Shodan receives the operator's approved query/target because that is necessary to perform the lookup.

#### General residual risk

- Provider APIs can return semantically wrong but syntactically valid data.
- Scheduler/Kernel rules can be internally consistent yet analytically imperfect.
- In-memory gateway cache/circuit state is instance-local and non-durable.
- Browser-local cases are durable inside the browser profile by design.
- A stolen gateway bearer remains usable until rotation/revocation.
- A compromised repository/deployment administrator can bypass application controls.
- Source coverage changes over time; absence is not benignness.
- Documentation-contract tests protect selected facts, not every prose nuance.
- Deployment quotas/rate limits can leave public production behind protected `main`.

#### Out of scope by design

LLM/adaptive threat reasoning, malware submission/detonation, remediation, credential testing, arbitrary web fetching, arbitrary shell execution, caller-controlled proxying, Shodan on-demand scan submission, Shodan bulk `download`, arbitrary Shodan paging/endpoints, unbounded graph crawling, server-side case persistence, automated attribution and a universal maliciousness score are not PARA11AX gateway capabilities.

#### Investigation Workspace v2 threats

Investigation bundles are untrusted local input. Relevant threats are prototype/accessor abuse, structural secret smuggling, oversized or sparse content, stale-state forgery, unsafe reference URLs, duplicate artifact identity, semantic promotion of operator/imported data, lost updates, and misleading no-result conclusions. Controls are closed-schema recursive validation, byte/collection bounds, HTTPS-only references, deterministic reconstruction/status comparison, serialized atomic writes, explicit authority layers, dependency invalidation, and the fixed `NO_EVIDENCE_IDENTIFIED` versus `BENIGN_EXPLAINED` distinction.

Residual risk remains analyst-controlled: a valid bundle can contain incorrect analyst-supplied scope, rationale, or external results. PARA11AX preserves provenance and limitations but cannot prove the truth of operator assertions or telemetry completeness. Reports and ServiceNow records are projections only and require human approval.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
