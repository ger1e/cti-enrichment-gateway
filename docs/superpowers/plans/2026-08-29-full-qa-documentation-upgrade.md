<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Document status:** Historical design record. Preserved for implementation history; current behavior is defined by [docs/ARCHITECTURE.md](https://github.com/ger1e/para11ax/blob/main/docs/ARCHITECTURE.md) and the current README.

# Full QA and Documentation Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PARA11AX implementation, tests, CI, Maltego coverage, deployment evidence, and public documentation agree on the current post-v8 contract, with executable drift guards and a durable QA evidence report.

**Architecture:** Add one focused documentation-contract test that derives machine facts from canonical source/config and checks bounded documentation sections. Then update deep docs/README/changelog/Maltego documentation to the verified contract, audit security/operations wording, and add an evidence-oriented QA report. Do not alter product behavior unless the audit exposes a real correctness/security defect; such a defect is split into its own focused PR.

**Tech Stack:** Node.js 24 / `node:test`, JavaScript ES modules, Python Maltego client, Bash/ShellCheck, PowerShell parser checks, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-29-full-qa-documentation-upgrade-design.md`

## Global Constraints

- No new numbered V8 train.
- No new provider, provider credential change, arbitrary egress, server-side case persistence, UI redesign, scoring model, LLM verdict, or semantic-versioning promise.
- Preserve existing API/evidence/provider/Maltego behavior unless QA proves a real defect.
- Canonical workflow set comes from `WORKFLOWS`; current count is nine and includes `certificate`.
- Canonical provider count comes from the active provider registry; current count is 38.
- Evidence Schema is v2; canonical top-level projection contracts are Evidence Graph v1.0 and Guidance v1.0.
- Documentation must distinguish repository-proven, CI-proven, deployment-proven, live-public-proven, and credential-dependent/unverified states.
- A tracked QA report must not claim to embed its own containing commit SHA.
- Full exact-head Tooling smoke and CodeQL are required before merge; exact-main Tooling smoke, CodeQL, Vercel READY metadata, and public live checks are required after merge.

---

### Task 1: Add documentation-contract drift tests

**Files:**
- Create: `test/documentation-contracts.test.mjs`
- Read: `src/workflows.js`
- Read: `src/core/provider-registry.js`
- Read: `src/providers/index.js`
- Read: `src/core/version.js`
- Read: `src/core/evidence-graph.js`
- Read: `src/core/guidance.js`
- Read: `maltego/transform-manifest.json`
- Test: `test/documentation-contracts.test.mjs`

**Interfaces:**
- Consumes: `WORKFLOWS`, active provider registry, exported version constants, Maltego transform manifest, bounded documentation files.
- Produces: one low-brittleness regression suite that fails when canonical observable/provider/version/API/Maltego/production-identity facts drift from docs.

- [ ] **Step 1: Write the failing test**

Create a test module that:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORKFLOWS } from '../src/workflows.js';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { ALL_PROVIDERS } from '../src/providers/index.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const workflows = Object.keys(WORKFLOWS).sort();
const providerCount = createProviderRegistry(ALL_PROVIDERS).names().length;

function requireTokens(text, tokens, label) {
  for (const token of tokens) assert.ok(text.includes(token), `${label}: missing ${token}`);
}

test('architecture and API document all canonical workflow types', () => {
  const architecture = read('docs/ARCHITECTURE.md');
  const api = read('docs/API.md');
  requireTokens(architecture, workflows.map(type => `\`${type}\``), 'architecture workflow contract');
  requireTokens(api, workflows.map(type => `\`${type}\``), 'API workflow contract');
});

test('README provider count and production identity match canonical policy', () => {
  const readme = read('README.md');
  assert.ok(readme.includes(`${providerCount} upstream APIs and feeds`));
  assert.ok(readme.includes('https://para11ax.vercel.app'));
});

test('Evidence v2, Evidence Graph v1.0, and Guidance v1.0 are first-class documented contracts', () => {
  const schema = read('docs/EVIDENCE-SCHEMA.md');
  requireTokens(schema, ['Evidence Schema v2', 'Evidence Graph v1.0', 'Guidance v1.0', '`evidenceGraph`', '`guidance`'], 'evidence documentation');
  assert.match(schema, /error[^\n]*(?:does not|do not|without)[^\n]*(?:evidenceGraph|guidance)|(?:evidenceGraph|guidance)[^\n]*(?:absent|not added)[^\n]*error/i);
});

test('Maltego documentation covers every canonical workflow and certificate transport semantics', () => {
  const maltegoReadme = read('maltego/README.md');
  requireTokens(maltegoReadme, workflows.map(type => `\`${type}\``), 'Maltego workflow documentation');
  requireTokens(maltegoReadme, ['EnrichCertificate', 'cert-sha256:'], 'certificate Maltego semantics');
});

test('documentation rejects a universal maliciousness score', () => {
  const docs = ['README.md', 'docs/EVIDENCE-SCHEMA.md', 'docs/ARCHITECTURE.md'].map(read).join('\n');
  assert.match(docs, /no universal maliciousness score|does not.*universal.*score/i);
});
```

Add a bounded API-route assertion using the documented canonical route names `meta`, `health`, `status`, `enrich`, `batch`, and `stix`, plus a changelog assertion for local cases, Evidence Graph, Guidance, and certificate Maltego parity.

- [ ] **Step 2: Run the new test to verify RED**

Run: `node --test test/documentation-contracts.test.mjs`

Expected: FAIL against the stale baseline because architecture/API omit the complete nine-workflow contract, Evidence Schema omits top-level Evidence Graph/Guidance, Maltego docs are incomplete or stale, and changelog lacks the completed v8 consolidation.

- [ ] **Step 3: Commit only the failing regression test**

Commit message: `test: detect documentation contract drift`

### Task 2: Upgrade contract and operator documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/API.md`
- Modify: `docs/EVIDENCE-SCHEMA.md`
- Modify: `docs/END-TO-END-EXAMPLE.md`
- Modify: `maltego/README.md`
- Test: `test/documentation-contracts.test.mjs`

**Interfaces:**
- Consumes: canonical workflow/provider/version/Maltego facts and Train 4–6 implementation contracts.
- Produces: public/operator documentation that accurately explains all nine workflows, additive Train 5 response fields, graph distinctions, local case boundaries, and complete Maltego parity.

- [ ] **Step 1: Update README**

Keep it concise. Ensure it states:

```text
Inputs: ip · domain · url · hash · cve · attack · asn · cidr · certificate
Outputs: Evidence v2 · Evidence Graph v1.0 · Guidance v1.0 · typed correlation · deterministic decision support
Maltego: all nine workflow types covered; certificate SHA-256 uses explicit certificate transform semantics
```

Mention browser-local cases/index/bundles as local analyst workspace state, not server persistence.

- [ ] **Step 2: Update architecture**

Document all nine canonical workflow types and add three distinct graph concepts:

```text
decision.entityGraph -> compact decision-support investigation pivots
response.evidenceGraph -> canonical Evidence Graph v1.0 projection
browser case graph -> local-only exact typed case/sighting projection
```

Make clear that Evidence Graph and Guidance are added only on successful/partial normalized enrichment paths and do not redefine error envelopes.

- [ ] **Step 3: Update API contract**

Add a supported-types section listing all nine canonical types. Document certificate request form `cert-sha256:<64-hex>` and exact type matching. For `/enrich`, state that `status: ok|partial` responses include additive `evidenceGraph` and `guidance`; error envelopes do not gain those fields.

- [ ] **Step 4: Update Evidence Schema**

Add first-class sections headed exactly:

```markdown
#### Evidence Graph v1.0
#### Guidance v1.0
```

Document deterministic identity, bounded output, explicit-only relationships, no inferred attribution, guidance inheritance from existing decision/correlation output, semantic-change attention input, and the distinction from `decision.entityGraph`.

- [ ] **Step 5: Update end-to-end example**

Show the current conceptual response flow:

```text
evidence -> correlation -> decision -> evidenceGraph + guidance -> analyst interpretation/export
```

Explain limitations and provenance without presenting generated hunt guidance as compromise proof.

- [ ] **Step 6: Update Maltego README**

List all nine workflow types and transforms, including `EnrichCertificate`. State that raw SHA-256 entered through the certificate transform is sent as `cert-sha256:<fingerprint>`, while `EnrichHash` preserves file-hash semantics. Reassert that only `PARA11AX_TOKEN` crosses the Maltego credential boundary.

- [ ] **Step 7: Run the documentation-contract test**

Run: `node --test test/documentation-contracts.test.mjs`

Expected: PASS for the contract/documentation assertions implemented so far.

- [ ] **Step 8: Commit**

Commit message: `docs: align public contracts with v8 platform`

### Task 3: Upgrade operations, security, contribution, provider, and changelog docs

**Files:**
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/PROVIDERS.md`
- Modify: `SECURITY.md` only where materially stale
- Modify: `docs/SECURITY-CONTROLS.md` only where materially stale
- Modify: `docs/THREAT-MODEL.md` only where materially stale
- Modify: `CONTRIBUTING.md`
- Modify: `CHANGELOG.md`
- Test: `test/documentation-contracts.test.mjs`

**Interfaces:**
- Consumes: current CI workflow definitions, provider policy, Train 4 local-state boundary, Train 5 projection boundary, Train 6 Maltego boundary.
- Produces: maintenance/security/release documentation with explicit proof-state vocabulary and current v8 change history.

- [ ] **Step 1: Audit CI/operations wording against `.github/workflows/tooling-smoke.yml` and `codeql.yml`**

Document that Tooling smoke is branch-required and publishes exact-head status; CodeQL is a release verification gate even if not required by branch protection. Add documentation-contract verification to the local/full QA narrative because it runs under `npm test`/`npm run check`.

- [ ] **Step 2: Audit provider documentation**

Ensure current provider count is 38 and supported-type wording includes certificate only where provider policy actually supports it. Keep implemented/configured/production-verified states separate; do not claim secret readiness.

- [ ] **Step 3: Audit security documents**

Add only missing material statements:

```text
browser-local case persistence does not create server-side IOC history
Evidence Graph/Guidance projections add no provider egress or persistence
Maltego certificate parity adds no provider credential exposure
```

Correct any wording that treats repository files as proof of external GitHub/Vercel settings.

- [ ] **Step 4: Strengthen contribution contract**

Require changes to canonical externally documented contracts to update relevant docs and executable drift checks in the same PR.

- [ ] **Step 5: Upgrade changelog**

Under `Unreleased`, record:

```text
Train 4: browser-local cases, bundles, exact typed cross-case index
Train 5: Evidence Graph v1.0 and Guidance v1.0 additive projections
Train 6: certificate Maltego parity across all nine workflows
Post-train hardening: source-before-paint/single stylesheet ownership where material
QA/docs consolidation: executable documentation-contract drift checks
```

Do not claim semantic-versioning guarantees.

- [ ] **Step 6: Run targeted and full Node tests**

Run:

```bash
node --test test/documentation-contracts.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `docs: harden operations security and maintenance truth`

### Task 4: Add durable QA report and complete repository audit

**Files:**
- Create: `docs/QA-REPORT.md`
- Modify: `README.md` only to add a deep-doc link if appropriate
- Modify: `test/documentation-contracts.test.mjs` only if a newly discovered stable contract needs a drift guard

**Interfaces:**
- Consumes: audit findings, test outputs, CI workflow definitions, GitHub/Vercel/public-route evidence.
- Produces: evidence-oriented current-state QA report that clearly separates proof boundaries and lists residual/unverified states.

- [ ] **Step 1: Run repository audit on the candidate head**

The authoritative remote execution gate is GitHub `Tooling smoke`, which must exercise:

```text
npm ci --ignore-scripts
npm audit --omit=dev
npm run check
python3 -m unittest discover -s maltego/tests -v
python3 -m compileall -q maltego
bash -n + ShellCheck
PowerShell parser checks
```

Also inspect CodeQL, branch protection/governance read state, workflow permissions/pinning/timeout/concurrency, changed files, and public-release audit output.

- [ ] **Step 2: Record discovered issues before fixing any newly found issue**

For each issue, record `finding`, `proof`, `disposition`, and whether it is docs/tests only or requires a split behavioral PR. Do not bury runtime fixes in this documentation branch.

- [ ] **Step 3: Create QA report**

Use these sections:

```markdown
# PARA11AX QA Report
## Scope and audit baseline
## Proof-state definitions
## Findings and dispositions
## Repository/static verification
## CI verification
## Deployment and live-public verification
## Credential-dependent surfaces not proven here
## Residual risks and deliberate gaps
## Reproduction checklist
```

Record the baseline SHA and candidate PR-head SHA where meaningful, but explicitly state that the tracked report does not embed its own final containing merge SHA. Post-merge exact identity is reproduced from GitHub/Vercel metadata.

- [ ] **Step 4: Run full local-equivalent suite through GitHub Actions on exact PR head**

Expected: exact-head Tooling smoke PASS and CodeQL PASS.

- [ ] **Step 5: Commit QA report**

Commit message: `docs: add evidence-oriented QA report`

### Task 5: Release review, protected merge, and production verification

**Files:**
- No new product files expected.
- Update `docs/QA-REPORT.md` before merge only if pre-merge findings materially change; do not attempt a self-referential post-merge SHA edit.

**Interfaces:**
- Consumes: exact tested PR head.
- Produces: protected-main merged QA/docs consolidation and independently reproducible exact-main production evidence.

- [ ] **Step 1: Re-read current main and compare branch**

Require:

```text
no unexpected concurrent overlap
no provider/API/UI behavior changes unless separately approved
no credential/dependency/egress/persistence leakage
no unresolved review threads
```

- [ ] **Step 2: Verify exact PR head again**

Require exact-head Tooling smoke PASS and CodeQL PASS after the final documentation/report commit.

- [ ] **Step 3: Merge with expected-head SHA**

Use repository-supported merge method and expected-head guard. If `main` moved, stop and reconcile before merging.

- [ ] **Step 4: Verify exact merged main**

Require:

```text
main == returned merge SHA
Tooling smoke push run PASS
CodeQL push run PASS
Vercel production deployment READY with githubCommitSha == merge SHA
```

- [ ] **Step 5: Verify live public surfaces**

Check at minimum:

```text
GET https://para11ax.vercel.app/ -> 200
GET https://para11ax.vercel.app/app/ -> 200
GET https://para11ax.vercel.app/api/para11ax/meta -> expected public JSON contract
sample static/error route behavior -> expected public status/content
```

Do not claim authenticated health/status/provider readiness unless an authorized bearer/provider probe is actually executed.

- [ ] **Step 6: Final closure report**

Report exact merge SHA, PR number, pre/post-merge Tooling smoke and CodeQL run numbers, Vercel deployment ID/state/SHA, live public checks, findings fixed, and credential-dependent surfaces intentionally left unverified.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
