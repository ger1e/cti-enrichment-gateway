# MAX Intelligence Enrichment Design

## Goal
Strengthen the existing PARA11AX gateway without changing its public API shape or adding infrastructure dependencies. Improve evidence quality, infrastructure correlation, provider observability, and production safety around Modat and peer providers.

## Constraints
- Preserve current `/api/para11ax/enrich`, `/api/para11ax/batch`, `/api/para11ax/stix`, `/api/para11ax/meta`, `/api/para11ax/health`, and `/api/para11ax/status` contracts.
- No new framework, database, queue, cache service, agent subsystem, or direct client-side vendor credentials.
- Secrets remain server-side Vercel environment variables.
- Infrastructure observations such as internet exposure, passive DNS, routing and registration remain neutral context unless an independent reputation/threat source supplies a threat verdict.
- Keep deterministic ordering and bounded output sizes.
- Preserve scheduler concurrency <= 4, request deadline 20 seconds, per-provider timeout bounds, retry/circuit behavior, and fixed-host egress metadata.

## Design
### Evidence quality
Correlation exposes an `evidenceQuality` object independent from `verdict`. It summarizes source diversity, evidence freshness, successful normalized evidence count, contradiction count, and an ordinal quality level. Quality measures how well-supported the result is, not whether the indicator is malicious; provider execution failures remain in the envelope's existing `failures` and `providerSummary` fields rather than being duplicated into correlation.

### Infrastructure correlation
Correlation exposes `infrastructureContext` for network indicators. It summarizes infrastructure providers, shared relationship targets, and corroborated infrastructure facts. Modat, Shodan, Censys, RIPE/registration/network identity sources can corroborate infrastructure context without becoming reputation votes.

### Telemetry
The telemetry accumulator retains the existing sanitized event model and adds bounded aggregate counters by provider and status. No indicator, authorization header, secret, URL query, or response body is added to default telemetry.

### Status
Authenticated `/api/para11ax/status` continues returning aggregate telemetry only. New telemetry aggregates become visible there automatically through `telemetry.stats()`; secret values remain absent.

### Modat safety
Modat remains fixed to `api.magnify.modat.io`, tier 3/quota, server-side Bearer auth, bounded responses, fail-closed parsing, positive/negative cache TTLs, and neutral `observed` verdicts for infrastructure/passive-DNS facts.

## Verification
- Unit tests for evidence quality and infrastructure corroboration.
- Unit tests for provider/status telemetry aggregation and sanitization.
- Existing Modat provider tests remain green.
- Existing scheduler, correlation, manifest, secret-invariant, STIX and cross-platform tooling tests remain green.
- PR CI must pass before merge; production deployment must report READY and no new runtime error clusters.