---
name: line-art-prompt-compiler
description: Enforces prompt engineering rules and negative prompt constraints for generating high-contrast statement line-art coloring pages with xAI Grok.
---

# Statement Line-Art Prompt Compiler Skill

This skill provides prompt construction guidelines and negative prompt suppression rules for generating statement coloring pages using xAI Grok (`grok-imagine-image`).

---

## 🎨 Line-Art Prompting Rules

### 1. Mandatory Positive Prompt Clauses (ALWAYS Present)
Every image generation prompt sent to xAI Grok must include:
- `"black-and-white coloring book page"`
- `"outline-only line art, clean bold contours"`
- `"NO color fill, NO grayscale, NO shading, NO gradients"`
- `"printable, lots of open spaces for coloring"`

### 2. High-Glam Motifs (Optional Enhancements)
- `"glam, sparkly, rhinestone-dot outlines"`
- `"hearts, bows, stars, crowns, diamonds, gem outlines"`
- `"roses with thorns, bold statement coloring page"`
- `"decorative high-fashion border"`

### 3. Mandatory Negative Prompt (ALWAYS Injected)
`"color, colored, grayscale, grey, shading, shadow, gradient, photorealistic, 3d, render, crosshatching, hatching, halftone, painterly, texture fill"`

---

## 🛡 Drift Detection & Validation

Before executing an image prompt:
1. Verify alignment line presence using `formatAlignmentLine(spec)`.
2. Run `DriftDetectionSeam` to ensure zero forbidden tokens (`shading`, `grayscale`, `3d render`) are present.
3. Validate output safety using `SafetyPolicySeam`.
