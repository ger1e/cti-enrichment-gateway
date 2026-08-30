### Operations

#### Acceptance and proof states

Keep these states separate:

1. **Repository-proven** — exact source SHA passes repository invariants, dependency/public-release checks, Node tests, Maltego tests, Python compilation, shell/ShellCheck, and PowerShell parsing.
2. **CI-proven** — GitHub Actions reports the required checks for that exact SHA. `Tooling smoke` is the branch-required gate; CodeQL is also required by the PARA11AX QA/release process.
3. **Configured** — required runtime secrets/environment values exist. Source code cannot prove this.
4. **Deployment-proven** — Vercel metadata reports the expected exact Git SHA and `READY` state.
5. **Live-public-proven** — public unauthenticated routes return expected status/content on that deployment.
6. **Credential/provider-proven** — authenticated health/status/provider probes were actually executed against the exact deployment.
7. **User-Scanner-wired** — the isolated worker is deployed/configured and an authorized scan succeeds through the PARA11AX shell/API path.
8. **Shodan-shell-wired** — `SHODAN_API_KEY` is configured in the PARA11AX runtime and an authorized bounded Shodan command succeeds through `/api/para11ax/shodan` on the exact deployment.

Do not collapse these into one “production verified” claim. A READY deployment is not proof of provider credentials, User Scanner wiring, Shodan credits, or Shodan shell readiness.

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

`npm run check` includes repository invariants, public-release audit, and the full Node suite. Documentation-contract checks cover canonical workflow/provider/version facts plus the separate User Scanner and Shodan analyst-shell public contracts.

#### Documentation contract maintenance

Externally meaningful canonical facts must not drift silently from documentation. Current executable checks cover:

- all nine Evidence v2 workflow types;
- canonical provider count;
- Evidence Schema v2 / Evidence Graph v1.0 / Guidance v1.0;
- API route inventory;
- User Scanner aliases/boundary/environment names;
- native Shodan shell commands, endpoint, fixed upstream, key name, credit behavior, first-page search, Evidence v2 isolation, and disabled `download`;
- Maltego workflow/certificate semantics;
- canonical production identity;
- changelog coverage for externally meaningful capabilities.

When a canonical source changes, update the relevant documentation and drift test in the same PR. Do not weaken the test merely to preserve stale prose.

#### Hosted CI and deployment boundary

This public repository runs one bounded Ubuntu `Tooling smoke` job for pull requests targeting `main`, pushes to `main`, and explicit manual dispatch. There are no scheduled runs and no recurring hosted macOS/Windows runners. CodeQL runs separately for JavaScript/TypeScript analysis.

Vercel Git deployment is narrower than CI: feature/PR branches do not automatically become production. A protected verified merge to `main` may produce the production build, accepted only when deployment metadata reports that exact `main` SHA.

The User Scanner worker remains a separate Python Vercel project. Shodan shell execution remains inside the main PARA11AX runtime because it is a single bounded API lookup path rather than a high-fan-out worker.

#### User Scanner hosted wiring

Reference topology:

```text
Browser analyst shell
  -> https://para11ax.vercel.app/api/para11ax/user-scanner
  -> PARA11AX_USER_SCANNER_URL
  -> isolated User Scanner worker
```

Main project configuration:

```text
PARA11AX_USER_SCANNER_URL=https://user-scanner-kappa.vercel.app
PARA11AX_USER_SCANNER_TOKEN=<optional matching worker bearer>
```

Do not put worker credentials in tracked files, client JavaScript, screenshots, or examples containing real values.

#### Shodan analyst-shell operations

Reference topology:

```text
Browser analyst shell
  -> bearer-authenticated POST /api/para11ax/shodan
  -> bounded Shodan command handler
  -> SHODAN_API_KEY (server-side only)
  -> https://api.shodan.io
```

Production configuration:

```text
SHODAN_API_KEY=<server-side Shodan API key>
```

Approved shell commands:

```text
shodan host <ip>
shodan search <query>
shodan count <query>
shodan stats <query> [--facets <fields>]
shodan domain <domain>
shodan info
```

Examples:

```text
shodan host 8.8.8.8
shodan search product:"FortiGate" country:HU
shodan count port:443 country:HU
shodan stats product:nginx --facets country:20,org:10
shodan domain example.com
shodan info
```

Operational guarantees:

- same-origin browser call only;
- fixed upstream origin `https://api.shodan.io`;
- no browser exposure of `SHODAN_API_KEY`;
- no caller-selected URLs, hosts, methods, pages, credentials, proxy routes, or arbitrary Shodan operations;
- search is first-page only;
- returned match/service arrays are bounded;
- large raw banners/service bodies are removed;
- `shodan download` is disabled;
- Shodan output stays terminal/operator context and leaves the current Evidence v2 result unchanged.

Credit classification exposed by the route:

- `host` — no query credit;
- `count` — no query credit;
- `stats` — no query credit;
- `info` — no query credit;
- `domain` — consumes a query credit;
- `search` — may consume a query credit depending on Shodan plan/query behavior.

Use `shodan info` to inspect account/API metadata before broad operator use. Treat quota/account state as time-sensitive operational state, not a repository fact.

#### Production smoke acceptance

Acceptance is against one exact source SHA. Verify deployment metadata first; reject a stale deployment.

Public QA can verify without a bearer:

- `GET /`;
- `GET /app/`;
- public `GET /api/para11ax/meta`;
- representative static/error routes;
- deployment metadata/source SHA;
- User Scanner worker deployment identity without claiming scanner readiness.

Credential-bearing acceptance, only when explicitly authorized, adds:

- protected `GET /api/para11ax/health`;
- protected `GET /api/para11ax/status` and `Cache-Control: no-store`;
- one bounded public-source enrichment;
- one configured credentialed-source enrichment;
- one bounded User Scanner operation when expected to be wired;
- `shodan info` to prove authenticated Shodan-route/key/account access;
- `shodan host <approved-test-ip>` to prove the fixed host path without query-credit use;
- optional `shodan count <approved-query>` to prove query parsing without consuming a query credit;
- no bearer/API-key reflection in response bodies or errors;
- gateway/schema version matching repository identity.

Do not use `shodan search` or `shodan domain` as a routine smoke check when a no-query-credit operation can prove wiring. If search/domain are explicitly tested, record their credit impact and scope.

For Shodan acceptance verify that the browser/client path hits same-origin `/api/para11ax/shodan`, the normalized envelope reports `source: "shodan"`, the upstream origin is fixed, the key is absent from output, and the current Evidence v2 result is unchanged.

If an authorized bearer is not used, report authenticated health/status/provider/User Scanner/Shodan readiness as **not proven by this QA pass** rather than failed or implicitly healthy.

#### Provider readiness

Use the sequential secret-safe provider probe in an authorized environment:

```bash
para11ax providers probe --all
```

The Evidence v2 Shodan provider and native Shodan analyst-shell route are separate acceptance surfaces. A successful provider probe does not automatically prove the shell endpoint, and a successful shell command does not prove every Evidence v2 workflow/profile path.

#### Maltego acceptance

Repository tests enforce intended parity between the nine server Evidence v2 workflow types and Maltego transforms. Certificate semantics remain explicit: `EnrichCertificate` adds `cert-sha256:` while `EnrichHash` retains file-hash semantics.

User Scanner and Shodan analyst-shell commands are not silently added to Maltego Evidence v2 transform parity. Their operator semantics are separate.

#### Browser-local workspace acceptance

Cases, snapshots, diffs, exact typed sightings, and case graphs remain browser-local IndexedDB state. Active-case state/authentication remain runtime-only.

User Scanner and Shodan operator output are terminal-visible but are not automatically persisted/pinned as typed case evidence. Any future persistence requires an explicit schema/design.

#### Secret handling

- Keep `.env*` except `.env.example` untracked.
- Store production secrets in Vercel/project secret storage, not Git.
- Rotate `PARA11AX_TOKEN` if exposed.
- Rotate `PARA11AX_USER_SCANNER_TOKEN` independently if enabled/exposed.
- Rotate `SHODAN_API_KEY` independently if exposed; do not commit it to shell history, docs, screenshots, or client code.
- Rotate an affected provider credential independently rather than unrelated credentials.
- Do not send raw queried indicators, email targets, username targets, or Shodan secrets to observability telemetry.

#### Failure behavior

Evidence v2 provider failures remain explicit, are not cached as negative evidence, and can yield partial results while successful providers continue.

User Scanner gateway misconfiguration/worker failure/timeout use controlled errors and never become `Not Found`.

Shodan missing configuration fails closed; upstream Shodan rate limiting remains an explicit rate-limit error; malformed/unsupported Shodan requests fail validation before outbound execution. None of these states becomes benign/empty Evidence v2.

#### Parser/source/operator changes

When an Evidence v2 upstream schema changes: add a reproducing failing fixture, update minimally, increment parser version, regenerate manifest, update docs/drift guards, run full verification, and production-smoke the changed provider.

When the Shodan operator contract changes: update `test/shodan-terminal.test.mjs`, `docs/SHODAN-SHELL.md`, README, landing, API, architecture, operations, security/threat-model documentation, and changelog in the same PR. New commands require explicit destination, credit, boundedness, output, and Evidence-v2-isolation review.

#### Public release

Treat every tracked repository artifact as public. Run `npm run audit:public` and follow `PUBLIC-RELEASE-CHECKLIST.md` before release publication.

`QA-REPORT.md` records proof boundaries. A tracked Markdown report cannot safely embed the SHA of the commit containing itself; exact current repository/deployment SHAs must be read during verification.