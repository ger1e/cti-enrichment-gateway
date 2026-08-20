# Public release checklist

This repository is private and intended for personal research/lab use. A public release must be treated as a separate publication event, not as a visibility toggle.

## Hard gates

Do not publish until all of the following are true:

- No client, employer, internal-enterprise, restricted, or otherwise non-public data is present.
- No provider credential, gateway bearer, private key, certificate, session token, `.env` file, capture, malware sample, dump, or analysis artifact is tracked or present in reachable history.
- Provider licensing and redistribution terms have been reviewed for any bundled schemas, fixtures, screenshots, examples, or response-derived material.
- No internal hostnames, usernames, tenant IDs, account IDs, case/ticket IDs, private URLs, project/team identifiers, or non-public infrastructure details remain.
- Example indicators are documentation-safe public examples or synthetics; they are not copied from restricted investigations.
- Git history has been inspected, not only the current working tree.
- CI, deployment, environment-variable references and documentation are reviewed for disclosure of operational details that are unnecessary for a public artifact.

## Automated guardrail

Run:

```bash
npm run audit:public
```

For additional organization/client terms that must never appear in a release candidate:

```bash
PUBLIC_RELEASE_FORBIDDEN_TERMS='example-client,internal-domain.example,case-prefix' npm run audit:public
```

The audit blocks common sensitive artifact types and high-confidence credential patterns. A passing result is not evidence that publication is safe; it only removes a small class of obvious mistakes.

## History review

Before public release, inspect repository history for sensitive paths and strings. If any secret was ever committed, revoke/rotate it before history cleanup. History rewriting does not make a still-valid secret safe.

At minimum review:

- all historical `.env*`, config, fixture and deployment files
- removed screenshots, captures, samples and archives
- commit messages and PR/issue text for restricted names or identifiers
- old CI logs and artifacts if they contained sensitive output

## Public extraction preference

Prefer creating a new, sanitized public repository from a reviewed export rather than making this private repository public in place. Preserve attribution and license obligations, but do not copy private Git history unless that history has been explicitly reviewed.

The public artifact should contain only what demonstrates the engineering pattern:

- architecture and threat model
- safe schemas and synthetic examples
- bounded provider adapters or mocks where licensing permits
- tests
- CI and security controls
- documentation

It should not contain production credentials, private deployment identifiers, personal research data, commercial-client material, or provider response corpora.

## Final human review

A second review should answer four questions independently:

1. What information would a stranger learn about private people, organizations, environments or investigations?
2. What could be used to access a service or reconstruct a credential?
3. What content might violate a provider or source license if redistributed?
4. What operational detail is unnecessary to prove the project works?

If any answer is uncertain, keep the repository private until resolved.
