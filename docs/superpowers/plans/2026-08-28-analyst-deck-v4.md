# PARA11AX Analyst Deck v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/app` as a polished tactical CTI analyst workspace without changing gateway, auth, session, command, evidence, export, or API semantics.

**Architecture:** Keep the existing terminal controller and bounded shell behavior intact. Add a focused presentation adapter (`app/analyst-deck.js`) that restructures the mounted `.unix-shell` into a command deck, status rail, view rail, and workspace viewport, plus a dedicated stylesheet (`app/analyst-deck.css`) that supersedes the old terminal-first layout. Compact the boot presentation through CSS while retaining its existing DOM/runtime payloads.

**Tech Stack:** Static HTML/CSS, browser-native ES modules, Node.js 24 test runner, existing PARA11AX shell/renderers.

**Spec:** `docs/superpowers/specs/2026-08-28-analyst-deck-v4.md`

## Global Constraints

- Preserve `shell.js`, `api-client.js`, `session.js`, renderer semantics, endpoint behavior, and memory-only bearer handling.
- No third-party runtime scripts, styles, fonts, media, or dependencies.
- Active palette: `#39FF14`, `#020403`, gunmetal/near-black, white, restrained `#FF2438`.
- Preserve exact hidden Pepe payload and current boot/audio hooks for compatibility.
- Preserve Overview, Evidence, Correlation, Relationships, Coverage, and Raw views.
- Mobile 360–430 px must be dedicated, thumb-safe, and free from horizontal page overflow.
- Preserve `prefers-reduced-motion` behavior.

---

### Task 1: Lock the analyst-deck contract

**Files:**
- Create: `test/analyst-deck-v4.test.mjs`

**Interfaces:**
- Consumes: current `/app` assets and shell modules.
- Produces: regression contract for new presentation markers and preserved security/behavior boundaries.

- [ ] **Step 1: Write failing tests** requiring `app/analyst-deck.js`, `app/analyst-deck.css`, `analyst-deck` root state, `investigation-launcher`, `analyst-view-rail`, `analyst-workspace`, `analyst-status-rail`, compact boot rules, mobile 360–430 behavior, reduced motion, and no legacy cyan in the new stylesheet.
- [ ] **Step 2: Run the full Tooling Smoke workflow on the test-only branch head.**
  Expected: FAIL because the new presentation assets/markers do not exist.
- [ ] **Step 3: Preserve the red run URL/SHA in the PR history before implementation.**

### Task 2: Build the presentation adapter

**Files:**
- Create: `app/analyst-deck.js`
- Modify: `app/terminal-main.js`

**Interfaces:**
- Consumes: mounted `.unix-shell`, `.shell-status`, `.shell-scrollback`, `.shell-prompt`, `.shell-footer`, existing command input `#para11ax-command-input`.
- Produces: DOM wrappers/classes only; emits existing shell commands through the existing input/form, never calls gateway APIs directly.

- [ ] **Step 1: Observe `#workspace` for the mounted `.unix-shell`.**
- [ ] **Step 2: Wrap existing shell nodes into `.analyst-deck`, `.analyst-command-deck`, `.investigation-launcher`, `.analyst-workspace`, `.analyst-status-rail`, and `.analyst-view-rail` without cloning or replacing the command input or scrollback.**
- [ ] **Step 3: Add view buttons that submit existing bounded commands (`overview`, `evidence`, `correlation`, `relationships`, `coverage`, `raw`) by setting the current shell input and dispatching its form submit event.**
- [ ] **Step 4: Add bounded quick actions (`help`, `meta`, `status`, `json`, `stix`, `clear`) through the same command path.**
- [ ] **Step 5: Import the adapter from `terminal-main.js` after the existing shell modules.**

### Task 3: Replace terminal-first styling with analyst workspace styling

**Files:**
- Create: `app/analyst-deck.css`
- Modify: `app/analyst-deck.js` to load the stylesheet once.

**Interfaces:**
- Consumes: DOM classes from Task 2 and existing semantic classes rendered by `renderers.js`.
- Produces: desktop and mobile visual system only.

- [ ] **Step 1: Define black/gunmetal/phosphor/red design tokens and opaque data surfaces.**
- [ ] **Step 2: Style the top command deck with sentinel logo, session state, clock, and controls.**
- [ ] **Step 3: Style the investigation launcher as the primary observable/command surface.**
- [ ] **Step 4: Style result sections (`.shell-result-*`, evidence/correlation/coverage/raw classes) as readable analyst workspaces instead of transcript dumps.**
- [ ] **Step 5: Move Matrix/HUD layers behind the deck using z-index/opacity rules; keep dense rain at edges.**
- [ ] **Step 6: Add mobile ≤430 px single-column layout, sticky horizontal view rail, 44 px controls, raw horizontal scrolling, and no fixed HUD overlap.**
- [ ] **Step 7: Add reduced-motion rules for all new animations.**

### Task 4: Compact the boot experience without breaking compatibility

**Files:**
- Modify: `app/analyst-deck.css`

**Interfaces:**
- Consumes: existing `.boot-panel`, `.boot-log`, `.boot-pepe`, `.boot-status`, `.boot-controls`, `.boot-globe`.
- Produces: compact visible cold-start console; underlying boot DOM remains unchanged.

- [ ] **Step 1: Reduce boot panel footprint and make sentinel/globe/status the visible hierarchy.**
- [ ] **Step 2: Visually suppress the verbose boot wall and Pepe payload while keeping them in the DOM and scrollable/accessible for compatibility.**
- [ ] **Step 3: Keep Initialize/Skip controls prominent and mobile-safe.**
- [ ] **Step 4: Preserve boot/reduced-motion compatibility tests.**

### Task 5: Green verification and merge

**Files:**
- Test: entire repository.

**Interfaces:**
- Produces: verified PR merged to protected `main`, exact-sha Vercel deployment.

- [ ] **Step 1: Run Tooling Smoke on the implementation head.** Expected: success.
- [ ] **Step 2: Run CodeQL on the same head.** Expected: success.
- [ ] **Step 3: Inspect the PR changed-file list to confirm no gateway/auth/session/provider files changed.**
- [ ] **Step 4: Merge only after both gates pass.**
- [ ] **Step 5: Verify protected `main` status and Vercel production deployment at the exact merged SHA.**
- [ ] **Step 6: Fetch `/app/`, `/app/analyst-deck.css`, and `/app/analyst-deck.js` from production and confirm HTTP 200 plus the new analyst-deck markers.**
