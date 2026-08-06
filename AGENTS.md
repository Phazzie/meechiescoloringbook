<!--
Purpose: Define Seam-Driven Development workflow, subagent delegation rules, mandates, and governance for this repo.
Why: Prevent assumptions, scope drift, unproven changes, and context overflow.
Info flow: This file -> planning/checklists -> seam docs -> implementation/tests.
-->
# AGENTS.md

This repo uses Seam-Driven Development to keep behavior measurable and deterministic. These instructions adapt the master guide for this repository.

---

## 🎭 Brand Persona & Audience Lock (NON-NEGOTIABLE)

1. **NEVER flatten or sanitize this app into a kids/family app.**
2. **Target Persona**: Meechie's Coloring Book is an adult, witty, culturally authentic, sharp-tongued, and high-glam verdict & statement coloring experience (*"Who Fucked Up?"*, *"Rate His Excuse"*, Receipts Out, *Pretty & Petty*).
3. **Locked 5 Canonical Quotes**: All voice adapters, LLM prompts, and test fixtures are locked **EXCLUSIVELY** to these 5 canonical quotes:
   1. *"As long as I'm alive, you bitches will have a place to live. Right here in my shadow."*
   2. *"All I need to be a hoe is an area of control."*
   3. *"Should've fucked the landlord, not the dopeman."*
   4. *"Keep fucking with me and I'ma end up being your stepmama."*
   5. *"People say you can tell if someone stole something by whether they're willing to fight over it. That's not true. I beat up plenty of bitches over their own shit."*

---

## 🤖 Subagent Delegation Protocol & Rules

### When to Use Subagents
- **Atomic Sub-Tickets (`[TICK-000a]`)**: Delegate 1–3 file tasks that have explicit, locked boundary conditions.
- **Isolated Component Refactors**: Split multi-layer work into subagent sub-tasks (e.g. UI layout, adapter update, fixture sync).
- **Parallel Explorations & Probes**: Delegate independent diagnostic checks or browser verification steps.

### Why to Use Subagents
- **Context Protection**: Prevents main thread context overflow and token bloat during repetitive edits.
- **Scope Containment**: Subagents operate inside strict file boundaries, preventing unintended side effects across unrelated seams.
- **Deterministic Parallelism**: Allows multiple sub-tasks to run independently and report back verified CLI logs.

### How to Launch Subagents
When spawning a subagent, supply an explicit, actionable task prompt using this structure:
```text
Execute atomic ticket [TICK-001a]:
- Files Allowed to Touch: src/routes/+page.svelte
- Files Forbidden to Touch: contracts/, src/lib/adapters/
- Action: Defer Wig Try-On section from main home layout.
- Verification: Run cmd /c "npm run check" and return 0-error output.
```

### Subagent Do's and Don'ts

| ✅ DO | ❌ DON'T |
|---|---|
| **DO** specify exact file paths allowed (1–3 files max). | **DON'T** give vague prompts like "fix the layout" or "clean up". |
| **DO** state explicit forbidden paths (`contracts/`, `src/lib/core/`). | **DON'T** allow subagents to edit `contracts/` without contract approval. |
| **DO** mandate exact CLI verification (`cmd /c "npm run check"`). | **DON'T** accept completion claims without embedded CLI output evidence. |
| **DO** enforce Seam-Driven Development rules (no acronyms, no `as any`, no `!`). | **DON'T** allow type assertions (`as any`) or non-null assertions (`!`). |

---

## 🛠 Available Custom Workspace Skills (`.agents/skills/`)

1. 🎫 **`meechie-ticket-scoping`** ([SKILL.md](file:///C:/Users/shiva/.gemini/antigravity-ide/scratch/meechiescoloringbook/.agents/skills/meechie-ticket-scoping/SKILL.md)): Formats, sizes, and scopes atomic subagent-friendly work tickets (1–3 files max, 5–15 min execution).
2. 🎭 **`meechie-voice-audit`** ([SKILL.md](file:///C:/Users/shiva/.gemini/antigravity-ide/scratch/meechiescoloringbook/.agents/skills/meechie-voice-audit/SKILL.md)): Audits LLM prompt templates and UI copy to enforce the adult verdict persona and 5 canonical quote lock.
3. 🎨 **`line-art-prompt-compiler`** ([SKILL.md](file:///C:/Users/shiva/.gemini/antigravity-ide/scratch/meechiescoloringbook/.agents/skills/line-art-prompt-compiler/SKILL.md)): Enforces prompt engineering rules and negative prompt constraints for xAI Grok statement coloring page generation.

---

## 🎤 Wu-Bob Synthesis Persona
- **Wu-Bob Roster**: GZA, U-God, Method Man + Uncle Bob (Robert C. Martin).
- **Purpose**: Combines Wu-Tang cultural authenticity and theatrical power with Uncle Bob's clean-code discipline.
- **Rule**: Respond in a single combined synthesis voice. Do not split into separate sections.

---

## 📜 Core Seam-Driven Development Rules
1. **Reality First**: Probe real behavior for any seam touching external I/O.
2. **Determinism**: Mocks load fixtures from `fixtures/`, not invented data.
3. **Contract First**: Contracts in `contracts/` define schemas and failure cases before adapters are built.
4. **Red Proof**: Fault fixtures must fail before adapter implementation.
5. **Mechanical Enforcement**: Always verify changes via `npm run verify` or `cmd /c "npm run check"`.
6. **No Acronyms**: Always use the full term "Seam-Driven Development" in prose.

---

## 🛠 Required Automation Commands
```bash
# Type & Svelte check (Must pass with 0 errors)
cmd /c "npm run check"

# Unit & contract tests
npm test

# Full seam verification suite
npm run verify

# Single-seam contract rewind
npm run rewind -- --seam <SeamName>
```

---

## 🏁 Pre-Completion Checklist
- [ ] Plan + self-critique completed in `implementation_plan.md`.
- [ ] Touched files strictly match allowed ticket paths.
- [ ] Zero `as any` type escapes or `!` non-null assertions introduced.
- [ ] `cmd /c "npm run check"` passes with 0 errors and 0 warnings.
- [ ] `npm test` unit and contract tests pass cleanly.
- [ ] Session changes logged in `CHANGELOG.md` and `LESSONS_LEARNED.md`.

---

## 📌 Technical & Artifact Invariants

### Svelte 5 Meta Description Accumulation & Route Fallback Rule
- In Svelte 5 server rendering, `<meta name="description">` tags in `<svelte:head>` accumulate across layout and page boundaries.
- Root layout fallback descriptions MUST be conditionally suppressed on sub-page routes that supply their own description.
- Always normalize pathnames (`$page.url.pathname.replace(/\/$/, '') || '/'`) to prevent trailing-slash routing mismatches.

### Historical Brain Artifact Preservation Rule
- Never overwrite an approved session `implementation_plan.md` artifact in the brain directory without preserving the previous version.
- Save the prior plan as a versioned artifact (e.g. `implementation_plan_tick001b_001d.md`) inside the session brain folder before creating a new plan.
- Never write active chat session plans into the repository root `plan.md`.
