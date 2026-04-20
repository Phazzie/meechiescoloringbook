# Seam-Driven Development: Gold Standard Self-Contained Guide for AI Agents

## Preamble: What This Document Is For

This guide teaches **Seam-Driven Development (SDD)** to an AI agent that has never encountered it before. You should be able to read this once, apply it perfectly, and never need external context.

**Assumed knowledge:** You understand Node.js (async/await, imports), TypeScript basics (types, interfaces), git, and the concept of testing. You do not need to know Zod, mocking patterns, or SDD concepts — we explain all of those.

**What you'll learn:** How to write testable, provable code that other AIs can trust. How to make boundaries explicit so nothing breaks in production. How to produce evidence for every claim.

---

## Part 1: Foundational Concepts

### What Is a Seam?

A **seam** is a boundary between your code and the outside world. Examples:

- **Filesystem** — your code calls `fs.readFile()` to load a config
- **Network** — your code calls `fetch()` to hit an API
- **Browser storage** — your code calls `localStorage.getItem()`
- **System processes** — your code spawns a child process or reads environment variables
- **Time/randomness** — your code calls `Date.now()` or `Math.random()`

**Core insight:** These boundaries are where bugs hide. The API returns unexpected JSON. The file doesn't exist. The network times out. The environment variable is missing. Your code *assumes* the happy path works and never proves it.

**The seam is where assumptions live.**

---

### Why Boundaries Matter

Consider this function:

```javascript
function generateColoring(spec) {
  const prompt = buildPrompt(spec);           // Pure logic ✓
  const image = fetch('/api/image', prompt);  // ← SEAM: network boundary
  const result = processImage(image);         // Pure logic ✓
  return result;
}
```

**Problem:** You can test `buildPrompt()` and `processImage()` in isolation. But `fetch()` depends on the network, the API server, the API authentication, the API implementation, and a hundred other things outside your control. When the test passes locally but fails in production, where's the bug? You don't know.

**What SDD does:** It makes the seam explicit. Now you:

1. **Prove** what the API *actually* returns (run a real probe)
2. **Capture** that behavior as a fixture (JSON snapshot)
3. **Test** your code against that fixture (deterministic mock)
4. **Adapt** the fixture to your code's needs (adapter)
5. **Verify** everything matches (contract tests)

Now when the API changes, you *notice* because the fixture no longer matches. The test fails loudly.

---

### Two Ways Code Fails in Production

**Failure Mode 1: Integration Hell**
Your code works in isolation, but when stitched together with other code, it breaks. The API returns a different format than expected. The file path is wrong. The environment variable is missing. You never proved the boundaries actually match.

**Failure Mode 2: AI Non-Compliance**
An AI agent (like you) skips steps, invents fixture data, does I/O off-seam, or loosens tests to make them pass. The code looks correct until real users hit it.

**SDD prevents both** by forcing explicit, measurable proof before production.

---

### The Core Principle: Proof, Not Assumptions

In SDD, you never assume behavior. You never say "the API probably returns JSON." You never guess what the file contains. You **prove** it.

- Assumption: "The image API returns `{ url: string }`"
- Proof: Run the actual API, capture the output, write it down. Now you know exactly what it returns.

Every rule in SDD serves this principle: **make it impossible to assume.**

---

## Part 2: The Seam-Driven Development Workflow

### Overview: The Five-Step "Liquid Loop"

Every seam follows these five steps, in order. Skipping any step invalidates the seam. This is not flexible — it is strict by design.

```
1. CONTRACT (define interface)
   ↓
2. PROBE (capture real behavior)
   ↓
3. FIXTURES (store snapshots)
   ↓
4. MOCK (fixture-backed test double)
   ↓
5. ADAPTER (real implementation)
```

Each step builds on the previous one. Step 4 (mock) cannot be written until Step 3 (fixtures) is complete. Step 5 (adapter) cannot be written until Step 4 (mock) is tested. This ordering is non-negotiable.

**Why the order matters:**

- If you write the **adapter first**, you invent what the API should return. The test passes, but the real API returns something different. Production breaks.
- If you write the **mock first**, you invent fixture data. The test passes with invented data, but fails with real data. Production breaks.
- If you **probe first** and capture real behavior, you know exactly what to expect. Tests pass because they're based on reality, not invention.

---

### Step 1: The Contract

**Purpose:** Define the seam's interface as a legal document. The contract is the law. Everything else must match it.

**What you're defining:**
- Input: What data flows into this seam?
- Output: What data flows out?
- Failure: What errors can happen? What do they look like?
- Constraints: What rules must hold? (e.g., "string must not be empty")

**Where it lives:** `contracts/<seam-name>.contract.ts`

**Implementation:** Use Zod, a TypeScript validation library. Zod lets you define schemas as code.

```typescript
// Example: contracts/image-generation.contract.ts

import { z } from 'zod';

// What flows IN to this seam
export const ImageGenerationInputSchema = z.object({
  prompt: z.string().min(1).max(1024),
  size: z.enum(['1024x1024', '512x512']),
});

// What flows OUT of this seam (success case)
export const ImageSchema = z.object({
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// What errors can happen? (failure case)
export class ImageGenerationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}
```

**Key insight:** The contract doesn't say "the API probably returns this." It says "the API *must* return exactly this, or it violates the contract."

**How you know you're done:** You can hand the contract to someone unfamiliar with the code and they understand exactly what flows in, what flows out, and what can go wrong.

---

### Step 2: The Probe

**Purpose:** Run the real seam against the real external system. Capture exactly what happens. No guessing.

**What you do:**
1. Create a standalone script that hits the actual external system (real API, real filesystem, real browser)
2. Provide real inputs
3. Capture the output as JSON
4. Commit that JSON as evidence

**Where it lives:** `probes/<seam-name>.probe.mjs` (or `.ts`)

**Example:**

```javascript
// probes/image-generation.probe.mjs
import fetch from 'node-fetch';

const prompt = 'Generate a coloring page for kids with simple shapes.';
const response = await fetch('https://api.xai.com/image', {
  method: 'POST',
  body: JSON.stringify({ prompt, model: 'grok-imagine' }),
  headers: { 'Authorization': `Bearer ${process.env.XAI_API_KEY}` }
});

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
```

**Run it:** `node probes/image-generation.probe.mjs > output.json`

**What you capture:** The real API response. The exact JSON. The exact error message if it fails.

**Status:** Each probe records when it was last run. If it was probed on 2025-02-15, the status is "2025-02-15". If it's pure logic (no external system), the status is "N/A".

**Why this step exists:** Because the API might return different data than you think. The API might return null instead of a string. It might fail in unexpected ways. The only way to know is to run it.

**If you skip this step:** You invent what the API returns. Tests pass with invented data but fail in production.

---

### Step 3: Fixtures

**Purpose:** Store the real behavior as JSON snapshots. These are the source of truth.

**What you create:**
- `fixtures/<seam-name>/sample.json` — happy path (input that works)
- `fixtures/<seam-name>/fault.json` — failure path (input that should fail)

Both are **real outputs from the probe**, never invented.

**Example:**

```json
// fixtures/image-generation/sample.json
{
  "input": {
    "prompt": "Generate a coloring page for kids with simple shapes."
  },
  "data": {
    "url": "https://images.xai.com/abc123.png",
    "width": 1024,
    "height": 1024
  }
}
```

```json
// fixtures/image-generation/fault.json
{
  "input": {
    "prompt": "x" // too short, violates contract
  },
  "error": {
    "code": "INVALID_PROMPT",
    "message": "Prompt must be at least 10 characters"
  }
}
```

**Key rule:** These are **real outputs from the probe**. Not invented. Not guessed. Captured.

**Freshness:** Fixtures must be ≤ 7 days old. If the API changed 10 days ago but you didn't re-probe, the fixture is stale and your tests are wrong. Automation checks this.

**Why two fixtures?**
- **Sample** proves happy-path works. Your code handles valid input correctly.
- **Fault** proves error-handling works. Your code rejects invalid input correctly.

**If you skip this step:** You invent fixture data. Tests pass with invented data. Real API behaves differently. Production breaks.

---

### Step 4: The Mock

**Purpose:** Create a test double that behaves exactly like the real seam, but uses fixtures instead of external systems. Used in contract tests to verify the interface *before* the adapter is written.

**Key constraint:** The mock loads fixtures and returns them. Zero custom logic. Zero invented behavior.

**Where it lives:** `src/lib/mocks/<seam-name>.mock.ts`

**Implementation:**

```typescript
// src/lib/mocks/image-generation.mock.ts
import sampleFixture from '../../fixtures/image-generation/sample.json';
import faultFixture from '../../fixtures/image-generation/fault.json';

export const imageGenerationMock = {
  async generate(input, scenario) {
    const fixture = scenario === 'fault' ? faultFixture : sampleFixture;

    if (fixture.error) {
      throw new Error(fixture.error.message);
    }

    return fixture.data;
  }
};
```

**How it's used:** In contract tests, you call `imageGenerationMock.generate(input, 'sample')` and verify it returns `sampleFixture.data`. You call it with `'fault'` and verify it throws an error.

**Why zero logic?** If the mock has custom logic, the test passes but the real adapter works differently. The seam breaks in production.

**If you skip this step:** You write the adapter without testing the interface first. The adapter looks good, but the real API returns something different. Production breaks.

---

### Step 5: The Adapter

**Purpose:** Implement the real I/O. Hit the actual external system. Validate output against the contract.

**Where it lives:** `src/lib/adapters/<seam-name>.adapter.ts`

**Implementation:**

```typescript
// src/lib/adapters/image-generation.adapter.ts
import { ImageGenerationInputSchema, ImageSchema } from '../contracts/image-generation.contract';

export const imageGenerationAdapter = {
  async generate(input) {
    // Validate input against contract
    const validated = ImageGenerationInputSchema.parse(input);

    // Call real external system
    const response = await fetch('https://api.xai.com/image', {
      method: 'POST',
      body: JSON.stringify(validated),
      headers: { 'Authorization': `Bearer ${process.env.XAI_API_KEY}` }
    });

    const data = await response.json();

    // Validate output against contract
    return ImageSchema.parse(data);
  }
};
```

**Key rules:**
- Validate input before calling external system
- Validate output after receiving it
- If validation fails, an error is thrown (caught by caller)
- Never invent data
- Never assume the external system returns what you expect

**Important:** Never import `fs` directly in an adapter. Use `JailedFs` instead.

**What is `JailedFs`?** A wrapper around filesystem operations that:
- Prevents directory traversal (`../../../etc/passwd`)
- Centralizes all file I/O in one seam
- Makes file I/O testable and auditable

---

### Contract Tests: Proving the Interface Works

After all five steps are written, tests verify that the mock and adapter both honor the contract.

**Where:** `tests/contract/<seam-name>.test.ts`

**What it tests:**
1. Mock returns the sample fixture
2. Mock throws an error on the fault fixture
3. Adapter returns the same output as mock for sample
4. Adapter throws an error on fault

```typescript
// tests/contract/image-generation.test.ts
import { imageGenerationMock } from '../src/lib/mocks/image-generation.mock';
import { imageGenerationAdapter } from '../src/lib/adapters/image-generation.adapter';
import sampleFixture from '../fixtures/image-generation/sample.json';
import faultFixture from '../fixtures/image-generation/fault.json';

describe('ImageGenerationSeam Contract', () => {
  // Test 1: Mock is correct
  it('mock returns sample fixture on success', async () => {
    const result = await imageGenerationMock.generate(sampleFixture.input, 'sample');
    expect(result).toEqual(sampleFixture.data);
  });

  // Test 2: Fault fixture fails (RED PROOF)
  it('fault fixture fails the mock', async () => {
    expect(() => imageGenerationMock.generate(faultFixture.input, 'fault')).toThrow();
  });

  // Test 3: Adapter matches mock on sample
  it('adapter returns same output as mock for sample', async () => {
    const mockResult = await imageGenerationMock.generate(sampleFixture.input, 'sample');
    const adapterResult = await imageGenerationAdapter.generate(sampleFixture.input);
    expect(adapterResult).toEqual(mockResult);
  });

  // Test 4: Adapter throws on fault
  it('adapter rejects fault fixture', async () => {
    expect(() => imageGenerationAdapter.generate(faultFixture.input)).toThrow();
  });
});
```

**Critical rule: Red Proof**

The fault fixture must fail the mock test *before* the adapter is written. This is non-negotiable.

Why? Because it forces you to think about error cases before implementing success cases. If you skip this:
- You implement the happy path
- Tests pass
- You never test error handling
- In production, an error occurs and the code crashes

Red proof prevents this. The fault test fails first, forcing you to write error-handling logic.

---

## Part 3: Decision Trees and Workflows

### Decision Tree: Is This a Seam?

```
Does this code call an external system?
├─ Yes → This is a seam
│  ├─ Can you probe the real system? (API running, credentials available, no firewall blocks)
│  │  ├─ Yes → Run the probe
│  │  └─ No → Record a blocked probe in DECISIONS.md (see "Blocked Probe Protocol")
│  └─ Create fixtures from probe output
└─ No → This is pure logic
   ├─ Can it fail? (input validation, constraints)
   │  ├─ Yes → Create a contract with sample/fault fixtures
   │  └─ No → No seam needed
```

---

### Decision Tree: Can I Invent Fixture Data?

```
Do I have real output from the probe?
├─ Yes → Use that. Never invent.
└─ No → Can I run the probe?
   ├─ Yes → Run it now. Get real data.
   └─ No → Record blocked probe. Don't invent.
```

**Rule:** If you can't prove it's real, don't ship it.

---

### Workflow: Before You Write Any Code

Before implementing anything, write a **Plan + Self-Critique** with:

1. **Goal** — What seams are being touched? (from `docs/seams.md`)
2. **Files** — Exact file paths you'll create/modify
3. **Commands** — Exact commands you'll run
4. **Riskiest Assumption** — What could be wrong?
5. **Validation Evidence** — How will you prove it works?

**Example:**

```
Goal: Add image generation to the app (ImageGenerationSeam)
Files: contracts/image-generation.contract.ts, fixtures/image-generation/*, 
       src/lib/mocks/image-generation.mock.ts, src/lib/adapters/image-generation.adapter.ts,
       tests/contract/image-generation.test.ts
Commands: npm test -- image-generation.test.ts, npm run verify
Riskiest Assumption: The xAI API returns JSON format we expect
Validation: Contract tests must pass, fault fixture must fail, npm run verify must show clean
```

**Why?** Because you're forced to understand the change before making it. If you can't answer all five, you're not ready to code.

---

### Workflow: When a Probe Can't Run

**Scenario:** You need to probe the xAI API, but you don't have an API key. Or the API is behind a firewall. Or DNS is down.

**What you do (Blocked Probe Protocol):**

1. **Stop.** Do not invent fixture data.
2. **Declare BLOCKED** in your work log.
3. **Record an Assumption entry in `DECISIONS.md`:**
   ```
   Date: 2025-02-15
   Seams: ImageGenerationSeam
   Statement: "xAI API returns { url, width, height }"
   Validation: "When API is available, probe and compare to fixture"
   Status: BLOCKED (missing API key)
   ```
4. **Run `npm run assumption:alarm`** to generate tracking report.
5. **Capture the error output** in `docs/evidence/YYYY-MM-DD/` so the block is explicit.

**Why this matters:** A blocked probe with a recorded assumption is acceptable. A blocked probe with invented fixture data is not. By recording the block, you make it explicit that this is an assumption, not proof.

---

## Part 4: Hard Rules and Why They Exist

### Rule 1: No Direct `fs` or `fs.promises` in Adapters

**Rule:** Never write `import fs from 'fs'` in an adapter.

**Why:** If adapters can import anything, file I/O is scattered across the codebase. When the file path is wrong, you don't know which adapter is guilty. Filesystem errors become invisible.

**Solution:** Use `JailedFs`, a wrapper that centralizes all file I/O in one place:

```typescript
// Wrong:
import fs from 'fs';
export const adapter = {
  async load(path) {
    return fs.readFile(path, 'utf-8');
  }
};

// Right:
import { JailedFs } from '../jailed-fs';
export const adapter = {
  async load(path) {
    return JailedFs.readFile(path, 'utf-8');
  }
};
```

**If you break this rule:** Tests pass locally but fail in production when the real filesystem has different structure.

---

### Rule 2: No Sync I/O in Adapters

**Rule:** Never use `readFileSync`, `spawnSync`, or any `*Sync` method.

**Why:** Sync I/O blocks the entire Node process. If the file system is slow, the entire app freezes. Sync operations can't timeout. In the browser, sync APIs don't exist.

**Solution:** Always use async:

```typescript
// Wrong:
const data = fs.readFileSync(path);

// Right:
const data = await fs.promises.readFile(path);
```

**If you break this rule:** The app freezes or crashes under load.

---

### Rule 3: No `process.cwd()` in Core Logic

**Rule:** Never call `process.cwd()` inside a domain function. Inject the path instead.

**Why:** `process.cwd()` is unpredictable. Tests might run from different directories. Different servers might have different cwd. Your code becomes untestable.

**Solution:** Pass the path as a parameter:

```typescript
// Wrong:
function loadConfig() {
  const path = `${process.cwd()}/config.json`;
  return loadFile(path);
}

// Right:
function loadConfig(baseDir) {
  const path = `${baseDir}/config.json`;
  return loadFile(path);
}
```

**If you break this rule:** Tests fail unpredictably. Deployments fail if the cwd is different.

---

### Rule 4: No Invented Data in Fixtures

**Rule:** Every fixture value is from the real probe. Never invent.

**Why:** If fixtures contain invented data, tests pass with invented data but fail with real data. The test is a false positive.

**Solution:** Capture and commit real outputs only:

```json
// Wrong (invented):
{
  "data": {
    "url": "https://example.com/image.png"  // ← you made this up
  }
}

// Right (from real probe):
{
  "data": {
    "url": "https://images.xai.com/abc123.png",  // ← from actual API response
    "width": 1024,
    "height": 1024
  }
}
```

**If you break this rule:** Tests pass. Real API behaves differently. Production breaks.

---

### Rule 5: Fixture Freshness ≤ 7 Days

**Rule:** Every probe must be re-run every 7 days. If the probe is older than 7 days, the fixture is stale.

**Why:** External systems change. The API might return a new field. The file format might change. An old fixture becomes a lie.

**Solution:** Automation checks fixture dates and fails if any fixture is older than 7 days. You must re-probe and re-commit.

**If you break this rule:** Tests pass with stale data. Real system changed. Production breaks.

---

### Rule 6: Contract Tests Must Pass Before Shipping

**Rule:** Before merging to main, all contract tests must pass. Red proof must be green.

**Why:** If a contract test fails, it means either:
1. The fixture is wrong (doesn't match real system)
2. The mock is wrong (doesn't return fixture correctly)
3. The adapter is wrong (doesn't match real behavior)

Any of these means the seam is broken in production.

**If you break this rule:** Broken seams ship. Production fails.

---

## Part 5: Evidence and Verification

### What is Evidence?

Evidence is the **permanent record that a seam is correct**. It answers: "How do I know this seam works?"

Evidence includes:
- Contract tests passing
- Adapter tests passing
- Fixture from probe
- Proof that the fixture is real, not invented

---

### The `npm run verify` Command

**What it does:** Runs a series of checks that collectively prove all seams are correct.

```bash
npm run verify
```

**What it checks:**

| Check | What It Verifies |
|-------|-----------------|
| `chamber:lock` | All seam artifacts exist (contract, fixtures, mock, adapter, tests) |
| `shaolin:lint` | All fixtures are ≤ 7 days old (probes are fresh) |
| `verify:runner` | All tests pass, TypeScript compiles |
| `seam:ledger` | All seams are accounted for (none are missing) |
| `clan:chain` | Each seam is marked "clean" or "dirty" |
| `proof:tape` | Plain-English summary of evidence |
| `assumption:alarm` | Blocked probes are tracked |
| `cipher:gate` | All changes are backed by decisions in DECISIONS.md |

**Output:** If all checks pass, a green summary. If any check fails, a red error with the specific failure.

**If you skip this:** You ship a seam that's untested, unfresh, or incomplete. Production breaks.

---

### Evidence Artifacts

When you run `npm run verify`, it generates reports under `docs/evidence/YYYY-MM-DD/`:

| File | Purpose | Audience |
|------|---------|----------|
| `chamber-lock.json` | Checklist of all seam files | CI/automation |
| `shaolin-lint.json` | Fixture freshness report | Automation (must all be < 7 days) |
| `seam-ledger.json` + `.md` | Summary of all seams, which are active, which are mocked | Engineers + non-coders |
| `clan-chain.md` | Which seams are "clean" (all checks pass) vs "dirty" (probes old or tests failing) | Non-coders, risk assessment |
| `proof-tape.md` | Plain-English summary: "ImageGenerationSeam is clean, sample fixture passed, fault fixture passed, adapter tests passed, last probed 2025-02-10" | Product managers, non-coders |
| `assumption-alarm.json` | List of all blocked probes and why | Risk tracking |
| `cipher-gate.json` | List of all changes and which DECISIONS.md entries back them | Governance |

**Why all this output?** To make correctness visible and auditable. A non-coder can read `proof-tape.md` and know whether the app is ready for production.

---

## Part 6: Common Mistakes and How SDD Prevents Them

### Mistake 1: Skipping the Probe

**What happens:** You think "the API probably returns JSON with a `url` field" so you write a fixture:

```json
{
  "url": "https://example.com/image.png",
  "width": 1024,
  "height": 1024
}
```

Mock tests pass. Adapter tests pass. You ship.

In production, the real API returns:

```json
{
  "data": {
    "image_url": "https://xai.com/abc.png",
    "dimensions": { "w": 1024, "h": 1024 }
  }
}
```

**The app breaks** because the schema doesn't match. But tests passed!

**How SDD prevents it:** SDD requires a real probe. The real API output is captured. Fixtures contain real data. Tests fail if the real API returns something different.

---

### Mistake 2: Inventing Fixture Data

**What happens:** You don't have credentials to run the probe, so you invent fixture data:

```json
{
  "url": "https://example.com/image.png"
}
```

Tests pass. You ship.

In production, the real API fails or returns a different format. **The app breaks.**

**How SDD prevents it:** The Blocked Probe Protocol. If you can't run the probe, you record an assumption. Automation tracks it. Shipping requires all assumptions to be resolved.

---

### Mistake 3: Writing the Adapter First

**What happens:** You jump straight to the adapter without defining the contract or fixtures:

```typescript
export const imageGenerationAdapter = {
  async generate(prompt) {
    const response = await fetch('/api/image', { body: prompt });
    return response.json(); // ← Assumes this shape
  }
};
```

You write tests that use your adapter. Tests pass. You ship.

The real API fails in a way you didn't anticipate. **The app breaks.**

**How SDD prevents it:** Steps must be in order. Contract first. Then probe. Then fixtures. Then mock. Then adapter. If you skip steps, the tooling detects it (`chamber:lock` fails).

---

### Mistake 4: Loose Contracts

**What happens:** You define a contract that's too flexible:

```typescript
export const ImageSchema = z.object({
  url: z.string(),  // ← Could be any string, even empty
  width: z.number(),
  height: z.number(),
});
```

Tests pass with invalid data. In production, you get an empty URL. **The app breaks.**

**How SDD prevents it:** Red proof forces you to write fault fixtures. A fault fixture with an empty URL should fail. That forces you to add `.url()` or `.min(1)` to the contract.

---

### Mistake 5: AI Skipping Steps

**What happens:** An AI agent:
- Skips the probe ("I'll just look at the docs")
- Invents fixture data ("This is probably what the API returns")
- Writes the adapter without testing ("Tests can come later")
- Commits and ships

**Everything looks good until production breaks.**

**How SDD prevents it:** The tooling is strict. `npm run verify` fails if:
- Probe is missing
- Fixture is older than 7 days
- Contract tests don't pass
- Artifact file is missing

Shipping requires `npm run verify` to pass. An AI can't bypass this without explicit authorization.

---

## Part 7: A Complete Example

### Problem Statement

Add image generation to a coloring book app. The app should:
1. Accept a coloring spec (colors, decorations, size)
2. Send it to the xAI API as a prompt
3. Get back an image URL
4. Store and display the image

### Step 1: Contract

File: `contracts/image-generation.contract.ts`

```typescript
import { z } from 'zod';

export const ImageGenerationInputSchema = z.object({
  prompt: z.string().min(10).max(1024),
  size: z.enum(['1024x1024', '512x512']).default('1024x1024'),
});

export const GeneratedImageSchema = z.object({
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.enum(['png', 'jpg']).optional(),
});

export class ImageGenerationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ImageGenerationError';
  }
}

export type ImageGenerationInput = z.infer<typeof ImageGenerationInputSchema>;
export type GeneratedImage = z.infer<typeof GeneratedImageSchema>;
```

**What this says:** Input is a string (10-1024 chars) + size. Output is a URL + dimensions. Errors have a code.

### Step 2: Probe

File: `probes/image-generation.probe.mjs`

```javascript
// Run with: XAI_API_KEY=sk_... node probes/image-generation.probe.mjs

const prompt = 'Generate a coloring page: simple shapes, no text, bright colors. Size: 1024x1024.';

const response = await fetch('https://api.x.ai/v1/image', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: prompt,
    model: 'grok-imagine-image',
    output_format: 'url'
  })
});

if (!response.ok) {
  console.error(`API Error: ${response.status}`, await response.text());
  process.exit(1);
}

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
```

**Run it:** `XAI_API_KEY=sk_xxx node probes/image-generation.probe.mjs`

**Real output (captured 2025-02-15):**

```json
{
  "data": {
    "image": {
      "url": "https://images.xai.com/abc123.png",
      "width": 1024,
      "height": 1024
    }
  }
}
```

### Step 3: Fixtures

File: `fixtures/image-generation/sample.json`

```json
{
  "input": {
    "prompt": "Generate a coloring page: simple shapes, no text, bright colors. Size: 1024x1024."
  },
  "data": {
    "url": "https://images.xai.com/abc123.png",
    "width": 1024,
    "height": 1024
  }
}
```

File: `fixtures/image-generation/fault.json`

```json
{
  "input": {
    "prompt": "short"
  },
  "error": {
    "code": "INVALID_PROMPT",
    "message": "Prompt must be at least 10 characters"
  }
}
```

### Step 4: Mock

File: `src/lib/mocks/image-generation.mock.ts`

```typescript
import sampleFixture from '../../fixtures/image-generation/sample.json';
import faultFixture from '../../fixtures/image-generation/fault.json';
import { GeneratedImage, ImageGenerationError, ImageGenerationInputSchema } from '../contracts/image-generation.contract';

export const imageGenerationMock = {
  async generate(input: any, scenario: 'sample' | 'fault'): Promise<GeneratedImage> {
    // Validate input shape
    try {
      ImageGenerationInputSchema.parse(input);
    } catch (e) {
      throw new ImageGenerationError('Invalid input', 'INVALID_INPUT');
    }

    const fixture = scenario === 'fault' ? faultFixture : sampleFixture;

    if (fixture.error) {
      throw new ImageGenerationError(fixture.error.message, fixture.error.code);
    }

    return fixture.data;
  }
};
```

### Step 5: Adapter

File: `src/lib/adapters/image-generation.adapter.ts`

```typescript
import { ImageGenerationInputSchema, GeneratedImageSchema, ImageGenerationError } from '../contracts/image-generation.contract';

export const imageGenerationAdapter = {
  async generate(input: any) {
    // Validate input against contract
    const validatedInput = ImageGenerationInputSchema.parse(input);

    // Call real API
    const response = await fetch('https://api.x.ai/v1/image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: validatedInput.prompt,
        model: 'grok-imagine-image',
        output_format: 'url'
      })
    });

    if (!response.ok) {
      throw new ImageGenerationError(
        `API returned ${response.status}`,
        'API_ERROR'
      );
    }

    const data = await response.json();

    // Validate output against contract
    const image = data.data.image;
    return GeneratedImageSchema.parse(image);
  }
};
```

### Step 5: Contract Tests

File: `tests/contract/image-generation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { imageGenerationMock } from '../../src/lib/mocks/image-generation.mock';
import { imageGenerationAdapter } from '../../src/lib/adapters/image-generation.adapter';
import sampleFixture from '../../fixtures/image-generation/sample.json';
import faultFixture from '../../fixtures/image-generation/fault.json';

describe('ImageGenerationSeam Contract', () => {
  // Test: Mock returns sample fixture
  it('mock returns sample fixture on valid input', async () => {
    const result = await imageGenerationMock.generate(sampleFixture.input, 'sample');
    expect(result).toEqual(sampleFixture.data);
  });

  // Test: Fault fixture fails (RED PROOF)
  it('fault fixture fails the mock', async () => {
    expect(async () => {
      await imageGenerationMock.generate(faultFixture.input, 'fault');
    }).rejects.toThrow('INVALID_PROMPT');
  });

  // Test: Adapter matches mock on sample
  it('adapter returns same output as mock for sample', async () => {
    const mockResult = await imageGenerationMock.generate(sampleFixture.input, 'sample');
    const adapterResult = await imageGenerationAdapter.generate(sampleFixture.input);
    expect(adapterResult).toEqual(mockResult);
  });

  // Test: Adapter rejects fault
  it('adapter rejects fault fixture', async () => {
    expect(async () => {
      await imageGenerationAdapter.generate(faultFixture.input);
    }).rejects.toThrow();
  });
});
```

### Verification

```bash
npm run verify
```

**Output:**

```
✓ chamber:lock      All artifacts exist
✓ shaolin:lint      Fixtures are fresh (2025-02-15 ≤ 7 days)
✓ verify:runner     Tests pass, TypeScript green
✓ seam:ledger       ImageGenerationSeam: complete, all 5 steps
✓ clan:chain        ImageGenerationSeam: CLEAN
✓ proof:tape        ImageGenerationSeam generates images with deterministic error handling
✓ assumption:alarm  No blocked probes
✓ cipher:gate       ImageGenerationSeam backed by DECISIONS.md entry

RESULT: Ready to ship
```

---

## Part 8: Quick Reference

### The Five Steps (In Order)

1. **Contract** (`contracts/<seam>.contract.ts`) — Define input/output/errors with Zod
2. **Probe** (`probes/<seam>.probe.mjs`) — Run against real system, capture JSON
3. **Fixtures** (`fixtures/<seam>/sample.json`, `fault.json`) — Store real behavior
4. **Mock** (`src/lib/mocks/<seam>.mock.ts`) — Load fixtures, zero logic
5. **Adapter** (`src/lib/adapters/<seam>.adapter.ts`) — Real I/O + validation

Plus: **Tests** (`tests/contract/<seam>.test.ts`) — Verify mock and adapter

### The Core Rules

| Rule | Reason | Consequence of Breaking |
|------|--------|------------------------|
| Fixtures from real probes only | Ensures tests match reality | Tests pass, real system fails |
| Fixtures ≤ 7 days old | External systems change | Stale data, production breaks |
| Red proof (fault fails first) | Forces error handling | Errors crash in production |
| No direct `fs` imports | Centralizes file I/O | Scattered I/O, bugs invisible |
| No `*Sync` in adapters | Prevents blocking | App freezes under load |
| No `process.cwd()` in logic | Makes code testable | Tests fail unpredictably |
| Contract tests must pass | Seams must match | Integration failures |
| `npm run verify` before shipping | Prevents incomplete seams | Broken seams ship |

### When You're Stuck

**"Can I skip the probe?"** — Only if it's pure logic (no external system). Otherwise, no.

**"Can I invent fixture data?"** — Only if the real system is down and you've recorded a blocked probe in DECISIONS.md. Otherwise, no.

**"Can I write the adapter first?"** — Only if you're 100% sure what the external system returns. Otherwise, no. And you probably aren't sure.

**"Can I ship without contract tests passing?"** — No. That means the seam is broken.

**"Can I use an old fixture (10 days old)?"** — No. Automation will catch it and fail `npm run verify`.

---

## Conclusion

Seam-Driven Development is built on a single principle: **Prove, don't assume.**

Every rule, every step, every check is designed to make it impossible to ship untested, unproven code.

If you follow the five steps in order:
1. You catch integration problems before production
2. Tests reflect reality, not invention
3. Other AIs can trust your code (or they'll prove why they can't)
4. The app is deterministic, auditable, and correct

You're done. Read this document once. Apply it perfectly. Never need external context.
