<!--
Purpose: Summarize timeout/abort workpack validation evidence.
Why: Keep command outcomes auditable when local wrappers report known baseline or environment-limited failures.
Info flow: Command evidence files -> validation summary -> HPR ledger and Cipher Gate.
-->

# HPR Timeout/Abort Validation Summary

- `npm.cmd test -- tests/unit/http-resilience.test.ts tests/unit/provider-adapter-helpers.test.ts tests/contract/image-generation.test.ts tests/unit/image-generation-pipeline.test.ts tests/unit/api-generate.test.ts tests/unit/api-wig-try-on.test.ts src/lib/seams/wig-try-on-seam/test.ts --pool=forks --maxWorkers=1`: pass, 7 files and 92 tests passed. Evidence: `hpr-timeout-abort-focused-tests-2.txt`.
- `npm.cmd run check`: pass, 0 errors and 0 warnings. Evidence: `hpr-timeout-abort-check-2.txt`.
- `npm.cmd run rewind -- --seam ImageGenerationSeam`: pass, 7 tests. Evidence: `hpr-timeout-abort-rewind-ImageGenerationSeam.txt`.
- `npm.cmd run rewind -- --seam WigTryOnSeam`: pass, 5 tests. Evidence: `hpr-timeout-abort-rewind-WigTryOnSeam.txt`.
- `npm.cmd run rewind -- --seam ProviderAdapterSeam`: pass, 4 tests. Evidence: `hpr-timeout-abort-rewind-ProviderAdapterSeam.txt`.
- `npm.cmd test`: test summary shows pass, 54 files and 456 tests passed, 1 skipped. The PowerShell `2>&1 | Tee-Object` wrapper returned nonzero because jsdom canvas stderr was surfaced as a native command error; the test summary itself is green. Evidence: `hpr-timeout-abort-full-test.txt`.
- `npm.cmd run lint`: fail, known baseline/generated-output lint debt. Evidence: `hpr-timeout-abort-lint.txt`.
- `npm.cmd run build`: fail after successful SvelteKit build output at Windows Vercel adapter symlink `EPERM`, matching baseline build debt. Evidence: `hpr-timeout-abort-build.txt`.
- `npm.cmd run cipher:gate`: pass. Evidence: `hpr-timeout-abort-cipher-gate.txt`.
- `git diff --check`: first failed only on unrelated generated governance artifacts that were stashed separately; rerun passed with exit 0 after the stash. Evidence: `hpr-timeout-abort-diff-check.txt` and `hpr-timeout-abort-diff-check-2.txt`.
- `npm.cmd run verify` and `npm.cmd run verify:runner`: timed out locally on the serial test leg. The non-test governance scripts `chamber:lock`, `shaolin:lint`, `assumption:alarm`, `seam:ledger`, `clan:chain`, and `proof:tape` were run separately and passed.
