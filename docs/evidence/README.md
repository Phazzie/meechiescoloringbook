<!--
Purpose: Define how to capture and store evidence for Seam-Driven Development.
Why: Make verification reproducible and auditable.
Info flow: Command outputs -> evidence files -> review/validation.
-->
# Evidence

Store command outputs and probe metadata tied to seam changes.

## Convention
- Folder: `docs/evidence/YYYY-MM-DD/`
- Files:
  - `verify.txt` (output of `node scripts/verify-runner.mjs` — the chain's **inner** check/test
    stage only, despite the name; it is written by the runner, not by the outer command)
  - `verify-outer.txt` (transcript of the outer `npm run verify`, including the `audit:gate`
    result and the chain's own exit status — the only artifact that carries either)
  - `test.txt` (output of `npm test`)
  - `probe-<seam>.txt` (output of probe runs)
  - `chamber-lock.json` (artifact gate report)
  - `shaolin-lint.json` (evidence freshness report)
  - `rewind-<seam>.txt` (seam-scoped contract test output)
  - `seam-ledger.json` (seam artifact ledger report)
  - `seam-ledger.md` (human-readable seam ledger)
  - `clan-chain.json` (clean vs dirty seam chain)
  - `clan-chain.md` (plain-English chain summary)
  - `proof-tape.json` (evidence summary metadata)
  - `proof-tape.md` (plain-English evidence summary)
  - `cipher-gate.json` (cipher gate proof summary report)
  - `assumption-alarm.json` (assumption coverage report)
  - `ci-verify.txt` (optional CI verification output, if captured)
  - `e2e.txt` (optional end-to-end transcript — see the exit-status rule below)
  - `lint.txt` / `build.txt` (optional `npm run lint` / `npm run build` transcripts, for the
    routines that mandate them; the chain writes neither)

## Exit statuses
A transcript must carry the exit status of the command that produced it, on its own line, as
`<name> exit=<code>`: `verify exit=0` in `verify-outer.txt`, `lint exit=0`, `build exit=0`,
`e2e exit=0` at the end of `e2e.txt`'s Row 2.

This is not decoration. Counts in a transcript describe a run; only the exit status reports it.
Three times a transcript here has been green by every count it contained and wrong anyway — an
empty section spliced under a heading, a passing total printed beside failures, a count that came
from a test's own stdout rather than the reporter's. Capture the status from the command with `$?`
and append it; do not type it in from what the output appeared to say.

## The guard
`npm run evidence:guard [dir]` reads a committed folder and refuses it when a transcript does not
carry its own result, when a run reports no tests at all (`0 passed` is a number, not a result), or
when `proof-tape.md` is missing or says something `proof-tape.json` does not — the tape writes both
of its own outputs after taking its inventory, so the Markdown summary is the one required artifact
the inventory structurally cannot vouch for. It defaults to today's folder — deliberately not "whichever is newest", so a
run that wrote nothing fails instead of validating its predecessor's work. CI runs it over exactly
the dated folders a change touches, before `npm run verify`, so what is judged is what the author
committed rather than what the chain has just rewritten.

## Capture order
Two artifacts are written by commands outside the chain but inventoried by a stage inside it, so
the order matters and is not a matter of taste:

1. `npm run check` / `lint` / `build`
2. `npm run cipher:gate` — **before** the chain, so `proof-tape` inventories the `cipher-gate.json`
   that ships rather than the previous run's.
3. `npm run verify` — writes `chamber-lock`, `verify.txt`, `test.txt`, `shaolin-lint`,
   `assumption-alarm`, `seam-ledger`, `clan-chain` and the proof tape.
4. The outer transcript — captured to a scratch path and moved to `verify-outer.txt` **after** the
   chain returns, because a file cannot be inventoried while it is still being written to. It is
   therefore deliberately absent from that chain's own inventory.

Any hand-written summary in the folder must be final *before* step 3, since the chain inventories
it. Do not paste timestamps, byte counts or file hashes into one: they can only be known after the
chain runs, which is exactly when it is too late to change the file without invalidating the
inventory.

## Notes
- If a probe cannot be run, record the reason and a waiver expiry.
