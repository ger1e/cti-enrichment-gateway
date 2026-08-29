# Radar, Rain, and Brand Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the landing page and analyst UI share one animated radar + PARA11AX lockup, while matching landing rain motion to the staggered native SVG style used by the `ger1e/ger1e` README banner.

**Architecture:** Shared SVG assets own radar/rain animation declaratively. A visual-only shared runtime maps existing brand hooks on both surfaces to one compact radar lockup, while landing motion CSS mounts the hero radar and rain without constructing animation layers in JavaScript.

**Tech Stack:** Static SVG/SMIL, CSS, browser JavaScript, Node.js `node:test` regression tests.

**Spec:** `docs/superpowers/specs/2026-08-29-radar-rain-brand-unification.md`

## Global Constraints

- `/` and `/app/` resolve to the same `assets/brand/para11ax-radar-lockup.svg` asset.
- Radar motion uses native SVG `<animateTransform>`.
- Rain uses staggered native SVG column translation modeled on the `ger1e/ger1e` profile banner.
- Palette remains PARA11AX phosphor `#39FF14` with restrained anomaly red `#FF2438`.
- `prefers-reduced-motion: reduce` leaves static content visible.
- No new network, storage, audio, auth, or enrichment capability.

---

### Task 1: Lock regression contract
- [x] Add failing tests for shared radar branding, native radar/rain motion, reduced motion, and removal of runtime radar construction.
- [x] Verify Tooling smoke fails only on the new contract before implementation.

### Task 2: Add canonical visual assets
- [x] Add `assets/brand/para11ax-radar-lockup.svg`.
- [x] Add `assets/brand/para11ax-radar.svg`.
- [x] Add `assets/brand/para11ax-rain.svg` with staggered 16–23 second translate tracks.

### Task 3: Apply the shared brand
- [x] Add `brand-unification.js` and `brand-unification.css`.
- [x] Import the shared runtime from both landing and analyst UI entry points.
- [x] Keep dynamic shell/boot logo hooks compatible while resolving active logos to the radar lockup.

### Task 4: Remove fragile landing construction
- [x] Remove `enhanceRadar`, `RADAR_CONTACTS`, `densifyRain`, and `EXTRA_RAIN_COLUMNS` from the landing adapter.
- [x] Mount hero radar and rain assets through `landing-radar-motion.css`.
- [x] Retain reveal/glitch/prompt/cursor behavior.

### Task 5: Verify
- [ ] Run focused regression tests through the PR CI gate.
- [ ] Run full `npm run check` through Tooling smoke.
- [ ] Confirm CodeQL and protected-main integration before completion.
