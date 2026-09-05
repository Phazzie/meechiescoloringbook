<!--
Purpose: Record the exit code of every `npm run rewind` invocation for this head, appended as each
         run finished rather than summarised from memory afterwards.
Why: The per-seam `rewind-<SeamName>.txt` files hold a suite's output but not the command's exit
     status, and an earlier revision of verify-chain.txt declared "all rewinds exit 0" in a
     paragraph saved before the first rewind had executed. This file is what makes that claim
     checkable instead of remembered.
Info flow: npm run rewind (x19) -> a row here per run -> verify-chain.txt's evidence paragraph,
           which reads its counts back from this table.
-->

# Rewind exit codes — Run 4 close-out (PR #296)

Two naming decisions, both taken because a reviewer caught the alternative:

- **Outside the `rewind-*.txt` pattern.** While this file was `rewind-exit-codes.txt`, an
  `ls rewind-*.txt | wc -l` check returned 20 against a claimed 19 — the artifact added to make the
  count checkable was the thing that falsified it.
- **Markdown, not `.txt`.** `docs/AGENTS.md` reserves `.txt` for raw terminal dumps and requires
  summaries of validations to be Markdown. This file describes itself as a summary, so it is one.

The `--seam` column is quoted exactly as it must be typed: for the five canonical rows, dropping the
quotes makes the shell split on the space and `rewind` silently resolves the legacy row instead.

## 19 runs, started 2026-09-05T00:19:53Z

| exit | artifact | command argument |
|---|---|---|
| 0 | `rewind-MeechieToolSeam.txt` | `--seam "MeechieToolSeam"` |
| 0 | `rewind-SpecValidationSeam.txt` | `--seam "SpecValidationSeam"` |
| 0 | `rewind-OutputPackagingSeam.txt` | `--seam "OutputPackagingSeam"` |
| 0 | `rewind-CreationStoreSeam.txt` | `--seam "CreationStoreSeam"` |
| 0 | `rewind-SessionSeam.txt` | `--seam "SessionSeam"` |
| 0 | `rewind-ClockSeam.txt` | `--seam "ClockSeam"` |
| 0 | `rewind-PromptAssemblySeam.txt` | `--seam "PromptAssemblySeam"` |
| 0 | `rewind-ImageGenerationSeam.txt` | `--seam "ImageGenerationSeam"` |
| 0 | `rewind-ImageProviderConfigSeam.txt` | `--seam "ImageProviderConfigSeam"` |
| 0 | `rewind-SafetyPolicySeam.txt` | `--seam "SafetyPolicySeam"` |
| 0 | `rewind-RateLimitSeam.txt` | `--seam "RateLimitSeam"` |
| 0 | `rewind-ProviderAdapterSeam.txt` | `--seam "ProviderAdapterSeam"` |
| 0 | `rewind-DriftDetectionSeam.txt` | `--seam "DriftDetectionSeam"` |
| 0 | `rewind-MeechieVoiceSeam.txt` | `--seam "MeechieVoiceSeam"` |
| 0 | `rewind-MeechieVoiceSeam(self-contained).txt` | `--seam "MeechieVoiceSeam (self-contained)"` |
| 0 | `rewind-DriftDetectionSeam(self-contained).txt` | `--seam "DriftDetectionSeam (self-contained)"` |
| 0 | `rewind-PromptAssemblySeam(self-contained).txt` | `--seam "PromptAssemblySeam (self-contained)"` |
| 0 | `rewind-SpecValidationSeam(self-contained).txt` | `--seam "SpecValidationSeam (self-contained)"` |
| 0 | `rewind-MeechieToolSeam(self-contained).txt` | `--seam "MeechieToolSeam (self-contained)"` |

Finished 2026-09-05T00:20:29Z.
