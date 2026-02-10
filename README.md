<!--
Purpose: Explain the project, its governance model, and how to run it locally.
Why: Keep Seam-Driven Development and Wu-Tang coding intent visible to non-coders.
Info flow: Philosophy -> workflow -> commands -> evidence.
-->
# Coloring Book Page Generator

This app generates printable coloring pages with strict layout and constraint rules. It is built with **Seam-Driven Development** to prevent integration drift and to keep the core logic deterministic and testable.

## Why Seam-Driven Development + Wu-Tang coding
Many teams get to “100% loud” in the UI — buttons, colors, swagger — but stop right before the app actually works everywhere. AI will happily fill in the rest with shortcuts, hidden assumptions, and unexpected side effects, and suddenly you get a pretty prototype that fails when a real person touches it. That gap is the 70% problem we’re trying to eliminate.

Seam-Driven Development pulls integration to the front of the line. Before any feature ships, we map out every seam (trust boundary, adapter, adapter, provider) and build the contract, mock, and adapter for it. That way, the interfaces are proven before we rely on them, and when we finally stitch the UI, we already know the seams line up. It keeps the work deterministic and auditable even when AI is being “helpful.”

Wu-Tang coding is the mindset we add on top. Wu-Bob is Uncle Bob plus a rotating trio of Wu-Tang brains (GZA, U-God, and Method Man right now). The Wu-Tang energy forces synthesis — the AI can’t just pattern-match code it wrote before; it has to blend Uncle Bob’s discipline with Wu-Wisdom’s flavor. That makes the output sharper because it has to satisfy more constraints: clean code, precise behavior, and a strong creative voice. It also gives non-coders a shared shorthand (RZA for vision, GZA for precision, etc.) so they can steer the process without rewriting logic.

This repo fights the two big failure modes we keep seeing:
- **Integration hell**: the seams don’t actually match, so the app breaks as soon as you try to use it.
- **AI non-compliance**: skipped steps, helper modules doing I/O off-seam, or loose specs that can’t be proven.

Seam-Driven Development + Wu-Tang coding keeps the work honest: integration first, contracts enforced, and meaningfully reviewed by the Wu-Bob fusion.

## What this app lets you do
- Build a Meechie-style coloring page by entering titles, numbered list items, and optional footer text, then generate a fully locked prompt that a model can’t wander from.
- Talk to the chat panel (a mocked/meechie assistant) to translate feelings into the same structured spec, keeping everything traceable.
- See the assembled and revised prompts plus drift violations in a debug panel so you know exactly why something failed.
- Save generations, favorites, drafts, and exports (PDFs and printable images) through seam-protected storage so nothing bypasses the contract.
- Install the app as an Android-friendly PWA with manifest, icons, and offline-safe assets because the art needs to travel.

## Terminology
- **Deterministic**: same inputs lead to the same outputs. Nothing magically depends on hidden randomness or “AI intuition.”
- **Canonical prompt**: the carefully crafted, multi-line prompt we log for evidence so every constraint is visible and testable.
- **Deterministic compressed provider prompt**: the trimmed version of the canonical prompt that keeps all required constraints but fits inside provider limits (like the 1024-character cap). Think of it as the short-form script we feed the model after we prove the long-form version is correct.
- **Assumption Alarm**: a governance checkpoint that fires when a probe is blocked; it records the blocked seam, what we assume is true, and how we will validate it later.
- **CLI flags**: things that start with `-` (e.g., `--seam` or `--help`). Whenever we mention a flag, we explain in plain language what it toggles so non-coders can follow the instructions.

## Requirements
- Node.js 20+
- npm

## Local development

```sh
npm install
npm run dev
```

## Git hooks (recommended)

```sh
npm run hooks:install
```
Run this once after cloning to enable local pre-commit and pre-push verification.

## Verification (required for seam changes)

```sh
npm run verify
```

This runs the Seam-Driven Development gates (chamber lock, assumption alarm, evidence capture, seam ledger, clan chain, proof tape, cipher gate) and writes evidence under `docs/evidence/YYYY-MM-DD/`.

## Build

```sh
npm run build
npm run preview
```

## Testing

```sh
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Environment
Create a local `.env` from `.env.example` when you need integration tests or live provider calls.

Notes:
- Integration tests require `FEATURE_INTEGRATION_TESTS=true` and a valid `XAI_API_KEY`.
- The xAI image API currently ignores `size` or `quality`, so `DEFAULT_IMAGE_SIZE` is future-facing.

## Optional commands

```sh
npm test
npm run check
npm run rewind -- --seam DriftDetectionSeam
```
