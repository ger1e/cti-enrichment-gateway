### Operations

#### Acceptance and proof states

Keep these states separate:

1. **Repository-proven:** exact source SHA passes repository invariants, dependency/public-release checks, Node tests, Maltego tests, Python compilation, shell/ShellCheck and PowerShell parsing.
2. **CI-proven:** GitHub Actions reports the required checks for that exact SHA. `Tooling smoke` is the branch-required gate; CodeQL is also required by the PARA11AX release/QA process even when branch protection does not list it as a required context.
3. **Configured:** required runtime secrets exist. Source code or public metadata cannot establish this.
4. **Deployment-proven:** Vercel metadata reports the expected exact Git SHA and `READY` state.
5. **Live-public-proven:** public unauthenticated routes return their expected status/content on that deployment.
6. **Credential/provider-proven:** authenticated health/status and provider probes were actually executed with authorized credentials against the exact deployment.
7. **User-Scanner-wired:** the isolated User Scanner worker is deployed, the PARA11AX production project points to it with `PARA11AX_USER_SCANNER_URL`, any configured worker bearer matches `PARA11AX_USER_SCANNER_TOKEN`, and an authorized bounded scan succeeds through the PARA11AX shell/API path.

Do not collapse these into a single “production verified” statement. A READY public deployment is not proof that provider credentials or User Scanner worker wiring are configured or healthy.

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
python3 -m compileall -q workers/user-scanner
```

`npm run check` includes repository invariants, public-release audit and the full Node suite. The Node suite includes executable documentation-contract checks that compare bounded public documentation facts with canonical workflow/provider/version surfaces and the separate User Scanner public contract.

`node scripts/generate-release-manifest.mjs --check` must pass. The committed manifest intentionally has `sourceCommit: null`; a deployment/release process may supply an exact SHA with `--source-commit` or `SOURCE_COMMIT` when producing an external release record.

#### Documentation contract maintenance

Externally meaningful canonical facts must not drift silently from documentation. Current executable documentation checks cover:

- all nine Evidence v2 workflow types (`ip`, `domain`, `url`, `hash`, `cve`, `attack`, `asn`, `cidr`, `certificate`)
- canonical provider count
- Evidence Schema v2 / Evidence Graph v1.0 / Guidance v1.0 documentation
- API route inventory, including the separate `/api/para11ax/user-scanner` route
- User Scanner shell aliases, active OSINT boundary and hosted-worker environment names
- Maltego workflow/certificate semantics
- canonical production identity
- v8 changelog coverage

When a canonical source changes, update the relevant documentation and drift test in the same PR. Do not weaken the test merely to preserve stale prose.

#### Hosted-CI and deployment cost boundary

This public repository runs one bounded Ubuntu `Tooling smoke` job for pull requests targeting `main`, pushes to `main`, and explicit manual dispatch. There are no scheduled runs and no recurring hosted macOS/Windows runners. Obsolete in-progress runs are cancelled and the job has a ten-minute ceiling.

The workflow performs the locked npm install/audit, repository and Node checks, Maltego Python tests, Python compilation, ShellCheck/bash validation, and PowerShell syntax validation. It publishes `Tooling smoke` against the exact PR head or merged `main` SHA and marks that SHA pending before validation so stale success cannot be reused.

CodeQL runs separately for JavaScript/TypeScript analysis. It is not currently the branch-protection context that gates merges, but the PARA11AX release/QA procedure requires the exact candidate head and exact merged `main` CodeQL runs to pass before a QA/release closure claim.

Vercel Git deployment is intentionally narrower than CI: `vercel.json` disables automatic builds for feature/PR branches and permits protected `main`. A protected, verified merge to `main` may produce one production build, which is accepted only when Vercel deployment metadata reports that exact `main` SHA.

The User Scanner worker is a separate Python Vercel project. Keeping it separate prevents its high-fan-out active OSINT network behavior and Python dependency surface from being folded into the passive Node enrichment runtime. Its deployment state must therefore be accepted independently from the main PARA11AX project.

#### User Scanner hosted deployment and wiring

Reference production topology:

```text
Browser analyst shell
  -> https://para11ax.vercel.app/api/para11ax/user-scanner
  -> PARA11AX_USER_SCANNER_URL
  -> https://user-scanner-kappa.vercel.app
```

The main PARA11AX Vercel project requires:

```text
PARA11AX_USER_SCANNER_URL=https://user-scanner-kappa.vercel.app
PARA11AX_USER_SCANNER_TOKEN=<set only when worker bearer auth is enabled>
```

The worker project may independently require the matching bearer expected by its reference server. Do not put either bearer in tracked files, client JavaScript, terminal history, screenshots or documentation examples containing real values.

For local/self-hosted development, `PARA11AX_USER_SCANNER_URL` may use loopback HTTP such as `http://127.0.0.1:8765/`; non-loopback worker URLs must use HTTPS.

The PARA11AX gateway owns the public request contract. Callers cannot select the worker URL, proxy route, arbitrary module path, concurrency, worker timeout or bulk file. `category` and `module` remain mutually exclusive; cross-scan is opt-in; NSFW modules remain excluded by default unless the analyst explicitly requests inclusion.

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
- User Scanner worker deployment metadata and public deployment identity, without claiming scanner readiness

Credential-bearing acceptance, only when explicitly authorized, adds:

- protected `GET /api/para11ax/health`
- bearer `GET /api/para11ax/status` and `Cache-Control: no-store`
- one bounded public-source enrichment
- one configured credentialed-source enrichment
- one bounded `user-scanner username <authorized-test-handle> --module <approved-module>` operation through the existing PARA11AX shell when User Scanner is expected to be wired
- no credential or bearer reflection in response bodies/error surfaces
- gateway/schema version matches repository release identity

For the User Scanner acceptance step, verify that the shell hits the same-origin PARA11AX route rather than calling the worker directly; confirm a structured `source: "user-scanner"` response, bounded summary/results, and no mutation of the current Evidence v2 result. A worker timeout, rate limit or module error is an explicit coverage/runtime failure, not a not-found result.

If the authorized bearer is not used, report health/status/enrichment/User Scanner readiness as **not proven by this QA pass**, not as failed and not as implicitly healthy.

For provider readiness, use the sequential secret-safe probe in the credential-bearing operator environment:

```bash
para11ax providers probe --all
```

The probe distinguishes `ok`, `unconfigured`, `auth_failed`, `rate_limited`, `timeout`, `upstream_error`, and `contract_error`. Never reinterpret `unconfigured`, upstream failure, or feed absence as a clean verdict.

#### Maltego acceptance

Repository tests enforce intended parity between the nine server Evidence v2 workflow types and Maltego transforms. Certificate semantics remain explicit: `EnrichCertificate` turns a raw SHA-256 Maltego Hash input into `cert-sha256:<fingerprint>` for the gateway; `EnrichHash` keeps the same raw value as file-hash semantics.

User Scanner is not silently added to Maltego transform parity. Its current operator surface is the existing PARA11AX analyst shell/API. Adding email/username transforms would require a separate design and explicit semantics because account/handle matches are not Evidence v2 reputation facts.

Only `PARA11AX_TOKEN` crosses the Maltego credential boundary. Provider credentials and the optional User Scanner worker token remain server-side.

#### Browser-local workspace acceptance

Train 4 case persistence is browser-local IndexedDB state. Case snapshots, diffs, exact typed sightings and case graphs must not create server-side IOC history, bearer persistence, or a direct network persistence path. Active-case state is runtime-only.

User Scanner output is terminal-visible but remains separate from the current Evidence v2 result and is not automatically persisted into browser case evidence. Any future persistence/pinning of identity OSINT requires an explicit typed schema rather than free-form promotion.

#### Secret handling

- Keep `.env*` except `.env.example` untracked.
- Store production secrets in Vercel/project secret storage, not Git.
- Rotate `PARA11AX_TOKEN` if exposed; clients must update their bearer after rotation.
- Configure `PARA11AX_USER_SCANNER_URL` as deployment configuration, not caller input.
- Rotate `PARA11AX_USER_SCANNER_TOKEN` independently if worker authentication is enabled and the token is exposed.
- Rotate an affected provider credential independently. Other provider secrets should not need rotation merely because one provider token changed.
- Sentry auth remains observability-only; do not send CTI evidence, raw queried indicators, email targets or username targets to Sentry.

#### Provider incident behavior

When a provider degrades:

- failures remain explicit and are not cached
- retry is bounded to one retry for retryable conditions
- the instance-local circuit may open after repeated retryable failures
- successful providers continue and response status becomes partial where applicable
- do not convert provider outage into a `not_listed`/clean verdict

Use authenticated `/api/para11ax/status` for count-only circuit/cache/configuration state. Do not add raw IOC history to the status surface.

User Scanner worker/module failures follow a separate path: gateway misconfiguration is `503`, worker/upstream failure is controlled `502`, and worker timeout is `504`. Do not reinterpret any of those as `Not Found`/`Not Registered`.

#### Parser/source changes

When an upstream schema changes:

1. add a reproducing failing fixture
2. update the parser minimally
3. increment `parserVersion`
4. regenerate `release-manifest.json`
5. update documentation/drift guards if the public contract changed
6. run full repository verification
7. production-smoke the changed provider before marking it production-verified

For User Scanner module/worker changes, preserve the PARA11AX gateway envelope and validate changed worker fields before exposing them. The worker is untrusted upstream input from the gateway's perspective.

#### Adding a provider or workflow type

A new provider must have a fixed bounded lookup, explicit semantics and a justified workflow placement. Required changes include adapter, static metadata, registry/workflow, tests, parser version and release manifest. Do not add an API merely because a key exists.

A new workflow type additionally requires classifier/canonicalization policy, API/meta exposure, browser transport policy where applicable, Maltego parity decision, documentation-contract updates, and explicit STIX posture.

User Scanner email/username targets are not new Evidence v2 workflow types. They remain a separate active OSINT capability until a future design explicitly changes that boundary.

#### Cache/circuit notes

Cache and circuit state are in-memory and instance-local. Cold starts reset them. Do not use them as durable investigation history or quota accounting. Durable analyst case state currently exists only in the browser-local Train 4 workspace; a server-side IOC lifecycle/store would require a separate explicit design.

User Scanner does not reuse the passive provider cache/circuit model. Its current gateway path has its own bounded request/response/time limits and delegates module execution/rate behavior to the isolated worker.

#### Public release

Treat every tracked repository artifact as public. Run `npm run audit:public` and follow `PUBLIC-RELEASE-CHECKLIST.md` before publishing release artifacts or derived bundles.

#### QA evidence

`QA-REPORT.md` records the current consolidation audit, findings and proof boundaries. A tracked Markdown report cannot safely embed the SHA of the commit that contains itself; exact current repository and deployment SHAs must be read from GitHub/Vercel during verification.
