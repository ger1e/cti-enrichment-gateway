# V8 Train 6 — Certificate Maltego Parity Design

## Goal

Close the only staged Train 6 compatibility gap by exposing the existing `certificate` observable through the local Maltego client without changing server/provider semantics.

## Scope

- Add one discoverable Maltego transform: `EnrichCertificate`.
- Use Maltego's built-in `maltego.Hash` as the input entity because the analyst starts from a SHA-256 fingerprint.
- Preserve explicit observable semantics: choosing `EnrichCertificate` means the raw 64-hex Maltego hash value is transported to PARA11AX as `cert-sha256:<fingerprint>` with gateway type `certificate`.
- Add `certificate` to the Maltego gateway client's supported indicator types.
- Register the transform in `maltego/transforms/__init__.py` and `maltego/transform-manifest.json` so MTZ generation and integrity verification include it.
- Update compatibility/parity tests so all nine active gateway workflow types have Maltego coverage.

## Invariants

- No classifier guessing between file hashes and certificate fingerprints.
- No server API, provider, host, credential, dependency, browser UI, persistence, scoring, or evidence-schema changes.
- Existing Censys and VirusTotal certificate provider behavior remains authoritative; Train 6 only exposes it through Maltego.
- Certificate evidence remains contextual metadata and is not promoted to maliciousness.
- The Maltego credential boundary remains `PARA11AX_TOKEN` only.
- Remote gateway transport remains HTTPS-only; localhost HTTP remains the existing development exception.
- Existing MTZ archive safety and secret-leak checks remain unchanged.

## Transport Contract

Input entity value:

```text
0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

Maltego transform call:

```python
execute_gateway_transform(request, response, 'certificate')
```

Gateway JSON payload emitted by `GatewayClient.enrich`:

```json
{
  "indicator": "cert-sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "type": "certificate"
}
```

## Verification

1. Commit tests first and observe Tooling smoke fail for the missing Train 6 behavior.
2. Implement the minimal transform/client/manifest registration.
3. Require exact-head Tooling smoke and CodeQL success.
4. Review changed-file scope, unresolved review threads, and mainline drift.
5. Merge only against the expected exact head.
6. Verify post-merge `main` Tooling smoke, CodeQL, and Vercel status before declaring closure.
