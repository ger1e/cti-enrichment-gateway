# Radar, Rain, and Brand Unification Design

## Goal

Unify the landing page and analyst web UI around one compact radar + PARA11AX lockup, make the landing radar reliably animate without runtime DOM injection, and make landing rain follow the staggered native SVG motion used by the `ger1e/ger1e` README banner while retaining PARA11AX phosphor/red colors.

## Requirements

- The top-left brand on `/` and `/app/` must use the exact same shared asset.
- The shared asset must be a small radar + `PARA11AX` lockup, not the existing sentinel helmet.
- The radar sweep must be self-contained SVG motion using `<animateTransform>` so it does not depend on JavaScript enhancement.
- The landing hero radar must use the same self-contained native SVG animation approach.
- Landing rain must use staggered native SVG falling-column animation modeled on the `ger1e/ger1e` profile banner: repeated vertical glyph columns, varied durations, varied starting offsets, and continuous translate animation.
- Landing rain keeps PARA11AX colors (`#39FF14` primary and restrained `#FF2438` anomaly accents); it does not import the profile banner cyan/cobalt palette.
- Reduced-motion users receive static radar/rain rather than hidden content.
- The change is visual only; it must not add network, storage, audio, authentication, or enrichment behavior.

## Architecture

Create one canonical `assets/brand/para11ax-radar-lockup.svg` and reference it from both HTML surfaces. Create one reusable `assets/brand/para11ax-radar.svg` for the landing hero. Replace the CSS-positioned landing rain spans with a fixed SVG rain layer whose SMIL `animateTransform` elements reproduce the staggered README motion pattern. Remove the landing JavaScript responsibility for constructing radar layers so animation is present as soon as SVG is rendered.

## Verification

Automated tests must assert shared-asset parity, native radar motion, native rain motion, reduced-motion CSS fallback, and absence of the old runtime radar injection contract. Existing brand and landing tests must remain green.