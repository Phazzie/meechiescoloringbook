<!--
Purpose: Record the exit status of every `npm run rewind` invocation in this run.
Why: scripts/rewind.mjs writes a per-seam artifact but not its exit status, and redirecting
     its stdout would clobber that artifact's header. The statuses are collected here
     mechanically, from each spawn result, so the table is command evidence and not a
     hand-entered claim.
Info flow: npm run rewind -> rewind-<Seam>.txt (written by the script) + this table.
Note: Markdown, so the header uses Markdown comment syntax and the file is not mistaken
      for one of the raw rewind-*.txt artifacts.
-->

# Seam rewind exit codes (2026-09-05)

| Seam (as passed to --seam) | Exit | Artifact |
| --- | --- | --- |
| `MeechieToolSeam` | 0 | `rewind-MeechieToolSeam.txt` |
| `SpecValidationSeam` | 0 | `rewind-SpecValidationSeam.txt` |
| `OutputPackagingSeam` | 0 | `rewind-OutputPackagingSeam.txt` |
| `CreationStoreSeam` | 0 | `rewind-CreationStoreSeam.txt` |
| `SessionSeam` | 0 | `rewind-SessionSeam.txt` |
| `ClockSeam` | 0 | `rewind-ClockSeam.txt` |
| `PromptAssemblySeam` | 0 | `rewind-PromptAssemblySeam.txt` |
| `ImageGenerationSeam` | 0 | `rewind-ImageGenerationSeam.txt` |
| `ImageProviderConfigSeam` | 0 | `rewind-ImageProviderConfigSeam.txt` |
| `SafetyPolicySeam` | 0 | `rewind-SafetyPolicySeam.txt` |
| `RateLimitSeam` | 0 | `rewind-RateLimitSeam.txt` |
| `ProviderAdapterSeam` | 0 | `rewind-ProviderAdapterSeam.txt` |
| `DriftDetectionSeam` | 0 | `rewind-DriftDetectionSeam.txt` |
| `MeechieVoiceSeam` | 0 | `rewind-MeechieVoiceSeam.txt` |
| `MeechieVoiceSeam (self-contained)` | 0 | `rewind-MeechieVoiceSeam(self-contained).txt` |
| `DriftDetectionSeam (self-contained)` | 0 | `rewind-DriftDetectionSeam(self-contained).txt` |
| `PromptAssemblySeam (self-contained)` | 0 | `rewind-PromptAssemblySeam(self-contained).txt` |
| `SpecValidationSeam (self-contained)` | 0 | `rewind-SpecValidationSeam(self-contained).txt` |
| `MeechieToolSeam (self-contained)` | 0 | `rewind-MeechieToolSeam(self-contained).txt` |
