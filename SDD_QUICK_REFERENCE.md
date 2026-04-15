<!--
Purpose: Quick reference guide for Seam-Driven Development methodology.
Why: Provide a single source of truth for the workflow, rules, and governance patterns used across this codebase.
Info flow: Core concepts and workflow steps -> governance practices -> checklists -> AI agent guidance.
-->

# Seam-Driven Development: A General-Purpose Guide

## What is Seam-Driven Development?

Seam-Driven Development is an engineering method that isolates side effects behind explicit boundaries — called **seams** — so behavior can be proven with real-world evidence before integration. Every seam gets a contract, a probe, fixtures, a mock, and an adapter, in that order.

The core problem it solves: developers (and AI agents) **assume** how external systems behave instead of **measuring** it. This causes silent integration failures, undocumented shortcuts, and conflicts discovered too late. Seam-Driven Development replaces assumptions with proof.

---

## Six-Step Workflow at a Glance

The workflow is strictly sequential. Each step produces an artifact that the next step consumes.

```
Step 1: Contract   →  contracts/<seam>.contract.ts      (schema + types + error codes)
Step 2: Probe      →  probes/<seam>.probe.mjs            (runs against real system)
Step 3: Fixtures   →  fixtures/<seam>/sample.json        (happy-path snapshot)
                      fixtures/<seam>/fault.json          (failure-path snapshot)
Step 4: Mock       →  src/lib/mocks/<seam>.mock.ts       (loads fixtures, zero logic)
Step 5: Tests      →  tests/contract/<seam>.test.ts      (runs against mock + adapter)
Step 6: Adapter    →  src/lib/adapters/<seam>.adapter.ts (real I/O, validates output)
```

Steps 1–5 can be completed and tested with no real I/O. The adapter (Step 6) is written last, after the contract is proven correct through the mock.

---

## Core Concepts

| Term | Definition |
|------|-----------|
| **Seam** | A boundary between your core logic and an external system (API, database, filesystem, browser storage, third-party service). |
| **Contract** | A schema that defines the seam's interface — inputs, outputs, constraints, and error modes. The single source of truth. |
| **Probe** | A script that runs against the real external system and captures its actual behavior as JSON. |
| **Fixture** | A deterministic JSON snapshot of real behavior, used by mocks and tests. For I/O seams, fixtures always come from the probe — never hand-written or invented. For pure seams (no external system to probe), fixtures may be hand-crafted but must still conform to the contract schema. |
| **Mock** | A fixture-backed implementation with zero custom logic. Loads fixtures by scenario, returns them exactly. |
| **Adapter** | The real implementation that performs I/O and validates its output against the contract. |

---

## Pure Seams vs. I/O Seams

Not all seams touch the outside world. This distinction matters because it changes what artifacts are required.

**I/O Seams** cross a process or network boundary — API calls, database queries, filesystem operations, browser storage. These require the full workflow: contract, probe, fixtures, mock, adapter.

**Pure Seams** are computation-only — validation, formatting, transformation, business rules. These need a contract, fixtures (which can be hand-crafted since there's no external system to probe), a mock, and an adapter. Probing is marked N/A because there's no external behavior to capture. Fixture freshness rules don't apply.

When registering a seam, mark its probe status as `N/A` if it's pure. This prevents your verification tooling from flagging it as stale.

---

## The Workflow

Follow this order. Do not skip steps.

### Step 1: Contract

Define the seam's interface as a schema. Zod is recommended because it produces both runtime validation and TypeScript types from a single definition, but any schema library works.

```typescript
// contracts/user-profile.contract.ts
import { z } from 'zod';
import { resultSchema, type Result } from './shared.contract';

export const UserProfileInputSchema = z.object({
  userId: z.string().min(1),
});

export const UserProfileOutputSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
});

// Use the shared resultSchema helper — keeps result + error shapes consistent across all seams.
// SeamErrorSchema (from shared.contract.ts) covers the error branch automatically.
export const UserProfileResultSchema = resultSchema(UserProfileOutputSchema);

export type UserProfileInput = z.infer<typeof UserProfileInputSchema>;
export type UserProfileResult = Result<z.infer<typeof UserProfileOutputSchema>>;

// The seam interface
export type UserProfileSeam = {
  getProfile(input: UserProfileInput): Promise<UserProfileResult>;
};
```

**Rules:**
- The contract is the law. Everything else must conform to it.
- Specify all constraints (min/max, regex, enums), not just types.
- Define error codes explicitly — don't leave failure modes implicit.
- Use a `Result<T>` envelope (`{ ok, value } | { ok, error }`) so success and failure are structurally distinct.

---

### Step 2: Probe (I/O seams only)

Run a script against the real external system. Capture what actually happens.

```typescript
// probes/user-profile.probe.mjs
import { writeFile } from 'fs/promises';

const API_KEY = process.env.USER_API_KEY;
const BASE_URL = process.env.USER_API_BASE_URL;

// Happy path: fetch a known user
const sampleResponse = await fetch(`${BASE_URL}/users/abc-123`, {
  headers: { Authorization: `Bearer ${API_KEY}` },
});
const sampleData = await sampleResponse.json();

await writeFile('fixtures/user-profile/sample.json', JSON.stringify({
  scenario: 'sample',
  input: { userId: 'abc-123' },
  output: { ok: true, value: sampleData },
  probedAt: new Date().toISOString().slice(0, 10),
}, null, 2));

// Fault path: fetch a non-existent user
const faultResponse = await fetch(`${BASE_URL}/users/does-not-exist`, {
  headers: { Authorization: `Bearer ${API_KEY}` },
});
const faultData = await faultResponse.json();

await writeFile('fixtures/user-profile/fault.json', JSON.stringify({
  scenario: 'fault',
  input: { userId: 'does-not-exist' },
  output: {
    ok: false,
    error: {
      code: 'USER_NOT_FOUND',
      message: `API returned ${faultResponse.status}`,
      details: faultData,
    },
  },
  probedAt: new Date().toISOString().slice(0, 10),
}, null, 2));

console.log('Fixtures written.');
```

**Rules:**
- Run against the real system — real API, real database, real filesystem.
- Capture output as JSON, not summaries or screenshots.
- Record the probe date. Fixtures go stale; you need to know when they were captured.
- Probe both the happy path and at least one failure path.
- For pure seams, skip this step entirely and mark the probe as N/A.
- **Secrets and PII:** Never write API keys, passwords, session tokens, or personally identifiable information into fixture files. Before committing a fixture, redact any sensitive values (e.g., replace real email addresses with `user@example.com`, replace real user IDs with opaque strings). Add fixture directories to your secrets-scanning rules so CI can catch accidental leaks.

---

### Step 3: Fixtures

Store the probe output as deterministic snapshots.

```text
fixtures/user-profile/
├── sample.json    # Happy path: valid input → valid output
└── fault.json     # Failure path: missing resource → structured error
```

**Fixture schema:**
```json
{
  "scenario": "sample",
  "input": { "userId": "abc-123" },
  "output": {
    "ok": true,
    "value": {
      "id": "abc-123",
      "email": "user@example.com",
      "displayName": "Jane Doe",
      "createdAt": "2025-06-15T10:30:00Z"
    }
  },
  "probedAt": "2025-07-01"
}
```

**Rules:**
- `sample.json`: Must represent a valid, working interaction.
- `fault.json`: Must represent a real failure mode (not invented).
- Both come from the probe, never hand-crafted (for I/O seams).
- For pure seams, fixtures can be hand-crafted since there's no external system — but they must still conform to the contract schema.
- Keep I/O fixtures fresh. Define a staleness threshold (7 days is a reasonable default) and enforce it in your verification tooling.
- The `input` field is stored alongside the output so tests can replay the exact call.

---

### Step 4: Mock

A fixture-backed implementation with **zero custom logic**.

```typescript
// mocks/user-profile.mock.ts
import type { UserProfileSeam, UserProfileInput } from '../contracts/user-profile.contract';
import sampleFixture from '../../fixtures/user-profile/sample.json';
import faultFixture from '../../fixtures/user-profile/fault.json';

type Scenario = 'sample' | 'fault';

export const createUserProfileMock = (scenario: Scenario): UserProfileSeam => ({
  getProfile: async (input: UserProfileInput) => {
    const fixture = scenario === 'fault' ? faultFixture : sampleFixture;
    return fixture.output;
  },
});
```

**Rules:**
- The mock is a factory function. The scenario is bound at construction, not per-call. This ensures a mock instance is locked to one behavior.
- Load fixtures, return them. No conditional logic, no data transformation, no invention.
- Parse fixtures against the contract schema at load time if your language supports it. This catches schema drift early.
- The mock exists so you can write and run contract tests before the adapter exists.

---

### Step 5: Contract Tests

Write tests that prove the fixtures work with both the mock and the adapter.

```typescript
// tests/contract/user-profile.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUserProfileMock } from '../../mocks/user-profile.mock';
import { userProfileAdapter } from '../../adapters/user-profile.adapter';
import sampleFixture from '../../fixtures/user-profile/sample.json';
import faultFixture from '../../fixtures/user-profile/fault.json';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UserProfile contract', () => {
  // Mock tests — run first, no I/O
  it('mock returns sample fixture on success', async () => {
    const mock = createUserProfileMock('sample');
    const result = await mock.getProfile(sampleFixture.input);
    expect(result).toEqual(sampleFixture.output);
  });

  it('mock returns fault fixture on failure', async () => {
    const mock = createUserProfileMock('fault');
    const result = await mock.getProfile(faultFixture.input);
    expect(result).toEqual(faultFixture.output);
  });

  // Adapter tests — stub the I/O, verify contract conformance
  it('adapter returns contract-conformant output for sample input', async () => {
    // Stub fetch, database client, etc.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleFixture.output.value,
    }));

    const result = await userProfileAdapter.getProfile(sampleFixture.input);
    expect(result).toEqual(sampleFixture.output);
  });

  it('adapter returns structured error for fault input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'User not found' }),
    }));

    const result = await userProfileAdapter.getProfile(faultFixture.input);
    expect(result).toEqual(faultFixture.output);
  });
});
```

**The critical rule: Red Proof.** The fault fixture must produce a failure through the mock *before* you write the adapter. This proves the contract can detect bad states. If your fault fixture passes when it shouldn't, your contract has a gap.

---

### Step 6: Adapter

The real implementation. This is the only component that performs actual I/O.

```typescript
// adapters/user-profile.adapter.ts
import { UserProfileResultSchema } from '../contracts/user-profile.contract';
import type { UserProfileSeam, UserProfileInput } from '../contracts/user-profile.contract';

const BASE_URL = process.env.USER_API_BASE_URL;
const API_KEY = process.env.USER_API_KEY;

if (!BASE_URL || !API_KEY) {
  throw new Error('USER_API_BASE_URL and USER_API_KEY environment variables are required');
}

export const userProfileAdapter: UserProfileSeam = {
  getProfile: async (input: UserProfileInput) => {
    const response = await fetch(`${BASE_URL}/users/${input.userId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: response.status === 404 ? 'USER_NOT_FOUND' : 'SERVICE_UNAVAILABLE',
          message: `API returned ${response.status}`,
        },
      };
    }

    const data = await response.json();

    // Validate against contract — the adapter does not trust the external system
    const parsed = UserProfileResultSchema.safeParse({ ok: true, value: data });
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'INPUT_INVALID', message: 'Response did not match contract schema' },
      };
    }

    return parsed.data;
  },
};
```

**Rules:**
- The adapter is the only place where real I/O happens.
- Validate all external data against the contract schema. Never trust the outside world.
- Map external errors to your contract's error codes.
- Wrap raw I/O behind controlled interfaces when possible (sandboxed filesystem wrappers, connection pools, etc.) — but only if your project needs it. Don't add abstraction layers you won't use.

---

## Governance

Seam-Driven Development's value collapses without enforcement. The methodology must be checked mechanically, not just documented.

### Seam Registry

Maintain an inventory of every seam in your project — a markdown table, a JSON manifest, a YAML file, whatever your team prefers. This is the source of truth for your verification tooling.

Each entry should track:
- Seam name
- Whether it's pure or I/O
- Paths to its artifacts (contract, probe, fixtures, mock, tests, adapter)
- Last probe date (or N/A for pure seams)

**When you add a new seam, register it here first.** When you remove a seam, remove it from the registry. Verification reads this file to know what to check.

### Verification Pipeline

Build automated checks that answer these questions:

1. **Artifact completeness:** Does every registered seam have all required artifacts? (Contract, fixtures, mock, tests, adapter — and probe for I/O seams.)
2. **Fixture freshness:** For I/O seams, were the probes run within your staleness threshold?
3. **Contract tests pass:** Do all contract tests pass?
4. **Schema conformance:** Do fixtures parse cleanly against the contract schema?

Wire these checks into a single command (`npm run verify`, `make verify`, whatever fits your stack). Run it in CI. Fail the build if any check fails.

### Decision Log

Every change to a seam's contract should have a dated entry explaining:
- What changed and why
- Which seams are affected
- What evidence supports the change (test output, probe results)
- Known risks

This isn't process for the sake of process — it's how you trace integration failures back to the decision that caused them. When an external API changes and your probe catches it, the decision log shows exactly what you assumed and when.

For teams using AI agents, the decision log is especially valuable. It forces the agent to justify contract changes with evidence rather than just making them.

---

## Principles

These are the rules that make Seam-Driven Development work. Breaking them undermines the entire system.

1. **Reality First** — If a seam touches the real world, you must probe it and capture fixtures. No exceptions.
2. **Determinism** — Mocks load fixtures. They never invent data, generate random values, or contain conditional logic.
3. **Contract First** — The contract schema is the law. Adapters and mocks must conform to it. If reality doesn't match the contract, update the contract (and re-probe), don't hack the adapter.
4. **Red Proof** — The fault fixture must fail through the mock before the adapter is written. This proves the contract can detect failures.
5. **Mechanical Enforcement** — Every rule that matters must be checked by code (lint, verify, CI), not just written in docs. If a rule can be broken silently, it will be.

---

## Adding a New Seam: Checklist

- [ ] Determine if the seam is pure or I/O
- [ ] Define the contract with schema, types, and error codes
- [ ] Register the seam in your seam inventory
- [ ] (I/O only) Write and run a probe against the real system
- [ ] Create fixtures: `sample.json` (happy path) and `fault.json` (failure path)
- [ ] Write the mock — loads fixtures by scenario, zero logic
- [ ] Write contract tests — fault fixture must fail (Red Proof)
- [ ] Write the adapter — real I/O, validates output against contract
- [ ] Run your verification pipeline — all checks must pass
- [ ] (If applicable) Add a decision log entry

---

## Modifying an Existing Seam: Checklist

- [ ] Update the contract schema to reflect the new behavior
- [ ] (I/O only) Re-run the probe to capture fresh fixtures
- [ ] Update fixtures to match the new contract
- [ ] Update mock if fixture structure changed
- [ ] Update contract tests
- [ ] Update the adapter
- [ ] Run verification — all checks must pass
- [ ] Add a decision log entry explaining the change and evidence

---

## For AI Agents

AI agents are especially prone to the failures Seam-Driven Development prevents: assuming behavior, optimizing for visible progress over correctness, and drifting from instructions. If you're an AI agent working in a Seam-Driven Development codebase, follow these rules:

1. **Identify the seam.** Before writing code, ask: does this touch an external system? If yes, it's a seam and the full workflow applies.
2. **Check the registry.** Does this seam already exist? If so, read its contract before making changes. If not, register it.
3. **Contract first.** Define or update the contract before writing implementation code.
4. **Probe before you assume.** If the seam is I/O and you don't have fresh fixtures, run the probe. Don't guess what an API returns.
5. **Red Proof before adapter.** Write the fault test and watch it fail through the mock before writing the adapter.
6. **Verify before declaring done.** Run the full verification pipeline. All checks must pass.

**Never skip steps. Never invent data. Never assume behavior.**

---

## What Seam-Driven Development Prevents

- Assumptions treated as facts
- Silent integration failures discovered in production
- Mocks that don't match real system behavior
- API changes breaking adapters without warning
- Undocumented shortcuts accumulating as tech debt
- Multiple contributors (human or AI) making conflicting changes

## What Seam-Driven Development Enables

- Provable, testable boundaries between your code and the outside world
- Multiple developers or AI agents working on the same codebase safely
- Early detection of integration issues (at probe time, not deploy time)
- Deterministic, auditable changes with a clear evidence trail
- Confidence that your mocks actually represent reality
