<!--
Purpose: Machine-readable design tokens and narrative design system specification for Meechie's Coloring Book.
Why: Provides a single source of truth for visual identity so UI components, generated assets, and tooling
     stay consistent with the brand without relying on scattered magic values in CSS files.
Info flow: This document → component implementations in src/routes/ and src/lib/components/ →
           compiled CSS variables in +layout.svelte → rendered UI.
Note: Tokens reflect the *current* implementation palette (dark theatrical theme with gold/fuchsia accents).
     Typography uses the actual web fonts loaded in +layout.svelte.
-->

---
version: alpha
name: Meechie's Playful Canvas
description: A warm, inviting design system for AI-powered coloring book generation
colors:
  primary: "#c9a227"
  primary-bright: "#f0c44a"
  secondary: "#e8006a"
  secondary-glow: "rgba(232, 0, 106, 0.22)"
  tertiary: "#00c896"
  neutral-dark: "#07070f"
  neutral-surface: "#100f1c"
  neutral-card: "#16142a"
  neutral-cream: "#fdf6e3"
  neutral-lavender: "#b8aacf"
typography:
  h1:
    fontFamily: "'Fraunces', Georgia, 'Times New Roman', serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  h2:
    fontFamily: "'Fraunces', Georgia, 'Times New Roman', serif"
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: "'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: "'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Barlow Condensed', 'Avenir Next Condensed', 'Avenir Next', sans-serif"
    fontSize: 14px
    fontSizeMobile: 16px
    fontWeight: 600
    lineHeight: 1.4
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
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#0d0a14"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-tertiary:
    backgroundColor: "transparent"
    borderColor: "{colors.primary}"
    borderWidth: "1px"
    borderStyle: "solid"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  card:
    backgroundColor: "{colors.neutral-card}"
    rounded: "{rounded.lg}"
    padding: "24px"
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
  input:
    backgroundColor: "{colors.neutral-surface}"
    borderColor: "rgba(201, 162, 39, 0.35)"
    borderWidth: "1px"
    borderStyle: "solid"
    focusBorderColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
---

## Overview

Meechie's Coloring Book is a joyful, imaginative space where AI creativity meets childhood wonder. The design celebrates vibrant storytelling, approachable technology, and the magic of turning words into art you can color. The aesthetic is theatrical and warm—dark backgrounds punctuated by golden light and fuchsia accents, evoking a mystical coloring studio. Every interaction feels like an invitation to play.

The target audience is kids and families who want custom coloring experiences. The emotional tone is playful, supportive, and enchanted.

## Colors

The color palette balances rich dark backgrounds with warm metallic accents and vivid highlights.

- **Primary (#c9a227 / #f0c44a):** Warm gold that signals creativity and magic. Used for primary actions, interactive highlights, and borders.
- **Secondary (#e8006a):** Vibrant fuchsia for accent actions, gradients, and celebratory moments. Creates energy against the dark background.
- **Tertiary (#00c896):** Emerald green for success states and positive feedback.
- **Neutral Dark (#07070f):** Near-black page background — the "studio canvas."
- **Neutral Surface (#100f1c):** Slightly lighter surface for cards and panels.
- **Neutral Card (#16142a):** Card background, slightly lighter than surface.
- **Neutral Cream (#fdf6e3):** Primary text color — warm white for readability on dark backgrounds.
- **Neutral Lavender (#b8aacf):** Muted purple for secondary text and decorative elements.

## Typography

Type hierarchy is clear and expressive. Headlines use the editorial serif `Fraunces` for a hand-crafted feel. Body copy uses `Bricolage Grotesque` for warmth and readability. UI labels use `Barlow Condensed` for compact, bold clarity.

- **Display/Headlines (`Fraunces`):** Italic-capable variable serif. Bold weights for H1–H2 deliver a storybook, hand-crafted quality.
- **Body (`Bricolage Grotesque`):** Variable sans-serif. Generous line height (1.5–1.6) for easy reading on all devices.
- **Labels & UI (`Barlow Condensed`):** Condensed sans-serif at heavier weights keeps compact UI elements legible. Minimum 16 px on mobile viewports.

## Layout

Content flows in a single-column layout on mobile with optional multi-column grids on desktop (max 1240px). The 8px spacing scale provides rhythm and breathing room. Generous padding (24px container padding) makes the interface feel open and non-cramped.

## Elevation & Depth

Depth is subtle: soft shadows (0 2px 8px) on cards and inputs create layering without heaviness. The dark background is the canvas; interactive elements stand out through gold/fuchsia color and gentle glow rather than heavy elevation.

## Shapes

All interactive elements use rounded corners (8px on inputs, 12px on buttons and cards) to feel approachable and less clinical. Consistency across shapes reinforces the playful aesthetic.

## Components

### Buttons
- **Primary Button**: Gold background, dark text, 12px rounded corners, 12px 24px padding. Used for primary actions ("Generate," "Download").
- **Secondary Button**: Fuchsia background, white text, same sizing as primary.
- **Tertiary Button**: Outline style with gold border and text, transparent background.

### Cards
- Dark card background (#16142a), 24px padding, 12px rounded corners, subtle shadow (0 2px 8px).
- Used for display of generated coloring pages, story previews, and result containers.

### Inputs
- Dark surface background, 1px gold-border, 8px rounded corners, 12px 16px padding.
- Placeholder text in muted lavender; focus state adds a thin border in primary gold color.

## Do's and Don'ts

- **Do** use the gold sparingly for the most important call-to-action per screen.
- **Don't** combine cold and warm colors in the same visual hierarchy level.
- **Do** maintain generous spacing and breathing room—the interface should feel playful, not dense.
- **Don't** use small type on mobile; text should be at least 16px for comfort.
- **Do** celebrate moments with fuchsia/gradient accents and emerald green for positive feedback.
- **Don't** use light backgrounds; the dark, studio-like aesthetic is core to the brand.
