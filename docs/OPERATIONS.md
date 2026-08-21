# Operations

## Acceptance states

Keep these states separate:

1. **Repository-complete:** exact `main` passes repository, Node, Maltego, Python, PowerShell, ShellCheck and public-release gates.
2. **Configured:** required Vercel/runtime secrets exist. `/api/status` reports booleans only.
3. **Production-complete:** the deployed Vercel source SHA equals exact verified `main` and production smoke tests pass against that deployment.

Do not call production complete from repository CI alone.

## Local/full repository verification

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

The GitHub `Tooling smoke` workflow additionally validates PowerShell syntax and publishes the required status check.

`node scripts/generate-release-manifest.mjs --check` must pass. The committed manifest intentionally has `sourceCommit: null`; a deployment/release process may supply an exact SHA with `--source-commit` or `SOURCE_COMMIT` when producing an external release record.

## Authorized finalizer

The repository ships an authenticated local finalizer. On the authorized workstation:

```powershell
git checkout main
git pull --ff-only
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\finalize.ps1
```

The finalizer is responsible for enforcing its branch-protection contract where the caller has permission, verifying required status checks, and invoking the pinned Vercel bootstrap/deployment workflow. If account permissions prevent branch-protection mutation, that is an explicit external prerequisite, not a successful configuration.

## Production smoke acceptance

Acceptance is against one exact source SHA. Verify deployment metadata first; reject a stale deployment.

Required smoke set:

- protected `GET /api/health`
- public `GET /api/meta`
- bearer `GET /api/status` and `Cache-Control: no-store`
- one bounded public-source enrichment
- one configured credentialed-source enrichment
- no credential or bearer reflection in response bodies/error surfaces
- gateway/schema version matches repository release identity

A provider may be repository-implemented but unconfigured; that is not a production failure if it is explicitly recorded as unconfigured. At least one configured credentialed provider should be exercised for full production acceptance.

## Secret handling

- Keep `.env*` except `.env.example` untracked.
- Store production secrets in Vercel/project secret storage, not Git.
- Rotate `CTI_GATEWAY_TOKEN` if exposed; clients must update their bearer after rotation.
- Rotate an affected provider credential independently. Other provider secrets should not need rotation merely because one provider token changed.
- Sentry auth remains observability-only; do not send CTI evidence or raw queried indicators to Sentry.

## Provider incident behavior

When a provider degrades:

- failures remain explicit and are not cached
- retry is bounded to one retry for retryable conditions
- the instance-local circuit may open after repeated retryable failures
- successful providers continue and response status becomes partial where applicable
- do not convert provider outage into a `not_listed`/clean verdict

Use authenticated `/api/status` for count-only circuit/cache/configuration state. Do not add raw IOC history to the status surface.

## Parser/source changes

When an upstream schema changes:

1. add a reproducing failing fixture
2. update the parser minimally
3. increment `parserVersion`
4. regenerate `release-manifest.json`
5. run full repository verification
6. production smoke the changed provider before marking it production-verified

## Adding a provider

A new provider must have a fixed bounded lookup, explicit semantics and a justified workflow placement. Required changes include adapter, static metadata, registry/workflow, tests, parser version and release manifest. Do not add an API merely because a key exists.

## Cache/circuit notes

Cache and circuit state are in-memory and instance-local. Cold starts reset them. Do not use them as durable investigation history or quota accounting. Durable IOC lifecycle/storage belongs in a separate explicitly designed component.

## Public release

This private repository may contain operational architecture unsuitable for direct publication even when secrets are absent. Run `npm run audit:public` and follow `PUBLIC-RELEASE-CHECKLIST.md` before extracting any public version.
