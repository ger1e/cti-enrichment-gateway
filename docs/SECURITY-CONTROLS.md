### Security controls

This document maps the repository's principal controls to the risk they reduce. It is descriptive, not a compliance attestation.

| Area | Control | Security effect | Residual risk |
| --- | --- | --- | --- |
| Authentication | Gateway bearer required for enrichment/health/status | Prevents unauthenticated use of provider-backed and operational workflows | A stolen bearer remains usable until rotated |
| Public metadata | `/api/para11ax/meta` is static and intentionally unauthenticated | Allows capability discovery without exposing configuration state | Public metadata still reveals product capability shape |
| Secret handling | Vendor credentials remain server-side | Prevents clients and Maltego transforms from receiving provider secrets | Server/runtime compromise can still expose secrets |
| Secret handling | Local Windows bearer protected with current-user DPAPI | Reduces plaintext token exposure at rest | A compromised user session can still access the token |
| Input validation | Deterministic indicator classification and syntax/size validation | Reduces parser ambiguity and malformed-input abuse | Valid but adversarial indicators still reach bounded adapters |
| Certificate identity | `cert-sha256:` is required for certificate fingerprints | Prevents ambiguous reinterpretation of bare SHA-256 file hashes | Analyst can still choose the wrong explicit transform/type |
| Outbound network | Adapter hosts are fixed; caller input cannot choose arbitrary destinations | Prevents the gateway becoming an arbitrary SSRF/proxy primitive | Provider-side behavior still requires defensive handling |
| Provider handling | Explicit timeouts, bounded response bodies and structured 429 handling | Limits resource exhaustion and uncontrolled upstream behavior | Provider latency/outage can still produce partial results |
| Error handling | Provider exception text is not reflected to callers | Reduces leakage of URLs, headers, credentials and internals | Logs still require safe operational handling |
| Evidence model | Provider-native semantics and provenance are preserved | Reduces false certainty and naive vendor-vote scoring | Analysts can still over-interpret correlations |
| Evidence projection | Evidence Graph v1.0 uses explicit deterministic bounded facts/relationships only | Prevents free-form graph inference and new egress/persistence from projection | Explicit upstream relationships can still be semantically wrong |
| Guidance | Guidance v1.0 inherits the existing decision vocabulary and evidence references | Prevents a second hidden scoring/decision model | Analysts can still over-weight guidance |
| Attribution | Infrastructure/certificate relationships are not treated as actor attribution | Reduces unsupported attribution claims | Human interpretation remains a risk |
| Browser cases | IndexedDB is the sole case persistence adapter; active case/auth stay runtime-only | Prevents browser workspace from becoming server-side IOC history or bearer persistence | Local browser profile compromise can expose case content |
| HTTP response | Authenticated responses use `Cache-Control: no-store` and defensive headers | Reduces accidental caching and browser-side exposure | Downstream clients can still persist data |
| Deployment | Production acceptance compares deployment metadata with exact verified `main` SHA | Reduces acceptance of stale/unreviewed deployment artifacts | A compromised upstream/main remains a supply-chain risk |
| CI supply chain | GitHub Actions are pinned to immutable commit SHAs | Reduces mutable-tag supply-chain risk | A pinned upstream commit can later be discovered vulnerable |
| Runtime parity | Node.js 24.x is enforced across CI/deployment/bootstrap | Reduces environment drift | Platform/runtime implementation differences can remain |
| Dependencies | Dependabot monitors npm and GitHub Actions | Surfaces known dependency/action updates | Update review and merge remain human responsibilities |
| Repository hygiene | `.env`, captures, samples, keys, generated packages and common artifacts are ignored | Reduces accidental sensitive commits | Ignore rules do not protect already-tracked/history content |
| Public release | `npm run audit:public` checks blocked artifacts, common high-confidence secrets and optional forbidden terms | Adds a publication guardrail | It is not a complete secret scanner, DLP system or licensing review |
| Documentation integrity | Executable documentation-contract tests compare canonical workflow/provider/version facts with bounded docs | Reduces silent documentation drift | Prose-only nuance still requires review |
| Change control | CODEOWNERS, contribution policy, PR template and issue forms | Makes security boundaries visible in human change paths | Repository settings must still enforce review/rules where supported |

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

File-based CI and documentation are complementary controls, not substitutes for those settings. Likewise, a Vercel `READY` deployment proves deployment state/source identity only; provider credential readiness requires authorized authenticated checks.
