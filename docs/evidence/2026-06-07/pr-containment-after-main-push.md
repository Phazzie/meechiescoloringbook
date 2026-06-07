<!--
Purpose: Classify remaining open pull requests after pushing verified local main.
Why: Identify which PRs still need merge/rebase/close action after origin/main advanced.
Info flow: gh open PR list + git ancestry checks -> after-push containment ledger -> PR drain actions.
-->
# PR Containment After Main Push

Generated at: 2026-06-07T03:50:58.5059002Z
Local main: 8c04105c773430d67f1b30a30b596faea24bf0c2
Origin main: 8c04105c773430d67f1b30a30b596faea24bf0c2
Total open PRs: 56

Summary:
- diverged: 50
- contained-in-origin-main: 6

| PR | State | Relation | Ahead | Behind | Base | Head | Title |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| #140 | UNKNOWN | diverged | 4 | 27 | main | claude/sweet-mendel-rCFcK | refactor: retire dual ImageGenerationSeam registration, consolidate to self-contained layout |
| #139 | UNKNOWN | diverged | 1 | 27 | main | claude/trusting-volta-UzhZq | refactor: four quick wins — named constants, simplified guard, modern exponentiation |
| #138 | UNKNOWN | diverged | 2 | 26 | main | claude/keen-hypatia-zmylJ | fix: address unresolved review threads from PR #124 (10) and PR #125 (8) |
| #137 | CLEAN | contained-in-origin-main | 0 | 16 | codex/hpr-studio-text-recovery-2026-06-05 | codex/hpr-dedication-input-2026-06-05 | fix: debounce dedication draft input |
| #136 | UNKNOWN | diverged | 2 | 27 | main | claude/sweet-mendel-ERwYG | feat: client-side request timeouts on all postJson calls (hardest-10 audit) |
| #135 | CLEAN | contained-in-origin-main | 0 | 18 | codex/hpr-timeout-abort-policy-2026-06-05 | codex/hpr-studio-text-recovery-2026-06-05 | fix: deepen Meechie studio text recovery |
| #134 | CLEAN | contained-in-origin-main | 0 | 20 | codex/hpr-safety-policy-generate-gate-2026-06-05 | codex/hpr-timeout-abort-policy-2026-06-05 | fix: harden timeout abort and retry policy |
| #133 | UNKNOWN | diverged | 1 | 27 | main | claude/trusting-volta-FFGMW | fix: four type-safety and clarity quick wins |
| #132 | UNKNOWN | diverged | 1 | 24 | main | claude/keen-hypatia-mnGPq | fix: address unresolved review threads from PR #128 (11) and PR #129 (10) |
| #131 | CLEAN | contained-in-origin-main | 0 | 22 | codex/hpr-generate-image-seam-2026-06-05 | codex/hpr-safety-policy-generate-gate-2026-06-05 | fix: gate generate requests with SafetyPolicySeam |
| #130 | CLEAN | contained-in-origin-main | 0 | 23 | codex/hpr-http-error-policy-2026-06-05 | codex/hpr-generate-image-seam-2026-06-05 | fix: route generate through ImageGenerationSeam |
| #129 | CLEAN | contained-in-origin-main | 0 | 24 | codex/hpr-ledger-baseline-2026-06-05 | codex/hpr-http-error-policy-2026-06-05 | fix: preserve structured postJson responses |
| #124 | UNKNOWN | diverged | 2 | 27 | main | claude/sweet-mendel-loTf1 | Extract +page.svelte 690-line script into StudioState runes class |
| #123 | UNKNOWN | diverged | 3 | 27 | main | claude/trusting-volta-d3gH4 | chore: four quick wins — ESLint globals, unused prop, response.ok check |
| #122 | UNKNOWN | diverged | 1 | 27 | main | claude/keen-hypatia-wChfF | fix: address unresolved review threads from PR #109 (15) and PR #116 (6) |
| #121 | UNKNOWN | diverged | 1 | 27 | main | claude/sweet-mendel-AY4uT | fix(seams): consolidate dual ImageGenerationSeam layout (#1 of top-10 hardest fixes) |
| #120 | UNKNOWN | diverged | 2 | 27 | main | claude/trusting-volta-DpGvx | refactor: four quick wins — dedup, exhaustiveness throw, redundant union types |
| #119 | UNKNOWN | diverged | 1 | 27 | main | claude/keen-hypatia-gt2zB | fix: address unresolved review threads from PR #109 (15) and PR #116 (6) |
| #118 | UNKNOWN | diverged | 4 | 27 | main | claude/sweet-mendel-L4QZ6 | fix: resolve GeneratedImage naming collision between API and provider layers |
| #117 | UNKNOWN | diverged | 2 | 27 | main | claude/trusting-volta-2xCn7 | fix: four quick wins — browser globals, FileReader guard, dead prop, callback param names |
| #116 | UNKNOWN | diverged | 1 | 27 | main | claude/keen-hypatia-Eom6Z | fix(seams): address all unresolved review threads from PR #105 and PR #109 |
| #115 | UNKNOWN | diverged | 1 | 27 | main | claude/sweet-mendel-s4goc | feat(safety): wire SafetyPolicySeam into generate pipeline as content-safety gate |
| #114 | UNKNOWN | diverged | 2 | 27 | main | claude/trusting-volta-80NcC | refactor: four quick wins — ordinal bug, DRY provider error, null ambiguity, double parse |
| #113 | UNKNOWN | diverged | 1 | 27 | main | claude/keen-hypatia-IKkay | fix: address review comments from PR #109 (15 threads) and PR #105 (10 threads) |
| #112 | UNKNOWN | diverged | 1 | 27 | main | claude/sweet-mendel-19K9t | fix(arch): route generate-pipeline through ImageGenerationSeam instead of raw HTTP |
| #111 | UNKNOWN | diverged | 1 | 27 | main | claude/trusting-volta-zsJNG | fix: harden SelfieUpload FileReader and WigCarousel data guard |
| #110 | UNKNOWN | diverged | 1 | 27 | main | claude/keen-hypatia-KoiZc | fix: address review comments from PR #105 (10 threads) and PR #109 (15 threads) |
| #109 | UNKNOWN | diverged | 2 | 28 | main | claude/keen-hypatia-2WnV3 | fix: address review comments from PR #94 (11 threads) and PR #105 (10 threads) |
| #108 | UNKNOWN | diverged | 1 | 28 | main | claude/sweet-mendel-vDLKZ | fix: timeout & abort signal threading across image generation pipeline |
| #107 | UNKNOWN | diverged | 2 | 28 | main | claude/trusting-volta-3qC0n | fix: four quick wins — dead catch, RangeError, ** operator, redundant length guard |
| #106 | UNKNOWN | diverged | 3 | 28 | main | claude/keen-hypatia-Iym52 | fix: address review comments from PR #94 (11 threads) and PR #105 (10 threads) |
| #105 | UNKNOWN | diverged | 1 | 28 | main | claude/sweet-mendel-uzgMS | refactor(seams): replace logic-heavy mocks with fixture-scenario mocks |
| #104 | UNKNOWN | diverged | 1 | 28 | main | claude/trusting-volta-OlBcD | Four quick wins: a11y, debounce constant, base64 warn, stale TODOs |
| #102 | UNKNOWN | diverged | 1 | 28 | main | claude/sweet-mendel-Cb6Yj | fix: eliminate dual ImageGenerationSeam contract split and dead flat-layout artifacts |
| #101 | UNKNOWN | diverged | 2 | 28 | main | claude/trusting-volta-OvWgW | Four quick wins: postJson simplification, HTTP error handling, constant consolidation |
| #100 | UNKNOWN | diverged | 1 | 28 | main | claude/keen-hypatia-gPGwR | fix: address review comments from PR #85 (17 threads) and PR #94 (11 threads) |
| #99 | UNKNOWN | diverged | 1 | 28 | main | claude/trusting-volta-LEOOj | fix: four quick wins — response.ok guard, error context, stale TODOs, missing test |
| #98 | UNKNOWN | diverged | 1 | 28 | main | claude/sweet-mendel-prxDO | fix(pipeline): deepen MeechieStudioTextPipeline error recovery |
| #95 | UNKNOWN | diverged | 1 | 32 | main | claude/keen-hypatia-yY1Ok | fix: address review comments from PR #83 (34 threads) and PR #85 (17 threads) |
| #94 | UNKNOWN | diverged | 1 | 32 | main | claude/cool-volta-CspQv | Add design.md: Visual identity and design system specification |
| #92 | DIRTY | diverged | 4 | 32 | claude/loving-cerf-WQ5lT | codex/fix-high-priority-bug-in-+page.svelte | [PR #91 follow-up] Fix stale dedication value in draft save path |
| #89 | UNKNOWN | diverged | 2 | 32 | main | claude/loving-cerf-xhu1X | fix: retire dead ImageGenerationSeam legacy layer and fix inverted HTTP status codes |
| #88 | UNKNOWN | diverged | 2 | 32 | main | claude/trusting-volta-pdWeK | fix: four quick wins — font typo, dead code, double-parse, unused return |
| #87 | UNKNOWN | diverged | 1 | 32 | main | dependabot/npm_and_yarn/npm_and_yarn-ec84fab188 | chore(deps-dev): bump @sveltejs/kit from 2.59.1 to 2.60.1 in the npm_and_yarn group across 1 directory |
| #86 | UNKNOWN | diverged | 3 | 32 | main | claude/trusting-volta-6zZbR | fix: four quick wins — response.ok guards and NaN-safe config parsing |
| #85 | UNKNOWN | diverged | 2 | 32 | main | claude/loving-cerf-gaGFo | feat: HTTP resilience — timeouts, exponential-backoff retry, and status-code bug fix |
| #82 | UNKNOWN | diverged | 2 | 32 | main | fix/quick-wins-16133530797685224206 | fix: 8 quick wins including linting configuration and flaky e2e tests |
| #81 | UNKNOWN | diverged | 1 | 88 | main | perf-meechie-tools-lookup-11088486340717629747 | ⚡ Optimize Meechie tool help text lookup |
| #80 | UNKNOWN | diverged | 2 | 32 | main | fix-quick-wins-11081142034329469877 | chore: Implement 8 quick wins across configuration and optimizations |
| #79 | UNKNOWN | diverged | 1 | 32 | main | coderabbitai/utg/a5eb1f4 | CodeRabbit Generated Unit Tests: Add generated unit tests |
| #77 | UNKNOWN | diverged | 4 | 32 | main | claude/trusting-volta-pgS2O | fix: four quick wins — HTTP error masking, date race, magic number, duplicate expression |
| #74 | UNKNOWN | diverged | 8 | 32 | main | claude/trusting-volta-Ceiye | fix: four quick wins — error handling, dead code, debug log |
| #73 | UNKNOWN | diverged | 7 | 32 | main | claude/loving-cerf-qGkAg | Migrate 13 legacy flat-layout seams to self-contained layout |
| #72 | UNKNOWN | diverged | 3 | 32 | main | claude/trusting-volta-5p2rl | fix: four quick wins in core pipeline and http client |
| #71 | UNKNOWN | diverged | 2 | 32 | main | claude/loving-cerf-uIaz4 | fix(lint): resolve all 89 ESLint errors — add environment globals and fix ignores |
| #60 | UNKNOWN | diverged | 5 | 65 | main | fix/vercel-ci-image-generation-types | fix: repair Vercel CI image generation checks |
