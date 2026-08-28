### PARA11AX Brand System

> **PARA11AX // CTI Evidence Gateway**
> **Observe · Correlate · Preserve Provenance**

PARA11AX is the product and visual identity for the bounded CTI evidence gateway. Repository, package, CLI, environment, API, deployment, and integration surfaces use the same identity.

#### Identity

The system combines three visual ideas:

1. **PARA11AX geometry** — offset cyan sight-lines converging on a single observation point.
2. **Oscillating scanner** — a red back-and-forth LED sweep representing active observation.
3. **Evidence state** — acid green is reserved for verified/healthy evidence cues rather than decoration.

The result should feel like black-glass intelligence tooling: technical, precise, slightly hostile, but still credible in an enterprise/security context.

#### Primary lockup

- Product name: **PARA11AX**
- Descriptor: `CTI // EVIDENCE GATEWAY`
- Primary line: `BOUNDED · READ-ONLY · PROVENANCE-FIRST`
- Tagline: `OBSERVE · CORRELATE · PRESERVE PROVENANCE`

Use [`../assets/brand/para11ax-hero.svg`](../assets/brand/para11ax-hero.svg) for the repository hero, [`../assets/brand/para11ax-lockup.svg`](../assets/brand/para11ax-lockup.svg) for horizontal surfaces, and [`../assets/brand/para11ax-mark.svg`](../assets/brand/para11ax-mark.svg) for compact/icon surfaces.

#### Canonical quotation

> “You’ve got to follow the evidence… That doesn’t make it fact.”  
> — **John Kiriakou**

This is the canonical philosophical close for PARA11AX. It captures the core operating rule: evidence is collected, preserved, correlated, and challenged; it is not automatically promoted to fact.

Usage rules:

- preserve the ellipsis — it marks omitted intervening remarks rather than pretending the excerpt was one uninterrupted sentence;
- preserve the attribution;
- use the quotation as a design/philosophy cue, not as an endorsement claim;
- `evidence` may use `para11ax-cyan`;
- `fact` stays `signal-white` or neutral text — **never** `evidence-green`, because the quotation explicitly warns against promoting evidence into verified fact;
- keep the quotation secondary to the product name and descriptor.

Source context: John Kiriakou, *The Joe Rogan Experience* #2392, approximately 01:32:47–01:33:55. The two quoted clauses occur in the same discussion with intervening remarks omitted by the ellipsis.

#### Color system

| Token | Hex | Role |
| --- | --- | --- |
| `void` | `#050608` | primary background |
| `panel` | `#0B0F12` | black-glass secondary surface |
| `scanner-red` | `#FF1E2D` | scanner track / observation motion |
| `hot-red` | `#FF4050` | scanner head / focal observation point |
| `para11ax-cyan` | `#00E5FF` | geometry, boundaries, technical structure |
| `evidence-green` | `#39FF88` | verified / healthy / evidence state only |
| `caution-amber` | `#F6C945` | caveats, partial state, upstream uncertainty |
| `signal-white` | `#F3F7FA` | primary text |
| `muted` | `#7D8B95` | secondary copy |

##### Color discipline

- Red owns **motion and observation**.
- Cyan owns **structure and geometry**.
- Green owns **verified evidence/status**.
- Amber owns **uncertainty and partial coverage**.
- Do not turn all four into equal decorative neon. The hierarchy is the design.

#### Scanner motion

The canonical scanner is a horizontal red LED bar with one bright head and a short luminous tail.

- Direction: left → right → left.
- Canonical cycle: **1.8 seconds**.
- Motion: smooth ease-in/ease-out.
- Glow: visible but not soft enough to blur the LED head.
- The static frame must remain legible when animation is unsupported.
- No flashing, strobing, or rapid opacity pulses.

The repository hero uses declarative SVG animation only; it contains no script or external resources.

#### Geometry

The PARA11AX mark is two offset angular sight-lines converging on a red observation node.

- Left cyan geometry is dominant.
- Right geometry is intentionally lower-opacity to create the para11ax offset.
- The center node is red, not green: it represents an **observation**, not a verdict.
- Never add skulls, crosshairs, shields, locks, or generic “hacker” glyphs to the primary mark.

#### Typography

No bundled/custom font files are required.

Preferred stack:

```text
ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
```

Use wide tracking for `PARA11AX` and compact uppercase technical labels for descriptors/status text.

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
BOUNDED · READ-ONLY · PROVENANCE-FIRST
OBSERVED ≠ INFERRED ≠ CONTEXTUAL
ABSENCE ≠ BENIGN
IMPLEMENTED ≠ CONFIGURED ≠ PRODUCTION-VERIFIED
```

#### Do / do not

| Do | Do not |
| --- | --- |
| use red scanner motion as the memorable cue | use rainbow/RGB neon everywhere |
| preserve black negative space | fill every surface with glow |
| use cyan for trust boundaries and structure | use red as a maliciousness verdict |
| reserve green for verified evidence/status | use green as generic decoration |
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
- Maltego artifact: `para11ax-local.mtz`

Legacy aliases are not part of the supported contract.
