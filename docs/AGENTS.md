<!--
Purpose: Define documentation standards and evidence recording rules for the docs/ directory.
Why: Maintain a structured, auditable history of the repository's seams, decisions, and triaged PRs.
Info flow: Triage/Verify tools -> docs/evidence/ -> docs/triage-table.md & docs/hpr-pr-resolution-ledger-*.md.
-->
# Documentation Governance (docs/ Directory)

This folder houses the repository's state ledgers, triage tables, seam catalogs, decision logs, and command evidence records. Any updates to documentation inside this directory must follow these rules:

## 1. Triage Table Maintenance (`triage-table.md`)
The [triage-table.md](./triage-table.md) acts as the single source of truth for open PR statuses.
- **Merge Status:** Must only be updated to `CLEAN` or `CONFLICT` after a programmatic merge run (via `scripts/analyze-merge-conflicts.js`).
- **Target Bucket Definitions:**
  - `1. Safe candidate for dry-run`: Clean merge, tests/verify pending.
  - `2. Stale/superseded`: Superseded by newer workpacks.
  - `3. Salvageable code only`: Port useful parts, do not merge branch wholesale.
  - `4. High-conflict/manual intervention`: Conflicting files require manual code edits.
  - `5. Dependency/generated/evidence-only`: Automatically updated metadata or lockfiles.

## 2. PR Resolution Ledgers
Ledger documents (e.g. `docs/hpr-pr-resolution-ledger-YYYY-MM-DD.md`) track historical PR audits.
- Each row represents a PR audit entry.
- Do not delete past entries; add new entries at the top or update existing status cells as progress is made.
- References to evidence files must use relative links pointing to the specific file under `docs/evidence/YYYY-MM-DD/`.

## 3. Seam Definitions & Blueprints
- The inventory of seams [seams.md](./seams.md) must match the exact PascalCase name of the seam (e.g. `MeechieToolSeam`).
- Any new seam must document its target contract, mock, test, and adapter path.
- The blueprint [SEAM_BLUEPRINT.md](./SEAM_BLUEPRINT.md) is the source of truth for new seam layouts.

## 4. Evidence Structure
All script-generated outputs, lints, exit-code captures, and dry-run summaries must be written to:
`docs/evidence/YYYY-MM-DD/`
- Standard logs should use `.txt` for raw terminal dumps or `.json` for structured results.
- Summaries of validations (like `pr-dry-run-summary.md`) must be in Markdown format.
- Avoid committing raw credentials or private configuration files.
