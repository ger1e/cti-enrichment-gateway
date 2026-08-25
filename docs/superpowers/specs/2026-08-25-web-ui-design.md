### PARA11AX Web UI Design

#### Status

Approved architecture direction. This document defines a user-facing analyst UI for the existing bearer-protected CTI Evidence Gateway without changing the gateway's upstream credential model or fixed-egress security boundary.

#### Goal

Add a public `/app` analyst workspace so a non-owner user can operate PARA11AX through the browser when they possess a valid gateway access token. The UI must make the existing Evidence v2 model understandable without flattening semantics into a synthetic maliciousness score.

The public `/` landing page remains marketing/documentation. `/app` becomes the operational client.

#### Non-goals

- No anonymous enrichment.
- No account system, database, OAuth, billing, teams, or password recovery in this phase.
- No browser storage of gateway tokens.
- No browser exposure of provider credentials.
- No arbitrary provider selection, arbitrary egress, active scanning, detonation, submission, remediation, or sample download.
- No new global risk or maliciousness score.
- No changes to the current `/api/*` request contracts unless a browser-security requirement forces a minimal compatibility change.

#### Authentication model

The user enters a gateway bearer token on `/app`.

The token exists only in JavaScript memory for the active page session. It must not be written to `localStorage`, `sessionStorage`, cookies, IndexedDB, the URL, DOM attributes, analytics, console output, error pages, or telemetry.

Token validation uses `GET /api/health` with `Authorization: Bearer <token>`. On `200`, the workspace unlocks. On `401`, the UI reports an invalid or unauthorized token without echoing it. Refreshing or closing the page clears the token because it is not persisted.

A user can explicitly disconnect. The UI clears all application-held token references and the visible token field, clears the current result state, and returns to the access screen. The design does not claim secure memory zeroization of immutable JavaScript string values.

#### Application structure

The application stays dependency-light and within the current repository/Vercel deployment.

Recommended files:

- `app/index.html` — application shell and accessible markup.
- `app/app.css` — PARA11AX analyst UI styles.
- `app/app.js` — browser controller, API client, state transitions, renderers, and safe exports.
- `test/web-ui.test.mjs` — structural/security tests for the browser surface.
- `vercel.json` — route `/app` and `/app/` to the application shell without changing `/api/*` routing.
- `index.html` — add a clear `OPEN ANALYST UI` link to `/app`.

No frontend framework is required for the first version. The UI can be implemented with standards-based HTML, CSS, and JavaScript because the interaction surface is bounded and the repository currently avoids frontend runtime dependencies.

#### Visual design

Use the existing PARA11AX black-glass system, but the analyst UI is denser and calmer than the landing page.

- `#050608` void background.
- `#0B0F12` panels.
- cyan for structure/navigation.
- red for scanner/active observation and destructive disconnect action.
- green for verified/successful evidence state.
- amber for uncertainty, partial coverage, aging/stale evidence, and warnings.
- compact system monospace typography.
- no oversized marketing wordmark inside the active workspace.
- red Matrix rain is allowed only as a restrained background layer and must not compete with evidence text.
- `prefers-reduced-motion` disables rain/scanner animations.

Mobile is a first-class layout. No horizontal page overflow is permitted. Wide evidence tables should become stacked cards or horizontally contained code/data regions rather than forcing the entire viewport wider.

#### Primary user flow

1. User opens `/app`.
2. Access panel asks for a gateway token.
3. UI validates with `/api/health`.
4. Workspace unlocks.
5. User enters one pivot.
6. UI submits to `POST /api/enrich` using the selected fixed profile: `fast`, `standard`, or `full`.
7. While running, the UI shows a bounded request state, not fabricated provider progress.
8. Response is rendered into semantic sections.
9. User may switch among semantic views or inspect raw JSON.
10. User may export the exact response JSON or request STIX 2.1 through `POST /api/stix`.
11. User may disconnect, which clears application-held token references, the visible token field, and current result state.

#### Workspace composition

The top control band contains:

- compact PARA11AX mark and connection state.
- indicator input.
- automatic indicator type display after response/classification; do not invent a browser-side classification result that conflicts with the gateway.
- fixed profile selector: `fast`, `standard`, `full`.
- `ENRICH` action.
- clear/reset action.
- disconnect action.

The result workspace contains these views:

##### Overview

Shows only facts contained in the envelope:

- canonical indicator and type.
- request ID.
- profile.
- status: `ok`, `partial`, or `error`.
- duration.
- budget usage.
- provider summary: ok / failed / skipped / cached.
- freshness.
- huntability and its existing rationale when present.

`partial` must be visually prominent and amber. It must never be styled as a weaker version of `ok` or interpreted as benign.

##### Evidence

Render each `evidence[]` item as a provider card rather than as one merged reputation table.

Each card may show:

- provider.
- observation kind.
- provider/parser verdict exactly as modeled.
- confidence when present.
- first/last seen when present.
- selected bounded attributes.
- tags/malware family/actor only when present in the gateway evidence.
- cache state and retrieval time.
- provenance references.
- integrity fingerprint in a secondary details region.

Observation kinds remain visually distinct. Registration/routing/context cannot be styled as malicious reputation. Community and ransomware claim kinds must explicitly retain claim/report wording.

##### Correlation

Render separate blocks for:

- corroboration.
- contradictions.
- freshness.
- huntability.
- CVE `riskAxes` where applicable.
- attribution confidence only when the gateway emits it.

The UI must not calculate its own cross-provider maliciousness score.

##### Relationships

Render deduplicated pivots with relation, target type/value, and provenance where available. Relationship values may be copyable but are not automatically enriched in this phase.

##### Coverage / Failures

Show provider failures, skipped coverage, timeouts, rate limits, parser failures, and other explicit coverage states separately from threat evidence.

The visual rule is mandatory: failure or missing coverage is never rendered as negative evidence.

##### Raw

Pretty-print the exact returned JSON in a bounded scrollable region with a copy action. No syntax highlighter dependency is required.

#### Export behavior

`DOWNLOAD JSON` serializes the exact enrichment response currently held in memory and creates a client-side Blob download. It must not add or remove evidence fields.

`DOWNLOAD STIX 2.1` calls `POST /api/stix` with the same canonical indicator/profile request contract, then downloads the returned bundle. The UI does not fabricate STIX locally.

No token, Authorization header, or credential-bearing state may appear in filenames or exported content.

#### Browser API client

A small API client module owns all authenticated fetches.

Requirements:

- same-origin relative `/api/*` paths only.
- `Authorization: Bearer <token>` only when a token is required.
- `Content-Type: application/json` for POST bodies.
- no retries beyond what the gateway itself defines; the browser should not multiply provider work.
- parse structured gateway errors when possible.
- treat non-JSON transport/platform failures separately from gateway evidence responses.
- never log token-bearing request objects.
- use `AbortController` for user-initiated cancellation/reset if implemented; cancellation must not be represented as a successful enrichment.

#### State model

The browser UI has four coarse states:

- `locked` — no validated token.
- `ready` — token validated; no active request.
- `running` — one enrichment request in progress.
- `result` — response rendered, including `ok`, `partial`, or `error` envelope state.

Only one active enrichment request is allowed from the first UI version. This prevents accidental duplicate quota consumption and simplifies mobile behavior.

Batch UI is intentionally deferred. The API remains available for programmatic batch clients.

#### Error handling

- `401`: lock the workspace and ask for a valid token. Never echo the supplied token.
- `400/413/415`: display the structured gateway error and keep the input editable.
- `405`: report method mismatch as an application/configuration fault.
- provider-level failures inside a successful enrichment envelope remain under Coverage / Failures rather than becoming top-level browser errors.
- network/platform failure: show a neutral request failure message with retry action; do not imply provider health or threat state.
- malformed/unexpected JSON: fail closed in the renderer, provide a raw diagnostic message without exposing secrets, and do not invent analytical output.

#### Security requirements

- token in memory only.
- no storage APIs for auth state.
- no token in URL/query/hash.
- no third-party JavaScript or CSS.
- no analytics or trackers.
- no remote fonts.
- no `eval`, dynamic code generation, or user-controlled HTML injection.
- all untrusted returned strings rendered with text nodes / `textContent`, not `innerHTML`.
- exports built from parsed response objects, never DOM scraping.
- API requests same-origin only.
- existing gateway bearer authentication and fixed-egress boundaries stay unchanged.
- existing unknown `/api/*` structured JSON behavior must remain intact.

#### Accessibility

- keyboard-complete controls.
- visible focus states.
- explicit labels for token, pivot, profile, and actions.
- semantic status text in addition to color.
- live region for request state/result completion.
- sufficient contrast in black-glass theme.
- reduced-motion support.
- responsive layout at narrow Android widths without horizontal document overflow.

#### Testing strategy

Add deterministic tests before implementation changes.

Structural tests:

- `/app` assets exist.
- viewport meta exists.
- reduced-motion CSS exists.
- no third-party JS/CSS.
- no `localStorage`, `sessionStorage`, cookies, IndexedDB, analytics, or remote fonts.
- no use of `innerHTML` for evidence rendering.
- same-origin `/api/health`, `/api/enrich`, `/api/stix` usage is present.
- only fixed profile values appear in the UI.
- landing page links to `/app`.
- Vercel routing preserves `/api/*` before human-facing fallbacks.

Behavioral browser-logic tests should cover:

- invalid token returns to locked state.
- validated token unlocks workspace.
- token is not included in persisted/exported state.
- `partial` renders as incomplete coverage.
- evidence kinds retain semantic labels.
- provider failures render outside evidence verdicts.
- JSON export matches the response object.
- STIX export uses the `/api/stix` response rather than local generation.
- reset/disconnect clears application-held token references, visible token input, and result state.

Existing Node, Maltego, repository-invariant, Tooling smoke, and CodeQL gates must remain green.

#### Deployment and acceptance

Implementation will use a feature branch and PR. Vercel preview remains disabled for non-main Git branches by existing policy, so production acceptance occurs only after protected-main merge and exact-SHA deployment.

Acceptance requires:

1. Tooling smoke passes.
2. CodeQL passes.
3. `/` remains healthy and links to `/app`.
4. `/app` returns the new UI on the exact deployed main SHA.
5. `/api/meta` remains public JSON.
6. `/api/health` remains bearer-protected.
7. unknown `/api/*` remains structured JSON 404.
8. human-facing `403`, `404`, and `500` routes remain branded HTML with correct status codes.
9. a real authorized enrichment can be completed through `/app` without the token appearing in storage, URL, exported JSON, or visible diagnostics.

#### Deferred evolution

If external use grows, the next architectural step is per-user issued gateway tokens with independent revocation, quotas, and audit metadata. The `/app` UX should be designed so that this future change replaces the token-issuance/auth layer without requiring a result-rendering redesign.
