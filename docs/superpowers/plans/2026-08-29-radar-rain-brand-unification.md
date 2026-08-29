# Radar, Rain, and Brand Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the landing page and analyst UI share one animated radar + PARA11AX lockup, while matching the landing rain motion to the staggered native SVG style used by the `ger1e/ger1e` README banner.

**Architecture:** Use shared SVG assets for the compact brand and hero radar so motion is declarative and independent of JavaScript. Replace CSS falling rain spans with one fixed SVG rain layer containing repeated glyph columns and staggered `<animateTransform>` elements. Keep JavaScript focused on reveal/glitch/prompt normalization only.

**Tech Stack:** Static HTML, SVG/SMIL, CSS, browser JavaScript, Node.js `node:test` regression tests.

**Spec:** `docs/superpowers/specs/2026-08-29-radar-rain-brand-unification.md`

## Global Constraints

- `/` and `/app/` use the same `assets/brand/para11ax-radar-lockup.svg` top-left asset.
- Radar motion uses native SVG `<animateTransform>`.
- Rain uses staggered native SVG column translation modeled on the `ger1e/ger1e` profile banner.
- Palette remains PARA11AX phosphor `#39FF14` with restrained anomaly red `#FF2438`.
- `prefers-reduced-motion: reduce` disables motion without hiding content.
- No new network, storage, audio, auth, or enrichment capability.

---

### Task 1: Lock regression contract

**Files:**
- Create: `test/radar-rain-brand-unification.test.mjs`

**Interfaces:**
- Consumes: `landing-maxx.html`, `app/index.html`, `landing-terminal-v7.js`, shared brand assets.
- Produces: assertions that fail until shared assets and native SVG motion exist.

- [ ] **Step 1: Write the failing test**

Add tests requiring both surfaces to reference `/assets/brand/para11ax-radar-lockup.svg`, requiring native `<animateTransform>` in radar/rain assets, and requiring `landing-terminal-v7.js` to no longer export or invoke `enhanceRadar`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/radar-rain-brand-unification.test.mjs`

Expected: FAIL because the shared radar assets do not exist and the current landing still uses runtime radar enhancement/CSS rain.

### Task 2: Add shared radar assets

**Files:**
- Create: `assets/brand/para11ax-radar-lockup.svg`
- Create: `assets/brand/para11ax-radar.svg`

**Interfaces:**
- Produces: self-contained animated SVG assets with `animateTransform` and static reduced-motion-compatible base geometry.

- [ ] **Step 1: Implement minimal SVG assets**

Create a compact radar lockup with concentric rings, crosshair, rotating sweep, restrained contacts, and PARA11AX wordmark. Create a larger square radar asset for the landing hero using the same geometry and sweep language.

- [ ] **Step 2: Keep motion declarative**

Use SVG `<animateTransform attributeName="transform" type="rotate" ... repeatCount="indefinite"/>`; do not require JavaScript.

### Task 3: Replace landing rain and wire shared brand

**Files:**
- Modify: `landing-maxx.html`
- Modify: `landing-radar-motion.css`
- Modify: `landing-terminal-v7.js`

**Interfaces:**
- Consumes: shared radar SVG assets.
- Produces: native SVG rain and radar rendering on `/`.

- [ ] **Step 1: Replace top-left text brand**

Render `<img class="terminal-brand-lockup" src="/assets/brand/para11ax-radar-lockup.svg" ...>` inside the existing home link.

- [ ] **Step 2: Replace CSS rain spans**

Use a fixed SVG `.matrix-rain` containing reusable vertical glyph columns and multiple staggered `<animateTransform type="translate">` tracks with varied durations and offsets.

- [ ] **Step 3: Replace hero runtime radar**

Render `/assets/brand/para11ax-radar.svg` in `.hero-ghost`; remove JavaScript-created radar layers.

- [ ] **Step 4: Simplify motion adapter**

Remove `RADAR_CONTACTS`, `enhanceRadar`, and its invocation/export from `landing-terminal-v7.js`. Retain prompt normalization, reveal, glitch, cursor stylesheet, and non-radar motion polish.

- [ ] **Step 5: Add reduced-motion fallback**

In `landing-radar-motion.css`, pause SVG animation via `.matrix-rain svg *, .hero-radar` handling where supported and keep static geometry visible.

### Task 4: Wire analyst UI shared brand

**Files:**
- Modify: `app/index.html`
- Modify: `app/app.css`

**Interfaces:**
- Consumes: `/assets/brand/para11ax-radar-lockup.svg`.
- Produces: same top-left identity as landing.

- [ ] **Step 1: Replace text-only terminal mark**

Use the same shared lockup image in the workspace status header while preserving the version string as adjacent text if needed.

- [ ] **Step 2: Size for desktop/mobile**

Constrain the shared lockup to a small header footprint without changing terminal controls or layout semantics.

### Task 5: Verify and commit

**Files:**
- Test: `test/radar-rain-brand-unification.test.mjs`
- Existing tests: `test/landing-motion-pass.test.mjs`, `test/brand-unification.test.js`, `test/gateway-terminal-mobile-logo.test.mjs`, `test/web-ui.test.mjs`

- [ ] **Step 1: Run focused tests**

Run: `node --test test/radar-rain-brand-unification.test.mjs test/landing-motion-pass.test.mjs test/brand-unification.test.js test/gateway-terminal-mobile-logo.test.mjs test/web-ui.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run full repository validation**

Run: `npm run check`

Expected: PASS with no regression failures.

- [ ] **Step 3: Review diff**

Confirm changes are visual-only and both surfaces reference the exact same lockup path.

- [ ] **Step 4: Commit**

Commit message: `fix: unify radar branding and landing rain`
