# CTI Provider Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and verify every read-only provider adapter in the MAX CTI workflow without enabling submissions, sample downloads, detonation, takedowns, or arbitrary outbound HTTP.

**Architecture:** Each provider is a small adapter declaring supported indicator types, timeout/cache metadata, exact outbound endpoint/authentication, and a parser that maps vendor-specific responses into the gateway's canonical evidence object. The gateway builds the registry from configured/no-key adapters and skips credentialed providers whose environment variable is absent. Contract tests assert request method, URL host/path, authentication placement, sanitized references, parser semantics, and no state-changing endpoint usage.

**Tech Stack:** Node.js 24.x / ES modules / built-in `fetch`, `node:test`, GitHub Actions, Vercel Functions.

**Spec:** `docs/specs/max-cti-core.md`

## Global Constraints

- Personal research and lab use only.
- Read-only enrichment by default.
- No arbitrary HTTP proxy, arbitrary headers, shell execution, secret retrieval, automatic urlscan submission, automatic malware submission, automatic sample download, automatic detonation, Webamon scan/takedown, Pulsedive analyze/submit, VirusTotal rescan, or Cloudflare URL Scanner submission.
- Never include provider secret values in references, evidence, errors, or logs.
- Preserve provider semantics; do not implement vendor-vote maliciousness scoring.
- Provider failure returns structured partial results.
- All network calls use HTTPS, bounded response sizes, explicit timeouts, and fixed provider hosts.

---

### Task 1: Shared provider HTTP and parsing utilities

**Files:**
- Modify: `src/core/fetch-json.js`
- Create: `src/providers/helpers.js`
- Test: `test/provider-adapters.test.js`

**Interfaces:**
- `fetchJson(url, { method, headers, body, fetchImpl, signal, maxBytes, redirect })`
- helpers for environment secret retrieval, URL/reference sanitization, array coercion, Unix timestamp conversion, VT statistics, and relationship construction.

- [ ] Write failing tests for headers/method/body forwarding, bounded responses, and secret-free references.
- [ ] Run CI and verify RED.
- [ ] Implement minimal shared utilities.
- [ ] Run CI and verify GREEN.

### Task 2: Infrastructure adapters

**Files:**
- Create: `src/providers/ipinfo.js`
- Create: `src/providers/ripestat.js`
- Create: `src/providers/greynoise.js`
- Create: `src/providers/abuseipdb.js`
- Create: `src/providers/shodan.js`
- Create: `src/providers/censys.js`
- Create: `src/providers/cloudflare-radar.js`
- Test: `test/provider-adapters.test.js`

**Exact read-only endpoints:**
- IPinfo Lite: `GET https://api.ipinfo.io/lite/{ip}?token=...`
- RIPEstat: `GET https://stat.ripe.net/data/network-info/data.json?resource={ip}`
- GreyNoise Community: `GET https://api.greynoise.io/v3/community/{ip}` with `key` header when configured
- AbuseIPDB: `GET https://api.abuseipdb.com/api/v2/check?ipAddress={ip}&maxAgeInDays=90` with `Key` header
- Shodan: `GET https://api.shodan.io/shodan/host/{ip}?key=...&minify=false`
- Censys Platform v3: `GET https://api.platform.censys.io/v3/global/asset/host/{ip}` with Bearer PAT
- Cloudflare Radar: `GET https://api.cloudflare.com/client/v4/radar/entities/ip?ip={ip}` with Bearer token

- [ ] Write failing contract/parser tests.
- [ ] Verify RED in CI.
- [ ] Implement adapters.
- [ ] Verify GREEN in CI.

### Task 3: Threat-intelligence and web adapters

**Files:**
- Create: `src/providers/virustotal.js`
- Create: `src/providers/otx.js`
- Create: `src/providers/threatfox.js`
- Create: `src/providers/urlscan.js`
- Create: `src/providers/webamon.js`
- Create: `src/providers/pulsedive.js`
- Test: `test/provider-adapters.test.js`

**Read-only surfaces:**
- VirusTotal v3 object lookup only: IP/domain/file report endpoints using `x-apikey`; no analyse/rescan/download.
- OTX indicator `general` section only using `X-OTX-API-KEY`.
- ThreatFox `search_ioc` / `search_hash` queries only with `Auth-Key`.
- urlscan Search API only with `api-key`; no submission endpoint.
- Webamon `/search` only; no `/scan` or takedown.
- Pulsedive `/api/indicator.php` only; no `/analyze.php`.

- [ ] Write failing contract/parser tests.
- [ ] Verify RED in CI.
- [ ] Implement adapters.
- [ ] Verify GREEN in CI.

### Task 4: Malware adapters

**Files:**
- Create: `src/providers/circl-hashlookup.js`
- Create: `src/providers/malwarebazaar.js`
- Create: `src/providers/malpedia.js`
- Create: `src/providers/hybrid-analysis.js`
- Test: `test/provider-adapters.test.js`

**Read-only surfaces:**
- CIRCL hashlookup `GET /lookup/{algorithm}/{hash}`.
- MalwareBazaar `POST /api/v1/` with `query=get_info`; never `get_file` or upload.
- Malpedia `GET /api/get/sample/{hash}/info`; never raw/zip/sample retrieval or scan endpoints.
- Hybrid Analysis v2.38.0 `GET /search/hash?hash={hash}` with `api-key`; no submission/download/file-collection endpoints.

- [ ] Write failing contract/parser tests.
- [ ] Verify RED in CI.
- [ ] Implement adapters.
- [ ] Verify GREEN in CI.

### Task 5: Vulnerability adapters

**Files:**
- Create: `src/providers/nvd.js`
- Create: `src/providers/osv.js`
- Keep: `src/providers/cisa-kev.js`
- Keep: `src/providers/epss.js`
- Test: `test/provider-adapters.test.js`

**Read-only surfaces:**
- NVD CVE API 2.0 `GET https://services.nvd.nist.gov/rest/json/cves/2.0?cveId={CVE}` with optional `apiKey` header.
- OSV `GET https://api.osv.dev/v1/vulns/{CVE}`; 404 is a normal no-match condition.

- [ ] Write failing contract/parser tests.
- [ ] Verify RED in CI.
- [ ] Implement adapters.
- [ ] Verify GREEN in CI.

### Task 6: Registry, workflows, configuration skipping

**Files:**
- Modify: `src/app.js`
- Modify: `src/workflows.js`
- Test: `test/workflows.test.js`
- Test: `test/app.test.js`

**Interfaces:**
- Active workflows contain all implemented adapters in deterministic order.
- Credentialed adapters are omitted when their required environment variable is absent.
- No-key adapters remain active.
- Health reports configured state only, never secret values.

- [ ] Write failing workflow/skip tests.
- [ ] Verify RED in CI.
- [ ] Wire all adapters and skip logic.
- [ ] Verify GREEN in CI.

### Task 7: CI verification and documentation

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] Run full Node test suite on GitHub Actions with Node 24.
- [ ] Run Maltego Python unit tests in CI on Python 3.12 without exercising Windows DPAPI persistence.
- [ ] Confirm no tests or fixtures contain real secrets.
- [ ] Confirm PR diff contains no submission/download/detonation routes.
- [ ] Record exact provider endpoint/version notes and remaining runtime-only verification limits.
