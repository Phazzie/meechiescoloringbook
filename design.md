<!-- Purpose: Visual identity and design system specification for Meechie's Coloring Book. -->
<!-- Why: Single source of truth for colors, typography, spacing, and component tokens so UI stays consistent. -->
<!-- Info flow: This doc -> CSS variables in +layout.svelte -> component styles. -->
---
version: alpha
name: Meechie's Sassy Canvas
description: A bold, late-night-glam design system for AI-powered relationship drama tools
colors:
  primary: "#e8006a"
  secondary: "#c9a227"
  tertiary: "#f0c44a"
  surface: "#100f1c"
  neutral-light: "#F5F5F5"
  neutral-dark: "#1A1A1A"
  accent-success: "#7CB342"
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
    borderColor: "{colors.tertiary}"
    borderWidth: "1px"
    textColor: "{colors.tertiary}"
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

Meechie's Coloring Book is a bold, sassy space where AI creativity meets relationship drama. The tools — Apology Autopsy, Run Or Red Flag, Excuse Court, Who Fucked Up?, Rate His Excuse — are designed for adults who want to process messy situations with humor and style. The aesthetic is late-night glam: dark surfaces, fuchsia highlights, gold accents, and editorial typography. Every interaction feels opinionated, vibrant, and fun.

The target audience is adults navigating situationships, drama, and everyday relationship chaos. The emotional tone is witty, direct, and unapologetically glamorous.

## Colors

The color palette pairs bold accent colors with a dark surface for a high-contrast editorial feel.

- **Primary (#e8006a — fuchsia):** Hot pink that signals energy and directness. Used for primary actions, highlights, and interactive states. Maps to CSS `--fuchsia`.
- **Secondary (#c9a227 — gold):** Rich gold for secondary actions, borders, and accent moments. Maps to CSS `--gold`.
- **Tertiary (#f0c44a — bright gold):** Lighter gold for micro-interactions and hover states. Maps to CSS `--gold-bright`.
- **Surface (#100f1c):** Deep near-black for card backgrounds, nav, and elevated surfaces. Maps to CSS `--dark-surface`.
- **Neutral Light (#F5F5F5):** Off-white for page backgrounds and lighter containers.
- **Neutral Dark (#1A1A1A):** Near-black for text and structural elements on light backgrounds.
- **Success (#7CB342):** Soft sage green for positive feedback and completion states.

## Typography

Three typefaces create a layered editorial voice: Fraunces for display drama, Bricolage Grotesque for readable body copy, Barlow Condensed for compact UI labels.

- **Display (Fraunces):** Italic serifs at bold weights for headlines and hero moments.
- **Body (Bricolage Grotesque):** Variable optical-size font with generous line height (1.5–1.6) for comfortable reading.
- **Labels (Barlow Condensed):** Condensed weight for UI chrome, buttons, and tight spaces.

Note: `label.fontSize` is 14px for compact UI chrome. Body text should be at least 16px; do not apply label tokens to paragraph content.

## Layout

Content flows in a single-column layout on mobile with optional multi-column grids on desktop (max 1240px). The 8px spacing scale provides rhythm. Generous padding (24px container padding) keeps the interface from feeling cramped.

## Elevation & Depth

Depth is subtle: soft shadows (0 2px 8px) on cards create layering without heaviness. The dark surface (`--dark-surface: #100f1c`) grounds elevated components against lighter backgrounds.

## Shapes

All interactive elements use rounded corners — 8px on inputs and textareas, 12px on buttons and cards — for an approachable feel that still reads as intentional and designed.

## Components

### Buttons
- **Primary Button**: Fuchsia background, white text, 12px rounded corners, 12px 24px padding. Used for the single most important action per screen.
- **Secondary Button**: Gold background, white text, same sizing as primary.
- **Tertiary Button**: Transparent background, 1px gold-bright border, gold-bright text. Used for low-emphasis actions.

### Cards
- White background, 24px padding, 12px rounded corners, subtle shadow (0 2px 8px).
- Used for display of generated pages, tool results, and answer containers.

### Inputs
- Light gray background (#F9F9F9), 1px border (#E0E0E0), **8px** rounded corners, 12px 16px padding.
- Placeholder text in muted gray; focus state adds a thin fuchsia border.

## Do's and Don'ts

- **Do** use fuchsia sparingly for the single most important call-to-action per screen.
- **Don't** combine multiple warm accent colors at the same visual hierarchy level.
- **Do** maintain generous spacing — the interface should feel confident and editorial, not cluttered.
- **Don't** use small type in body content; paragraph text should be at least 16px for comfort. (14px label tokens are for compact UI chrome only.)
- **Do** celebrate moments with gold accents and success green for positive feedback.
- **Don't** use light backgrounds on dark-surface sections; honor the dark base as core to the brand.
