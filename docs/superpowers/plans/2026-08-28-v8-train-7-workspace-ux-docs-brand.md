# PARA11AX v8 Train 7 — Terminal Workspace UX, Mobile, Accessibility, Documentation, and Brand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the v8 capabilities into a coherent terminal-first analyst workspace, make contextual cases/diffs/graphs usable on desktop and mobile, converge every public/error surface on the canonical brand, and make capability documentation machine-checked against the code.

**Architecture:** Preserve the primary shell hierarchy `status -> scrollback/evidence -> prompt`. Add one reusable dismissible terminal overlay host for tasks that are materially harder in linear text, render case history/diffs/graph inside that host, and keep text-command fallbacks. Generate capability documentation from the shared registry, and treat accessibility/mobile/reduced-motion/brand invariants as regression-tested product requirements rather than cosmetic follow-up.

**Tech Stack:** Browser ES modules, DOM/SVG/CSS, existing shell/view-model/renderers, no new frontend framework, Node documentation generator, existing brand/static regression tests.

**Spec:** `docs/superpowers/specs/2026-08-28-para11ax-v8-full-maxx-design.md`

## Global Constraints

- Train 6 must be merged before execution.
- Canonical active palette is exactly: background `#020403`, phosphor `#39FF14`, primary text `#F7FFF6`, muted `#8DA391`, alert/scanner `#FF2438`.
- Legacy active/dormant palette tokens `#00E5FF`, `#F6C945`, `#39FF88`, `#FF1E2D`, `#FF4050`, and old background/text/muted values must not remain in active presentation code or user-visible `theme` output.
- Red is sparse and reserved for anomaly/error/contradiction/scanner states.
- Shell prompt remains exactly `analyst@para11ax:~$`.
- No permanent sidebar, dashboard, card grid, duplicated launcher, force-directed graph library, or second navigation system.
- Context overlays are dismissible, keyboard reachable, screen-reader labelled, and restore focus to the invoking shell control.
- `Escape` closes the top overlay; `Tab`/`Shift+Tab` stay within an open modal overlay; text selection remains native.
- Mobile remains one column. No page-level horizontal overflow at 320 CSS px. Raw JSON may scroll horizontally inside its own bounded region.
- `prefers-reduced-motion: reduce` disables nonessential Matrix/radar/glitch/reveal/pulse motion.
- Existing synthesized `/app` audio is not expanded or made a dependency of any v8 feature.
- Landing-page live data comes only from public `/api/para11ax/meta`; no fabricated uptime, latency, provider health, case count, or investigation metrics.
- Documentation must distinguish `implemented`, `configured`, and `production-verified` where operational state is discussed.

---

### Task 1: Add one reusable terminal-native overlay host

**Files:**
- Create: `app/terminal-overlay.js`
- Create: `app/terminal-overlay.css`
- Modify: `app/index.html`
- Modify: `app/shell-ui.js`
- Create: `test/terminal-overlay-v8.test.js`

**Interfaces:**

```js
export function createTerminalOverlay({ document, onClose });
// returns frozen { open({ title, ariaLabel, content }), close(), isOpen(), element }
```

- [ ] **Step 1: Write failing DOM-contract tests**

Using the repository's existing lightweight DOM test approach, assert the overlay root has:

```text
role="dialog"
aria-modal="true"
aria-labelledby points to visible title
hidden when closed
```

Assert `Escape` closes it, focus moves to the first focusable control on open, and previous focus is restored on close.

- [ ] **Step 2: Run RED**

```bash
node --test test/terminal-overlay-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement one overlay host**

Build DOM nodes with `document.createElement`; do not inject analyst/evidence strings via `innerHTML`. The overlay contains exactly:

```text
header: title + close button
body: supplied Node/DocumentFragment
footer: "ESC CLOSE" hint
```

Track the element focused before open. Trap `Tab` only while open. Closing empties body content and restores focus.

- [ ] **Step 4: Add terminal styling**

`terminal-overlay.css` uses only canonical CSS custom properties from the app root. Desktop max width `min(960px, calc(100vw - 32px))`, max height `min(80vh, 760px)`. At `max-width: 640px`, inset is 8px and width is `calc(100vw - 16px)`.

- [ ] **Step 5: Load stylesheet and construct overlay once**

Add stylesheet in `app/index.html`. In `mountAnalystShell()`, create one overlay instance and reuse it for graph/case/diff surfaces. Do not create a new overlay per command.

- [ ] **Step 6: Run GREEN and commit**

```bash
node --test test/terminal-overlay-v8.test.js test/shell.test.js
git add app/terminal-overlay.js app/terminal-overlay.css app/index.html app/shell-ui.js test/terminal-overlay-v8.test.js
git commit -m "feat: add terminal workspace overlay"
```

---

### Task 2: Add bounded visual evidence graph with text fallback

**Files:**
- Create: `app/evidence-graph-view.js`
- Create: `app/evidence-graph-view.css`
- Modify: `app/shell-ui.js`
- Modify: `app/index.html`
- Create: `test/evidence-graph-view-v8.test.js`

**Interfaces:**

```js
export function renderEvidenceGraphView({ document, graph, onPivot });
```

Returns a DOM node; performs no provider call itself.

- [ ] **Step 1: Write failing graph-view tests**

For a deterministic 4-node graph, assert one SVG with one labelled group per node, one line/path per edge, and a parallel accessible relationship list. Assert user-provided node values are set through `textContent`. Assert graphs over 100 nodes/100 edges are rejected.

- [ ] **Step 2: Run RED**

```bash
node --test test/evidence-graph-view-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement deterministic layered layout**

No force simulation. Place subject at column 0; first-hop evidence/infrastructure nodes at column 1; contextual/case/ATT&CK nodes at column 2. Sort each column by `type`, then `value`, then `id`. Use fixed row spacing and an SVG `viewBox`; clamp visible SVG height and allow its container to scroll.

Each edge renders a `<title>` containing `type`, provider when present, and evidence-fingerprint count. Each node has a keyboard-focusable button in the parallel list.

- [ ] **Step 4: Implement explicit pivot action only**

For nodes whose types are supported observables, the list exposes `PIVOT`. It calls `onPivot({ type, value })`; `shell-ui.js` converts that into the normal `enrich` command path and therefore normal auth/profile/budget controls. No click can call providers directly.

- [ ] **Step 5: Mobile and reduced-motion behavior**

At ≤640 px, show the accessible node/relationship list first and SVG second; SVG has no animated transitions. Reduced motion disables hover/pulse animation.

- [ ] **Step 6: Run GREEN and commit**

```bash
node --test test/evidence-graph-view-v8.test.js test/guidance-rendering-v8.test.js
git add app/evidence-graph-view.js app/evidence-graph-view.css app/shell-ui.js app/index.html test/evidence-graph-view-v8.test.js
git commit -m "feat: add contextual evidence graph overlay"
```

---

### Task 3: Add case, history, and semantic-diff workspace views

**Files:**
- Create: `app/case-workspace-view.js`
- Create: `app/case-workspace-view.css`
- Modify: `app/shell-ui.js`
- Modify: `app/index.html`
- Create: `test/case-workspace-view-v8.test.js`

**Interfaces:**

```js
export function renderCaseSummary({ document, caseValue });
export function renderCaseHistory({ document, caseValue });
export function renderSemanticDiffView({ document, diff });
```

- [ ] **Step 1: Write failing view tests**

Assert summary visibly contains case ID/title, pin/note/snapshot/diff counts and local-storage warning. History sorts snapshots newest-first while preserving immutable IDs. Diff groups records by Train 3 category and prints before/after values in `<pre>` elements using `textContent`.

- [ ] **Step 2: Run RED**

```bash
node --test test/case-workspace-view-v8.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement terminal-native case views**

Use compact definition lists/tables/preformatted blocks; do not create dashboard cards. Render this fixed warning in case summary:

```text
LOCAL WORKSPACE · STORED IN THIS BROWSER PROFILE · NOT ENCRYPTED BY PARA11AX
```

Do not display tokens/provider credential state.

- [ ] **Step 4: Wire existing case commands to overlays where useful**

`case show`, `case list`, and `diff` keep a concise scrollback summary and open overlay detail only for multi-row content. `case export/import/refresh` remain command actions rather than overlay buttons. Closing an overlay does not close the active case.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test test/case-workspace-view-v8.test.js test/shell-case-runtime-v8.test.js
git add app/case-workspace-view.js app/case-workspace-view.css app/shell-ui.js app/index.html test/case-workspace-view-v8.test.js
git commit -m "feat: add terminal case workspace views"
```

---

### Task 4: Converge app, shell theme output, landing, and error surfaces on canonical palette

**Files:**
- Modify: `app/shell-ui.js`
- Modify: `app/app.css`
- Modify: `app/terminal-v7.css`
- Modify: `landing-terminal-v7.css`
- Modify: `landing-radar-motion.css`
- Modify: `403.html`
- Modify: `404.html`
- Modify: `500.html`
- Modify: `test/brand-unification.test.js`
- Modify: `test/app-theme-color-v6.test.mjs`

**Interfaces:** no application-domain behavior changes.

- [ ] **Step 1: Strengthen brand regression tests and verify RED**

Extend `test/brand-unification.test.js` so active presentation files and `PALETTE_TEXT` must contain canonical tokens and must not contain:

```text
#00E5FF
#F6C945
#39FF88
#FF1E2D
#FF4050
#050608
#F3F7FA
#7D8B95
```

Case-insensitive scan only the active HTML/CSS/JS presentation files enumerated in the test; do not scan historical docs/specs/changelog.

```bash
node --test test/brand-unification.test.js test/app-theme-color-v6.test.mjs
```

Expected: RED because current shell `theme` output still contains legacy values.

- [ ] **Step 2: Replace `PALETTE_TEXT` exactly**

In `app/shell-ui.js`:

```js
const PALETTE_TEXT = [
  'void       #020403  terminal background',
  'phosphor   #39FF14  primary terminal signal / verified state',
  'white      #F7FFF6  primary terminal text',
  'muted      #8DA391  secondary terminal text',
  'red        #FF2438  anomaly / error / contradiction / scanner',
].join('\n');
```

- [ ] **Step 3: Replace remaining active legacy CSS literals**

Use root variables:

```css
--px-bg: #020403;
--px-green: #39FF14;
--px-text: #F7FFF6;
--px-muted: #8DA391;
--px-red: #FF2438;
```

Map existing aliases to these variables if removing them would create broad unrelated churn. Do not introduce cyan/amber secondary states.

- [ ] **Step 4: Converge 403/404/500**

Retain each page's correct status/code copy, root favicon inheritance, and cursor CSS. Use only canonical palette and native mono stack. Error code/action is red only for the fault accent; body/copy remains white/muted/phosphor.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test test/brand-unification.test.js test/app-theme-color-v6.test.mjs test/error-pages.test.js
git add app/shell-ui.js app/app.css app/terminal-v7.css landing-terminal-v7.css landing-radar-motion.css 403.html 404.html 500.html test/brand-unification.test.js test/app-theme-color-v6.test.mjs
git commit -m "style: converge v8 terminal palette"
```

---

### Task 5: Harden mobile, keyboard, accessibility, and reduced-motion behavior

**Files:**
- Modify: `app/app.css`
- Modify: `app/terminal-v7.css`
- Modify: `app/index.html`
- Modify: `app/shell-ui.js`
- Modify: `app/terminal-overlay.css`
- Modify: `app/evidence-graph-view.css`
- Modify: `app/case-workspace-view.css`
- Create: `test/v8-accessibility-mobile.test.js`

- [ ] **Step 1: Write failing static/DOM acceptance tests**

Assert:

```text
viewport meta includes width=device-width, initial-scale=1
shell root and overlay have accessible names
scrollback remains role=log
command input has accessible label
all overlay close buttons have type=button + accessible name
CSS contains @media (prefers-reduced-motion: reduce)
CSS contains <=640px and <=360px mobile rules
no fixed min-width > 320px on shell/overlay/graph containers
```

DOM tests assert `Escape` closes overlays and focus restores to command input.

- [ ] **Step 2: Run RED**

```bash
node --test test/v8-accessibility-mobile.test.js
```

Expected: at least new overlay/mobile assertions fail.

- [ ] **Step 3: Apply one-column mobile constraints**

At ≤640px:

```css
.unix-shell { width: 100%; min-width: 0; }
.shell-scrollback, .terminal-overlay-body { min-width: 0; overflow-wrap: anywhere; }
pre, .shell-raw-json { max-width: 100%; overflow-x: auto; }
```

At ≤360px reduce shell/overlay padding but keep touch targets ≥44px for buttons. Do not shrink body text below 12px.

- [ ] **Step 4: Add reduced-motion hard disable**

Inside reduced-motion media query set animation/transition duration to `0.001ms` and iteration count to 1 for nonessential app/overlay/Matrix/radar/glitch selectors. Keep cursor/focus visibility without animation.

- [ ] **Step 5: Add non-color status markers**

Where red/phosphor conveys state, retain explicit text such as `ERROR`, `CONTRADICTION`, `AUTH:UP`, `AUTH:DOWN`, `PARTIAL`, so color is redundant.

- [ ] **Step 6: Run GREEN and commit**

```bash
node --test test/v8-accessibility-mobile.test.js test/terminal-overlay-v8.test.js test/evidence-graph-view-v8.test.js test/case-workspace-view-v8.test.js
git add app/app.css app/terminal-v7.css app/index.html app/shell-ui.js app/terminal-overlay.css app/evidence-graph-view.css app/case-workspace-view.css test/v8-accessibility-mobile.test.js
git commit -m "fix: harden mobile and accessible terminal ux"
```

---

### Task 6: Defer large evidence/raw rendering without changing data

**Files:**
- Modify: `app/renderers.js`
- Modify: `app/shell-ui.js`
- Create: `test/terminal-render-bounds-v8.test.js`

**Interfaces:** visual rendering only; Evidence v2 stays intact in memory/export.

- [ ] **Step 1: Write failing rendering-bound tests**

Assert raw/evidence views initially render at most 200 visible text rows/evidence records and append an explicit continuation control when more exists. Clicking `SHOW NEXT 200` reveals the next bounded chunk. JSON download/copy still serializes the complete result.

- [ ] **Step 2: Run RED**

```bash
node --test test/terminal-render-bounds-v8.test.js
```

Expected: current render path emits all content at once.

- [ ] **Step 3: Implement view-only chunking**

Introduce a local render cursor keyed by result `requestId + view`. Chunk only DOM rendering; do not truncate `currentResult`, copy/export, report input, case snapshots, or semantic diff input.

- [ ] **Step 4: Reset cursor on result/view change and run GREEN**

```bash
node --test test/terminal-render-bounds-v8.test.js test/shell.test.js test/api-client.test.js
git add app/renderers.js app/shell-ui.js test/terminal-render-bounds-v8.test.js
git commit -m "perf: bound large terminal rendering"
```

---

### Task 7: Drive public capability documentation from the shared registry

**Files:**
- Create: `scripts/generate-capabilities.mjs`
- Create: `docs/CAPABILITIES.md`
- Modify: `package.json`
- Modify: `scripts/verify-repo.sh`
- Modify: `README.md`
- Modify: `docs/API.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/EVIDENCE-SCHEMA.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/PROVIDERS.md`
- Modify: `docs/SECURITY-CONTROLS.md`
- Modify: `docs/THREAT-MODEL.md`
- Modify: `docs/BRAND.md`
- Modify: `maltego/README.md`
- Create: `test/capability-docs-v8.test.js`

**Interfaces:**

```bash
node scripts/generate-capabilities.mjs --write
node scripts/generate-capabilities.mjs --check
```

- [ ] **Step 1: Write failing deterministic-generator test**

Assert generated markdown contains current observable rows, provider count, source role, freshness class, credential mode (`none|optional|required`, never env names), and STIX posture. Running generation twice must produce byte-identical output.

- [ ] **Step 2: Run RED**

```bash
node --test test/capability-docs-v8.test.js
```

Expected: generator missing.

- [ ] **Step 3: Implement generator from canonical registries**

Import `ALL_PROVIDERS`, `createProviderRegistry`, `OBSERVABLE_MANIFEST`, and `buildCapabilityRegistry`. Render stable Markdown sorted by observable/provider name. Header states:

```text
Generated from PARA11AX canonical registries. Do not edit capability tables manually.
```

No provider credential variable names are emitted.

- [ ] **Step 4: Add verification script**

In `package.json`:

```json
"generate:capabilities": "node scripts/generate-capabilities.mjs --write",
"verify:capabilities": "node scripts/generate-capabilities.mjs --check"
```

Call `npm run verify:capabilities` from `scripts/verify-repo.sh`.

- [ ] **Step 5: Update human documentation around the generated truth**

Document, without duplicating the generated table:

```text
read-only/fixed-egress boundary
9 observable classes including explicit cert-sha256 syntax
38-provider curated catalog after Train 2
Evidence semantics + semantic diff behavior
local IndexedDB case threat model and non-encryption warning
.para11ax bundle limits
manual case refresh limits
compare endpoint and 1 MiB cap
single-bearer auth
server-side provider credentials only
privacy-minimal telemetry
shell/API/CLI/Maltego/report/STIX parity
implemented vs configured vs production-verified state language
```

- [ ] **Step 6: Run GREEN and commit**

```bash
npm run generate:capabilities
node --test test/capability-docs-v8.test.js
npm run verify:capabilities
git add scripts/generate-capabilities.mjs docs/CAPABILITIES.md package.json scripts/verify-repo.sh README.md docs/API.md docs/ARCHITECTURE.md docs/EVIDENCE-SCHEMA.md docs/OPERATIONS.md docs/PROVIDERS.md docs/SECURITY-CONTROLS.md docs/THREAT-MODEL.md docs/BRAND.md maltego/README.md test/capability-docs-v8.test.js
git commit -m "docs: generate v8 capability truth"
```

---

### Task 8: Make landing capability copy live-but-public and deterministic

**Files:**
- Modify: `landing-terminal-v7.js`
- Modify: `landing-maxx.html`
- Create: `test/landing-meta-v8.test.js`

- [ ] **Step 1: Write failing landing tests**

Assert landing JS fetches only `/api/para11ax/meta`, uses `cache: 'no-store'`, sends no Authorization header, and can render:

```text
READ-ONLY · <N> SOURCES · <N> OBSERVABLE TYPES · EVIDENCE V2
```

from returned public metadata. Assert source/type numbers are absent when fetch fails rather than replaced with fabricated values.

- [ ] **Step 2: Run RED**

```bash
node --test test/landing-meta-v8.test.js
```

Expected: live capability rendering missing.

- [ ] **Step 3: Implement bounded public meta hydration**

Use a 3-second `AbortController` timeout. Validate that `capabilities.providers` and `capabilities.observableTypes` are arrays before rendering counts. Fetch once on page load only; no polling.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test test/landing-meta-v8.test.js test/brand-unification.test.js
git add landing-terminal-v7.js landing-maxx.html test/landing-meta-v8.test.js
git commit -m "feat: hydrate landing capability truth"
```

---

### Task 9: Complete Train 7 verification

- [ ] **Step 1: Run focused UX/brand/docs suite**

```bash
node --test test/terminal-overlay-v8.test.js test/evidence-graph-view-v8.test.js test/case-workspace-view-v8.test.js test/v8-accessibility-mobile.test.js test/terminal-render-bounds-v8.test.js test/brand-unification.test.js test/capability-docs-v8.test.js test/landing-meta-v8.test.js
```

Expected: PASS.

- [ ] **Step 2: Run complete gates**

```bash
npm test
npm run verify:capabilities
npm run verify:repo
npm run audit:public
npm run check
python -m unittest discover -s test
```

Expected: all PASS.

- [ ] **Step 3: Static scope audit**

```bash
git grep -n -Ei '#00e5ff|#f6c945|#39ff88|#ff1e2d|#ff4050' -- app landing-maxx.html landing-terminal-v7.js landing-terminal-v7.css landing-radar-motion.css 403.html 404.html 500.html
git grep -n -E 'PARA11AX_TOKEN|Authorization|localStorage|sessionStorage' -- app/case-*.js app/indexeddb-case-storage.js
```

Expected: first command has no matches; second has no matches.

- [ ] **Step 4: Review final diff**

```bash
git diff --stat main...HEAD
git diff main...HEAD -- app landing-maxx.html landing-terminal-v7.js landing-terminal-v7.css landing-radar-motion.css 403.html 404.html 500.html scripts/generate-capabilities.mjs docs README.md
```

Acceptance conditions:

```text
- shell hierarchy remains status -> scrollback/evidence -> prompt
- one reusable overlay host; no permanent dashboard/sidebar/card grid
- graph is deterministic, bounded and has text/list fallback
- 320px viewport has no page-level horizontal overflow by CSS contract
- keyboard/focus/reduced-motion requirements have regression tests
- active palette contains only canonical black/phosphor/white/muted/red roles
- audio surface is unchanged
- landing uses public meta only and performs no polling
- docs capability tables are generated and drift-checked
```

Do not create an empty verification commit.