## Summary

Describe the change and why it is needed.

## Scope

- [ ] Change is narrow and reviewable
- [ ] Read-only CTI enrichment boundary is preserved
- [ ] No secrets, samples, captures, private keys, certificates, populated `.env` files, or generated local artifacts are included

## Validation

- [ ] `npm run verify:tooling`
- [ ] `npm run verify:repo`
- [ ] `npm run lint:shell`
- [ ] `npm run check`
- [ ] `npm test`
- [ ] Maltego unit tests pass when relevant
- [ ] Python compilation check passes when relevant

## Security / privacy / licensing

- [ ] No new secret exposure path
- [ ] No caller-controlled outbound host or arbitrary proxy behavior
- [ ] Provider-native semantics and provenance remain intact
- [ ] Provider licensing/data-handling constraints were reviewed when relevant
- [ ] Error/logging changes do not reflect credentials or sensitive upstream data
- [ ] New dependencies/actions are pinned or otherwise justified

Security-sensitive surfaces touched:

- [ ] Authentication / authorization
- [ ] Provider adapters / outbound requests
- [ ] Validation / canonicalization
- [ ] Caching / persistence
- [ ] Deployment / CI / supply chain
- [ ] Maltego client / token handling
- [ ] None

## Evidence

List tests, fixtures, provider documentation, or other evidence used to validate the change.

## Residual risk / limitations

Document degraded modes, provider limitations, false-positive/false-negative considerations, or unresolved risk. Use `None` only when genuinely applicable.
