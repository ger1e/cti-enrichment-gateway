### Operations

#### Acceptance and proof states

Keep these states separate:

1. **Repository-proven:** exact source SHA passes repository invariants, dependency/public-release checks, Node tests, Maltego tests, Python compilation, shell/ShellCheck and PowerShell parsing.
2. **CI-proven:** GitHub Actions reports the required checks for that exact SHA. `Tooling smoke` is the branch-required gate; CodeQL is also required by the PARA11AX release/QA process even when branch protection does not list it as a required context.
3. **Configured:** required runtime secrets exist. Source code or public metadata cannot establish this.
4. **Deployment-proven:** Vercel metadata reports the expected exact Git SHA and `READY` state.
5. **Live-public-proven:** public unauthenticated routes return their expected status/content on that deployment.
6. **Credential/provider-proven:** authenticated health/status and provider probes were actually executed with authorized credentials against the exact deployment.

Do not collapse these into a single “production verified” statement. A READY public deployment is not proof that provider credentials are configured or healthy.

#### Local/full repository verification

From a clean checkout of exact `main`:

```powershell
git fetch origin
git checkout main
git pull --ff-only
npm run check
cd maltego
python3 -m unittest discover -s tests -v
cd ..
python3 -m compileall -q maltego
```

`npm run check` includes repository invariants, public-release audit and the full Node suite. The Node suite includes executable documentation-contract checks that compare bounded public documentation facts with canonical workflow/provider/version surfaces.

`node scripts/generate-release-manifest.mjs --check` must pass. The committed manifest intentionally has `sourceCommit: null`; a deployment/release process may supply an exact SHA with `--source-commit` or `SOURCE_COMMIT` when producing an external release record.

#### Documentation contract maintenance

Externally meaningful canonical facts must not drift silently from documentation. Current executable documentation checks cover:

- all nine workflow types (`ip`, `domain`, `url`, `hash`, `cve`, `attack`, `asn`, `cidr`, `certificate`)
- canonical provider count
- Evidence Schema v2 / Evidence Graph v1.0 / Guidance v1.0 documentation
- API route inventory
- Maltego workflow/certificate semantics
- canonical production identity
- v8 changelog coverage

When a canonical source changes, update the relevant documentation and drift test in the same PR. Do not weaken the test merely to preserve stale prose.

#### Hosted-CI and deployment cost boundary

This public repository runs one bounded Ubuntu `Tooling smoke` job for pull requests targeting `main`, pushes to `main`, and explicit manual dispatch. There are no scheduled runs and no recurring hosted macOS/Windows runners. Obsolete in-progress runs are cancelled and the job has a ten-minute ceiling.

The workflow performs the locked npm install/audit, repository and Node checks, Maltego Python tests, Python compilation, ShellCheck/bash validation, and PowerShell syntax validation. It publishes `Tooling smoke` against the exact PR head or merged `main` SHA and marks that SHA pending before validation so stale success cannot be reused.

CodeQL runs separately for JavaScript/TypeScript analysis. It is not currently the branch-protection context that gates merges, but the PARA11AX release/QA procedure requires the exact candidate head and exact merged `main` CodeQL runs to pass before a QA/release closure claim.

Vercel Git deployment is intentionally narrower than CI: `vercel.json` disables automatic builds for feature/PR branches and permits protected `main`. A protected, verified merge to `main` may produce one production build, which is accepted only when Vercel deployment metadata reports that exact `main` SHA.

#### Authorized finalizer

The repository ships an authenticated local finalizer. On the authorized workstation:

```powershell
git checkout main
git pull --ff-only
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\finalize.ps1
```

The finalizer is responsible for enforcing its branch-protection contract where the caller has permission, verifying required status checks, and invoking the pinned Vercel bootstrap/deployment workflow when an explicit deployment is needed. If account permissions prevent branch-protection mutation, that is an explicit external prerequisite, not a successful configuration.

Repository files describe the intended governance contract but cannot by themselves prove current GitHub account/repository settings. Use the read-only governance verifier or GitHub API readback for that claim.

#### Production smoke acceptance

Acceptance is against one exact source SHA. Verify deployment metadata first; reject a stale deployment.

Public QA can safely verify without a bearer:

- `GET /`
- `GET /app/`
- public `GET /api/para11ax/meta`
- representative static/error routes
- production deployment metadata/source SHA

Credential-bearing acceptance, only when explicitly authorized, adds:

- protected `GET /api/para11ax/health`
- bearer `GET /api/para11ax/status` and `Cache-Control: no-store`
- one bounded public-source enrichment
- one configured credentialed-source enrichment
- no credential or bearer reflection in response bodies/error surfaces
- gateway/schema version matches repository release identity

If the authorized bearer is not used, report health/status/enrichment readiness as **not proven by this QA pass**, not as failed and not as implicitly healthy.

For provider readiness, use the sequential secret-safe probe in the credential-bearing operator environment:

```bash
para11ax providers probe --all
```

The probe distinguishes `ok`, `unconfigured`, `auth_failed`, `rate_limited`, `timeout`, `upstream_error`, and `contract_error`. Never reinterpret `unconfigured`, upstream failure, or feed absence as a clean verdict.

#### Maltego acceptance

Repository tests enforce intended parity between the nine server workflow types and Maltego transforms. Certificate semantics remain explicit: `EnrichCertificate` turns a raw SHA-256 Maltego Hash input into `cert-sha256:<fingerprint>` for the gateway; `EnrichHash` keeps the same raw value as file-hash semantics.

Only `PARA11AX_TOKEN` crosses the Maltego credential boundary. Provider credentials remain server-side.

#### Browser-local workspace acceptance

Train 4 case persistence is browser-local IndexedDB state. Case snapshots, diffs, exact typed sightings and case graphs must not create server-side IOC history, bearer persistence, or a direct network persistence path. Active-case state is runtime-only.

#### Secret handling

- Keep `.env*` except `.env.example` untracked.
- Store production secrets in Vercel/project secret storage, not Git.
- Rotate `PARA11AX_TOKEN` if exposed; clients must update their bearer after rotation.
- Rotate an affected provider credential independently. Other provider secrets should not need rotation merely because one provider token changed.
- Sentry auth remains observability-only; do not send CTI evidence or raw queried indicators to Sentry.

#### Provider incident behavior

When a provider degrades:

- failures remain explicit and are not cached
- retry is bounded to one retry for retryable conditions
- the instance-local circuit may open after repeated retryable failures
- successful providers continue and response status becomes partial where applicable
- do not convert provider outage into a `not_listed`/clean verdict

Use authenticated `/api/para11ax/status` for count-only circuit/cache/configuration state. Do not add raw IOC history to the status surface.

#### Parser/source changes

When an upstream schema changes:

1. add a reproducing failing fixture
2. update the parser minimally
3. increment `parserVersion`
4. regenerate `release-manifest.json`
5. update documentation/drift guards if the public contract changed
6. run full repository verification
7. production-smoke the changed provider before marking it production-verified

#### Adding a provider or workflow type

A new provider must have a fixed bounded lookup, explicit semantics and a justified workflow placement. Required changes include adapter, static metadata, registry/workflow, tests, parser version and release manifest. Do not add an API merely because a key exists.

A new workflow type additionally requires classifier/canonicalization policy, API/meta exposure, browser transport policy where applicable, Maltego parity decision, documentation-contract updates, and explicit STIX posture.

#### Cache/circuit notes

Cache and circuit state are in-memory and instance-local. Cold starts reset them. Do not use them as durable investigation history or quota accounting. Durable analyst case state currently exists only in the browser-local Train 4 workspace; a server-side IOC lifecycle/store would require a separate explicit design.

#### Public release

Treat every tracked repository artifact as public. Run `npm run audit:public` and follow `PUBLIC-RELEASE-CHECKLIST.md` before publishing release artifacts or derived bundles.

#### QA evidence

`QA-REPORT.md` records the current consolidation audit, findings and proof boundaries. A tracked Markdown report cannot safely embed the SHA of the commit that contains itself; exact current repository and deployment SHAs must be read from GitHub/Vercel during verification.
