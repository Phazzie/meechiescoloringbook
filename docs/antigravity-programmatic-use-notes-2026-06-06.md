<!--
Purpose: Capture what Codex learned while trying to use Google Antigravity programmatically.
Why: Antigravity needs concrete context to review whether the approach is correct.
Info flow: Local CLI probes and wrapper results -> this note -> Antigravity review prompt.
-->
# Antigravity Programmatic Use Notes

Date: 2026-06-06

Repo: `Phazzie/meechiescoloringbook`

Local repo path: `C:\Users\ieatc\Meechiescoloringbook`

Codex skill path: `C:\Users\ieatc\.codex\skills\antigravity-reviewer`

Wrapper script path:
`C:\Users\ieatc\.codex\skills\antigravity-reviewer\scripts\Invoke-AntigravityReview.ps1`

## Goal

Use Google Antigravity as a bounded second-opinion reviewer for this repo's PR-drain work.

The desired use is not to let Antigravity merge, close, push, or edit project files. The desired use is:

1. Codex prepares a scoped review prompt.
2. Antigravity reviews the prompt and repo state.
3. Antigravity returns a blunt senior-review critique.
4. Codex verifies any useful critique locally before changing code.
5. Any Antigravity output is saved as evidence.

## Safety Limits

Antigravity should not be asked to:

- Merge PRs.
- Close PRs.
- Push branches.
- Rewrite history.
- Delete files.
- Run broad destructive commands.
- Edit the active project worktree without explicit user approval.

The intended default is read-only review.

## What Codex Built

Codex created a local Codex skill named `antigravity-reviewer`.

The skill contains:

- `SKILL.md`: instructions for using Antigravity as a bounded reviewer.
- `references/review-prompt-template.md`: hostile senior-review prompt template.
- `scripts/Invoke-AntigravityReview.ps1`: PowerShell wrapper around `agy.exe`.

The wrapper is meant to:

1. Read a prompt from a file.
2. Locate `agy.exe`.
3. Run `agy --print` with a bounded timeout.
4. Capture stdout, stderr, and Antigravity's internal log path.
5. Write a JSON evidence file.
6. Avoid `--dangerously-skip-permissions`.

The installed Antigravity CLI binary was found at:

`C:\Users\ieatc\AppData\Local\agy\bin\agy.exe`

## What Worked

These commands worked:

```powershell
agy --help
agy changelog
```

The skill validator passed after installing `PyYAML` for `C:\Python313\python.exe`.

The wrapper dry-run works and writes JSON evidence.

The wrapper now uses `Start-Process` with stdout/stderr temp files because an earlier .NET async process-capture approach was unreliable under Windows PowerShell 5.1.

## What Failed Or Was Unclear

### 1. Hidden/headless auth was unreliable

Headless `agy --print` from the Codex shell repeatedly timed out or produced no useful stdout.

Representative log messages included:

```text
You are not logged into Antigravity.
keyringAuth: timed out after 5s
Print mode: silent auth failed, triggering OAuth
Print mode: auth timed out
```

This happened even after the user believed they were logged in.

### 2. Visible terminal behaved differently

Launching `agy --print` in a visible PowerShell window reached a different path and once authenticated via keyring.

Representative successful log messages included:

```text
ChainedAuth: authenticated via keyring
OAuth: authenticated successfully
Print mode: silent auth succeeded
```

However, visible print runs still produced empty stdout/stderr in the capture files.

### 3. `agy models` was not a clean proof

`agy models` did not reliably return useful output from the Codex shell. It sometimes exited with no stdout/stderr while logs still showed auth errors.

### 4. `--sandbox` may affect auth

The first wrapper default used `--sandbox`. In this Windows setup, sandboxed runs appeared more likely to hit auth/keyring timeout behavior.

A later no-sandbox test still timed out, so sandbox is not proven to be the only issue.

### 5. Asking Antigravity to write a temp file did not work

Codex tested a prompt asking Antigravity to write `ANTIGRAVITY_READY` to a temp file outside the repo. The process exited `0`, but the requested file was not created. The log for that run again showed auth timeout.

### 6. Stale `agy` processes remained

Two old `agy` processes were visible:

```text
agy 1432
agy 19304
```

Attempts to kill them from the Codex shell failed or hung. They may or may not be affecting keyring/session behavior.

## Current Hypothesis

The basic CLI is installed and usable, but programmatic use from Codex is blocked by one or more of:

- Windows keyring access from hidden/non-interactive shells.
- Difference between PowerShell, cmd, visible terminal, and Codex-hosted shell behavior.
- Antigravity print mode rendering output somewhere other than stdout.
- Stale Antigravity processes holding auth/session state.
- A required login/session step not shared with the Codex process context.

This is not yet proven to be a repo problem.

## Question For Antigravity

Codex needs Antigravity to review whether this integration approach is correct.

Specifically:

1. Is `agy --print` the correct non-interactive API for this use case?
2. Should Codex run it from PowerShell, cmd, or another shell on Windows?
3. Should `--sandbox` be avoided during auth setup?
4. Is stdout expected to contain the model answer in print mode?
5. If stdout is empty, where is the answer supposed to be retrieved from?
6. Is there a supported way to authenticate the CLI for headless use?
7. Are stale `agy` processes likely to break keyring/OAuth?
8. Is asking Antigravity to write an output file a valid pattern, or does the CLI/tool permission model prevent that?
9. What should the wrapper script change?
10. Is this whole approach wrong, and should Codex use a different Antigravity interface?

## Prompt To Give Antigravity

```md
You are reviewing Codex's attempt to use Google Antigravity programmatically on Windows.

Do not edit files, merge PRs, close PRs, push branches, or run destructive commands. This is a read-only diagnostic review unless I explicitly say otherwise.

Repo path:
C:\Users\ieatc\Meechiescoloringbook

Context document:
docs/antigravity-programmatic-use-notes-2026-06-06.md

Codex skill path:
C:\Users\ieatc\.codex\skills\antigravity-reviewer

Wrapper script:
C:\Users\ieatc\.codex\skills\antigravity-reviewer\scripts\Invoke-AntigravityReview.ps1

What Codex is trying to do:
- Use Antigravity as a bounded second-opinion reviewer.
- Feed Antigravity a scoped review prompt.
- Capture Antigravity's response as evidence.
- Keep Antigravity read-only by default.
- Prevent Antigravity from merging, closing, pushing, deleting, or editing project files unless explicitly approved.

What has been failing:
- Hidden/headless `agy --print` from Codex times out on auth/keyring.
- Visible terminal `agy --print` once authenticated successfully but stdout/stderr capture was empty.
- `agy models` did not reliably prove auth.
- `--sandbox` may make auth worse, but no-sandbox also timed out.
- Asking Antigravity to write to a temp output file did not create the file.
- Two stale `agy` processes were observed and could not be killed from Codex.

Please inspect the context doc and wrapper script, then answer:

1. Is `agy --print` the right interface for this job?
2. Is Codex invoking it incorrectly?
3. Should this run through cmd.exe instead of PowerShell?
4. Is there a known Windows keyring/OAuth issue with hidden shells?
5. Should `--sandbox` be used only after auth is established?
6. Where should print-mode output appear?
7. If stdout is empty, how should Codex retrieve the answer?
8. Is asking Antigravity to write an output file a valid approach?
9. What exact changes should be made to the wrapper script?
10. What is the shortest reliable test that proves Antigravity can be used programmatically from this machine?

Be blunt. If the approach is wrong, say so. If it is close, give exact fixes. Do not recommend broad repo changes or PR merging here.
```

## Suggested Proof Test

A successful programmatic setup should pass this without manual interaction:

```powershell
agy --print-timeout 60s --print "Reply with exactly ANTIGRAVITY_READY."
```

Expected proof:

- Exit code is `0`.
- Stdout contains `ANTIGRAVITY_READY`.
- No browser login is required.
- No project files are modified.

If stdout is not the expected output channel, Antigravity should identify the supported output channel.
