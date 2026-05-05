<!--
Purpose: Track the atomic implementation checklist for the Meechie redesign integration.
Why: Let future agents resume the redesign from GitHub without hidden chat context.
Info flow: Prompt + Claude redesign assets -> checklist tasks -> implementation evidence -> PR handoff.
-->
# Meechie Redesign Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the stopped Claude Meechie redesign into the live Svelte app while preserving Seam-Driven Development evidence, existing seam behavior, and resumable GitHub handoff.

**Architecture:** Keep the live Svelte app as source of truth. Use `claude redesign/Meechie Coloring Book v2.html` as the primary visual reference and copy only stable image assets into `static/meechie/`. Treat the redesign as UI-first unless a specific task explicitly upgrades `MeechieToolSeam`.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Zod seam contracts, Vitest, Playwright, Vite.

---

## Baseline Captured 2026-05-02

Current branch:

```text
## feature/meechie-redesign-integration
 M src/lib/components/MeechieTools.svelte
 M src/routes/+layout.svelte
 M src/routes/+page.svelte
 M src/routes/meechie/+page.svelte
?? .claude/
?? .playwright-mcp/
?? "claude redesign/"
?? docs/evidence/2026-04-29/
?? docs/evidence/2026-04-30/
```

Baseline `npm run check`:

```text
svelte-check found 0 errors and 0 warnings
```

Claude redesign source inventory:

```text
claude redesign/Meechie Coloring Book v2.html   Primary visual reference.
claude redesign/Meechie Coloring Book v1.html   Secondary reference for vault/quality ideas.
claude redesign/Meechie Coloring Book.html      Secondary reference for simpler layout ideas.
claude redesign/colors_and_type.css             Token reference only.
claude redesign/tweaks-panel.jsx                Do not port; prototype floating panel conflicts with unobstructed preview requirement.
```

Image asset decisions:

```text
Use: meechie-banner.png, meechie-verdict-girl.png, meechie-chosen.png, meechie-receipts.png, meechie-coloring-page.png.
Reject duplicate copy: meechie-glam.png duplicates meechie-chosen.png.
Reject duplicate copy: meechie-coloring-page2.png duplicates meechie-coloring-page.png.
```

## Checklist Item Format

Every implementation item must keep this shape when updated:

```md
- [ ] Task title
  - Type:
  - Files allowed:
  - Files forbidden:
  - Seams:
  - Change:
  - Acceptance:
  - Commands:
  - Evidence pasted:
  - Safe stop:
```

## Phase 0: Governance And Baseline

- [x] Move implementation off `main`.
  - Type: verification
  - Files allowed: none
  - Files forbidden: app files
  - Seams: none
  - Change: created branch `feature/meechie-redesign-integration`.
  - Acceptance: dirty work is no longer on `main`.
  - Commands: `git switch -c feature/meechie-redesign-integration`
  - Evidence pasted: `Switched to a new branch 'feature/meechie-redesign-integration'`
  - Safe stop: branch contains existing dirty UI work without reset.

- [x] Capture baseline branch and dirty files.
  - Type: verification
  - Files allowed: this plan
  - Files forbidden: app files
  - Seams: none
  - Change: recorded `git status --short --branch` output above.
  - Acceptance: branch and dirty files are visible in this plan.
  - Commands: `git status --short --branch`
  - Evidence pasted: see Baseline section.
  - Safe stop: future agents can separate prior dirty work from new edits.

- [x] Capture baseline type check.
  - Type: verification
  - Files allowed: this plan
  - Files forbidden: app files
  - Seams: none
  - Change: recorded baseline `npm run check`.
  - Acceptance: baseline has zero Svelte diagnostics before new edits.
  - Commands: `npm run check`
  - Evidence pasted: see Baseline section.
  - Safe stop: future failures can be compared to known baseline.

- [x] Inventory Claude source files and asset decisions.
  - Type: docs
  - Files allowed: this plan
  - Files forbidden: app files
  - Seams: none
  - Change: recorded primary/secondary references, rejected prototype panel, and duplicate assets.
  - Acceptance: implementation source material is explicit.
  - Commands: `Get-ChildItem "claude redesign/assets"` and `Get-FileHash "claude redesign/assets/*.png"`
  - Evidence pasted: see Baseline section.
  - Safe stop: no agent has to guess which Claude artifact to follow.

## Phase 1: Asset Placement

- [ ] Copy selected image assets into `static/meechie/`.
  - Type: UI-only
  - Files allowed: `static/meechie/`
  - Files forbidden: `contracts/`, `src/lib/adapters/`, `tests/contract/`
  - Seams: none
  - Change: copy only the five selected production assets listed in Baseline.
  - Acceptance: `/meechie/meechie-banner.png` and all selected images are URL-addressable.
  - Commands: `Get-ChildItem static/meechie`
  - Evidence pasted:
  - Safe stop: images exist but no Svelte code depends on them yet.

- [ ] Verify image asset loading in dev server.
  - Type: verification
  - Files allowed: none
  - Files forbidden: app files
  - Seams: none
  - Change: confirm static images do not 404.
  - Acceptance: browser/network check shows selected images load.
  - Commands: `npm run dev -- --host 127.0.0.1`
  - Evidence pasted:
  - Safe stop: assets can be referenced by UI tasks.

## Phase 2: Hero Banner

- [ ] Replace current text-only hero with banner-backed Meechie hero.
  - Type: UI-only
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: seam contracts and adapters
  - Seams: none
  - Change: use `/meechie/meechie-banner.png` as background art and render `Meechie's Coloring Book` / `Color Me Corrected` as real Svelte text.
  - Acceptance: first viewport clearly says this is Meechie's coloring book generator.
  - Commands: `npm run check`
  - Evidence pasted:
  - Safe stop: hero works without changing generation behavior.

- [ ] Add product story copy to hero.
  - Type: UI-only
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: seam contracts and adapters
  - Seams: none
  - Change: copy must state that the user tells Meechie what happened, gets a verdict/quote, and downloads a printable coloring page.
  - Acceptance: new user can identify the product in under five seconds.
  - Commands: `npm run check`
  - Evidence pasted:
  - Safe stop: page hierarchy is clearer before mode work.

## Phase 3: Mode Model And Selector

- [ ] Add local mode metadata.
  - Type: existing-seam usage
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: `contracts/`
  - Seams: `MeechieToolSeam`
  - Change: define eight modes with `id`, `label`, `shortLabel`, `toolId`, `image`, `icon`, `themeColor`, `placeholder`, `cta`, and `help`.
  - Acceptance: mode UI, placeholders, CTA text, and tool payloads read from one list.
  - Commands: `npm run check`
  - Evidence pasted:
  - Safe stop: metadata exists before mode UI is rewritten.

- [ ] Render all required modes as visual buttons.
  - Type: UI-only
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: seam contracts and adapters
  - Seams: none
  - Change: replace the old three-card section with eight visual mode buttons/cards.
  - Acceptance: active mode is visually obvious, keyboard focus is visible, and all eight modes are reachable.
  - Commands: `npm run check`
  - Evidence pasted:
  - Safe stop: selector is usable before tool calls are changed.

- [ ] Verify mode state updates the evidence panel.
  - Type: verification
  - Files allowed: none
  - Files forbidden: app files
  - Seams: `MeechieToolSeam`
  - Change: manually click each mode and confirm placeholder, image, help, and CTA update.
  - Acceptance: no mode is visually disconnected from its form state.
  - Commands: browser manual check
  - Evidence pasted:
  - Safe stop: UI state is ready for tool wiring.

## Phase 4: Evidence Input, Theme Chips, And Voice Controls

- [ ] Make evidence submission the primary input.
  - Type: UI-only
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: seam contracts and adapters
  - Seams: none
  - Change: replace builder-first hierarchy with an evidence textarea, optional dedication field, and mode-specific CTA.
  - Acceptance: `Custom Page Builder` no longer dominates the primary flow.
  - Commands: `npm run check`
  - Evidence pasted:
  - Safe stop: user can tell Meechie what happened before advanced settings are visible.

- [ ] Add visual theme chips.
  - Type: existing-seam usage
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: `contracts/`
  - Seams: `SpecValidationSeam`
  - Change: add Crown Energy, Pretty & Petty, Church Glam, Receipts, Family Reunion, Beauty Supply Oracle, Phone Died, and Door-Crack Energy chips with icons and style hints.
  - Acceptance: selected chip updates preview label and generation `styleHint`.
  - Commands: `npm run check`
  - Evidence pasted:
  - Safe stop: theme state is deterministic.

- [ ] Add contained voice controls.
  - Type: UI-only
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: `claude redesign/tweaks-panel.jsx`
  - Seams: none
  - Change: add Intensity, Rawness, and Third Person controls in a sidebar or `details` section that never covers the preview.
  - Acceptance: defaults are Receipts Out, Mild, and Sometimes.
  - Commands: `npm run check`
  - Evidence pasted:
  - Safe stop: no floating settings panel exists.

## Phase 5: Verdict, Quote, And Preview Flow

- [ ] Wire active mode to `/api/tools` without changing seam contract.
  - Type: existing-seam usage
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: `contracts/`, `fixtures/`, `src/lib/mocks/`, `tests/contract/`
  - Seams: `MeechieToolSeam`
  - Change: build valid payloads for current `MeechieToolInputSchema`; use `headline` as verdict and `response` as quote/output copy.
  - Acceptance: no `MeechieToolSeam` contract change is needed for the demo pass.
  - Commands: `npm run check`
  - Evidence pasted:
  - Safe stop: UI can get Meechie output using existing seam.

- [ ] Render verdict/quote card.
  - Type: existing-seam usage
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: seam contracts and adapters
  - Seams: `MeechieToolSeam`
  - Change: show verdict headline, response/quote, rating if present, copy quote, and remix action.
  - Acceptance: output feels connected to the coloring page preview.
  - Commands: `npm run check`
  - Evidence pasted:
  - Safe stop: quote exists before page generation.

- [ ] Connect Meechie output to coloring page spec.
  - Type: existing-seam usage
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: seam contracts and adapters
  - Seams: `SpecValidationSeam`, `ImageGenerationSeam`, `OutputPackagingSeam`
  - Change: generated page title/list uses the visible Meechie output text.
  - Acceptance: the preview and packaged export use the same visible quote/output.
  - Commands: `npm run check`
  - Evidence pasted:
  - Safe stop: real generation path remains intact.

## Phase 6: Export, Vault, And Advanced Diagnostics

- [ ] Move export actions into the preview footer.
  - Type: existing-seam usage
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: `contracts/`
  - Seams: `OutputPackagingSeam`
  - Change: PDF/PNG download links and copy quote action live with the preview.
  - Acceptance: export actions are visible after generation and not hidden in advanced controls.
  - Commands: `npm run check`
  - Evidence pasted:
  - Safe stop: export flow remains seam-backed.

- [ ] Restyle vault as quote/page vault without changing storage seam.
  - Type: existing-seam usage
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: `contracts/`, `src/lib/adapters/creation-store.adapter.ts`
  - Seams: `CreationStoreSeam`, `SessionSeam`
  - Change: keep load, pin/unpin, delete behavior while using Meechie vault language.
  - Acceptance: existing storage behavior still works.
  - Commands: `npm run rewind -- --seam CreationStoreSeam`; `npm run rewind -- --seam SessionSeam`
  - Evidence pasted:
  - Safe stop: vault is visual-only unless seam tests say otherwise.

- [ ] Keep system trace behind advanced disclosure.
  - Type: UI-only
  - Files allowed: `src/routes/+page.svelte`
  - Files forbidden: seam contracts and adapters
  - Seams: none
  - Change: diagnostics remain available but visually secondary.
  - Acceptance: non-technical user flow is not interrupted by prompt/rewrite/violation internals.
  - Commands: `npm run check`
  - Evidence pasted:
  - Safe stop: debugging data remains accessible.

## Phase 7: Visual And Accessibility Verification

- [ ] Run desktop visual check.
  - Type: verification
  - Files allowed: evidence files generated by tooling
  - Files forbidden: app files
  - Seams: none
  - Change: inspect `1440x900`.
  - Acceptance: hero readable, Meechie visible, preview unobstructed, export visible.
  - Commands: browser or Playwright screenshot
  - Evidence pasted:
  - Safe stop: desktop layout has been inspected.

- [ ] Run tablet visual check.
  - Type: verification
  - Files allowed: evidence files generated by tooling
  - Files forbidden: app files
  - Seams: none
  - Change: inspect `1024x768`.
  - Acceptance: mode selector and preview remain usable.
  - Commands: browser or Playwright screenshot
  - Evidence pasted:
  - Safe stop: tablet layout has been inspected.

- [ ] Run mobile visual check.
  - Type: verification
  - Files allowed: evidence files generated by tooling
  - Files forbidden: app files
  - Seams: none
  - Change: inspect `390x844`.
  - Acceptance: no text overflow, settings do not cover preview, primary CTA reachable.
  - Commands: browser or Playwright screenshot
  - Evidence pasted:
  - Safe stop: mobile layout has been inspected.

## Phase 8: Final Proof Gates

- [ ] Run static and unit proof gates.
  - Type: verification
  - Files allowed: evidence files generated by tooling
  - Files forbidden: app files
  - Seams: all touched existing seams
  - Change: run final project verification.
  - Acceptance: command outputs are pasted before claiming completion.
  - Commands: `npm run check`; `npm test`; `npm run verify`
  - Evidence pasted:
  - Safe stop: final local proof is complete.

- [ ] Commit, push, and open draft PR.
  - Type: docs
  - Files allowed: all implemented files
  - Files forbidden: unrelated dirty files not needed for this work
  - Seams: all touched seams
  - Change: publish branch to GitHub and open draft PR.
  - Acceptance: PR title is `Draft: Meechie redesign integration` and body links this plan.
  - Commands: `git status --short`; `git add ...`; `git commit ...`; `git push -u origin feature/meechie-redesign-integration`; `gh pr create --draft ...`
  - Evidence pasted:
  - Safe stop: other agents can resume from GitHub.
