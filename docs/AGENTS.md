<!--
Purpose: Define documentation standards and evidence recording rules for the docs/ directory.
Why: Maintain a structured, auditable history of the repository's seams, decisions, and triaged PRs.
Info flow: Triage/Verify tools -> docs/evidence/ -> docs/triage-table.md & docs/hpr-pr-resolution-ledger-*.md.
-->
# Documentation Governance (docs/ Directory)

This folder houses the repository's state ledgers, triage tables, seam catalogs, decision logs, and command evidence records. Any updates to documentation inside this directory must follow these rules:

## 1. Triage Table Maintenance (`triage-table.md`)
[`triage-table.md`](./triage-table.md) is the single source of truth for open PR statuses, and it has
**two kinds of column**. Which kind a column is decides who may write it.

**Written only by `scripts/analyze-merge-conflicts.js`. Never edited by hand:**
- **Merge status** — exactly `CLEAN` or `CONFLICT`, and nothing else. No decoration, no third value.
- **Conflicting paths** — the files git named, or a note saying the measurement could not be made.
  This cell **abbreviates**: a directory contributing several files reads `dir/* (N files)`, because a
  cell holding twenty-five paths is how this column once said nothing at all.
- The block between `<!-- conflicting-paths:begin -->` and `<!-- conflicting-paths:end -->`, which
  names every path git gave, verbatim and unescaped, inside a code fence. It is the complete record the
  abbreviated cell stands for, written from the same measurement in the same run. Rewritten whole; the
  refresh refuses to measure a table whose markers are missing, duplicated or out of order.
- The `Last refreshed: **<date>**, against \`origin/main\` at \`<sha>\`` line, which the same run
  rewrites so the table cannot claim a base its cells were not measured against.

**Written only by a human. Never by a script:**
- **Dry-run** — `yes` or `no`: whether this PR should be checked out and validated.
  `scripts/validate-pr-backlog.js` selects a row only when this is `yes` **and** the status is
  `CLEAN`. Two conditions, because merging cleanly and being worth validating are different facts.
- **Content `main` lacks** and **Disposition** — what the PR still holds that `main` does not, and
  what to do about it, in prose.

Rules that follow from the split:
- A script that reads this table must locate its columns **by header name**, never by position, and
  must split rows on unescaped pipes only. Import the helpers from `analyze-merge-conflicts.js`
  (`readTable`, `splitRow`) rather than parsing the file again.
- A refresh is all-or-nothing. If any row's head cannot be measured, nothing is written — a table
  mixing old and new measurements under one provenance line cannot be read.
- Every guard belongs to every reader. Both scripts import the same `findRowsWithBadPrCell`,
  `findMalformedRows`, `findDuplicateColumns` and `readTable`; a guard added for one of them and not
  the other is how the validator twice reported an empty backlog for a table it simply could not read.
  `findDuplicateColumns` takes the column names its caller reads, so a reader guards its own columns.
- An abbreviation in a cell is allowed; being the only record is not. Anything shortened for
  readability needs the unshortened version written by the same run, and a test asserting the two
  agree — `tests/unit/analyze-merge-conflicts.test.ts` reads the committed file and rebuilds each cell
  from the block's paths with `summarizeConflictPaths`, rather than parsing the cell apart, because a
  filename may legally contain the separator a parser would split on.
- **Structure is recognised only where structure can legally be.** This file holds filenames git chose,
  and a filename may be shaped like a table row, like a block marker, or like a blank line. So PR rows
  come only from the contiguous table (`tableRowEnd`), the markers only from outside a fenced block
  (`fencedLines`), and git's path-list terminator only from a line with nothing in it. Matching the
  shape of a line anywhere in the document hands this file's grammar to whoever names a file.
- A second fact about a row gets its own column. Encoding two decisions in one cell is what the
  retired `Target Bucket` vocabulary did, and separating them is why it is gone: its five categories
  (`1. Safe candidate for dry-run` … `5. Dependency/generated/evidence-only`) described the 2026-06
  backlog drain, which is finished. Do not reintroduce them.

## 2. PR Resolution Ledgers
Ledger documents (e.g. `docs/hpr-pr-resolution-ledger-YYYY-MM-DD.md`) track historical PR audits.
- Each row represents a PR audit entry.
- Do not delete past entries; add new entries at the top or update existing status cells as progress is made.
- References to evidence files must use relative links pointing to the specific file under `docs/evidence/YYYY-MM-DD/`.

## 3. Seam Definitions & Blueprints
- The inventory of seams [seams.md](file:///C:/Users/ieatc/Meechiescoloringbook/docs/seams.md) must match the exact PascalCase name of the seam (e.g. `MeechieToolSeam`).
- Any new seam must document its target contract, mock, test, and adapter path.
- The blueprint [SEAM_BLUEPRINT.md](file:///C:/Users/ieatc/Meechiescoloringbook/docs/SEAM_BLUEPRINT.md) is the source of truth for new seam layouts.

## 4. Evidence Structure
All script-generated outputs, lints, exit-code captures, and dry-run summaries must be written to:
`docs/evidence/YYYY-MM-DD/`
- Standard logs should use `.txt` for raw terminal dumps or `.json` for structured results.
- Summaries of validations (like `pr-dry-run-summary.md`) must be in Markdown format.
- Avoid committing raw credentials or private configuration files.
