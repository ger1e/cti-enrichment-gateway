# Provider Contract Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every canonical provider adapter contract-current, observable, secret-safe, and probeable so “working” is determined by real provider behavior rather than fixture-only tests.

**Architecture:** Keep the existing dependency-free provider model and fixed-host egress boundary. Provider-specific adapters own endpoint/auth/response semantics; the control plane adds a sequential, bounded `para11ax providers probe` that classifies configuration/auth/rate/upstream/contract states without printing secrets. Normal provider absence must be represented as neutral absence evidence when the upstream contract explicitly defines it, never as benign and never as an outage.

**Tech Stack:** Node.js 24 ESM, built-in `node:test`, existing `fetchJson`/`safeFetch`, canonical `config/providers.json`, GitHub/Vercel control plane.

**Spec:** `docs/superpowers/specs/2026-08-22-max-intelligence-enrichment.md`

## Global Constraints

- Preserve `/api/para11ax/enrich`, `/api/para11ax/batch`, `/api/para11ax/stix`, `/api/para11ax/meta`, `/api/para11ax/health`, and `/api/para11ax/status` public contracts.
- No new framework, database, queue, cache service, agent subsystem, or direct client-side vendor credentials.
- Secrets remain server-side and must never be printed by probe output, tests, telemetry, reports, references, or errors.
- Fixed-host HTTPS egress, bounded request/response sizes, redirect denial by default, provider timeouts, scheduler bounds, and neutral absence semantics remain mandatory.
- Do not run GitHub Actions or create Vercel deployments during the current overbilling window.
- One authenticated sequential all-provider probe is required after billing reset before claiming all configured providers production-ready.

---

### Task 1: Freeze provider-readiness contract

**Files:**
- Test: `test/provider-contract-regression.test.js`
- Create: `src/control/provider-probe.js`
- Modify: `bin/para11ax.mjs`

**Interfaces:**
- Produces: `probeProviders({ providers, env, includeCredentialed, selectedNames }) -> Promise<Array<ProbeResult>>`
- `ProbeResult.status` is one of `ok`, `unconfigured`, `auth_failed`, `rate_limited`, `timeout`, `upstream_error`, `contract_error`.

- [x] Write failing tests for RansomLook v2, Cloudflare Radar nested response, Webamon current search contract, and sequential secret-safe probing.
- [x] Implement the minimum adapter/probe changes.
- [ ] Add CLI regression tests for `para11ax providers probe`, `--all`, and `--provider`.
- [ ] Confirm no probe path emits credential values or raw upstream error text.

### Task 2: Audit and fix network/infrastructure providers

**Files:**
- Modify as evidence requires: `src/providers/ipinfo.js`, `rdap.js`, `ripestat.js`, `dshield.js`, `spamhaus-drop.js`, `tor-exit.js`, `feodo-tracker.js`, `threatminer.js`, `misp-osint.js`, `greynoise.js`, `abuseipdb.js`, `shodan.js`, `censys.js`, `modat.js`, `cloudflare-radar.js`
- Test: `test/provider-contract-regression.test.js`, existing provider tests

- [ ] Verify each live/documented endpoint, method, auth scheme, response shape, and not-found semantics from primary sources.
- [ ] Add a failing regression for each confirmed drift before changing production code.
- [ ] Convert documented lookup absence (for example provider-specific 404) into neutral `no_result`/`not_found`, never `benign`.
- [ ] Keep true 401/403/429/5xx transport states as failures.
- [ ] Resolve RDAP bootstrap redirects without weakening SSRF/fixed-host policy; if a safe bounded redirect design cannot be proven, reduce declared scope rather than silently failing every request.
- [ ] Record ThreatMiner 5xx/522 as upstream availability if its documented endpoint is still correct.

### Task 3: Audit and fix reputation/web providers

**Files:**
- Modify as evidence requires: `src/providers/virustotal.js`, `otx.js`, `threatfox.js`, `urlscan.js`, `webamon.js`, `pulsedive.js`, `openphish.js`, `urlhaus.js`, `tweetfeed.js`
- Test: `test/provider-contract-regression.test.js`, `test/provider-adapters.test.js`, `test/ransomware-community-sources.test.js`

- [ ] Verify endpoint/auth/query/body contracts from current primary docs.
- [ ] Add VirusTotal v3 404/`NotFoundError` absence regression and implementation.
- [ ] Audit Shodan/VT/urlscan/Webamon/Pulsedive query-string credential/reference leakage.
- [ ] Preserve community/context sources as context, not reputation corroboration.

### Task 4: Audit and fix malware/hash providers

**Files:**
- Modify as evidence requires: `src/providers/circl-hashlookup.js`, `malwarebazaar.js`, `malpedia.js`, `hybrid-analysis.js`
- Test: `test/provider-contract-regression.test.js`, `test/provider-adapters.test.js`

- [x] Correct CIRCL Hashlookup hyphenated digest fields and normal 404 absence.
- [ ] Verify abuse.ch Auth-Key/query bodies, Malpedia `apitoken` auth + md5/sha256 info endpoints, and Hybrid Analysis v2.38 search/hash behavior.
- [ ] Normalize documented absence without turning unavailable/auth failures into negative intelligence.

### Task 5: Audit and fix vulnerability/ATT&CK providers

**Files:**
- Modify as evidence requires: `src/providers/cisa-kev.js`, `epss.js`, `circl-vulnerability.js`, `nvd.js`, `osv.js`, `attack-taxii.js`
- Test: existing vulnerability/TAXII suites plus `test/provider-contract-regression.test.js`

- [ ] Verify live primary endpoints and response schemas for one canonical CVE/ATT&CK ID.
- [ ] Keep TAXII media type exact and bounded; no generic JSON Accept fallback that breaks TAXII 2.1.
- [ ] Preserve optional NVD key behavior.

### Task 6: Audit and fix ransomware/community providers

**Files:**
- Modify as evidence requires: `src/providers/ransomlook.js`, `ransomware-live.js`, `tweetfeed.js`
- Test: `test/ransomware-community-sources.test.js`

- [x] Correct RansomLook 2.0 `q=` request and structured response.
- [ ] Verify Ransomware.live PRO `X-API-KEY`, current search path, and response shape.
- [ ] Verify TweetFeed exact IOC endpoint and hash support boundaries.
- [ ] Keep adversary claims explicitly unconfirmed unless independent evidence confirms compromise.

### Task 7: Canonical manifest and parser-version convergence

**Files:**
- Modify: `config/providers.json`, `release-manifest.json`
- Test: `test/provider-manifest.test.js`, `test/provider-control-manifest.test.js`, `test/release-manifest.test.js`

- [ ] Increment parser versions only for adapters whose request/response contract changed.
- [ ] Ensure fixed hosts, methods, auth types, observation types, and credentials match implementation exactly.
- [ ] Add an invariant ensuring every active provider has a canonical probe fixture/type and no manifest-only phantom provider exists.

### Task 8: Cost-safe verification and final authenticated gate

**Files:**
- Modify: `docs/OPERATIONS.md` or existing operator documentation, provider readiness notes as needed.

- [ ] During overbilling window, perform only primary-doc research, public harmless live requests, GitHub read/write, and static diff review; trigger no Actions/Vercel build.
- [ ] After reset, run one local/manual test gate and require all unit/invariant/audit tests green.
- [ ] Run one sequential `para11ax providers probe --all` with locally/configured credentials; do not print secrets.
- [ ] Classify every provider: `ok` means production-ready; `unconfigured` requires credential setup; `auth_failed` requires credential correction; `rate_limited` requires quota policy; `upstream_error` is vendor availability; `contract_error` returns to Tasks 2–6.
- [ ] Do not merge/deploy until repository defects are zero and the remaining non-`ok` states are demonstrably external/configuration constraints.
