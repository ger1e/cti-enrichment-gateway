### PARA11AX Brand System

> **PARA11AX // CTI Evidence Gateway**  
> **Intelligence. Enriched. Operational.**

PARA11AX is the product and visual identity for the bounded CTI evidence gateway. Repository, package, CLI, web UI, environment, API, deployment, and integration surfaces use one identity.

#### Identity

The system combines four visual ideas:

1. **Sentinel geometry** — a compact gunmetal helmet/visor mark representing guarded observation and disciplined analysis.
2. **Phosphor signal** — `#39FF14` is the primary identity color for the visor, structural rails, active state, and technical emphasis.
3. **Anomaly signal** — red is sparse and event-specific: scanner motion, warning/focal nodes, and deliberate corruption inside Matrix rain.
4. **Evidence discipline** — white and muted neutrals carry most text so semantic color retains meaning instead of becoming decoration.

The result should feel like black-glass intelligence tooling: hostile enough to be memorable, precise enough to be credible, and consistent across landing page, analyst terminal, GitHub, and documentation.

#### Primary lockup

- Product name: **PARA11AX**
- Descriptor: `CTI // EVIDENCE GATEWAY`
- Primary line: `BOUNDED · READ-ONLY · PROVENANCE-FIRST`
- Brand line: `INTELLIGENCE. ENRICHED. OPERATIONAL.`
- Semantic line: `OBSERVED ≠ INFERRED ≠ CONTEXTUAL`

Use [`../assets/brand/para11ax-hero.svg`](../assets/brand/para11ax-hero.svg) for the repository hero, [`../assets/brand/para11ax-lockup.svg`](../assets/brand/para11ax-lockup.svg) for horizontal surfaces, [`../assets/brand/para11ax-mark.svg`](../assets/brand/para11ax-mark.svg) for compact/icon surfaces, and [`../app/para11ax-mark.svg`](../app/para11ax-mark.svg) for the analyst header.

#### Canonical quotation

> “You’ve got to follow the evidence… That doesn’t make it fact.”  
> — **John Kiriakou**

This is the canonical philosophical close for PARA11AX. It captures the core operating rule: evidence is collected, preserved, correlated, and challenged; it is not automatically promoted to fact.

Usage rules:

- preserve the ellipsis — it marks omitted intervening remarks rather than pretending the excerpt was one uninterrupted sentence;
- preserve the attribution;
- use the quotation as a design/philosophy cue, not as an endorsement claim;
- `evidence` may use phosphor emphasis;
- `fact` stays signal-white or neutral text — never promote it through status color;
- keep the quotation secondary to the product name and descriptor.

Source context: John Kiriakou, *The Joe Rogan Experience* #2392, approximately 01:32:47–01:33:55. The two quoted clauses occur in the same discussion with intervening remarks omitted by the ellipsis.

#### Color system

| Token | Hex | Role |
| --- | --- | --- |
| `void` | `#020403` | primary background |
| `panel` | `#061008` | black-green secondary surface |
| `gunmetal` | `#202922` | sentinel armor / neutral structure |
| `phosphor` | `#39FF14` | primary identity, visor, active rails, technical emphasis |
| `phosphor-soft` | `#80FF6B` | secondary green text / glow |
| `scanner-red` | `#FF2438` | anomaly, scanner head, warning/focal signal |
| `signal-white` | `#F7FFF6` | primary text |
| `muted` | `#8CA08F` | secondary copy |
| `caution-amber` | `#F6C945` | caveats, partial state, upstream uncertainty |

##### Color discipline

- Phosphor owns **identity, active structure, and the sentinel visor**.
- Red owns **anomaly and motion**, and stays sparse.
- White owns **primary copy and legibility**.
- Gunmetal owns **armor and neutral framing**.
- Amber owns **uncertainty and partial coverage**.
- Cyan is not part of the active PARA11AX identity.

#### Matrix rain

Matrix rain is an environmental layer, not the content hierarchy.

- Primary stream color: phosphor green.
- Red anomaly streams: sparse; never equal to green density.
- Desktop: dense, multi-depth, fast enough to feel alive without obscuring the terminal.
- Mobile: edge-biased and lower-opacity so input/output remains readable.
- Reduced motion: freeze or remove falling motion while preserving static identity.

#### Scanner motion

The scanner remains a red back-and-forth signal because it represents active observation, not a verdict.

- Direction: left → right → left.
- Canonical cycle: **1.8 seconds**.
- Motion: smooth ease-in/ease-out.
- No flashing or strobing.
- Static state must remain legible.

#### Sentinel geometry

The primary emblem is an original angular sentinel/helmet with a phosphor visor.

- Gunmetal shell and dark faceplate.
- Phosphor visor is the strongest colored element.
- A tiny red anomaly node may appear as a secondary cue.
- Use the same silhouette across mark, lockup, README hero, and analyst header.
- Avoid unrelated skulls, generic padlocks, weapon silhouettes, or copied entertainment/IP motifs.

#### Typography

No bundled/custom font files are required.

Preferred stack:

```text
ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
```

Use wide tracking for `PARA11AX` and compact uppercase technical labels for descriptors/status text. The `11` may be phosphor green while the remaining wordmark stays signal-white.

#### Voice

PARA11AX copy should be:

- short;
- evidence-first;
- explicit about uncertainty;
- technically precise;
- free of synthetic “AI threat score” language;
- free of claims that absence means benign;
- free of attribution by infrastructure proximity alone.

Canonical phrases:

```text
INTELLIGENCE. ENRICHED. OPERATIONAL.
BOUNDED · READ-ONLY · PROVENANCE-FIRST
OBSERVED ≠ INFERRED ≠ CONTEXTUAL
ABSENCE ≠ BENIGN
IMPLEMENTED ≠ CONFIGURED ≠ PRODUCTION-VERIFIED
```

#### Do / do not

| Do | Do not |
| --- | --- |
| use one phosphor-led identity everywhere | keep legacy cyan branding active beside the new design |
| use red as a sparse anomaly/scanner cue | turn red into a universal maliciousness verdict |
| preserve black negative space | fill every surface with glow |
| keep the sentinel readable at small sizes | over-detail the header mark |
| reduce rain behind mobile content | let decorative motion compromise terminal readability |
| retain exact technical caveats | brand away uncertainty |
| keep canonical PARA11AX identifiers aligned | reintroduce legacy aliases |

#### Canonical identity boundary

The full identity migration is intentionally breaking. Canonical surfaces are:

- repository: `para11ax`
- package: `para11ax`
- CLI: `para11ax`
- gateway bearer: `PARA11AX_TOKEN`
- API paths: `/api/para11ax/*`
- production URL: `https://para11ax.vercel.app`
- analyst UI: `https://para11ax.vercel.app/app/`
- Maltego artifact: `para11ax-local.mtz`

Legacy aliases and the old cyan visual identity are not part of the supported contract.
