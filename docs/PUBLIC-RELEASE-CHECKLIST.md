# Public release checklist

This repository is public. Treat every commit, pull request, workflow artifact, issue, and release as a publication event.

## Hard gates

Do not merge or publish a release unless all of the following are true:

- No client, employer, internal-enterprise, restricted, or otherwise non-public data is present.
- No provider credential, gateway bearer, private key, certificate, session token, `.env` file, capture, malware sample, dump, or analysis artifact is tracked or present in reachable history.
- Provider licensing and redistribution terms have been reviewed for any bundled schemas, fixtures, screenshots, examples, or response-derived material.
- No internal hostnames, usernames, tenant IDs, account IDs, case/ticket IDs, private URLs, project/team identifiers, or non-public infrastructure details remain.
- Example indicators are documentation-safe public examples or synthetics; they are not copied from restricted investigations.
- Relevant Git history has been inspected, not only the current working tree.
- CI, deployment, environment-variable references, logs, artifacts, and documentation have been reviewed for unnecessary operational disclosure.

If a secret was ever committed, revoke or rotate it before history cleanup. Rewriting history does not make a still-valid secret safe.

## Automated guardrail

Run:

```bash
npm run audit:public
```

For additional organization or client terms that must never appear in a release candidate:

```bash
PUBLIC_RELEASE_FORBIDDEN_TERMS='example-client,internal-domain.example,case-prefix' npm run audit:public
```

The audit blocks common sensitive artifact types and high-confidence credential patterns. A passing result is a guardrail, not proof that publication is safe.

## History review

For changes touching credentials, deployment, fixtures, examples, imported data, or previously private material, review at minimum:

- historical `.env*`, config, fixture, and deployment files
- removed screenshots, captures, samples, archives, and generated artifacts
- commit messages and PR/issue text for restricted names or identifiers
- old CI logs and artifacts if they could contain sensitive output
- provider terms where response-derived data or schemas may be redistributed

## Public-source hygiene

Keep the public repository limited to material that is necessary to demonstrate and operate the engineering pattern:

- architecture and threat model
- safe schemas and synthetic examples
- bounded provider adapters or mocks where licensing permits
- tests and deterministic fixtures
- CI and security controls
- documentation

Do not commit production credentials, private deployment identifiers, personal research data, commercial-client material, provider response corpora, malware samples, or investigation artifacts.

When work originates from a private environment or restricted source, prefer a reviewed sanitized export instead of importing private Git history.

## Final review

Before merge or release, answer these independently:

1. What would a stranger learn about private people, organizations, environments, or investigations?
2. Could anything here be used to access a service or reconstruct a credential?
3. Could any bundled material violate a provider or source license if redistributed?
4. Is any operational detail unnecessary to prove or operate the project?

If any answer is uncertain, stop publication of that change until it is resolved.
