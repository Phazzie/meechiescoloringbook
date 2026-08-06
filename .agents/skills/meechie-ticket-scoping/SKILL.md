---
name: meechie-ticket-scoping
description: Formats, sizes, and scopes atomic subagent-friendly work tickets under Seam-Driven Development. Use when creating work tickets or breaking down features into subagent tasks.
---

# Meechie Work Ticket Scoping Skill (Subagent-Optimized)

This skill defines the rules, schema, and sizing protocol for scoping work into **atomic, self-contained work tickets** tailored for execution by autonomous AI subagents.

---

## 📐 Subagent Ticket Sizing Protocol (Atomic Scope Rule)

To prevent context drift, hallucination, or multi-file breaks during subagent execution:

1. **Max 1–3 Files Allowed per Ticket**: Each ticket must touch at most 1–3 closely related files.
2. **Single Seam Focus**: A ticket must concern a single seam or UI component at a time.
3. **Execution Time Ceiling**: Designed to complete in 5–15 minutes of autonomous execution.
4. **Sub-Ticket Splitting (`a/b/c`)**: If a feature requires changes across multiple layers (contract → mock → adapter → route), split it into sequential atomic sub-tickets (e.g., `[TICK-001a]`, `[TICK-001b]`, `[TICK-001c]`).

---

## 📋 Standard Subagent Ticket Schema

Every ticket must follow this exact Markdown schema:

```markdown
### 🎫 Ticket ID: [TICK-000a] - [Atomic Sub-Task Title]

- **Parent Feature**: [Parent Feature Name]
- **Work Type**: [Feature | Seam Implementation | Refactor | Docs | Verification]
- **Target Persona Alignment**: [Adult Cultural Verdict Persona relevance]
- **Subagent Execution Estimate**: 5 – 15 minutes

---

### 📂 File Scoping Boundaries

- **Files Allowed to Touch** (1–3 Files Max):
  - `src/routes/path/to/file.svelte`

- **Files Forbidden to Touch** (Protection Boundaries):
  - `contracts/` (Immutable contracts)
  - `src/lib/core/` (Pure domain logic)

- **Impacted Seams & Contracts**:
  - `MeechieToolSeam` ([contracts/meechie-tool.contract.ts](file:///C:/Users/shiva/.gemini/antigravity-ide/scratch/meechiescoloringbook/contracts/meechie-tool.contract.ts))

---

### 🛠 Step-by-Step Technical Breakdown

1. **Step 1**: [Exact code change / method update]
2. **Step 2**: [Data binding / UI state change]
3. **Step 3**: [Error fallback / Zod validation check]

---

### 🛡 Validation Strategy (Zero Shortcuts Policy)

- **Input Validation**: Specify the Zod schema (`Schema.parse()`) or Type Guard (`isType()`) used to validate un-trusted data.
- **DOM Events**: Enforce `instanceof` checks (e.g., `event.target instanceof HTMLInputElement`).
- **Forbidden Assertions**: Strictly ZERO `as any` type escapes or `!` non-null assertions allowed.

---

### 🏁 Definition of Done (DoD) & Acceptance Criteria

- [ ] All changes implemented strictly within allowed files.
- [ ] `cmd /c "npm run check"` passes with 0 Svelte/TypeScript errors.
- [ ] `npm test` unit/contract tests pass cleanly.
- [ ] Zero `as any` or `!` non-null assertions introduced.
- [ ] Subagent pastes exact CLI verification output before marking done.

---

### 💻 Verification Commands

```bash
cmd /c "npm run check"
npm test
```

---

### 🛑 Safe Stop & Rollback Trigger

- **Stop Condition**: If an unexpected contract mismatch, missing fixture, or failing test occurs, **STOP IMMEDIATELY**, roll back uncommitted changes, and mark status as `BLOCKED` with explicit failure output.
```
```

---

## 🤖 Subagent Autonomous Execution Prompt Template

When delegating a ticket to a subagent, supply this exact prompt format:

```text
You are an autonomous coding subagent working on TarotUpMyHeart / Meechie's Coloring Book under Seam-Driven Development.

Execute the following atomic ticket:
Ticket ID: [TICK-000a]
Task: [Task Title]

RULES:
1. Touch ONLY files listed in "Files Allowed to Touch". Do NOT modify forbidden files.
2. Maintain Seam-Driven Development rules — no acronyms, strict type validation (NO 'as any', NO '!').
3. Run verification command `cmd /c "npm run check"` upon completion.
4. Report back with exact test results.
```
