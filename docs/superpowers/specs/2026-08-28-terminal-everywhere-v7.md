# PARA11AX Terminal Everywhere v7 — Design Specification

## Purpose

Make every public PARA11AX surface visibly belong to the same terminal system shown in the approved mobile reference and generated terminal mockup. The landing page, authenticated analyst Web UI, GitHub README hero, brand documentation, and documentation diagrams must share the same phosphor-black terminal language while preserving all gateway/auth/evidence behavior.

## Canonical terminal language

The canonical composition is a bounded terminal frame, not a dashboard. It uses a black/near-black canvas, phosphor-green type and borders, signal-white for primary copy, muted green-gray for secondary copy, and sparse red only for anomalies/errors/scanner events.

Canonical palette:

- `#020403` terminal background.
- `#39FF14` phosphor identity, active state, cursor, status and primary terminal rails.
- `#F7FFF6` primary readable copy.
- `#8DA391` secondary copy and passive state.
- `#FF2438` anomaly/error/scanner only.

Legacy cyan, amber and alternate greens must not appear in active presentation assets. Banned active literals include `#00E5FF`, `#F6C945`, `#39FF88`, `#00FFFF`, `#00E5FF`, `#FF1E2D`, and `#FF4050`.

## Landing page

The landing page becomes a large terminal environment rather than a cyberpunk marketing card grid.

Required hierarchy:

1. One compact terminal status header: `PARA11AX`, `LINK: UP`, `AUTH: UP`, `SYS: NOMINAL`, version, operational indicator, and `ENTER TERMINAL`.
2. Hero rendered as terminal/ASCII identity with the core doctrine: `PROVENANCE-FIRST CTI PLATFORM`, `EVIDENCE FIRST.`, `BOUNDED ALWAYS.`, `OPERATIONAL WHEN SUPPORTED.`.
3. Dense but readable Matrix rain behind the terminal plane. Green dominates; red remains sparse anomaly motion only.
4. A terminal-styled system overview rail for source count, evidence schema/read-only/fixed-egress facts and production state.
5. Capability and analyst-terminal panes that look like shell sessions rather than rounded SaaS cards. The analyst pane must visibly use `user@para11ax:~$` and include `whoami`, `mission`, and a blinking cursor.
6. Integration/source summary rendered as terminal rows/columns, not branded vendor-logo marketing tiles.
7. Terminal footer with provenance/read-only/fixed-egress doctrine and production URL.

Animation is visual-only: Matrix fall, scanner sweep, cursor blink, sequential terminal-line reveal, small status pulse, low-amplitude CRT/glitch cues and viewport-reveal motion. There is no audio on the landing page.

All animation must stop or become static under `prefers-reduced-motion: reduce`.

## Authenticated Web UI

The authenticated `/app` remains a real terminal surface. Existing shell/auth/API/evidence semantics stay unchanged.

Required visual behavior:

- Preserve native shell flow: status line → scrollback → prompt.
- Primary prompt remains `user@para11ax: ~` in the shell adapter.
- Increase resemblance to the approved reference with a thin phosphor terminal frame, compact header, clear operational indicator, large scrollback, phosphor prompt and cursor-like focus cue.
- Results render as transcript sections and dotted terminal separators; no dashboard cards or side rails.
- Existing visual event classes may trigger short scanner/glitch/pulse cues, but must not hide content or alter data.
- Matrix rain remains edge-biased/background-only and never competes with scrollback.
- No new sound system is added. Existing app audio behavior is not expanded and no landing-page audio is introduced.
- Mobile is first-class at 360–430px: single terminal column, full-width scrollback, thumb-safe input, raw JSON horizontal scroll, and no oversized labels.

## GitHub README

GitHub cannot use the landing runtime, so the README uses terminal-native static/animated SVG assets and markdown structure.

Required changes:

- Replace the current sentinel-led hero with a terminal-first README hero matching the approved mockup: top terminal status line, PARA11AX terminal identity, source/evidence/read-only facts, and analyst prompt excerpt.
- Keep desktop and mobile hero variants.
- Use terminal separators and concise code-fence blocks to make major sections feel like shell output while preserving GitHub readability.
- Keep Tooling Smoke and CodeQL badges and all technical claims/links.
- The README must not claim runtime behavior that is not verified.

## Documentation and brand assets

`docs/BRAND.md` becomes the canonical terminal design system. It must explicitly state that the terminal frame and prompt are primary identity elements, with sentinel geometry demoted to optional secondary/emblem use.

Architecture and semantic-firewall diagrams should use the same black/phosphor/white/red palette, square/terminal framing, monospaced labels and terminal-line connectors. They remain technically accurate and readable without animation.

## Motion and visual cues

Maximum visual cue does not mean flashing. Canonical cues:

- Cursor blink: 0.8–1.0 s cycle.
- Scanner sweep: approximately 1.8 s cycle.
- Matrix streams: multi-depth 2.8–9 s cycles depending on layer.
- Status LED/pulse: subtle 1.4–2.4 s brightness change.
- Terminal line reveal: 25–90 ms stagger per line depending on section.
- Glitch cue: <= 400 ms, low displacement, event-triggered only.
- No strobing, no high-frequency full-screen flashes.
- Reduced-motion disables all nonessential movement and preserves static terminal hierarchy.

## Audio

No new sound is required. The landing page and documentation remain silent. Existing `/app` synthesized audio code is not expanded by this project.

## Security and behavior invariants

This is a presentation-only program. It must not change:

- memory-only bearer token handling;
- provider selection restrictions;
- gateway API routes or egress policy;
- evidence/correlation/relationship/coverage/raw semantics;
- renderer safe-DOM constraints;
- Vercel `/app/app.js` rewrite;
- boot state non-persistence;
- exact 39-line Unicode Pepe payload;
- no external runtime assets requirement.

## Validation

Add regression tests that verify:

- landing terminal structure and canonical prompt text;
- landing visual-motion hooks plus reduced-motion handling;
- no banned legacy palette literals in active presentation files;
- README terminal hero assets and terminal-oriented copy;
- brand documentation declares terminal-first identity and no audio requirement;
- `/app` still uses native shell flow and does not recreate dashboard wrappers;
- mobile terminal contracts remain present;
- existing full Tooling Smoke and CodeQL gates stay green.
