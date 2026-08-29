### Contributing

This repository is a public personal-research/lab PARA11AX project. Changes should preserve its read-only, bounded, evidence-first design.

#### Before changing code

Read `SECURITY.md` and the architecture/provider-boundary sections in `README.md`.

Do not commit or add workflows that expose API keys, tokens, credentials, private keys, certificates, `.env` files, packet captures, malware samples, generated MTZ packages, or sensitive analysis material.

Do not broaden provider integrations into submission, scanning, detonation, malware/sample download, arbitrary proxying, shell execution, secret retrieval, or other write-capable behavior without an explicit security/design review.

#### Development workflow

1. Branch from an up-to-date `main`.
2. Keep changes narrow and independently reviewable.
3. Preserve provider-native semantics and provenance.
4. Add or update tests for behavior changes.
5. When a canonical externally documented contract changes, update the relevant documentation **and** its executable drift guard in the same PR.
6. Run the repository gates before opening a ready-for-review PR.

Canonical contract changes include workflow/indicator types, provider inventory/count, schema/projection versions, API routes, Maltego workflow coverage, production identity, security boundaries and release/CI claims.

```bash
npm run bootstrap
npm run verify:tooling
npm run verify:repo
npm run lint:shell
npm run check
npm test
cd maltego && python3 -m unittest discover -s tests -v
cd .. && python3 -m compileall -q maltego
```

`npm run check` includes the documentation-contract tests. If one fails after a canonical contract change, fix the documentation/source mismatch; do not weaken the assertion merely to preserve stale text.

#### Security review triggers

Call out a security impact explicitly when a change touches any of the following:

- authentication or authorization
- secret handling or environment variables
- outbound provider hosts, redirects, headers, or request construction
- input validation/canonicalization
- response-size, timeout, retry, or rate-limit behavior
- cache or persistence semantics
- browser-local case storage/bundles/indexing
- evidence graph or guidance projection semantics
- logging, Sentry, or error reflection
- GitHub Actions, dependency pinning, or deployment/bootstrap logic
- Maltego token storage, gateway transport, certificate mapping, or graph expansion
- any new provider capability beyond retrieval/enrichment

#### Pull requests

PRs should explain:

- what changed and why
- affected indicator/workflow/provider surfaces
- evidence or tests used to validate the change
- documentation-contract impact where applicable
- security/privacy/licensing impact
- expected false positives, degraded modes, or telemetry/provider limitations where relevant
- what is repository/CI-proven versus what still requires authenticated deployment/provider verification

Prefer small PRs. Avoid drive-by formatting mixed with functional changes. If a broad QA/docs pass uncovers a real runtime defect, split the behavioral fix into a focused PR rather than hiding it inside documentation churn.

#### Commit messages

Use concise imperative messages. Conventional prefixes such as `feat:`, `fix:`, `chore:`, `docs:`, `test:`, and `refactor:` are preferred when they make history easier to scan.
