<!--
Purpose: Visual identity and design system specification for Meechie's Coloring Book.
Why: Single authoritative reference so all contributors implement the same look and feel.
Info flow: Tokens defined here -> implemented in components -> verified by visual review.
-->
---
version: alpha
name: Meechie's Playful Canvas
description: A warm, inviting design system for AI-powered coloring book generation
colors:
  primary: "#c9a227"
  accent: "#f0c44a"
  highlight: "#e8006a"
  background: "#07070f"
  surface: "#0d0a14"
  text: "rgba(253, 246, 227, 0.9)"
  text-muted: "rgba(253, 246, 227, 0.45)"
typography:
  h1:
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: 48px
    fontWeight: 700
    fontStyle: italic
    lineHeight: 1.2
    letterSpacing: -0.02em
  h2:
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: 36px
    fontWeight: 700
    fontStyle: italic
    lineHeight: 1.3
  body-lg:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Barlow Condensed', 'Avenir Next Condensed', sans-serif"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.4
    textTransform: uppercase
    letterSpacing: 0.1em
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
  container-padding: 24px
max-width: 1240px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "transparent"
    borderColor: "{colors.primary}"
    borderWidth: "1px"
    textColor: "{colors.accent}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-tertiary:
    backgroundColor: "transparent"
    borderColor: "{colors.highlight}"
    borderWidth: "1px"
    textColor: "{colors.highlight}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
    boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
  input:
    backgroundColor: "rgba(255,255,255,0.04)"
    borderColor: "rgba(201, 162, 39, 0.25)"
    borderWidth: "1px"
    borderStyle: "solid"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    focusBorderColor: "{colors.primary}"
    focusBorderWidth: "1px"
---

## Overview

Meechie's Coloring Book is a joyful, imaginative space where AI creativity meets childhood wonder. The design celebrates vibrant storytelling, approachable technology, and the magic of turning words into art you can color. The aesthetic is warm, encouraging, and family-friendly—never intimidating. Every interaction feels like an invitation to play.

The target audience is kids and families who want custom coloring experiences. The emotional tone is playful, supportive, and enchanted.

## Colors

The actual implementation uses a dark, theatrical palette accented with gold and fuchsia. These are the production tokens—not aspirational placeholders.

- **Primary (#c9a227):** Warm gold that signals creativity and importance. Used for primary actions, badges, and interactive highlights.
- **Accent (#f0c44a):** Lighter gold for hover states and secondary highlights.
- **Highlight (#e8006a):** Vivid fuchsia for emphasis, gradient overlays, and moments of delight.
- **Background (#07070f):** Near-black base that makes gold and fuchsia pop (the "dark canvas" metaphor).
- **Surface (#0d0a14):** Slightly lighter dark for cards, nav, and elevated surfaces.
- **Text (rgba(253, 246, 227, 0.9)):** Warm cream for body copy—high contrast on dark backgrounds.
- **Text Muted (rgba(253, 246, 227, 0.45)):** Subdued cream for secondary labels and metadata.

## Typography

The app loads three fonts via Google Fonts: **Fraunces** (expressive italic headlines), **Bricolage Grotesque** (friendly body text), and **Barlow Condensed** (compact UI labels and navigation). All three must be present in `+layout.svelte`'s font link.

- **Headlines:** Fraunces italic at bold weights for a playful, editorial feel.
- **Body:** Bricolage Grotesque with generous line height (1.5–1.6) for easy reading.
- **Labels & UI:** Barlow Condensed, uppercase, tight tracking—compact without feeling small.

Note: the `label` token (14px) is sized for compact desktop UI elements with sufficient weight and tracking for legibility. Body and content text on mobile must be at least 16px (`body-md` or larger).

## Layout

Content flows in a single-column layout on mobile with optional multi-column grids on desktop (max 1240px). The 8px spacing scale provides rhythm and breathing room. Generous padding (24px container padding) makes the interface feel open and non-cramped.

## Elevation & Depth

Depth is subtle: soft shadows on cards and inputs create layering against the dark background. Interactive elements stand out through color (gold border/glow) and shadow rather than heavy elevation.

## Shapes

All interactive elements use rounded corners: `{rounded.md}` (8px) on inputs, `{rounded.lg}` (12px) on buttons and cards. Consistency across shapes reinforces the playful aesthetic.

## Components

### Buttons
- **Primary Button**: Gold background, dark text, 12px rounded corners, 12px 24px padding. Used for primary actions ("Generate," "Download").
- **Secondary Button**: Transparent background, 1px gold border, gold text. Same sizing as primary.
- **Tertiary Button**: Transparent background, 1px fuchsia border, fuchsia text. Used for accent/alternative actions.

### Cards
- Dark surface background, 24px padding, 12px rounded corners, subtle shadow (0 2px 8px).
- Used for display of generated coloring pages, story previews, and result containers.

### Inputs
- Translucent dark background, 1px gold-tinted border (rgba(201, 162, 39, 0.25)), 8px rounded corners (`{rounded.md}`), 12px 16px padding.
- Placeholder text in muted cream; focus state adds a thin 1px border in primary gold (`{colors.primary}`).

## Do's and Don'ts

- **Do** use the warm gold sparingly for the most important call-to-action per screen.
- **Don't** combine competing accent colors at the same visual hierarchy level.
- **Do** maintain generous spacing and breathing room—the interface should feel playful, not dense.
- **Don't** use small type for content on mobile; body text should be at least 16px for comfort.
- **Do** celebrate moments with the fuchsia highlight and success states for positive feedback.
- **Don't** use light backgrounds; the dark, canvas-like aesthetic is core to the brand.
