<!-- PARA11AX-DOC-STANDARD: GER1E/PARA11AX v1 -->
> **Document status:** Historical design record. Preserved for implementation history; current behavior is defined by [docs/ARCHITECTURE.md](https://github.com/ger1e/para11ax/blob/main/docs/ARCHITECTURE.md) and the current README.

# PARA11AX Terminal Everywhere v7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the landing page, authenticated analyst UI, README, and documentation use one canonical phosphor terminal visual system with strong visual motion cues and no new audio.

**Architecture:** Keep all runtime/security behavior unchanged and implement a presentation-only visual system. Landing receives terminal-native markup/CSS plus a small motion adapter; `/app` keeps its existing native shell structure and gets reference-aligned terminal framing/motion; README/docs use terminal-native SVG and markdown assets that share the same palette and composition.

**Tech Stack:** Static HTML/CSS/ES modules, SVG, Node.js test runner, existing GitHub Actions Tooling Smoke and CodeQL.

**Spec:** `docs/superpowers/specs/2026-08-28-terminal-everywhere-v7.md`

## Global Constraints

- Canonical palette: `#020403`, `#39FF14`, `#F7FFF6`, `#8DA391`, `#FF2438` only for active presentation identity/state.
- Banned active literals: `#00E5FF`, `#F6C945`, `#39FF88`, `#00FFFF`, `#FF1E2D`, `#FF4050`.
- No new audio on landing/docs; do not expand existing `/app` audio behavior.
- Preserve memory-only bearer token, provider restrictions, API/egress semantics, safe DOM rendering, Vercel rewrite, exact 39-line Pepe payload, boot non-persistence and no external runtime assets.
- `prefers-reduced-motion: reduce` must disable nonessential motion.
- Mobile 360–430px remains first-class and terminal-first.

---

### Task 1: Lock the cross-surface regression contract

**Files:**
- Create: `test/terminal-everywhere-v7.test.mjs`

**Interfaces:**
- Consumes: current landing, `/app`, README and brand/docs assets.
- Produces: source-level regression contract for terminal structure, palette, motion hooks, no-audio rule and README/docs alignment.

- [ ] **Step 1: Write the failing test**

Create tests that assert:

```js
assert.match(landing, /class="terminal-hero"/i);
assert.match(landing, /user@para11ax:~\$/i);
assert.match(landing, /data-terminal-motion="v7"/i);
assert.match(landing, /prefers-reduced-motion:\s*reduce/i);
assert.doesNotMatch(activePresentation, /#00e5ff|#f6c945|#39ff88|#00ffff|#ff1e2d|#ff4050/i);
assert.doesNotMatch(landing, /AudioContext|new\s+Audio|\.mp3|\.wav|\.ogg/i);
assert.match(readme, /para11ax-terminal-hero\.svg/i);
assert.match(brand, /terminal frame/i);
assert.match(brand, /no new audio/i);
assert.match(appDeck, /user@para11ax: ~/i);
assert.doesNotMatch(appDeck, /analyst-view-rail|analyst-action-rail|analyst-status-rail/i);
```

Also assert that `README.md` retains Tooling Smoke and CodeQL badges and that `app/index.html` still contains the exact boot/Pepe marker block identifiers.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/terminal-everywhere-v7.test.mjs`

Expected: FAIL on missing v7 landing structure/asset/docs assertions while existing source files remain unchanged.

- [ ] **Step 3: Commit the red contract**

Commit only `test/terminal-everywhere-v7.test.mjs` with message `test: define terminal-everywhere v7 contract`.

---

### Task 2: Rebuild the landing page as a live terminal

**Files:**
- Modify: `landing-maxx.html`
- Create: `landing-terminal-v7.js`
- Test: `test/terminal-everywhere-v7.test.mjs`

**Interfaces:**
- Consumes: existing `/app/` CTA, production metadata and canonical palette.
- Produces: terminal-first landing markup plus motion adapter identified by `data-terminal-motion="v7"`.

- [ ] **Step 1: Replace dashboard/marketing composition with terminal hierarchy**

Implement these concrete blocks in `landing-maxx.html`:

```html
<header class="terminal-topline">
  <a class="terminal-brand" href="/">PARA11AX</a>
  <div class="terminal-state">LINK: UP | AUTH: UP | SYS: NOMINAL | v2.0.0 <span class="status-dot"></span></div>
  <a class="terminal-enter" href="/app/">&gt; ENTER TERMINAL</a>
</header>
<section class="terminal-hero" aria-labelledby="hero-title">...</section>
<section class="terminal-overview">...</section>
<section class="terminal-grid">...</section>
<section class="terminal-integrations">...</section>
<footer class="terminal-footer">...</footer>
```

Hero content must visibly include:

```text
PARA11AX
PROVENANCE-FIRST CTI PLATFORM
EVIDENCE FIRST.
BOUNDED ALWAYS.
OPERATIONAL WHEN SUPPORTED.
```

Analyst session pane must visibly include:

```text
user@para11ax:~$ whoami
Threat Hunter
user@para11ax:~$ mission
Evidence first. Bounded always. Operational when supported.
user@para11ax:~$ _
```

- [ ] **Step 2: Implement the canonical CSS and motion hooks**

Use only canonical palette tokens. Add CSS animations for Matrix fall, scanner sweep, cursor blink, status pulse, terminal-line reveal and a short low-displacement glitch cue. Add `@media (prefers-reduced-motion: reduce)` that disables these animations.

- [ ] **Step 3: Add the visual-only motion adapter**

`landing-terminal-v7.js` must:

```js
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.dataset.terminalMotion = 'v7';
```

Use `IntersectionObserver` when available to add `.is-visible` to `[data-reveal]` sections and periodically add/remove a short `.is-glitching` class on the hero only when reduced motion is false. It must not import audio, call network APIs, persist state, or mutate technical copy.

- [ ] **Step 4: Run the focused test**

Run: `node --test test/terminal-everywhere-v7.test.mjs`

Expected: landing assertions PASS; README/docs assertions may still FAIL until later tasks.

- [ ] **Step 5: Commit**

Commit landing files with message `feat: rebuild landing as terminal-first surface`.

---

### Task 3: Align the authenticated `/app` terminal to the reference

**Files:**
- Modify: `app/analyst-deck.css`
- Modify: `app/analyst-deck.js`
- Modify as needed: `app/shell-polish.css`
- Modify as needed: `app/visual-maxx.js`
- Test: existing `/app` visual tests plus `test/terminal-everywhere-v7.test.mjs`

**Interfaces:**
- Consumes: native `.unix-shell`, `.shell-status`, `.shell-scrollback`, `.shell-prompt`, existing visual event classes.
- Produces: terminal frame/reference alignment without DOM re-parenting, alternate command paths or API/session imports.

- [ ] **Step 1: Preserve the shell adapter contract**

Keep `PROMPT_TEXT = 'user@para11ax: ~'`, `dataset.terminalFirst`, stylesheet loading and prompt normalization. Do not create dashboard/view/action/status wrapper rails.

- [ ] **Step 2: Apply reference terminal geometry**

Style the shell as one bordered terminal plane with:

```css
.unix-shell { display:grid; grid-template-rows:auto minmax(0,1fr) auto; }
.shell-status { border-bottom:1px solid var(--terminal-line); }
.shell-scrollback { overflow:auto; background:var(--terminal-bg); }
.shell-prompt { border-top:1px solid var(--terminal-line-strong); }
```

Use a thin phosphor frame/inner glow, operational status dot, scanline cue, cursor/focus cue and transcript separators. No card layout, no sidebars, no rounded SaaS panels.

- [ ] **Step 3: Max visual cues without content disruption**

Existing event classes such as scanning/result/error may trigger <=400 ms glitch/pulse effects, but must not change text/data or block input. Matrix remains edge-biased and reduced behind scrollback.

- [ ] **Step 4: Keep mobile terminal-first**

At `max-width:430px`, preserve one-column status/scrollback/prompt, 16px input text where needed to avoid mobile zoom, raw horizontal scrolling and no oversized labels.

- [ ] **Step 5: Run focused and existing UI tests**

Run: `node --test test/terminal-everywhere-v7.test.mjs test/web-ui.test.mjs test/analyst-deck-v4.test.mjs test/analyst-deck-v5.test.mjs test/analyst-deck-v6.test.mjs`

Expected: PASS for all files that exist in the repository; if a named historical file does not exist, use the current `test/analyst-deck*.test.mjs` files returned by repository listing and document the exact command in the commit message/PR.

- [ ] **Step 6: Commit**

Commit `/app` presentation changes with message `feat: align analyst shell with canonical terminal`.

---

### Task 4: Replace README hero and documentation visuals with terminal-native assets

**Files:**
- Create: `assets/brand/para11ax-terminal-hero.svg`
- Create: `assets/brand/para11ax-terminal-hero-mobile.svg`
- Modify: `README.md`
- Modify: `assets/brand/para11ax-architecture.svg`
- Modify: `assets/brand/para11ax-semantic-firewall.svg`
- Test: `test/terminal-everywhere-v7.test.mjs`

**Interfaces:**
- Consumes: existing README claims/links, architecture and semantic-firewall content.
- Produces: GitHub-safe terminal assets with matching desktop/mobile hierarchy.

- [ ] **Step 1: Create terminal hero SVGs**

Desktop hero must include a terminal status bar, PARA11AX wordmark/ASCII-like treatment, `PROVENANCE-FIRST CTI`, operational facts and a visible `user@para11ax:~$` excerpt. Mobile hero must preserve the same content hierarchy at 720x360 without clipped text.

Use only canonical palette and monospaced/system text. Do not embed external fonts/images/scripts.

- [ ] **Step 2: Update README hero references and section framing**

Change the `<picture>` sources to the new terminal hero assets. Keep badges, links and all core technical claims. Use concise shell-style code fences/separators around `OPERATIONAL CORE`, `ANALYST SURFACE`, `SEMANTIC FIREWALL`, `DEEP DOCS` and `DELIBERATE GAPS` without converting the document into unreadable ASCII art.

- [ ] **Step 3: Restyle architecture and semantic-firewall diagrams**

Use square terminal frames, canonical palette and monospaced labels. Preserve node/edge meaning and all evidence-semantics distinctions.

- [ ] **Step 4: Run focused test**

Run: `node --test test/terminal-everywhere-v7.test.mjs`

Expected: README and asset assertions PASS.

- [ ] **Step 5: Commit**

Commit docs/assets with message `feat: unify README and diagrams with terminal identity`.

---

### Task 5: Make `docs/BRAND.md` the terminal-first canonical design system

**Files:**
- Modify: `docs/BRAND.md`
- Test: `test/terminal-everywhere-v7.test.mjs`

**Interfaces:**
- Consumes: approved reference/mockup and v7 spec.
- Produces: durable design rules for future PARA11AX work.

- [ ] **Step 1: Rewrite primary identity hierarchy**

State explicitly that the terminal frame, prompt and phosphor shell are primary identity; sentinel geometry is optional secondary emblem use.

Include canonical prompt examples:

```text
user@para11ax:~$ whoami
Threat Hunter
user@para11ax:~$ _
```

- [ ] **Step 2: Document motion and audio rules**

Copy exact motion ranges from the spec and state: `No new audio is part of the canonical landing/README/documentation identity.` Existing `/app` audio is independent behavior and must not be expanded by visual-brand work.

- [ ] **Step 3: Remove stale palette doctrine**

Remove amber as an active brand token and align muted/terminal tokens to v7 values. Keep semantic uncertainty expressed in text/structure rather than a branded amber dependency.

- [ ] **Step 4: Run focused test and commit**

Run: `node --test test/terminal-everywhere-v7.test.mjs`

Expected: PASS.

Commit with message `docs: make terminal frame canonical PARA11AX identity`.

---

### Task 6: Full verification, PR, merge and production acceptance

**Files:**
- No new production files unless verification reveals a scoped defect.

**Interfaces:**
- Consumes: all prior task commits.
- Produces: verified PR and exact-SHA production acceptance.

- [ ] **Step 1: Run full repository tests through the existing GitHub Tooling Smoke workflow**

Open a PR from `feat/terminal-everywhere-v7` to protected `main` and wait for Tooling Smoke and CodeQL on the exact head SHA.

Expected: Tooling Smoke SUCCESS and CodeQL SUCCESS.

- [ ] **Step 2: Review changed-file scope**

Confirm changes are limited to presentation assets/docs/tests and that API/provider/auth/session/renderer/gateway source files are untouched.

- [ ] **Step 3: Merge by squash using the verified head SHA**

Expected: protected `main` advances to one merge SHA.

- [ ] **Step 4: Verify protected-main status and Vercel deployment**

Confirm Tooling Smoke/Vercel success on the exact merge SHA and Vercel production state `READY` with matching `githubCommitSha`.

- [ ] **Step 5: Fetch canonical production surfaces**

Verify HTTP 200 for:

```text
https://para11ax.vercel.app/
https://para11ax.vercel.app/app/
https://para11ax.vercel.app/app/analyst-deck.css
https://para11ax.vercel.app/app/analyst-deck.js
```

Confirm landing contains the v7 terminal hero/motion marker and `/app` contains the canonical terminal-first adapter/palette.

- [ ] **Step 6: Final report**

Report exact PR number, verified head SHA, merge SHA, Tooling Smoke/CodeQL status, Vercel deployment ID/state and canonical URLs. Do not claim completion before these checks are fresh and successful.

---

<p align="center"><sub>PΛRΛ11ΛX // PER ASPERA AD ASTRA</sub></p>
