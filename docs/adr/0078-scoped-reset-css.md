# ADR-0078: Scoped Reset CSS for bz UI

## Status

Accepted

## Context

Obsidian injects global styles on base HTML elements (`button`, `input`, `textarea`, `a`, scrollbars, font sizes). These styles are theme-dependent and conflict with bz's custom UI. Current workarounds are scattered: `core/styles.css` overrides specific selectors with `!important` (e.g., `.bz-win-head button`), and individual domain styles repeat boilerplate resets.

The password vault redesign (v1-vault, Route C) requires pixel-faithful reproduction of a standalone prototype inside Obsidian. Without a clean baseline, every new UI element must fight Obsidian's defaults.

## Decision

Add `src/core/reset.css` — a scoped normalization layer loaded before all other bz styles. All rules are scoped under `.bz-*` container selectors (e.g., `.bz-vault`, `.bz-overlay-popup`) to avoid affecting Obsidian's own UI.

### What it resets (scoped)

1. **Box model**: `box-sizing: border-box` on all descendants
2. **Button/input/textarea normalization**: clear Obsidian's padding, border, background, color, font, shadow; each component re-establishes its own styles
3. **Scrollbar hiding**: `scrollbar-width: none` + webkit zero-width
4. **Font baseline**: `--font-interface`, 14px, line-height 1.5, `--text-normal`
5. **Link reset**: `color: inherit; text-decoration: none`
6. **Image/SVG inline alignment**
7. **Focus-visible**: reuse existing `outline: 2px solid var(--interactive-accent)` pattern

### What it does NOT do

- No global `* { margin: 0; padding: 0 }` — would break Obsidian
- No color hardcoding — all values from Obsidian CSS variables (per ui-design-manual.md §2)
- No component-level styles — those stay in domain `styles.css`
- No Obsidian variable overrides — we inherit, not replace

### Loading order

```
Obsidian theme CSS
  ↓
src/core/reset.css       ← NEW: normalize within bz containers
  ↓
src/core/styles.css       ← shared components
  ↓
src/<domain>/styles.css   ← domain-specific
```

Build script (`scripts/build-css.mjs`) must prepend `reset.css` in the aggregation.

## Consequences

- New UI starts from a clean, predictable baseline inside bz containers
- Existing UI benefits incrementally — domains can adopt the scoped resets by adding the container class
- No risk of breaking Obsidian's own UI or other plugins
- The reset is ~40 lines, trivial to maintain
