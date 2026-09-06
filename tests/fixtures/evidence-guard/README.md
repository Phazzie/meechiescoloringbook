<!--
Purpose: Explain what the frozen evidence folder beside this file is for.
Why: A copy of real evidence, committed under tests/, looks like a mistake until you know why it is
     here — and knowing why is what stops someone "tidying" it back into docs/evidence/.
Info flow: docs/evidence/<date>/ (once, by hand) -> this folder -> tests/unit/evidence-guard.test.ts.
-->
# Evidence-guard fixture

`2026-09-06/` is a frozen copy of a real `npm run verify` output, and it is the input to
`tests/unit/evidence-guard.test.ts`. Each case copies it to a temporary directory, breaks one thing,
and checks that `scripts/evidence-guard.mjs` refuses it for that reason.

It is a committed fixture rather than "whichever folder in `docs/evidence/` is newest", which is what
the test used at first. That version had two faults, both of which shipped:

1. **It read a folder the chain was rewriting.** `npm test` runs inside `npm run verify`, which
   regenerates today's evidence as it goes, so the fixture was copied mid-rewrite and the guard
   correctly rejected an inconsistent folder — the test reading a file while it was being written,
   which is the exact defect the guard exists to catch.
2. **It depended on what that folder happened to contain.** `e2e.txt` is optional, the rewind
   transcripts are named after whichever seam was run, and the mandated Playwright row carries a
   waiver that expires. Any ordinary future run that omitted an optional artifact, ran a different
   seam, or simply arrived after the expiry date would have broken every `npm test` in the
   repository, for evidence it had nothing to do with.

Both are the same mistake: a test whose subject is chosen by the state of the world at the moment it
runs. This folder does not move.

Two consequences worth knowing:

- **The waiver in this copy expires `2999-12-31`**, replacing the real dated one. The date is
  the same width, so every byte count in `proof-tape.json` still describes the file. The committed
  evidence in `docs/evidence/` keeps its real expiry, which is the whole point of it having one.
- **A new guard rule that this folder cannot satisfy will fail these tests**, and that is the
  intended behaviour: it means the rule requires something no past run produced. Regenerate the
  fixture from a real run that satisfies it, deliberately, rather than relaxing the rule.
