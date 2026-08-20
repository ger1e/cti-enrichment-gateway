# Contributing

This repository is a private personal-research/lab CTI enrichment gateway. Changes should preserve its read-only, bounded, evidence-first design.

## Before changing code

Read `SECURITY.md` and the architecture/provider-boundary sections in `README.md`.

Do not commit or add workflows that expose API keys, tokens, credentials, private keys, certificates, `.env` files, packet captures, malware samples, generated MTZ packages, or sensitive analysis material.

Do not broaden provider integrations into submission, scanning, detonation, malware/sample download, arbitrary proxying, shell execution, secret retrieval, or other write-capable behavior without an explicit security/design review.

## Development workflow

1. Branch from an up-to-date `main`.
2. Keep changes narrow and independently reviewable.
3. Preserve provider-native semantics and provenance.
4. Add or update tests for behavior changes.
5. Run the repository gates before opening a ready-for-review PR.

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

## Security review triggers

Call out a security impact explicitly when a change touches any of the following:

- authentication or authorization
- secret handling or environment variables
- outbound provider hosts, redirects, headers, or request construction
- input validation/canonicalization
- response-size, timeout, retry, or rate-limit behavior
- cache or persistence semantics
- logging, Sentry, or error reflection
- GitHub Actions, dependency pinning, or deployment/bootstrap logic
- Maltego token storage, gateway transport, or graph expansion
- any new provider capability beyond retrieval/enrichment

## Pull requests

PRs should explain:

- what changed and why
- affected indicator/workflow/provider surfaces
- evidence or tests used to validate the change
- security/privacy/licensing impact
- expected false positives, degraded modes, or telemetry/provider limitations where relevant

Prefer small PRs. Avoid drive-by formatting mixed with functional changes.

## Commit messages

Use concise imperative messages. Conventional prefixes such as `feat:`, `fix:`, `chore:`, `docs:`, `test:`, and `refactor:` are preferred when they make history easier to scan.
