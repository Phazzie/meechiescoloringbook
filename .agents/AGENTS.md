<!--
Purpose: Project-level customization rules for AI Agents working on Meechie's Coloring Book.
Why: Persist learned persona, quote locking, subagent ticket scoping, and prompt rules.
-->
# Meechie's Coloring Book - Workspace Agent Rules & Custom Skills

## 🛠 Available Custom Workspace Skills

The repository includes three specialized skills in `.agents/skills/`:

1. 🎫 **`meechie-ticket-scoping`** ([SKILL.md](file:///C:/Users/shiva/.gemini/antigravity-ide/scratch/meechiescoloringbook/.agents/skills/meechie-ticket-scoping/SKILL.md)): Formats, sizes, and scopes atomic subagent-friendly work tickets (1–3 files max, 5–15 min execution).
2. 🎭 **`meechie-voice-audit`** ([SKILL.md](file:///C:/Users/shiva/.gemini/antigravity-ide/scratch/meechiescoloringbook/.agents/skills/meechie-voice-audit/SKILL.md)): Audits LLM prompt templates and UI copy to enforce the adult verdict persona and 5 canonical quote lock.
3. 🎨 **`line-art-prompt-compiler`** ([SKILL.md](file:///C:/Users/shiva/.gemini/antigravity-ide/scratch/meechiescoloringbook/.agents/skills/line-art-prompt-compiler/SKILL.md)): Enforces prompt engineering rules and negative prompt constraints for xAI Grok statement coloring page generation.

---

## 🤖 Subagent Delegation Rules

- **WHEN**: Delegate atomic 1–3 file sub-tickets (`[TICK-000a]`), parallel UI checks, or fixture updates.
- **HOW**: Pass explicit file paths allowed, explicit forbidden boundaries (`contracts/`), and required `cmd /c "npm run check"` output assertions.
- **WHY**: Protects main context window, isolates failure domains, and enables fast subagent task execution.
- **DO's & DON'Ts**:
  - ✅ **DO** enforce strict type safety (zero `as any` or `!`).
  - ❌ **DON'T** allow subagents to touch `contracts/` without contract design approval.
  - ❌ **DON'T** use vague prompts ("fix the page").

---

## 🚨 MANDATORY AGENT RULES

### 1. Brand Persona & Audience Lock
- **NEVER flatten or sanitize this app into a kids/family app.**
- Meechie's Coloring Book is an adult, witty, culturally authentic, sharp-tongued, and high-glam verdict & statement coloring experience ("Who Fucked Up?", "Rate His Excuse", Receipts Out, *Pretty & Petty*).
- Never use generic therapy-speak or sanitized platitudes (*"You deserve someone who chooses you..."*, *"healing journey"*).

### 2. Locked 5 Canonical Meechie Quotes
The voice adapter (`meechieVoicePack`), LLM prompt exemplars, and test fixtures are locked **EXCLUSIVELY** to these 5 canonical quotes:
1. `"As long as I'm alive, you bitches will have a place to live. Right here in my shadow."`
2. `"All I need to be a hoe is an area of control."`
3. `"Should've fucked the landlord, not the dopeman."`
4. `"Keep fucking with me and I'ma end up being your stepmama."`
5. `"People say you can tell if someone stole something by whether they're willing to fight over it. That's not true. I beat up plenty of bitches over their own shit."`

### 3. Subagent Ticket Scoping Protocol (`meechie-ticket-scoping`)
- Always use the workspace skill `.agents/skills/meechie-ticket-scoping/SKILL.md`.
- Max 1–3 files touched per ticket.
- Sized for 5–15 minute subagent autonomous execution.
- Complex tasks must be split into sub-tickets (`[TICK-001a]`, `[TICK-001b]`, `[TICK-001c]`).

### 4. Seam-Driven Development Mandates
- Always say "Seam-Driven Development" in prose; **NEVER** output the acronym.
- Zero `as any` type escapes or `!` non-null assertions allowed.
- At the end of every response, provide **EXACTLY THREE concise next-step options**, each with a one-sentence reason.
