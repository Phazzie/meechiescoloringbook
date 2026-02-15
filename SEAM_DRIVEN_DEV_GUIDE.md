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
