# PARA11AX Brand System

> **PARA11AX // PROVENANCE-FIRST CTI TERMINAL**  
> **Intelligence. Enriched. Operational.**

PARA11AX uses one terminal-first identity across the landing page, analyst Web UI, GitHub README, documentation diagrams, package/CLI references and deployment surfaces.

## Primary identity

The **terminal frame** is the primary identity element. The product should read first as a bounded phosphor terminal, not as a dashboard, SaaS card system, poster, or illustration-led interface.

The **terminal prompt** is the second primary identity element:

```text
analyst@para11ax:~$ whoami
Threat Hunter
analyst@para11ax:~$ _
```

The terminal frame and terminal prompt must be visible whenever a surface has enough space. Sentinel/helmet geometry is optional secondary emblem use only. It may appear as a compact mark where helpful, but it does not own the page hierarchy.

## Canonical visual system

The terminal language combines five rules:

1. **Void terminal plane** — `#020403` owns the canvas.
2. **Phosphor signal** — `#39FF14` owns identity, prompts, cursor, active rails, status and primary terminal borders.
3. **Signal white** — `#F7FFF6` owns primary readable content.
4. **Muted terminal gray-green** — `#8DA391` owns passive state and secondary copy.
5. **Sparse anomaly red** — `#FF2438` is reserved for scanner heads, failures, contradictions and deliberate anomaly cues.

No legacy cyan, amber or alternate green branding is active in the v7 system.

| Token | Hex | Role |
| --- | --- | --- |
| `terminal-bg` | `#020403` | primary background |
| `terminal-phosphor` | `#39FF14` | identity, prompt, cursor, active state |
| `terminal-text` | `#F7FFF6` | primary content |
| `terminal-muted` | `#8DA391` | passive/secondary content |
| `terminal-alert` | `#FF2438` | anomaly, error, contradiction, scanner |

## Canonical copy

Use these phrases consistently:

```text
PROVENANCE-FIRST CTI PLATFORM
EVIDENCE FIRST.
BOUNDED ALWAYS.
OPERATIONAL WHEN SUPPORTED.
OBSERVED ≠ INFERRED ≠ CONTEXTUAL
ABSENCE ≠ BENIGN
IMPLEMENTED ≠ CONFIGURED ≠ PRODUCTION-VERIFIED
```

Primary product identifiers:

```text
repository: para11ax
package: para11ax
CLI: para11ax
gateway bearer: PARA11AX_TOKEN
API: /api/para11ax/*
production: https://para11ax.vercel.app
analyst UI: https://para11ax.vercel.app/app/
```

## Landing page

The landing page is one large terminal environment.

Required composition:

- compact terminal status line with product, link/auth/system state and terminal entry;
- large PARA11AX terminal/ASCII identity;
- provenance-first doctrine;
- terminal-style system overview;
- capability transcript;
- visible analyst shell example using `analyst@para11ax:~$`;
- fixed-source summary;
- terminal footer with read-only/fixed-egress doctrine.

Do not use rounded marketing cards as the primary hierarchy. Do not make the sentinel illustration the hero. Do not place decorative motion over readable terminal content.

## Analyst Web UI

The `/app` surface is a native shell plane:

```text
status line
────────────────────────────────
scrollback / evidence transcript
────────────────────────────────
analyst@para11ax:~$
```

The authenticated shell keeps status → scrollback → prompt as its DOM and visual hierarchy. Result views remain transcript sections with dotted separators. No dashboard sidebars, view rails, action rails, floating cards, or duplicated command launchers.

Mobile preserves the same hierarchy in one column. Input text stays large enough to avoid browser zoom, raw JSON remains horizontally scrollable, and decorative Matrix content is edge-biased/reduced.

## Motion system

Maximum visual cue means frequent but bounded terminal motion, not flashing.

Canonical motion:

- cursor blink: `0.8–1.0 s` cycle;
- scanner sweep: approximately `1.8 s`;
- Matrix streams: `2.8–9 s` multi-depth cycles;
- status pulse: `1.4–2.4 s` brightness change;
- terminal-line reveal: `25–90 ms` stagger depending on section;
- event glitch: maximum `400 ms`, low displacement, event-triggered only.

Allowed cue types:

- blinking block/native command caret;
- red scanner line;
- low-opacity CRT scanlines;
- phosphor status LED pulse;
- short channel-split/glitch on result/error/contradiction events;
- sequential terminal output reveal;
- background Matrix fall.

Never use high-frequency full-screen flashes, destructive layout shifts, or motion that hides evidence.

`prefers-reduced-motion: reduce` disables nonessential movement and preserves the same static hierarchy.

## Pointer system

Browser-owned PARA11AX surfaces use the local `assets/brand/para11ax-cursor.svg` pointer through `/site-cursor.css`. Interactive chrome keeps the branded pointer; terminal output, code, form text and selectable documentation retain native text-selection semantics. The cursor layer must not load remote assets.

GitHub-hosted README and Markdown pages cannot override github.com browser cursor policy; they express the same identity through the terminal hero assets instead.

## Audio

**No new audio** is part of the canonical landing/README/documentation identity.

Landing pages, README assets and documentation remain silent. Existing `/app` synthesized audio behavior is independent runtime behavior and must not be expanded by visual-brand work.

## README and documentation

The GitHub README uses one normalized 720 px SVG family modeled on the GER1E profile README geometry while retaining the PARA11AX terminal palette and identity:

- `assets/brand/para11ax-readme-hero-v8.svg` — `720 × 360` hero;
- `assets/brand/para11ax-readme-architecture-v4.svg` — `720 × 760` request-path panel;
- `assets/brand/para11ax-readme-semantics-v4.svg` — `720 × 820` semantic-firewall panel.

README SVGs use 12 px rounded outer framing, the canonical mono stack, black/phosphor/white/red semantics, and self-contained vector content with no raster/mobile fallback or remote asset dependency. The README follows a compact numbered `01 // …` through `07 // …` information hierarchy; technical prose remains searchable and exact.

Architecture and semantic panels may be taller than the hero, but all remain 720 px wide and use the same framing, typography and semantic boundaries. Do not use semantic color as a substitute for exact labels, and do not add a second decorative radar outside the hero.

## Matrix rain

Matrix rain is atmosphere, never content hierarchy.

- green streams dominate;
- red anomaly streams are sparse;
- desktop may be dense and multi-depth;
- mobile is edge-biased and lower opacity;
- reduced motion freezes/removes fall animation;
- no Matrix stream may interfere with prompt, evidence or navigation legibility.

## Typography

No bundled font files are required.

Canonical stack:

```text
ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
```

Wide tracking is allowed for PARA11AX/status labels. Long technical content uses normal mono spacing for readability.

## Canonical quotation

> “You’ve got to follow the evidence… That doesn’t make it fact.”  
> — **John Kiriakou**

Use the quotation as a secondary evidence-discipline cue, not as the hero. Preserve the ellipsis and attribution. Do not imply endorsement.

Source context: John Kiriakou, *The Joe Rogan Experience* #2392, approximately 01:32:47–01:33:55.

## Voice

PARA11AX copy should be:

- short;
- evidence-first;
- explicit about uncertainty;
- technically precise;
- free of synthetic “AI threat score” language;
- free of claims that absence means benign;
- free of attribution by infrastructure proximity alone.

## Do / do not

| Do | Do not |
| --- | --- |
| make the terminal frame the visual anchor | turn pages into generic SaaS dashboards |
| keep `analyst@para11ax:~$` visible where useful | invent unrelated prompt identities |
| use phosphor for active structure | reintroduce cyan/amber brand rails |
| use red only for sparse anomaly/error cues | make red a universal maliciousness verdict |
| animate cursor/scanner/status subtly | flash full-screen or obscure evidence |
| preserve black negative space | fill every surface with glow |
| keep mobile single-column and thumb-safe | shrink desktop cards into a phone layout |
| retain exact technical caveats | brand away uncertainty |

## Identity boundary

The canonical public identity is intentionally singular:

- repository: `para11ax`
- package: `para11ax`
- CLI: `para11ax`
- bearer: `PARA11AX_TOKEN`
- API paths: `/api/para11ax/*`
- production URL: `https://para11ax.vercel.app`
- analyst UI: `https://para11ax.vercel.app/app/`
- Maltego artifact: `para11ax-local.mtz`

Legacy aliases and legacy visual palettes are not part of the supported contract.
