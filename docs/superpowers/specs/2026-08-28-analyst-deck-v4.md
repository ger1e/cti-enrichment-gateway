# PARA11AX Analyst Deck v4 Design

## Goal

Replace the current `/app` terminal-first presentation with a polished tactical CTI analyst workspace while preserving the existing gateway, session, authentication, command, evidence, export, audio, and API behavior.

## Product direction

The analyst UI must feel like the operational continuation of the public PARA11AX landing page rather than a separate retro-terminal experiment.

### Visual hierarchy

- The sentinel/helmet and tactical HUD become the primary identity anchor.
- Phosphor green `#39FF14`, near-black/gunmetal, white, and restrained red `#FF2438` remain the active palette.
- Matrix rain remains dense at the page edges/background, but data surfaces are opaque enough that rain never competes with analyst content.
- Scanner/glitch effects are bounded accents, not continuous distraction.

### Boot/access

- Preserve the current boot engine, audio hooks, exact hidden Pepe payload, initialization/skip actions, volatile bearer handling, and reboot behavior.
- Visually collapse the boot wall into a compact cold-start console: sentinel mark, current boot status, slim progress/activity rail, and controls.
- The verbose boot log and Pepe payload remain in the DOM/runtime for compatibility but are not the dominant visible presentation.
- Access remains a memory-only bearer prompt with no persistence.

### Operational shell

The authenticated shell becomes an analyst deck with these zones:

1. **Top command deck** — PARA11AX sentinel lockup, session/auth/profile state, local clock, sound/disconnect controls.
2. **Observable launcher** — the existing shell prompt remains the command input, but is presented as a primary investigation launcher with quick command affordances.
3. **Source/status rail** — compact operational facts and live state: fixed sources, Evidence v2, fixed egress, read-only, auth/busy/evidence/provider state.
4. **Workspace viewport** — shell transcript and rendered result views occupy the main readable analysis surface.
5. **View rail** — explicit Overview, Evidence, Correlation, Relationships, Coverage, and Raw navigation mapped to the existing bounded `view` commands; no arbitrary provider controls.
6. **Export/action rail** — bounded JSON/STIX/copy/clear actions remain available through the existing shell behavior.

### Result presentation

- Existing renderer output remains semantically unchanged.
- Result sections are styled as analyst workspaces rather than terminal dumps: clear section headings, evidence rows, correlation signals, coverage/failure states, references, and raw JSON.
- `OBSERVED ≠ INFERRED ≠ CONTEXTUAL` remains visually reinforced.
- No universal maliciousness score or new inferred verdict is introduced.

### Mobile

For 360–430 px:

- Single-column analyst deck.
- Compact top bar and sentinel lockup.
- Prompt/launcher remains thumb-safe with at least 44 px controls.
- View rail becomes a horizontally scrollable/sticky command strip.
- Result viewport uses full width; raw JSON can scroll horizontally without page overflow.
- Matrix rain is edge-only and reduced behind active data surfaces.
- No persistent fixed HUD overlaps analyst content.

### Accessibility and motion

- Preserve keyboard command entry and existing ARIA semantics.
- `prefers-reduced-motion: reduce` disables HUD rotation, visor pulse, rain animation, and nonessential scanner/glitch animation.
- Focus states remain high contrast.

## Non-goals

- No gateway/API changes.
- No authentication/session persistence changes.
- No arbitrary provider selection.
- No removal of existing commands, evidence views, exports, boot engine, audio engine, or hidden compatibility payloads.
- No external runtime dependencies, fonts, scripts, or stylesheets.
