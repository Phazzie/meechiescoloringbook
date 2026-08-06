<!--
Purpose: Standardized Work Ticket System specification and template for Seam-Driven Development.
Why: Ensure deep, unambiguous, verifiable task scoping before any code edit.
Info flow: Ticket Template -> Task Scoping -> Implementation Plan -> Evidence Verification.
-->
# Seam-Driven Development Work Ticket System

This document specifies the official **Work Ticket System** for planning, scoping, and executing feature work, refactors, and seam implementations.

---

## 📋 Ticket Structure Requirements

Every work ticket must be defined in an `implementation_plan.md` artifact or PR description using this exact schema:

```markdown
### 🎫 Ticket ID: [TICK-000] - [Task Title]

- **Type of Work**: [Feature | Seam Implementation | Refactor | Docs | Verification]
- **Target Persona Alignment**: [Description of how this serves the adult cultural verdict persona]
- **Goal & Core Objective**: [Clear 1-2 sentence description of what will be built or changed]

---

### 📂 File Scoping Boundaries

- **Files Allowed to Touch** (Explicit Paths):
  - `src/routes/path/to/file.svelte`
  - `src/lib/adapters/path/to/adapter.ts`

- **Files Forbidden to Touch** (Protection Boundaries):
  - `contracts/` (Immutable contracts - require v2 if breaking)
  - `src/lib/core/` (Pure domain logic)
  - Unrelated routes or seams

- **Impacted Seams & Contracts**:
  - `MeechieToolSeam` ([contracts/meechie-tool.contract.ts](file:///C:/Users/shiva/.gemini/antigravity-ide/scratch/meechiescoloringbook/contracts/meechie-tool.contract.ts))
  - `ImageGenerationSeam` ([contracts/image-generation.contract.ts](file:///C:/Users/shiva/.gemini/antigravity-ide/scratch/meechiescoloringbook/contracts/image-generation.contract.ts))

---

### 🛠 Step-by-Step Technical Breakdown

1. **Step 1**: [Specific code change / refactor step]
2. **Step 2**: [Data transformation / state binding]
3. **Step 3**: [Error fallback / loading UI state]

---

### 🛡 Validation Strategy (Zero Type Escapes)

- **Input Validation**: Specify the Zod schema or Type Guard (`isUserPayload()`) used to parse un-trusted data.
- **DOM Events**: Enforce `instanceof` checks (e.g. `event.target instanceof HTMLInputElement`).
- **Forbidden Assertions**: Strictly zero `as any` type escapes or `!` non-null assertions allowed.

---

### 🏁 Definition of Done (DoD) & Acceptance Criteria

- [ ] All step-by-step changes implemented in allowed files only.
- [ ] Zero TypeScript errors in `cmd /c "npm run check"`.
- [ ] Contract & unit tests pass cleanly in `npm test`.
- [ ] No `as any` or `!` non-null assertions introduced.
- [ ] User-facing acceptance criteria verified via browser or Playwright smoke test.

---

### 💻 Execution & Verification Commands

```bash
# 1. Type check
cmd /c "npm run check"

# 2. Unit and contract tests
npm test

# 3. Full verification pipeline (for seam changes)
npm run verify
```

---

### 🛑 Safe Stop & Rollback Trigger

- **Stop Condition**: If an unexpected contract mismatch, missing fixture, or failing test occurs, **STOP IMMEDIATELY**, roll back uncommitted changes, and mark the ticket status as **BLOCKED** with explicit failure output pasted.
```
