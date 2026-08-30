<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Document status:** Historical design record. Preserved for implementation history; current behavior is defined by [docs/ARCHITECTURE.md](https://github.com/ger1e/para11ax/blob/main/docs/ARCHITECTURE.md) and the current README.

# V8 Train 6 Certificate Maltego Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit certificate-fingerprint parity to the existing PARA11AX Maltego client so all nine active gateway observable workflows are reachable from Maltego.

**Architecture:** Reuse the existing discoverable-transform pattern and shared `GatewayClient`. `EnrichCertificate` accepts a standard Maltego hash entity, but the client prefixes the raw fingerprint with `cert-sha256:` only when `indicator_type == 'certificate'`, preserving the server's explicit certificate classifier contract without changing file-hash behavior. Registration remains declarative through `transforms/__init__.py` and `transform-manifest.json`.

**Tech Stack:** Python 3.10+, `maltego-trx`, Node.js 24 test runner, GitHub Actions Tooling smoke, CodeQL.

**Spec:** `docs/superpowers/specs/2026-08-29-v8-train-6-certificate-maltego-parity-design.md`

## Global Constraints

- No classifier guessing between file hashes and certificate fingerprints.
- No server API, provider, host, credential, dependency, browser UI, persistence, scoring, or evidence-schema changes.
- The only transform credential is `PARA11AX_TOKEN`.
- Existing MTZ safety/secret checks remain unchanged.
- TDD is mandatory: observe failing tests before production implementation.

---

### Task 1: Lock the certificate transport contract with RED tests

**Files:**
- Modify: `maltego/tests/test_gateway_client.py`
- Modify: `maltego/tests/test_transform_parity.py`
- Modify: `test/manifest-invariants.test.js`

**Interfaces:**
- Consumes: existing `GatewayClient.enrich(indicator: str, indicator_type: str) -> dict` and transform registration conventions.
- Produces: failing expectations for certificate payload prefixing, transform registration, transform manifest inclusion, and nine-workflow parity.

- [ ] **Step 1: Add the failing gateway-client test**

Assert `SUPPORTED_INDICATOR_TYPES` contains `certificate`, call `client.enrich('a' * 64, 'certificate')`, and assert the emitted body equals:

```python
{'indicator': f"cert-sha256:{'a' * 64}", 'type': 'certificate'}
```

Also retain the existing raw file-hash payload behavior for `indicator_type == 'hash'`.

- [ ] **Step 2: Add the failing transform parity test**

Require `EnrichCertificate` in `transforms/__init__.py`, require `maltego/transforms/EnrichCertificate.py`, require `execute_gateway_transform(request, response, 'certificate')`, require `input_entity='maltego.Hash'`, and require a matching `transform-manifest.json` entry.

- [ ] **Step 3: Replace the staged Train 6 gap invariant**

Update the Node compatibility test to require Maltego coverage for all nine `WORKFLOWS` types and require `EnrichCertificate` to be present.

- [ ] **Step 4: Commit tests only and verify RED through GitHub Actions**

Expected Tooling smoke failures: missing certificate support/transform/manifest registration. CodeQL may remain green because this commit only changes tests/docs.

---

### Task 2: Implement minimal certificate parity

**Files:**
- Create: `maltego/transforms/EnrichCertificate.py`
- Modify: `maltego/transforms/__init__.py`
- Modify: `maltego/gateway_client.py`
- Modify: `maltego/transform-manifest.json`

**Interfaces:**
- Consumes: `execute_gateway_transform(request, response, indicator_type)` and the existing gateway JSON API.
- Produces: `EnrichCertificate` and certificate-aware transport in `GatewayClient.enrich`.

- [ ] **Step 1: Add the transform**

```python
from maltego_trx.transform import DiscoverableTransform
from extensions import registry
from transforms.common import execute_gateway_transform


@registry.register_transform(
    display_name='PARA11AX Enrich Certificate',
    input_entity='maltego.Hash',
    description='Enrich an X.509 certificate SHA-256 fingerprint through the private PARA11AX gateway.',
    output_entities=['maltego.Domain', 'maltego.URL', 'maltego.Phrase'],
)
class EnrichCertificate(DiscoverableTransform):
    @classmethod
    def create_entities(cls, request, response):
        execute_gateway_transform(request, response, 'certificate')
```

- [ ] **Step 2: Register the transform**

Import/export `EnrichCertificate` from `maltego/transforms/__init__.py` and add this manifest object:

```json
{"class": "EnrichCertificate", "indicatorType": "certificate", "inputEntity": "maltego.Hash"}
```

- [ ] **Step 3: Add client support without altering hash semantics**

Add `certificate` to `SUPPORTED_INDICATOR_TYPES`. Immediately before JSON encoding, compute:

```python
transport_indicator = indicator.strip()
if indicator_type == 'certificate':
    transport_indicator = f'cert-sha256:{transport_indicator}'
```

Use `transport_indicator` in the payload. Do not change the `hash` path.

- [ ] **Step 4: Verify GREEN**

Require the full Tooling smoke workflow to pass, including Node tests, Maltego unit tests, Python compile, shell/PowerShell checks, MTZ checks, and locked-dependency checks.

---

### Task 3: Release gate and merge

**Files:**
- No new production files beyond Task 2.

**Interfaces:**
- Consumes: exact feature-branch head and current protected `main`.
- Produces: merged Train 6 parity only if all gates remain clean.

- [ ] **Step 1: Run exact-head verification**

Require Tooling smoke PASS and CodeQL PASS on the exact PR head.

- [ ] **Step 2: Review scope**

Changed files must be limited to the approved docs/tests and the four Maltego implementation surfaces. Confirm no unresolved review threads and no unexpected provider/API/browser/persistence changes.

- [ ] **Step 3: Re-read protected `main` before merge**

If `main` advanced, compare and reconcile without force-updating the feature branch. Re-run exact-head checks after reconciliation.

- [ ] **Step 4: Merge with expected head SHA**

Use protected-main PR merge and supply the exact expected PR head SHA.

- [ ] **Step 5: Post-merge verification**

Require exact merged-main Tooling smoke PASS, CodeQL PASS, and successful Vercel deployment/status before declaring Train 6 closed.

## Self-Review

- Spec coverage: certificate transform, explicit transport prefix, registration, manifest, MTZ parity, credential boundary, and release verification are all covered.
- Placeholder scan: no deferred implementation steps remain.
- Type consistency: Maltego input is raw SHA-256 in `maltego.Hash`; gateway transport is `cert-sha256:<sha256>` with type `certificate`; file hashes remain unchanged.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
