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
