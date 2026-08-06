<!--
Purpose: Gemini-specific AI Agent instructions, command map, subagent rules, and persona guidelines.
Why: Provide optimized guidance for Gemini models working on Meechie's Coloring Book under Seam-Driven Development.
Info flow: GEMINI.md -> AGENTS.md -> docs/seams.md -> contracts/ -> src/
-->
# GEMINI.md

This file provides dedicated guidance to Gemini models working in this repository.

**Read `AGENTS.md` first.** It owns all core governance: Seam-Driven Development rules, persona lock, mandates, and checklists. This file provides Gemini-optimized navigation, subagent delegation tactics, and rapid validation workflows.

---

## ⚡ Gemini-Specific Execution Guidelines

Gemini models excel at rapid pattern recognition, visual design evaluation, and structured code generation. To maximize effectiveness:

1. **Strict Type Safety**: Always use strict TypeScript annotations, explicit return types, and Zod schemas or Type Guards. Never output `as any` or `!`.
2. **Seam-Driven Development Compliance**: Never write implementation code before contracts and mocks are defined.
3. **Always Say "Seam-Driven Development"**: Never output the forbidden acronym.
4. **End-of-Turn Protocol**: End every turn with **EXACTLY THREE concise next-step options**, each accompanied by a one-sentence rationale.

---

## 🤖 Subagent Delegation Tactics for Gemini

When orchestrating complex features, delegate atomic tasks to subagents to preserve context and speed:

### When to Delegate to Subagents
- **Atomic Sub-Tickets (`[TICK-000a]`)**: Multi-file refactors split into 1–3 file sub-tasks.
- **Visual & UI Smoke Testing**: Spawning `browser_subagent` to test UI routes, responsive layouts, and button actions.
- **Fixture & Mock Synchronization**: Delegating fixture updates and mock data verification.

### Subagent Prompting Checklist for Gemini

Before calling `browser_subagent` or delegating tasks, ensure the prompt includes:
- [ ] **Exact Allowed Paths**: Explicit 1–3 file target list.
- [ ] **Explicit Forbidden Paths**: `contracts/`, `src/lib/core/`.
- [ ] **Persona Guardrails**: Adult Cultural Verdict Persona, 5 canonical quotes lock.
- [ ] **Verification Command**: `cmd /c "npm run check"` output requirement.

---

## 🎭 Persona & Brand Architecture

- **Audience**: Adult, witty, culturally authentic, sharp-tongued relationship verdict & statement line-art coloring page app.
- **Primary Modes**: *"Who Fucked Up?"*, *"Rate His Excuse"*, Receipts Out, *Pretty & Petty*.
- **Visual Aesthetic**: The Dark Velvet Stage (`#07070f` midnight background, `#c9a227` gold, `#e8006a` fuchsia).
- **Typography**: `Fraunces` Italic Serif (headlines), `Bricolage Grotesque` (body), `Barlow Condensed` (UI tags).
- **The 5 Canonical Quotes**:
  1. *"As long as I'm alive, you bitches will have a place to live. Right here in my shadow."*
  2. *"All I need to be a hoe is an area of control."*
  3. *"Should've fucked the landlord, not the dopeman."*
  4. *"Keep fucking with me and I'ma end up being your stepmama."*
  5. *"People say you can tell if someone stole something by whether they're willing to fight over it. That's not true. I beat up plenty of bitches over their own shit."*

---

## 🛠 Available Custom Skills (`.agents/skills/`)

- 🎫 **`meechie-ticket-scoping`**: Formats and scopes atomic 1–3 file sub-tickets for 5–15 min subagent runs.
- 🎭 **`meechie-voice-audit`**: Audits LLM prompts and copy to enforce the adult verdict persona and 5 canonical quote lock.
- 🎨 **`line-art-prompt-compiler`**: Enforces prompt engineering rules and negative prompt constraints for xAI Grok statement coloring page generation.

---

## 💻 Essential Commands

```bash
# Type check & Svelte verification (0 errors required)
cmd /c "npm run check"

# Unit and contract tests
npm test

# Full seam verification pipeline
npm run verify

# Single seam verification
npm run rewind -- --seam <SeamName>
```
