---
version: alpha
name: Meechie's Playful Canvas
description: A warm, inviting design system for AI-powered coloring book generation
colors:
  primary: "#FF6B35"
  secondary: "#004E89"
  tertiary: "#F7931E"
  neutral-light: "#F5F5F5"
  neutral-dark: "#1A1A1A"
  accent-success: "#7CB342"
  accent-joy: "#FFEB3B"
typography:
  h1:
    fontFamily: system-ui, -apple-system, sans-serif
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  h2:
    fontFamily: system-ui, -apple-system, sans-serif
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: system-ui, -apple-system, sans-serif
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: system-ui, -apple-system, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: system-ui, -apple-system, sans-serif
    fontSize: 14px
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
  card:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "24px"
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
  input:
    backgroundColor: "#F9F9F9"
    borderColor: "#E0E0E0"
    rounded: "{rounded.md}"
    padding: "12px 16px"
---

## Overview

Meechie's Coloring Book is a joyful, imaginative space where AI creativity meets childhood wonder. The design celebrates vibrant storytelling, approachable technology, and the magic of turning words into art you can color. The aesthetic is warm, encouraging, and family-friendly—never intimidating. Every interaction feels like an invitation to play.

The target audience is kids and families who want custom coloring experiences. The emotional tone is playful, supportive, and enchanted.

## Colors

The color palette balances vibrant accent colors with calm, readable backgrounds.

- **Primary (#FF6B35):** Warm coral-orange that signals joy and creativity. Used for primary actions and interactive highlights.
- **Secondary (#004E89):** Deep ocean blue for secondary actions and informational content. Creates contrast while remaining calm.
- **Tertiary (#F7931E):** Bright golden-orange for accents and micro-interactions that delight without overwhelming.
- **Neutral Light (#F5F5F5):** Off-white background that reduces eye strain and feels paper-like (echoing the coloring book metaphor).
- **Neutral Dark (#1A1A1A):** Near-black for text and structural elements, maintaining high readability.
- **Success (#7CB342):** Soft sage green for positive feedback, celebrations, and completion states.
- **Joy (#FFEB3B):** Warm yellow for highlights and moments of celebration.

## Typography

Type hierarchy is clear and child-friendly. Headlines feel celebratory; body text is spacious and easy to read on all devices.

- **Headlines:** System fonts at bold weights for modern, accessible feel.
- **Body:** Generous line height (1.5–1.6) for easy reading by young eyes.
- **Labels & UI:** Slightly condensed weight and tracking for clarity in compact spaces.

## Layout

Content flows in a single-column layout on mobile with optional multi-column grids on desktop (max 1200px). The 8px spacing scale provides rhythm and breathing room. Generous padding (24px container padding) makes the interface feel open and non-cramped.

## Elevation & Depth

Depth is subtle: soft shadows (0 2px 8px) on cards and inputs create layering without darkness. Background is clean and light, with interactive elements standing out through color and shadow rather than heavy elevation.

## Shapes

All interactive elements use rounded corners (4px on inputs, 12px on buttons and cards) to feel approachable and less clinical. Consistency across shapes reinforces the playful aesthetic.

## Components

### Buttons
- **Primary Button**: Warm coral-orange background, white text, 12px rounded corners, 12px 24px padding. Used for primary actions ("Generate," "Download").
- **Secondary Button**: Ocean blue background, white text, same sizing as primary.
- **Tertiary Button**: Outline style with golden-orange border and text.

### Cards
- White background, 24px padding, 12px rounded corners, subtle shadow (0 2px 8px).
- Used for display of generated coloring pages, story previews, and result containers.

### Inputs
- Light gray background (#F9F9F9), 1px border (#E0E0E0), 8px rounded corners, 12px 16px padding.
- Placeholder text in muted gray; focus state adds a thin border in primary color.

## Do's and Don'ts

- **Do** use the warm coral-orange sparingly for the most important call-to-action per screen.
- **Don't** combine cold and warm colors in the same visual hierarchy level.
- **Do** maintain generous spacing and breathing room—the interface should feel playful, not dense.
- **Don't** use small type on mobile; text should be at least 16px for comfort.
- **Do** celebrate moments with the joy yellow accent and success green for positive feedback.
- **Don't** use dark backgrounds; the light, paper-like aesthetic is core to the brand.