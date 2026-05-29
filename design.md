<!--
Purpose: Visual identity and design system specification for Meechie's Coloring Book.
Why: Single source of truth for colors, typography, spacing, and component tokens.
Info flow: design.md → implementation (src/routes/+layout.svelte, components, styles).
-->
---
version: alpha
name: Meechie's Playful Canvas
description: A warm, inviting design system for AI-powered coloring book generation
colors:
  primary: "#e8006a"
  secondary: "#c9a227"
  tertiary: "#f0c44a"
  neutral-light: "#fdf6e3"
  neutral-dark: "#07070f"
  accent-success: "#00c896"
  accent-joy: "#b8aacf"
typography:
  h1:
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  h2:
    fontFamily: "'Fraunces', Georgia, serif"
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
    fontFamily: "'Barlow Condensed', 'Avenir Next Condensed', 'Segoe UI', sans-serif"
    fontSize: 16px
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
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-tertiary:
    backgroundColor: "transparent"
    borderColor: "{colors.secondary}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  card:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "24px"
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
  input:
    backgroundColor: "#F9F9F9"
    borderColor: "#E0E0E0"
    borderWidth: "1px"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    focusBorderColor: "{colors.primary}"
---

## Overview

Meechie's Coloring Book is a joyful, imaginative space where AI creativity meets childhood wonder. The design celebrates vibrant storytelling, approachable technology, and the magic of turning words into art you can color. The aesthetic is warm, encouraging, and family-friendly—never intimidating. Every interaction feels like an invitation to play.

The target audience is kids and families who want custom coloring experiences. The emotional tone is playful, supportive, and enchanted.

## Colors

The color palette balances vibrant accent colors with rich, dark backgrounds.

- **Primary (#e8006a):** Vibrant fuchsia-pink that signals boldness and creativity. Used for primary actions, interactive highlights, and brand identity.
- **Secondary (#c9a227):** Rich antique gold for secondary elements, accents, and a premium feel.
- **Tertiary (#f0c44a):** Bright gold for interactive states, hover highlights, and micro-animations.
- **Neutral Light (#fdf6e3):** Warm cream used for text and light surfaces against dark backgrounds.
- **Neutral Dark (#07070f):** Near-black for structural backgrounds, maintaining the dark-mode aesthetic.
- **Success (#00c896):** Bright emerald green for positive feedback, celebrations, and completion states.
- **Joy (#b8aacf):** Soft lavender for delightful accent moments and secondary highlights.

## Typography

Type hierarchy is clear and expressive. Headlines use a serif display face; body text is spacious and easy to read on all devices.

- **Headlines:** Fraunces (italic display serif) for celebratory, expressive headings.
- **Body:** Bricolage Grotesque with generous line height (1.5–1.6) for easy reading by young eyes.
- **Labels & UI:** Barlow Condensed for compact navigation and UI elements.

## Layout

Content flows in a single-column layout on mobile with optional multi-column grids on desktop (max 1240px). The 8px spacing scale provides rhythm and breathing room. Generous padding (24px container padding) makes the interface feel open and non-cramped.

## Elevation & Depth

Depth is subtle: soft shadows (0 2px 8px) on cards and inputs create layering without harshness. Dark backgrounds provide a rich canvas; interactive elements stand out through color and glow rather than heavy elevation.

## Shapes

All interactive elements use rounded corners (8px on inputs, 12px on buttons and cards) to feel approachable and less clinical. Consistency across shapes reinforces the playful aesthetic.

## Components

### Buttons
- **Primary Button**: Fuchsia-pink background, white text, 12px rounded corners, 12px 24px padding. Used for primary actions ("Generate," "Download").
- **Secondary Button**: Antique gold background, white text, same sizing as primary.
- **Tertiary Button**: Outline style with gold border and text.

### Cards
- White background, 24px padding, 12px rounded corners, subtle shadow (0 2px 8px).
- Used for display of generated coloring pages, story previews, and result containers.

### Inputs
- Light gray background (#F9F9F9), 1px border (#E0E0E0), 8px rounded corners, 12px 16px padding.
- Placeholder text in muted gray; focus state adds a thin border in primary color (#e8006a).

## Do's and Don'ts

- **Do** use the fuchsia-pink sparingly for the most important call-to-action per screen.
- **Don't** combine cold and warm colors in the same visual hierarchy level.
- **Do** maintain generous spacing and breathing room—the interface should feel playful, not dense.
- **Don't** use small type on mobile; text should be at least 16px for comfort.
- **Do** celebrate moments with the lavender accent and emerald for positive feedback.
- **Don't** rely on light backgrounds; the dark, immersive aesthetic is core to the brand.
