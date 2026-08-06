<!--
Purpose: Formal Handoff Brief for transitioning to a new chat window.
Why: Provide incoming AI agents with exact context, git commit status, persona rules, and ready sub-tickets.
Info flow: Current Session -> HANDOFF.md -> New Session Prompt.
-->
# Session Handoff & Turnover Brief

**Repository Location**: `C:\Users\shiva\.gemini\antigravity-ide\scratch\meechiescoloringbook`  
**Current Git State**: Branch `main`, Commit `0d2a00d` (*"docs: establish subagent ticket system, 5-quote lock, and persona rules"*), Working Tree Clean.  
**Verification Status**: `cmd /c "npm run check"` passing with **0 errors and 0 warnings**.

---

## 🎭 Persona & Brand Rules (NON-NEGOTIABLE)

1. **Adult Cultural Verdict Persona**: Meechie's Coloring Book is an adult, witty, culturally authentic, sharp-tongued relationship verdict & statement line-art coloring page app (*"Who Fucked Up?"*, *"Rate His Excuse"*, Receipts Out, *Pretty & Petty*). NEVER flatten into a kids/family app or therapy-speak.
2. **Locked 5 Canonical Quotes**: All quote pools, adapters, and LLM prompt exemplars are locked EXCLUSIVELY to these 5 canonical quotes:
   1. *"As long as I'm alive, you bitches will have a place to live. Right here in my shadow."*
   2. *"All I need to be a hoe is an area of control."*
   3. *"Should've fucked the landlord, not the dopeman."*
   4. *"Keep fucking with me and I'ma end up being your stepmama."*
   5. *"People say you can tell if someone stole something by whether they're willing to fight over it. That's not true. I beat up plenty of bitches over their own shit."*

---

## 🛠 Active Workspace Custom Skills (`.agents/skills/`)

- 🎫 **`meechie-ticket-scoping`**: Scopes atomic 1–2 file sub-tickets for 5–15 min autonomous subagent execution.
- 🎭 **`meechie-voice-audit`**: Audits LLM prompt templates and UI copy to enforce the adult verdict persona and 5 canonical quote lock.
- 🎨 **`line-art-prompt-compiler`**: Enforces prompt engineering rules and negative prompt constraints for xAI Grok statement coloring page generation.

---

## 🚀 Immediate Next Workpack (Phase 1 Sub-Tickets)

1. **`[TICK-001a]`**: Defer Wig Try-On Studio section on Home Page (`src/routes/+page.svelte` — 1 file).
2. **`[TICK-001d]`**: Remove Wig Studio link from main layout header (`src/routes/+layout.svelte` — 1 file).
3. **`[TICK-001b]`**: Update global `<title>` and `<meta>` tags to Adult Verdict Persona (`src/routes/+layout.svelte` — 1 file).

---

## 📜 Key Governance Documents

- Source of Truth Rules: [AGENTS.md](file:///C:/Users/shiva/.gemini/antigravity-ide/scratch/meechiescoloringbook/AGENTS.md)
- Gemini Agent Blueprint: [GEMINI.md](file:///C:/Users/shiva/.gemini/antigravity-ide/scratch/meechiescoloringbook/GEMINI.md)
- Work Ticket System Specification: [docs/WORK_TICKET_SYSTEM.md](file:///C:/Users/shiva/.gemini/antigravity-ide/scratch/meechiescoloringbook/docs/WORK_TICKET_SYSTEM.md)
- Master Implementation Plan: [implementation_plan.md](file:///C:/Users/shiva/.gemini/antigravity-ide/brain/3de9869e-c93d-4901-a500-1fbfb01e0802/implementation_plan.md)
