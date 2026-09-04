<!--
Purpose: Record user-visible changes for this repo.
Why: Provide a clear history of behavior changes and releases.
Info flow: Changes -> entries -> release communication.
-->
# Changelog

All notable user-visible changes for this repo.

## Unreleased
- Who Fucked Up?, Rate His Excuse and Random Meechie now make the same coloring page the rest of the app makes. These three routes are three of the four links in the nav, and each one used to flatten Meechie's whole answer into a single page title: a verdict that came back in beats ("Fault:", "Consequence:", "Move:") lost that structure and got cut off at 96 characters. They now print as numbered list pages with the lines intact, exactly like the toolkit does, and an unstructured saying still prints as a full-quote page.
- You can save a page from any of those three routes to the Quote Vault. Previously nothing outside the home studio and the toolkit could put anything in the vault, so a page generated from the nav — after paying for the generation — survived only as long as the tab did.
- Those three routes now tell you when the printed page drifted from what was asked for, instead of discarding the report.
- A failed retry on those routes no longer destroys the page you already have. Asking Meechie again and getting a timeout, an empty field, or a provider error used to wipe the verdict, the preview and the downloads before the request had even gone out.
- Editing "Dedicated to" after generating now drops the page it was not generated with, so a download can never carry a dedication the form no longer shows.
- The printable PDF on those routes survives a failed share image. They used to build both files in one call, and a browser that could not encode the square share image lost the PDF with it.
- Every verdict on those routes can be copied to the clipboard, and Random Meechie keeps the saying you are reading on screen while it fetches the next one.
- Asking for another saying on Random Meechie clears a dedication chosen for the previous one, so a name can no longer end up printed on a saying it was never meant for.
- "Generate My Coloring Page" is disabled while a replacement verdict is loading, so a generation can no longer be charged for a page that is about to be discarded.
- A saved page no longer claims that drift corrections were applied when none were. The drift report itself is still stored.
- Every tool in Meechie's Tools now makes a coloring page. All eleven — Apology Autopsy, Run Or Red Flag, Meechie Move, Excuse Court, Meechie Forecast, Receipt Check, Caption Drop, Return Fire, Term Breakdown, Rate Excuse and Random Meechie — used to end at a paragraph of text you could not print, keep, or copy. Each verdict now generates the page, previews it, downloads as PDF and PNG, and saves to the Quote Vault.
- A tool page is now shaped by what the tool actually said. A verdict that comes back in beats ("Fault:", "Consequence:", "Move:") prints as a numbered list page with those lines intact, and a ranked Excuse Court lineup prints as the ranking; a one-line saying prints as a full-quote page. Previously every mode flattened its whole answer into a single page title and lost the structure.
- Each tool has its own artwork direction: a gavel and scales for Excuse Court, paper and ledger lines for Receipt Check, stars and constellations for Meechie Forecast, and so on, instead of one shared style for everything.
- Rate Excuse pages lead with the score.
- You can copy any verdict to the clipboard.
- The Quote Vault is a real gallery of your saved coloring pages instead of a four-row list of titles. Every saved page is reachable, each row shows the actual page as a thumbnail alongside its quote and when you saved it, and you can search the whole vault by title, quote, or any line printed on the page. Pin now genuinely pins a page to the top, and you can download a saved page straight from its row.
- Reopening a saved page brings the page back, not just the words. The image, the prompt trace, and the printable PDF are all restored, so seeing your own saved page again no longer costs another generation.
- Deleting a saved page now asks first and can be undone afterwards. A single mis-tap can no longer destroy a page you paid to generate.
- Vault failures are visible. An unreadable browser store, a failed delete, or a failed pin now says what went wrong instead of showing an empty list or silently doing nothing.
- Pages now carry baseline security headers and a Content Security Policy, and the files served alongside them (scripts, images, the service worker) carry the same baseline. The site can no longer be embedded in someone else's page, which is the setup behind clickjacking, and the browser is told exactly which sources it may load from.
- Resolved all ten outstanding dependency advisories (one critical, six high) and added an audit gate to `npm run verify`, so the build chain cannot quietly rot again.
- Rate limiting now applies to every AI-backed endpoint. Requests are metered per client before any provider call, so a burst of traffic cannot run up provider spend. Limits are 20 requests/minute across the text features and 8/minute across the image features; exceeding one returns a clear "try again shortly" response with the wait time.
- The landing page is dramatically faster to load. Packaged imagery dropped from 38 MB to 2.6 MB with no visible change to the artwork — the wig cards, banners and example pages are the same pictures at sizes a screen can actually use.
- Saving a coloring page no longer produces a file named `.png` that contains JPEG data. The download now matches its real format.
- Drafts left untouched from an older default page are correctly recognised as untouched instead of being restored as your own work.
- A single corrupt entry in saved work no longer silently disappears on the next save.
- The wig try-on feature runs on xAI rather than Gemini, so the exhausted-quota failure that made it unusable is resolved.
- Fixed prompt text boundaries so template labels cannot become drawable page copy, consolidated prompt assembly into one canonical adapter, and versioned the combined contract as `v4`.
- Added a local PR backlog dry-run validation script (`scripts/validate-pr-backlog.js`) to automate checking out, testing, and verifying clean PR candidates.
- Added a review-comment extraction script (`scripts/get-pr-todos.js`) to isolate and scope active review threads for a specific PR.
- Added a real-time merge conflict analysis script (`scripts/analyze-merge-conflicts.js`) to test all open PR branches for merge conflicts and update the triage table.
- Fully redesigned the builder and Meechie pages with a cleaner modern visual system, clearer hierarchy, and polished action flows on desktop/mobile.
- Moved Meechie tools to a dedicated destination path from the main builder flow and added a focused handoff card.
- Added a temporary UI API key panel (save/load/clear/show) and propagated `x-api-key` from client requests to generation endpoints.
- Improved image-generation failure handling with clearer status codes and actionable missing-key messaging.
- Refactored `/api/generate` orchestration into `src/lib/core/generate-pipeline.ts` so the route is a thin transport wrapper.
- Refactored `/api/chat-interpretation` and `/api/tools` into core pipelines so both routes are now thin wrappers with centralized validation/safety behavior.
- Retired the unused legacy generation workflow/composition path so active runtime flow is only the current endpoint-pipeline architecture.
- Added shared prompt-template helpers in `src/lib/core/prompt-template.ts` and refactored PromptAssemblySeam/DriftDetectionSeam to use one wording source.
- Added shared client request helpers in `src/lib/core/http-client.ts` and refactored builder + Meechie tool fetch paths to use it.
- Refreshed MeechieVoiceSeam and fixture-backed Meechie tool copy to match the latest power-first tone pattern.
- Centralized Meechie voice copy in MeechieVoiceSeam and routed Meechie tools through the voice pack.
- Made image-generation prompt phrase checks case-insensitive to avoid false negatives when validating prompts.
- Wired the main UI and chat builder to enforce the full seam loop (SpecValidation → PromptAssembly → ImageGeneration → DriftDetection → OutputPackaging → CreationStore), gating Generate on validation, surfacing prompt/drift debug info, and adding creation favorites/deletion plus draft persistence.
- Added Manifest + Android-ready PNG/maskable icons for Meechie's Coloring Book PWA alongside the existing SVG asset.
- Added server-side xAI chat/image endpoints with client adapters calling `/api/chat-interpretation` and `/api/image-generation`.
- Added PWA manifest, icon, and service worker registration for Android installability.
- Embedded Meechie tools directly in the main page and reused the component for `/meechie`.
- Tweaked default page style to include minimal decorations and a decorative border for sparkle-friendly prompts.
- Added optional dedication line support in the spec and prompt assembly.
- Added square and group-chat share exports in output packaging.
- Added a sparkle overlay preview toggle in the output gallery.
- Added local environment template and secret ignore rules for safe configuration.
- Recorded Seam-Driven Development governance decisions and seam inventory for project setup.
- Implemented seam contracts, fixtures, mocks, adapters, and contract tests for all v1 seams.
- Added deterministic SVG rendering, drift detection, and client-side PDF/PNG packaging.
- Built the worksheet-style UI with manual builder, chat stub, debug panel, and saved creation list.
- Aligned prompt assembly with left/center alignment, centered list columns when requested, and removed decorative instructions to match constraints.
- Added alignment phrase checks to drift detection and reinforced deterministic SVG layout assertions.
- Added a shared alignment-line utility so PromptAssemblySeam, DriftDetectionSeam, fixtures, and probes all emit the “all numbers vertically aligned; all text left-aligned; treat blank space as intentional; do not fill empty space” sentence, eliminating drift between seams.
- Removed external font loading and ensured SVG-to-PNG/PDF outputs render on white backgrounds.
- Expanded user options (list mode/gutter, typography, color, decorations, illustrations, shading, border, and page size) with deterministic prompt + renderer enforcement.
- Added title-only drift detection coverage and dense/scene renderer proof fixtures for deterministic SVG output.
- Added seam ledger and proof tape automation outputs to improve proof visibility for non-coders.
- Added clan chain evidence summaries to flag clean vs dirty seams.
- Added cipher gate automation to require evidence-linked proof summaries in decisions.
- Added assumption alarm automation to enforce logged blocked-probe assumptions.
- Replaced the default README with project-specific Seam-Driven Development and Wu-Tang coding context.
- Expanded the README explanation to be more relatable for non-coders.
- Expanded README explanation to include integration-first seams and synthesis benefits.
- Added git hooks and CI verify workflow to enforce Seam-Driven Development gates automatically.
- Documented the local git hook install step in the README.
- Clarified that hooks should be installed after cloning.
- Added Meechie tools UI with deterministic templates behind a new seam.
- Added explicit Wu-Bob response formatting in AGENTS guidance.
- Updated Wu-Bob response guidance to a combined voice format.
- Added AI-agent reference notes plus a Seam-Driven Development checklist to keep plans and evidence explicit for autonomous agents.
- Shortened the canonical prompt template to fit the xAI 1024-character limit, updated drift checks, fixtures, and probes to match, and clarified negative/option line phrasing.
