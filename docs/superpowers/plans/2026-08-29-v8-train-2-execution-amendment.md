# PARA11AX v8 Train 2 — Execution Amendment

This amendment is part of the approved Train 2 implementation plan and is normative for execution. It changes no approved product behavior. It corrects current-main file-path drift discovered during the mandatory pre-implementation revalidation and makes the staged integration gap explicit.

Base revalidated against protected `main` at `e8358965ca792de5a910e4e35e6f23476da2dc5d`.

## 1. Correct current test paths

The original Train 2 plan references several test files that do not exist on the merged Train 1 baseline. Use these current paths instead:

- `test/validation.test.js` -> `test/validate-indicators.test.js`.
- Do not create or target `test/censys-v3.test.js`.
- Do not create or target `test/provider-fixtures.test.js`.
- `test/provider-safety-regressions.test.js` -> `test/provider-contract-regression.test.js` for existing provider safety regression coverage.

Create focused Train 2 tests rather than overloading unrelated legacy files:

- `test/certificate-providers-v8.test.js` for Censys and VirusTotal certificate endpoint, valid-result, 404/absence, schema-drift, fingerprint-conflict, and bounded-response behavior.
- `test/cloudflare-dns-v8.test.js` for Cloudflare DNS exact endpoint/header behavior, valid A answers, valid absence/NXDOMAIN semantics, malformed response schema, and bounded-response behavior.

Existing provider transport/read-only regression assertions remain in `test/provider-adapters.test.js`, `test/provider-contract-regression.test.js`, `test/egress-policy.test.js`, and `test/core-security.test.js`.

## 2. Train 1 contract fields remain mandatory

Every new provider entry must include the complete Train 1 admission contract. The Cloudflare DNS manifest entry therefore includes:

- `sourceRole: "first_party"`
- `freshnessClass: "live"`
- `admissionVersion: "v8.1"`
- `executionPolicy` equal to the canonical `EXECUTION_POLICY_VERSION`

The new provider must pass `assertProviderContract()`/canonical provider-set validation exactly like the existing catalog.

## 3. Parser schema-drift coverage is mandatory before implementation

Before production parser changes, RED tests must cover the cross-plan self-review requirements.

### Censys certificate

A 200 response is rejected with `Error('provider_schema_invalid')` when any of the following holds:

- the certificate resource object is absent;
- a returned SHA-256/fingerprint field conflicts with the requested canonical fingerprint;
- `names`/SAN names are present but are not an array;
- neither the requested fingerprint nor defensible certificate metadata exists.

A documented 404 is valid neutral `no_result`.

### VirusTotal certificate

A 200 response is rejected with `Error('provider_schema_invalid')` when any of the following holds:

- `data` is absent or not an object;
- `data.type` is present and is not `ssl_cert`;
- `data.id` or a SHA-256/thumbprint attribute is present and conflicts with the requested canonical fingerprint;
- `attributes` is absent or not an object.

A documented NotFound/404 is valid neutral `no_result`.

### Cloudflare DNS

- `Status` must be an integer.
- `Status === 0` with absent/empty `Answer` is valid neutral `no_result`.
- non-zero `Status` (including NXDOMAIN) is absence/context, never benign evidence.
- if `Answer` exists it must be an array.
- missing/invalid `Status` or non-array `Answer` throws `Error('provider_schema_invalid')`.

Each new/extended parser also gets a response-cap test through the bounded fetch/provider-runner path so oversized upstream data cannot reach parser logic as evidence.

## 4. Certificate classification remains unambiguous

The only accepted new syntax is `cert-sha256:<64-hex>`. A bare 64-hex string remains the existing file-hash observable. The certificate-prefix check runs before generic hash classification; malformed `cert-sha256:` input fails closed as unsupported.

Train 2 adds exactly one active observable type, bringing the server registry from eight to nine types.

## 5. Staged Maltego parity is explicit, not silently skipped

Train 6 is the approved owner of certificate-aware Maltego and STIX surface parity. Train 2 must not prematurely add the Maltego certificate transform.

The current Node invariant `Maltego transform registry covers every gateway workflow type` uses `requirements[type] ?? []`, which would silently treat a new `certificate` workflow as covered. Train 2 must replace that misleading invariant with an explicit staged contract:

- the existing eight Maltego-supported gateway types remain exactly covered;
- `certificate` is the only active gateway workflow type intentionally absent from Maltego during Trains 2–5;
- the test points to Train 6 as the closure point for that gap.

Do not modify the Python Maltego `V2_TYPES` or transform manifest in Train 2.

## 6. Final Train 2 verification commands

Use the actual current safety files:

```bash
node --test \
  test/egress-policy.test.js \
  test/core-security.test.js \
  test/provider-contract-regression.test.js \
  test/provider-contract-v8.test.js \
  test/certificate-providers-v8.test.js \
  test/cloudflare-dns-v8.test.js
```

Then run the full repository gate (`npm run check`) and the complete hosted Tooling Smoke/CodeQL checks. Final acceptance requires:

- exactly 38 canonical providers;
- exactly 9 active server observable types;
- fixed egress/read-only behavior unchanged;
- certificate fingerprint prefix semantics preserved;
- Censys, VirusTotal, and Cloudflare DNS malformed successful responses fail as provider errors, never negative evidence;
- no provider credential names/values leak through evidence or public metadata;
- the only intentionally deferred integration gap is certificate Maltego/STIX parity assigned to Train 6.
