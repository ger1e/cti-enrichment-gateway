### PARA11AX Web UI Design

#### Status

Approved architecture and approved maximum visual/audio direction. This document defines a user-facing analyst UI for the existing bearer-protected PARA11AX CTI enrichment platform without changing the gateway's upstream credential model, fixed-egress security boundary, or Evidence v2 semantics.

#### Goal

Add a public `/app` analyst workspace so a trusted non-owner user can operate PARA11AX through the browser when they possess a valid gateway access token. The UI must feel like a purpose-built cyberpunk intelligence terminal while making Evidence v2 easier to understand without flattening unlike evidence into a synthetic maliciousness score.

The public `/` landing page remains cinematic marketing/documentation. `/app` becomes the operational analyst client.

#### Trust model

Phase 1 is for trusted external users, not anonymous public self-service. Anyone who receives the current shared gateway bearer has the same API privilege until that bearer is rotated. The UI must not imply per-user isolation, quotas, or revocation that do not exist yet.

#### Non-goals

- No anonymous enrichment.
- No account system, database, OAuth, billing, teams, or password recovery in this phase.
- No browser storage of gateway tokens.
- No browser exposure of provider credentials.
- No arbitrary provider selection, arbitrary egress, active scanning, detonation, submission, remediation, or sample download.
- No new global risk or maliciousness score.
- No fabricated provider progress, attribution, or graph relationships.
- No changes to the current `/api/para11ax/*` request contracts unless a browser-security requirement forces a minimal compatibility change.

#### Authentication model

The user enters a gateway bearer token on `/app` through an integrated `PARA11AX // ANALYST ACCESS` terminal.

The token exists only in JavaScript memory for the active page session. It must not be written to `localStorage`, `sessionStorage`, cookies, IndexedDB, the URL, DOM attributes, analytics, console output, error pages, or telemetry.

Token validation uses `GET /api/para11ax/health` with `Authorization: Bearer <token>`. On `200`, the workspace unlocks and the access terminal collapses into the connection-state indicator. On `401`, the UI reports an invalid or unauthorized token without echoing it. Refreshing or closing the page clears the token because it is not persisted.

A user can explicitly disconnect. The UI clears all application-held token references and the visible token field, clears the current result state, aborts any active browser request, and returns to the access screen. The design does not claim secure memory zeroization of immutable JavaScript string values.

The access terminal must visibly state: `TOKEN HELD IN MEMORY ONLY · NOT SAVED · NOT LOGGED · CLEARED ON REFRESH`.

#### Application structure

The application stays dependency-light and within the current repository/Vercel deployment.

Recommended files:

- `app/index.html` — application shell and accessible markup.
- `app/app.css` — maximum PARA11AX terminal/HUD styling and responsive layout.
- `app/api-client.js` — same-origin authenticated gateway client.
- `app/renderers.js` — safe Evidence v2 semantic renderers using DOM APIs/textContent only.
- `app/audio.js` — synthesized Web Audio cue engine.
- `app/app.js` — state machine/controller, event wiring, exports, and orchestration.
- `test/web-ui.test.mjs` — structural/security/browser-logic tests.
- `vercel.json` — route `/app` and `/app/` to the application shell without changing `/api/para11ax/*` routing.
- `index.html` — add a clear `ENTER PARA11AX` action to `/app`.

No frontend framework or third-party runtime dependency is required for v1. Standards-based HTML, CSS, JavaScript, Web Audio, Blob, Clipboard, AbortController, and DOM APIs are sufficient.

#### Maximum visual direction

The active UI must look like a high-density intelligence command deck, not a SaaS dashboard.

Base system:

- void `#050608`.
- panel `#0B0F12`.
- scanner red `#FF1E2D`.
- hot red `#FF4050`.
- para11ax cyan `#00E5FF`.
- evidence green `#39FF88`.
- caution amber `#F6C945`.
- signal white `#F3F7FA`.
- muted `#7D8B95`.
- system monospace only; no remote fonts.

Color semantics are fixed:

- cyan = structure, context, navigation, neutral relationship geometry.
- green = successful/verified/corroborated evidence state where the gateway model supports it.
- amber = uncertainty, partial coverage, stale/aging state, warnings.
- red = scanner/active observation, provider failure, contradiction, destructive disconnect; red is never a generic maliciousness score.

A compact permanent legend must reinforce these semantics.

##### Scene and motion layers

Use three restrained red code-rain depth layers behind the workspace:

- far layer: slow, faint, sparse.
- middle layer: denser and faster.
- transient foreground layer: appears only during enrichment/transition moments and never overpowers text.

Cyan angular para11ax/sight geometry sits above rain but below evidence panels and converges toward the active pivot. The red scanner is the primary motion signature.

Add very low-opacity CSS CRT scanlines, vignette, and transient chromatic edge offsets during state changes. No permanent blur, text distortion, or readability loss.

`prefers-reduced-motion: reduce` disables rain movement, scanner animation, glitch/scan-in transitions, connector motion, and transition chromatic effects while preserving static semantic styling.

##### Desktop composition

Desktop uses three zones:

`CONTROL RAIL | ACTIVE ANALYSIS | EVIDENCE INSPECTOR`

The narrow control rail contains the compact PARA11AX mark, connection state, profile selector/navigation, semantic legend, mute/volume controls, clear/reset, and disconnect.

The center begins with the pivot console:

`[ DOMAIN / IP / HASH / CVE / URL / ATT&CK / ASN / CIDR ]`

`> enter observable________________________________ [ ENRICH ]`

While typing, show a faint cyan trace. Browser-side type detection may be used only as an input hint; the authoritative type shown after enrichment is the gateway-returned canonical type.

On submit, cyan geometry contracts toward the active pivot, one stronger scanner sweep runs, and the observation node pulses red. While the request is running, the pivot node may pulse slowly, but the UI must not fabricate provider-level completion progress.

When results arrive, reorganize the workspace into a compact intelligence strip plus semantic views rather than appending a long document.

##### Intelligence strip

The top result strip may show only gateway-returned facts, for example:

`STATUS PARTIAL · DOMAIN example.org · PROFILE STANDARD · 7.4s · 19 OK / 3 FAILED / 4 CACHED · FRESHNESS CURRENT · HUNTABILITY HIGH`

These are compact HUD readouts, not giant cards.

##### Views

Primary views:

`OVERVIEW · EVIDENCE · CORRELATION · RELATIONSHIPS · COVERAGE · RAW`

On mobile the tab bar is sticky and horizontally scrollable without causing document-width overflow.

##### Evidence signals

Each `evidence[]` item renders as an independent provider signal panel, never as one merged reputation table.

A signal may display:

- provider.
- observation kind.
- provider/parser verdict exactly as modeled.
- confidence when present.
- first/last seen when present.
- selected bounded attributes.
- tags, malware family, actor only when present.
- cache state and retrieval time.
- provenance references.
- parser version and integrity fingerprint inside secondary technical details.

Signal panels use semantic edge treatment rather than generic severity coloring. Registration/routing/context stays cyan/neutral. Community and ransomware claim kinds explicitly retain claim/report wording. Provider failures do not appear inside evidence verdict styling.

Signals scan into view with a short vertical reveal after a result arrives. No animation may obscure or delay access to text.

##### Correlation and contradiction treatment

Correlation renders only relationships and analytical dimensions actually emitted by the gateway.

The active pivot can be represented as a red observation node with structured lanes around it. Cyan connectors represent contextual/neutral relationships. Green can represent explicit supported corroboration. Amber represents uncertainty. Red connector collision is reserved for contradictions.

No force-directed graph, random node placement, or inferred significance is permitted.

Contradictions receive a dedicated split treatment, for example:

`SOURCE A ──────────╳────────── SOURCE B`

with opposing evidence summaries and a single short collision animation.

##### CVE risk axes

KEV, EPSS, and CVSS must remain separate horizontal tactical readouts, never combined:

`KEV   EXPLOITED`

`EPSS  0.94`

`CVSS  9.8`

Bars may visualize values only when values are present and the label remains explicit.

##### Huntability

Huntability is an operational panel, not a risk dial. Show only gateway-provided level/rationale and emitted operational details. Do not manufacture counts or endpoint/network/identity relevance not present in the response.

##### Coverage / failures

Coverage gets its own matrix/list so collection failure can never be confused with negative threat evidence. Display explicit states such as timeout, rate limit, parser failure, skipped, circuit-open, or other gateway-returned failures.

##### Raw JSON

Raw mode is a bounded terminal pane with line-number gutter generated from the serialized JSON text, internal scrolling, copy, search/filter within the text, and download. No heavyweight syntax-highlighting dependency.

##### Persistent action bar

Result actions:

`COPY IOC · COPY JSON · DOWNLOAD JSON · PACKAGE STIX 2.1 · RESET`

`PACKAGE STIX 2.1` calls `/api/para11ax/stix`; a short scanner cue may animate across the action during the request and it turns successful only after a valid bundle response.

#### Mobile-native composition

At narrow Android widths, the UI does not merely scale desktop down.

- compact sticky PARA11AX header.
- pivot input immediately below.
- profile control becomes a compact `F / S / FULL` segmented control while retaining accessible full labels.
- result HUD becomes a compact grid/stack.
- evidence becomes one-column signals.
- relationship visualization becomes a vertical pivot chain/structured list instead of a wide graph.
- sticky semantic tabs below the pivot console.
- touch targets remain usable.
- raw JSON scrolls inside its own container.
- no table or panel can force document-width overflow.
- background rain density is reduced roughly 30% relative to desktop.
- cyan geometry is simplified behind text.

#### Sound cue system

Sound is a first-class PARA11AX interaction layer, but it must remain user-controlled, synthesized, bounded, and non-sensitive.

Use Web Audio API only. Do not load MP3/WAV/remote audio assets. No audio data may be derived from the token, IOC value, provider response strings, or other potentially sensitive content.

Browser autoplay rules are respected. The first explicit user gesture on `ESTABLISH SESSION` or a dedicated `ENABLE AUDIO` control creates/resumes the `AudioContext`. No attempt is made to bypass autoplay restrictions.

Audio controls:

- persistent `SOUND` mute/unmute control.
- compact volume control with a bounded range; default approximately 35% after audio is enabled.
- audio preference may live only in current page memory in v1; no localStorage is required.
- all sound controls are keyboard accessible and have textual labels.
- muting stops future cues immediately; no long-running loop is required.

Cue palette, all short and synthesized:

- `access-ok` — tight low-to-high two-tone confirmation after `/api/para11ax/health` succeeds.
- `access-denied` — short low descending pulse on `401`.
- `key` — very quiet high-frequency terminal tick on pivot typing, rate-limited/debounced so key repeat cannot create a wall of sound; disabled for token-field typing to avoid any side-channel-like correlation with credential entry.
- `tab` — subtle cyan-feeling blip when switching semantic views.
- `scan` — brief broadband/filtered sweep synchronized with the red scanner on enrichment submit.
- `result-ok` — short resolved chord/pulse when an `ok` envelope arrives.
- `result-partial` — amber-coded two-step unresolved interval; one-shot only.
- `result-error` — short low pulse for top-level application/request failure; provider failures inside a usable envelope do not spam this cue.
- `contradiction` — one short collision/noise transient when contradictions first become visible.
- `copy` — quiet click for successful copy action.
- `stix-start` — short scanner sweep when packaging STIX.
- `stix-ok` — compact confirmation when a valid bundle is returned and download begins.
- `disconnect` — short descending power-down cue synchronized with the UI collapse.

Sound design constraints:

- no cue longer than about 450 ms except the scanner sweep, which may run up to about 700 ms.
- no continuous background drone/music.
- no cue fires repeatedly during render loops.
- result cues fire once per completed request.
- contradiction cue fires once per result when contradictions exist, not once per contradiction item.
- typing cue rate is capped so rapid typing remains subtle.
- no sound on password/token-field keystrokes.
- audio engine failure is non-fatal; the UI must remain fully functional without Web Audio.
- reduced-motion does not automatically imply muted audio, but audio controls remain explicit and independent.

#### Primary user flow

1. User opens `/app`.
2. Access terminal asks for a gateway token.
3. User gesture unlocks optional Web Audio and UI validates with `/api/para11ax/health`.
4. Workspace unlocks on success.
5. User enters one pivot and chooses `fast`, `standard`, or `full`.
6. UI submits to `POST /api/para11ax/enrich`.
7. Submit triggers one scanner visual/audio cue; running state shows no fabricated provider progress.
8. Response is rendered into semantic views.
9. A single result cue reflects `ok`, `partial`, or top-level request error.
10. User may inspect/copy/export exact JSON or request STIX 2.1 through `POST /api/para11ax/stix`.
11. User may disconnect, clearing application-held token/result state and returning to access mode.

#### Export behavior

`DOWNLOAD JSON` serializes the exact enrichment response currently held in memory and creates a client-side Blob download. It must not add or remove evidence fields.

`DOWNLOAD STIX 2.1` calls `POST /api/para11ax/stix` with the same canonical indicator/profile request contract, then downloads the returned bundle. The UI does not fabricate STIX locally.

No token, Authorization header, credential-bearing state, or audio state may appear in filenames or exported content.

#### Browser API client

A small API client owns all authenticated fetches.

Requirements:

- same-origin relative `/api/para11ax/*` paths only.
- `Authorization: Bearer <token>` only when required.
- `Content-Type: application/json` for POST bodies.
- no browser retries beyond what the gateway itself defines.
- parse structured gateway errors when possible.
- treat non-JSON transport/platform failures separately from gateway evidence responses.
- never log token-bearing request objects.
- use `AbortController` for reset/disconnect/cancellation.
- cancellation is never represented as successful enrichment.

#### State model

Coarse application states:

- `locked` — no validated token.
- `ready` — token validated; no active request.
- `running` — one enrichment request active.
- `result` — response rendered, including `ok`, `partial`, or `error` envelope state.

Only one enrichment request may be active. Batch UI is deferred.

Independent audio state tracks `unsupported`, `locked`, `enabled`, or `muted` without changing analytical state.

#### Error handling

- `401`: clear/lock authenticated workspace state and ask for a valid token; never echo the supplied token.
- `400/413/415`: display structured gateway error and keep input editable.
- `405`: report method mismatch as an application/configuration fault.
- provider failures inside a usable enrichment envelope remain under Coverage / Failures.
- network/platform failure: neutral request failure message; do not imply provider health or threat state.
- malformed/unexpected JSON: fail closed in analytical renderers and show a bounded diagnostic without secrets.
- Web Audio unavailable/suspended/error: silently degrade to visual-only operation plus a small non-blocking sound-state label if needed.

#### Security requirements

- token in memory only.
- no storage APIs for auth state.
- no token in URL/query/hash.
- no third-party JavaScript/CSS/audio.
- no analytics or trackers.
- no remote fonts.
- no `eval`, dynamic code generation, or user-controlled HTML injection.
- all untrusted returned strings use text nodes / `textContent`, never `innerHTML`.
- exports are built from parsed response objects, never DOM scraping.
- API requests use same-origin relative paths only.
- sound frequencies/timing are fixed cue definitions and never derived from token/IOC/provider content.
- token input never emits typing sounds.
- existing bearer authentication and fixed-egress boundaries stay unchanged.
- existing unknown `/api/para11ax/*` structured JSON behavior remains intact.

#### Accessibility

- keyboard-complete controls.
- visible focus states.
- explicit labels for token, pivot, profile, tabs, sound, volume, and actions.
- semantic status text in addition to color/sound.
- audio is supplemental only; no information is conveyed solely by sound.
- live region for request state/result completion.
- sufficient contrast.
- reduced-motion support.
- responsive narrow Android layout without document overflow.
- mute control remains reachable at all times after workspace unlock.

#### Testing strategy

Add deterministic tests before implementation changes.

Structural/security tests:

- `/app` assets exist.
- viewport meta exists.
- reduced-motion CSS exists.
- no third-party JS/CSS/audio or remote fonts.
- no `localStorage`, `sessionStorage`, cookies, IndexedDB, analytics.
- no `innerHTML` evidence rendering.
- same-origin `/api/para11ax/health`, `/api/para11ax/enrich`, `/api/para11ax/stix` usage.
- only fixed profile values in UI.
- landing page links to `/app`.
- Vercel routing preserves `/api/para11ax/*` before human fallbacks.
- Web Audio cue engine contains no remote asset loading.
- token field cannot trigger typing cue.
- sound cue definitions are fixed and not based on IOC/token values.

Behavioral logic tests:

- invalid token returns to locked state.
- validated token unlocks workspace.
- token is not included in persisted/exported state.
- only one active enrichment request is permitted.
- `partial` renders as incomplete coverage.
- evidence kinds retain semantic labels.
- provider failures render outside evidence verdicts.
- contradictions render separately and trigger at most one contradiction cue per result.
- JSON export matches the response object.
- STIX export uses `/api/para11ax/stix` response rather than local generation.
- reset/disconnect clears application-held token references, visible token input, result state, and active controller.
- audio-disabled/unsupported state does not block any workflow.
- result sounds fire once per request, not per provider card.
- no typing sound is emitted for the token field.

Existing Node, Maltego, repository-invariant, Tooling smoke, and CodeQL gates must remain green.

#### Deployment and acceptance

Implementation uses a feature branch and PR. Vercel preview remains disabled for non-main Git branches, so production acceptance occurs only after protected-main merge and exact-SHA deployment.

Acceptance requires:

1. Tooling smoke passes.
2. CodeQL passes.
3. `/` remains healthy and exposes `ENTER PARA11AX`.
4. `/app` returns the analyst UI on the exact deployed main SHA.
5. `/api/para11ax/meta` remains public JSON.
6. `/api/para11ax/health` remains bearer-protected.
7. unknown `/api/para11ax/*` remains structured JSON 404.
8. human-facing `403`, `404`, and `500` routes remain branded HTML with correct status codes.
9. a real authorized enrichment completes through `/app` without the token appearing in storage, URL, exported JSON, visible diagnostics, or audio behavior.
10. JSON and STIX export work from the UI.
11. mobile layout has no horizontal document overflow at narrow Android width.
12. audio can be enabled by user gesture, muted, volume-adjusted, and fully ignored without affecting functionality.
13. token-field typing produces no sound.
14. semantic status remains understandable with sound muted and motion reduced.

#### Deferred evolution

If external use grows, the next architectural step is per-user issued gateway tokens with independent revocation, quotas, and audit metadata. `/app` should be designed so that future auth/token issuance can replace the shared-bearer access layer without requiring evidence-rendering, visual-system, or sound-system redesign.
