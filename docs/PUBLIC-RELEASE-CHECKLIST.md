### Public release checklist

This repository is public. Treat every commit, pull request, workflow artifact, issue, and release as a publication event.

#### Hard gates

Do not merge or publish a release unless all of the following are true:

- No client, employer, internal-enterprise, restricted, or otherwise non-public data is present.
- No provider credential, gateway bearer, `SHODAN_API_KEY`, User Scanner token, private key, certificate, session token, `.env` file, capture, malware sample, dump, or analysis artifact is tracked or present in reachable history.
- No real Shodan account metadata, remaining-credit screenshots, account IDs, query history, or credential-bearing request URLs are committed.
- Provider licensing and redistribution terms have been reviewed for any bundled schemas, fixtures, screenshots, examples, or response-derived material.
- No internal hostnames, usernames, tenant IDs, account IDs, case/ticket IDs, private URLs, project/team identifiers, or non-public infrastructure details remain.
- Example indicators and Shodan queries are documentation-safe public examples or synthetics; they are not copied from restricted investigations.
- Relevant Git history has been inspected, not only the current working tree.
- CI, deployment, environment-variable references, logs, artifacts, and documentation have been reviewed for unnecessary operational disclosure.
- Shodan shell documentation exposes only the intended public contract: fixed `https://api.shodan.io` egress, server-side `SHODAN_API_KEY`, bounded commands/results, explicit credit semantics, and no real secret/account values.

If a secret was ever committed, revoke or rotate it before history cleanup. Rewriting history does not make a still-valid secret safe.

#### Automated guardrail

Run:

```bash
npm run audit:public
```

For additional organization or client terms that must never appear in a release candidate:

```bash
PUBLIC_RELEASE_FORBIDDEN_TERMS='example-client,internal-domain.example,case-prefix' npm run audit:public
```

The audit blocks common sensitive artifact types and high-confidence credential patterns. A passing result is a guardrail, not proof that publication is safe.

#### Shodan-specific review

For changes touching the native Shodan analyst-shell surface, confirm:

- examples use documentation-safe IPs/domains/queries;
- no API key or key-bearing URL appears in docs, tests, screenshots, logs, CI output, or issue/PR text;
- `shodan download`, arbitrary paging, caller-selected URLs, and on-demand scan submission remain absent/disabled unless a future explicit design changes that boundary;
- search remains first-page only and response/banners remain bounded as documented;
- query-credit impact is documented accurately without embedding live account balances;
- Shodan operator output remains separate from Evidence v2 unless an explicit typed design says otherwise.

#### History review

For changes touching credentials, deployment, fixtures, examples, imported data, or previously private material, review at minimum:

- historical `.env*`, config, fixture, and deployment files;
- removed screenshots, captures, samples, archives, and generated artifacts;
- commit messages and PR/issue text for restricted names or identifiers;
- old CI logs and artifacts if they could contain sensitive output;
- provider terms where response-derived data or schemas may be redistributed;
- Shodan query/account output when shell integration or screenshots were developed.

#### Public-source hygiene

Keep the public repository limited to material necessary to demonstrate and operate the engineering pattern:

- architecture and threat model;
- safe schemas and synthetic examples;
- bounded provider adapters or mocks where licensing permits;
- bounded Shodan shell contract/tests without credentials or live account details;
- tests and deterministic fixtures;
- CI and security controls;
- documentation.

Do not commit production credentials, private deployment identifiers, personal research data, commercial-client material, provider response corpora, Shodan account/query-history exports, malware samples, or investigation artifacts.

When work originates from a private environment or restricted source, prefer a reviewed sanitized export instead of importing private Git history.

#### Final review

Before merge or release, answer these independently:

1. What would a stranger learn about private people, organizations, environments, investigations, Shodan account state, or operator queries?
2. Could anything here be used to access a service or reconstruct a credential?
3. Could any bundled material violate a provider or source license if redistributed?
4. Is any operational detail unnecessary to prove or operate the project?

If any answer is uncertain, stop publication of that change until it is resolved.
