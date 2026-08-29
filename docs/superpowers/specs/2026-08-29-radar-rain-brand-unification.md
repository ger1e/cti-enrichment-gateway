# Radar, Rain, and Brand Unification Design

## Goal

Unify the landing page and analyst web UI around one compact radar + PARA11AX lockup, make the landing radar reliably animate without runtime DOM construction, and make landing rain follow the staggered native SVG motion used by the `ger1e/ger1e` README banner while retaining PARA11AX phosphor/red colors.

## Requirements

- The top-left brand on `/` and `/app/` resolves to the exact same shared asset.
- The shared asset is a small radar + `PARA11AX` lockup, not the legacy sentinel helmet.
- Radar sweep motion is self-contained SVG `<animateTransform>` and does not depend on JavaScript-built sweep layers.
- Landing rain uses staggered native SVG falling columns modeled on the `ger1e/ger1e` profile banner: repeated vertical glyph columns, varied 16–23 second durations, varied starting offsets, and continuous translate animation.
- Landing rain keeps PARA11AX colors (`#39FF14` primary and restrained `#FF2438` anomaly accents).
- Reduced-motion users receive static radar/rain rather than hidden content.
- The change is visual only; it adds no network, storage, audio, authentication, or enrichment behavior.

## Architecture

`assets/brand/para11ax-radar-lockup.svg` is the canonical compact brand. `brand-unification.js` and `brand-unification.css` apply that same asset to the existing landing and analyst-UI brand hooks, including dynamically created shell logos. `assets/brand/para11ax-radar.svg` and `assets/brand/para11ax-rain.svg` are mounted by `landing-radar-motion.css`, so hero radar and rain render independently of JavaScript DOM construction. The SVG assets own their motion and reduced-motion fallbacks.

## Verification

Automated tests assert shared-asset parity, native radar motion, native rain motion, reduced-motion fallbacks, absence of old runtime radar/rain construction, and visual-only runtime behavior. Existing platform tests remain green.
