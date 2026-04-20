# Seam-Driven Development: Quick Reference for AI Agents

## What is a Seam?

A **seam** is a boundary between core logic and external systems (APIs, filesystem, network, browser APIs). SDD makes these boundaries explicit, testable, and verifiable before integration.

## The Core Problem

AI agents (and humans) assume behavior instead of measuring it. This causes:
- Silent integration failures
- The "70% problem" (UI works, but logic doesn't everywhere)
- Undocumented assumptions piling up
- Discovery of conflicts too late

**SDD solves this by forcing proof, not assumptions.**

---

## The Workflow: "The Liquid Loop"

Every seam follows this **strict order**. Do not skip steps.

### 1. **Contract** (`contracts/<seam>.contract.ts`)
Define the seam's interface as a Zod schema.
```typescript
// Example: spec-validation.contract.ts
export const ColoringPageSpecSchema = z.object({
  itemNumber: z.number().min(1),
  label: z.string().regex(/^[A-Za-z0-9\s\-.,!?]+$/), // no newlines
  shadingMode: z.enum(['solid', 'gradient']),
  // ... more fields
});

export type ColoringPageSpec = z.infer<typeof ColoringPageSpecSchema>;
```

**Rules:**
- Source of truth for the seam
- Must specify all constraints and error modes
- Include validation rules, not just type hints

---

### 2. **Probe** (`probes/<seam>.probe.ts`)
Capture real-world behavior from the actual dependency.

```typescript
// Example: image-generation.probe.mjs
import { xaiImageGenAPI } from './xai-api.js';

const result = await xaiImageGenAPI.generate({
  prompt: "Generate a coloring page...",
  size: "1024x1024",
});
console.log(JSON.stringify(result, null, 2));
```

**Rules:**
- Run against real external systems (actual API, real filesystem, etc.)
- Capture output as JSON
- Record the probe date (e.g., `2024-02-15`)
- Status: `N/A` for pure logic, `YYYY-MM-DD` for real-world seams

---

### 3. **Fixtures** (`fixtures/<seam>/`)
Store real behavior snapshots as JSON.

```
fixtures/image-generation/
├── sample.json      # Happy path: valid prompt → valid image
└── fault.json       # Failure path: invalid prompt → error
```

**Rules:**
- `sample.json`: Happy path (must be valid, must work)
- `fault.json`: Failure path (must fail, must trigger adapter error handling)
- Both are real outputs from the probe, never invented
- Keep fixtures ≤ 7 days old (verified by `npm run verify`)

---

### 4. **Mock** (`src/lib/mocks/<seam>.mock.ts`)
Fixture-backed implementation with **zero custom logic**.

```typescript
// Example: spec-validation.mock.ts
import sampleFixture from '../../fixtures/spec-validation/sample.json';
import faultFixture from '../../fixtures/spec-validation/fault.json';

export const specValidationMock = {
  validate(spec, scenario) {
    const fixture = scenario === 'fault' ? faultFixture : sampleFixture;
    if (fixture.error) throw new Error(fixture.error);
    return fixture.data;
  }
};
```

**Rules:**
- Load fixtures by scenario, nothing else
- No invented data, no logic
- Return fixture output exactly as captured
- Used in contract tests before adapter is written

---

### 5. **Adapter** (`src/lib/adapters/<seam>.adapter.ts`)
Real I/O implementation that validates against the contract.

```typescript
// Example: image-generation.adapter.ts
import { ColoringImageSchema } from '../contracts/image-generation.contract';

export const imageGenerationAdapter = {
  async generate(prompt) {
    const response = await fetch('/api/image-generation', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();

    // Validate against contract
    return ColoringImageSchema.parse(data);
  }
};
```

**Rules:**
- Implement real I/O (API calls, filesystem, etc.)
- Validate output against contract schema
- Use `JailedFs` for filesystem (never raw `fs`)
- Only async I/O (no `*Sync` calls)

---

## The Contract Tests

After steps 1-4, write tests that prove the fixtures and adapter work:

```typescript
// tests/contract/image-generation.test.ts
import { imageGenerationMock } from '../../src/lib/mocks/image-generation.mock';
import { imageGenerationAdapter } from '../../src/lib/adapters/image-generation.adapter';
import sampleFixture from '../../fixtures/image-generation/sample.json';
import faultFixture from '../../fixtures/image-generation/fault.json';

describe('Image Generation Contract', () => {
  it('mock returns sample fixture on success', async () => {
    const result = await imageGenerationMock.generate(sampleFixture.input, 'sample');
    expect(result).toEqual(sampleFixture.data);
  });

  it('fault fixture fails before adapter work', async () => {
    expect(() => imageGenerationMock.generate(faultFixture.input, 'fault'))
      .toThrow();
  });

  it('adapter returns same output as mock for sample', async () => {
    const mockResult = await imageGenerationMock.generate(sampleFixture.input, 'sample');
    const adapterResult = await imageGenerationAdapter.generate(sampleFixture.input);
    expect(adapterResult).toEqual(mockResult);
  });
});
```

**Key Rule:** The fault fixture must fail the mock before you write the adapter. This is "Red Proof."

---

## Quick Checklist for a New Seam

- [ ] **Contract** defined with Zod schema (all constraints explicit)
- [ ] **Probe** run against real system, output captured as JSON
- [ ] **Fixtures** created: `sample.json` (works), `fault.json` (fails)
- [ ] **Mock** loads fixtures with zero custom logic
- [ ] **Tests** verify mock and adapter both use fixtures
- [ ] **Adapter** implements real I/O and validates against contract
- [ ] Run `npm run verify` to check artifacts and freshness

---

## Example: The Spec Validation Seam

**Contract:** Defines `ColoringPageSpec` with all validation rules
- Item number ≥ 1
- Label: alphanumeric + spaces/hyphens/punctuation (no newlines)
- Shading modes only valid with decorations

**Probe:** Test real input validation (date: 2024-02-15)

**Fixtures:**
- `sample.json`: Valid spec with all fields correct
- `fault.json`: Invalid spec with item number 0, newline in label, invalid shading

**Mock:** Loads sample or fault fixture, returns or throws based on scenario

**Tests:** Verify both mock and adapter reject the fault fixture before adapter is written

**Adapter:** Runs Zod parsing twice (raw input → spec, then strict validation)

---

## Key Rules (Do Not Break These)

1. **Reality First** — If a seam touches the real world, you must probe it and capture fixtures
2. **Determinism** — Mocks must load fixtures, never invent data
3. **Contract First** — The contract schema is the law; everything else must match it
4. **Red Proof** — The fault fixture must fail the mock before the adapter is written
5. **No Raw I/O in Adapters** — Use `JailedFs`, never raw `fs` imports
6. **Fixture Freshness** — Probes ≤ 7 days old (enforced by `npm run verify`)
7. **Mechanical Enforcement** — Rules are in code/lint, never just in docs

---

## Commands

```bash
npm run verify          # Master command: runs all checks
npm run test            # Run contract tests
npm test -- --watch    # Watch mode for development
npm run seam:ledger     # Generate seam coverage summary
npm run proof:tape      # Plain-English evidence summary
```

---

## What SDD Prevents

- ✗ Assumptions without proof
- ✗ Silent integration failures
- ✗ Undocumented shortcuts
- ✗ API changes breaking adapters silently
- ✗ Conflicts discovered too late

---

## What SDD Enables

- ✓ Provable, testable boundaries
- ✓ Multiple AI agents working on same codebase safely
- ✓ Explicit contracts before implementation
- ✓ Deterministic, auditable changes
- ✓ Early detection of integration issues
- ✓ Clear evidence of correctness

---

## For AI Agents: Before You Code

1. **Ask:** Is this a seam (touches external system)?
2. **Check:** Does the contract exist? If not, define it first.
3. **Probe:** If new, run a probe and capture fixtures.
4. **Test:** Write contract tests using fixtures.
5. **Implement:** Write the adapter, validate against contract.
6. **Verify:** Run `npm run verify` — all checks must pass.

**Never skip steps. Never invent data. Never assume behavior.**

---

## Mandatory Planning Step

Before writing any code, produce a **Plan + Self-Critique** covering:

- **Goal**: Exact seam names being touched (from `docs/seams.md`)
- **Files**: Exact file paths to be created or modified
- **Commands**: Exact commands that will be run
- **Risk**: Riskiest assumption in your plan
- **Proof**: What evidence you will capture to validate it

Do not start coding until you can answer all five. This is how you prove you understand the change before you make it.

---

## Non-Negotiable Adapter Rules

These are hard rules, not guidelines. Breaking any of them invalidates the seam.

| Rule | Detail |
|------|--------|
| No direct `fs` imports | Use `JailedFs` only — never `import fs` or `import { promises } from 'fs'` |
| No sync I/O | Every `*Sync` call is banned in adapters |
| No `process.cwd()` in core logic | Inject paths — never resolve them inside domain code |
| No third-party libs off-seam | Libraries may only be used behind seam adapters |
| No invented data in mocks | Mocks load fixtures only — zero custom logic |

---

## Two Failure Modes SDD Guards Against

**1. Integration Hell**
Seams look fine in isolation but fail when stitched together. Caused by untested boundaries, mismatched schemas, or silent format changes. SDD fixes this by requiring contract + fixture + contract test *before* the adapter exists.

**2. AI Non-Compliance**
AI agents skip steps, do I/O off-seam, loosen specs to make tests pass, or invent fixture data. SDD fixes this with mechanical verification (`npm run verify`) that fails loudly when any artifact is missing, stale, or mismatched.

---

## Lessons Learned in Practice

These are real mistakes this codebase encountered and solved.

### Validation Seams Must Accept Raw Input

**Problem:** A strict Zod schema on input blocks fault fixtures — invalid data can't even enter the seam to be tested.

**Solution:** Use a *raw/permissive* schema for input, then validate against the *strict* schema inside the adapter. The seam accepts anything; the adapter decides what's valid.

```typescript
// Two-stage validation pattern
const rawSpec = RawSpecSchema.parse(input);     // permissive — lets fault fixtures in
const validSpec = StrictSpecSchema.parse(rawSpec); // strict — this is where faults are caught
```

---

### Prompt Template Changes Break Fixtures Silently

**Problem:** Changing a prompt template without updating fixtures and drift checks causes contract tests to pass but produces wrong real-world output.

**Solution:** Any time a prompt template changes, update fixtures and drift checks in the *same commit*. Keep an exact alignment sentence shared across `PromptAssemblySeam`, `DriftDetectionSeam`, fixtures, and probes — extract it into a shared utility.

---

### Forbidden Token Detection Trips on Internal Lines

**Problem:** Drift detection scanning for forbidden tokens (e.g., "color", "fill") can match lines inside the prompt template itself, not just the model output.

**Solution:** Sanitize the scan — skip lines that are part of the prompt template or known-allowed strings before running drift detection.

---

### Provider Limits Are a Hard Contract

**Problem:** A canonical prompt that exceeds the provider's character limit (e.g., xAI's 1024-char limit) silently fails or gets truncated, breaking everything downstream.

**Solution:** Add a prompt-length guard inside `PromptAssemblySeam`. The canonical (full) prompt is your proof; the compressed provider prompt is a derivative that must stay within limits. If limits change, update the fixture and re-run the probe.

---

### DNS/Network Failures Look Like Missing Credentials

**Problem:** A probe that fails with a network error is indistinguishable from one that fails due to wrong API keys. Treating them the same leads to wrong assumptions recorded.

**Solution:** Capture the exact error output under `docs/evidence/`. Record what was tried and what the actual failure was.

---

### Browser Seams Need a Real Browser to Probe

**Problem:** `localStorage`-backed seams (Session, AuthContext, CreationStore) cannot be probed from Node.js — the browser storage APIs simply don't exist there.

**Solution:** Use Playwright to probe browser seams. Run `node probes/browser-seams.probe.mjs` with escalated permissions when needed and capture output as evidence.

---

### Integration Tests Must Be Gated

**Problem:** Integration tests that call real external APIs run silently during offline development, fail intermittently, or rack up API costs.

**Solution:** Gate all integration tests behind environment flags:
```bash
FEATURE_INTEGRATION_TESTS=true XAI_API_KEY=... npm test
```
Tests skip gracefully when the flags are absent.

---

## Blocked Probe Protocol

When a probe cannot run (no credentials, network blocked, sandbox restriction):

1. **Stop** — do not guess or invent fixture data
2. **Declare BLOCKED** in your work log
3. **Record an `Assumption` entry in `DECISIONS.md`** with:
   - `Date`, `Seams`, `Statement` (what you assumed), `Validation` (how it will be proved), `Status`
4. **Run `npm run assumption:alarm`** to document the gate
5. **Capture the failing probe output** under `docs/evidence/YYYY-MM-DD/` so the block is explicit and traceable

A blocked probe with a recorded assumption is fine. A blocked probe with invented fixture data is not.

---

## Evidence Storage Convention

All evidence lives under `docs/evidence/YYYY-MM-DD/`. When you run `npm run verify`, it generates:

| File | What It Contains |
|------|-----------------|
| `chamber-lock.json` | Artifact presence gate — all seam files exist |
| `shaolin-lint.json` | Fixture freshness — probes ≤ 7 days old |
| `seam-ledger.json` / `.md` | Coverage summary — all seams tracked |
| `clan-chain.md` | Clean vs. dirty seam status |
| `proof-tape.md` | Plain-English summary of evidence |
| `assumption-alarm.json` | Blocked probe tracking |
| `npm-test.txt` / `npm-verify.txt` | Raw command outputs |

Evidence is not optional. A change without evidence is unverified.
