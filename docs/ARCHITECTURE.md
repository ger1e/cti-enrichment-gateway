# Architecture and trust boundaries

## Purpose

The gateway is a read-only CTI enrichment layer. It accepts one validated indicator, invokes bounded provider-specific retrieval adapters, and returns normalized evidence, relationships, provenance, failures and provider-health state.

It is intentionally not a generic proxy, scanning platform, malware detonation service, sample repository, takedown system or secret broker.

## Trust boundaries

```text
Untrusted indicator input
        |
        v
+---------------------------+
| API boundary              |
| auth + size/type checks   |
+---------------------------+
        |
        v
+---------------------------+
| Canonical classification  |
| deterministic type rules  |
+---------------------------+
        |
        v
+---------------------------+
| Workflow/orchestration    |
| bounded provider registry |
+---------------------------+
        |
        +----------+----------+----------+
        |          |          |          |
        v          v          v          v
   Provider A  Provider B  Provider C  Public source
        |          |          |          |
        +----------+----------+----------+
                   |
                   v
+----------------------------------------+
| Normalization / provenance / failures  |
+----------------------------------------+
                   |
                   v
        Authenticated API response
```

### Caller boundary

Caller-controlled data is limited to the request envelope and indicator. The caller cannot select arbitrary outbound hosts, arbitrary headers, shell commands, files to read, secrets to return, or active scan/detonation behavior.

### Provider boundary

Each adapter owns its fixed upstream endpoint, authentication method, request construction, timeout, response-size bound, rate-limit interpretation and parser. Provider data is treated as untrusted external input and normalized before it reaches the response model.

### Secret boundary

Provider credentials exist only in the server/runtime environment. Clients receive normalized evidence and provider state, never provider credentials. The Maltego client receives only the gateway bearer and protects its local copy using current-user DPAPI on Windows.

### Evidence boundary

The gateway preserves observation type and provider-native semantics. Abuse reports, exposed services, sandbox behavior, malware associations, scanner/noise classification, exploit probability and known-exploited status are not collapsed into a single malicious-vendor vote.

Relationships such as shared ASN, hosting, certificate reuse or infrastructure proximity are pivots for investigation. They are not attribution.

## Failure model

The system prefers explicit partial results over silent omission:

- one provider failure does not discard successful evidence from others
- missing credentials produce skipped/partial coverage
- structured gateway failures represent unsupported/unavailable workflow coverage
- rate limits are represented explicitly
- arbitrary provider exception text is not reflected to callers

## Persistence model

The shipping cache is bounded in-memory TTL/negative caching. It improves warm-instance behavior but is not durable across cold starts or instances.

Durable quota state, IOC lifecycle, temporal graph relationships, investigation snapshots and long-lived caches belong behind a separate storage interface and are not auto-provisioned by this repository.

## Deployment integrity

Production deployment is intentionally coupled to source integrity:

1. fetch `origin/main`
2. require a clean local working tree
3. require local `HEAD` to equal the freshly fetched source
4. provision only required environment variables
5. deploy the verified source tree
6. confirm the safe health endpoint reports authentication configured

This reduces accidental deployment of uncommitted or stale local state. It does not replace repository/account security, dependency review or CI integrity.

## Public-release boundary

This private repository should not be made public merely to create a portfolio artifact. Prefer a reviewed, sanitized extraction into a new public repository. See `PUBLIC-RELEASE-CHECKLIST.md` and run `npm run audit:public` before any such extraction.
