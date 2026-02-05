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
  - `verify.txt` (output of `npm run verify`)
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

## Notes
- If a probe cannot be run, record the reason and a waiver expiry.
