### Security controls

This document maps the repository's principal controls to the risk they reduce. It is descriptive, not a compliance attestation.

| Area | Control | Security effect | Residual risk |
| --- | --- | --- | --- |
| Authentication | Gateway bearer required for enrichment/health/status/User Scanner | Prevents unauthenticated use of provider-backed, operational and active OSINT workflows | A stolen bearer remains usable until rotated |
| Public metadata | `/api/para11ax/meta` is static and intentionally unauthenticated | Allows capability discovery without exposing configuration state | Public metadata still reveals product capability shape |
| Secret handling | Vendor credentials remain server-side | Prevents clients and Maltego transforms from receiving provider secrets | Server/runtime compromise can still expose secrets |
| Secret handling | User Scanner worker bearer remains server-side in `PARA11AX_USER_SCANNER_TOKEN` when enabled | Prevents the browser shell from learning the worker credential | Compromise of the gateway runtime can still expose the worker token |
| Secret handling | Local Windows bearer protected with current-user DPAPI | Reduces plaintext token exposure at rest | A compromised user session can still access the token |
| Input validation | Deterministic indicator classification and syntax/size validation | Reduces parser ambiguity and malformed-input abuse | Valid but adversarial indicators still reach bounded adapters |
| Active OSINT input | User Scanner accepts only `email`/`username`, bounded target/category/module fields and known booleans; unknown fields are rejected | Prevents callers from turning the route into arbitrary worker invocation | Authorized enumeration can still be noisy and subject to remote-site limits/terms |
| Certificate identity | `cert-sha256:` is required for certificate fingerprints | Prevents ambiguous reinterpretation of bare SHA-256 file hashes | Analyst can still choose the wrong explicit transform/type |
| Outbound network | Adapter hosts are fixed; caller input cannot choose arbitrary destinations | Prevents the gateway becoming an arbitrary SSRF/proxy primitive | Provider-side behavior still requires defensive handling |
| Active OSINT egress | User Scanner worker destination comes only from `PARA11AX_USER_SCANNER_URL`; callers cannot choose worker URL, proxy, concurrency or timeout | Contains high-fan-out active OSINT behind one isolated, server-configured boundary | The worker intentionally contacts many third-party services and can be rate-limited or blocked |
| Active OSINT isolation | User Scanner runs in a separate Python worker and route rather than the passive provider registry/`safeFetch` fabric | Keeps scanner dependencies and broad external contact outside the Evidence v2 enrichment core | Worker compromise/failure remains an independent operational risk |
| Provider handling | Explicit timeouts, bounded response bodies and structured 429 handling | Limits resource exhaustion and uncontrolled upstream behavior | Provider latency/outage can still produce partial results |
| User Scanner handling | Gateway caps request/worker-response sizes, normalizes bounded result fields and returns controlled 502/503/504 errors | Limits oversized/untrusted worker output and prevents module failure becoming false negative evidence | Result metadata can still contain misleading third-party content and needs analyst interpretation |
| Error handling | Provider exception text is not reflected to callers | Reduces leakage of URLs, headers, credentials and internals | Logs still require safe operational handling |
| Evidence model | Provider-native semantics and provenance are preserved | Reduces false certainty and naive vendor-vote scoring | Analysts can still over-interpret correlations |
| Identity OSINT semantics | User Scanner results remain separate from Evidence v2 and do not become maliciousness/identity/attribution votes | Prevents a handle or registration hit from being promoted into threat evidence or same-person identity proof | Analysts can still over-correlate matching usernames/accounts manually |
| Evidence projection | Evidence Graph v1.0 uses explicit deterministic bounded facts/relationships only | Prevents free-form graph inference and new egress/persistence from projection | Explicit upstream relationships can still be semantically wrong |
| Guidance | Guidance v1.0 inherits the existing decision vocabulary and evidence references | Prevents a second hidden scoring/decision model | Analysts can still over-weight guidance |
| Attribution | Infrastructure/certificate relationships are not treated as actor attribution | Reduces unsupported attribution claims | Human interpretation remains a risk |
| Browser cases | IndexedDB is the sole case persistence adapter; active case/auth stay runtime-only | Prevents browser workspace from becoming server-side IOC history or bearer persistence | Local browser profile compromise can expose case content |
| Browser active OSINT | User Scanner output is terminal-visible but not automatically persisted/pinned as current Evidence v2 case material | Prevents untyped account-enumeration results from silently entering case evidence | Analysts may still copy results into notes outside the typed evidence model |
| HTTP response | Authenticated responses use `Cache-Control: no-store` and defensive headers | Reduces accidental caching and browser-side exposure | Downstream clients can still persist data |
| Deployment | Production acceptance compares deployment metadata with exact verified `main` SHA | Reduces acceptance of stale/unreviewed deployment artifacts | A compromised upstream/main remains a supply-chain risk |
| Worker deployment | User Scanner worker deployment and PARA11AX-to-worker wiring are accepted separately | Prevents a READY worker deployment from being mistaken for a functioning integrated capability | Environment drift can still break the link after deployment |
| CI supply chain | GitHub Actions are pinned to immutable commit SHAs | Reduces mutable-tag supply-chain risk | A pinned upstream commit can later be discovered vulnerable |
| Runtime parity | Node.js 24.x is enforced across CI/deployment/bootstrap | Reduces environment drift | Platform/runtime implementation differences can remain |
| Dependencies | Dependabot monitors npm and GitHub Actions | Surfaces known dependency/action updates | Update review and merge remain human responsibilities |
| Repository hygiene | `.env`, captures, samples, keys, generated packages and common artifacts are ignored | Reduces accidental sensitive commits | Ignore rules do not protect already-tracked/history content |
| Public release | `npm run audit:public` checks blocked artifacts, common high-confidence secrets and optional forbidden terms | Adds a publication guardrail | It is not a complete secret scanner, DLP system or licensing review |
| Documentation integrity | Executable documentation-contract tests compare canonical workflow/provider/version/User Scanner facts with bounded docs | Reduces silent documentation drift | Prose-only nuance still requires review |
| Change control | CODEOWNERS, contribution policy, PR template and issue forms | Makes security boundaries visible in human change paths | Repository settings must still enforce review/rules where supported |

#### User Scanner active OSINT boundary

User Scanner is an explicitly active OSINT capability. It is permitted to contact external services to check public username/email account signals, so it is not described as passive read-only enrichment. The security property is isolation and bounded control: the existing PARA11AX shell calls a same-origin authenticated route; that route validates the request and forwards only to the server-configured isolated worker.

The browser cannot set `PARA11AX_USER_SCANNER_URL`, `PARA11AX_USER_SCANNER_TOKEN`, proxy routes, worker concurrency or arbitrary outbound destinations. Cross-scan remains opt-in and the reference worker fixes pivot depth; NSFW modules are excluded by default. Use the capability only for authorized defensive research and assume third-party platforms may rate-limit, challenge or log enumeration traffic.

A `Found`/`Registered` result is platform-specific OSINT evidence only. Matching usernames across services do not prove the profiles belong to the same person. Email registration evidence does not prove current ownership or control. `Error` is coverage failure; it must never be flattened into `Not Found`/`Not Registered`.

#### Controls that require GitHub account/repository settings

The following cannot be guaranteed by files in the repository alone and should be verified in GitHub settings/API when the plan/account supports them:

- branch/ruleset protection for `main`
- block force-push and branch deletion
- required status checks
- required reviews where a second reviewer exists
- signed-commit enforcement where operationally practical
- secret scanning and push protection
- CodeQL/default code scanning where available
- passkey/2FA and recovery-code hygiene on the GitHub account

File-based CI and documentation are complementary controls, not substitutes for those settings. Likewise, a Vercel `READY` PARA11AX or User Scanner deployment proves deployment state/source identity only; provider credential readiness and worker wiring require authorized authenticated checks.
