### [#127](https://github.com/Phazzie/meechiescoloringbook/pull/127) - feat: migrate 5 flat seams to self-contained layout + fix SDD-non-compliant mocks

#### Thread 1: src/lib/adapters/drift-detection-seam/index.ts (Line 83)

- **Author:** @gemini-code-assist
- **Relevance:** Relevant
- **Suggested Owner Bucket:** `Backend / Seams`
- **Discussion URL:** [Link to GitHub](https://github.com/Phazzie/meechiescoloringbook/pull/127#discussion_r3356058154)
- **Comment:**
    > ![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)
    >
    > Using simple substring matching with `lowered.includes(token)` can lead to false positives (e.g., matching a short forbidden token like `'art'` inside a harmless word like `'earth'`). Consider using word boundary checks or a regular expression to match whole words only.
    >
    > ```suggestion
    > 	return PROMPT_FORBIDDEN_TOKENS.filter((token) => {
    > 		const regex = new RegExp(`\\b${token}\\b`, 'i');
    > 		return regex.test(lowered);
    > 	});
    > ```


#### Thread 2: src/lib/adapters/meechie-tool-seam/index.ts (Line 270)

- **Author:** @gemini-code-assist
- **Relevance:** Relevant
- **Suggested Owner Bucket:** `Backend / Seams`
- **Discussion URL:** [Link to GitHub](https://github.com/Phazzie/meechiescoloringbook/pull/127#discussion_r3356058166)
- **Comment:**
    > ![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)
    >
    > If the LLM returns markdown code blocks (e.g., ```json ... ```), `JSON.parse` will throw an error and fail the response validation. Although structured outputs are requested, models can occasionally output markdown formatting under edge cases or fallback scenarios. Sanitizing the content by stripping potential markdown code fences before parsing will make the parser more robust.
    >
    > ```typescript
    > 	let sanitized = content.trim();
    > 	if (sanitized.startsWith('```')) {
    > 		sanitized = sanitized.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
    > 	}
    > 	try {
    > 		const parsed = JSON.parse(sanitized) as Record<string, unknown>;
    > 		const headline =
    > 			typeof parsed.headline === 'string' ? parsed.headline.trim() : '';
    > 		const response =
    > 			typeof parsed.response === 'string' ? parsed.response.trim() : '';
    > 		if (!headline || !response) {
    > 			return null;
    > 		}
    >
    > 		if (toolId === 'rate_excuse') {
    > 			if (typeof parsed.rating !== 'number') {
    > 				return null;
    > 			}
    > 			const rating = Math.max(1, Math.min(10, Math.round(parsed.rating)));
    > 			return { headline: `${rating}/10`, response, rating };
    > 		}
    >
    > 		return { headline, response };
    > 	} catch {
    > 		return null;
    > 	}
    > ```


#### Thread 3: src/lib/adapters/prompt-assembly-seam/index.ts (Line 126)

- **Author:** @copilot-pull-request-reviewer
- **Relevance:** Relevant
- **Suggested Owner Bucket:** `Backend / Seams`
- **Discussion URL:** [Link to GitHub](https://github.com/Phazzie/meechiescoloringbook/pull/127#discussion_r3356067507)
- **Comment:**
    > `styleHint` is concatenated into the prompt verbatim, and `NonEmptyStringSchema` allows newlines/whitespace. A multi-line (or whitespace-only) style hint can inject extra lines/headings into the prompt and potentially alter downstream drift-detection or provider behavior. Normalize `styleHint` to a single trimmed line (collapse whitespace/newlines, treat whitespace-only as absent) before validating and building the prompt.


#### Thread 4: src/lib/adapters/meechie-tool-seam/index.ts (Line 244)

- **Author:** @copilot-pull-request-reviewer
- **Relevance:** Relevant
- **Suggested Owner Bucket:** `Backend / Seams`
- **Discussion URL:** [Link to GitHub](https://github.com/Phazzie/meechiescoloringbook/pull/127#discussion_r3356067550)
- **Comment:**
    > `parseResponse` accepts `toolId: string`, which allows callers to pass values outside the seam contract and weakens exhaustiveness/typing (especially since behavior differs for `'rate_excuse'`). Tighten the type to the contract’s union so invalid toolIds are caught at compile time.


#### Thread 5: src/lib/adapters/meechie-voice-seam/index.ts (Line 16)

- **Author:** @copilot-pull-request-reviewer
- **Relevance:** Relevant
- **Suggested Owner Bucket:** `Backend / Seams`
- **Discussion URL:** [Link to GitHub](https://github.com/Phazzie/meechiescoloringbook/pull/127#discussion_r3356067571)
- **Comment:**
    > This adapter embeds the entire `meechieVoicePack` as a large inline literal, while the same voice pack content also exists elsewhere (e.g. fixtures and the legacy flat adapter). Keeping multiple authoritative copies makes divergence very likely (voice edits will need to be made in several places, and tests may only cover one). Consider extracting the voice pack into a single source (shared JSON/module validated by `MeechieVoicePackSchema`) and importing it from both adapters.


#### Thread 6: docs/seams.md (Line 32)

- **Author:** @chatgpt-codex-connector
- **Relevance:** Relevant
- **Suggested Owner Bucket:** `General`
- **Discussion URL:** [Link to GitHub](https://github.com/Phazzie/meechiescoloringbook/pull/127#discussion_r3356080425)
- **Comment:**
    > **<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Wire canonical seams into runtime**
    >
    > When the app exercises the generation, chat, or Meechie tool flows, these newly declared canonical self-contained seams are not used: repo-wide search shows `src/lib/core/generate-pipeline.ts` still imports the flat prompt/drift/spec adapters, `src/lib/core/chat-interpretation-pipeline.ts` still imports the flat spec contract/adapter, and `src/lib/core/tools-pipeline.ts` still imports the flat Meechie tool adapter. This means fixes or contract changes made in the migrated self-contained seams and their fixture-backed mocks will only affect the new seam-local tests, not production behavior, so the migration is effectively bypassed until the runtime imports are updated.
    >
    > Useful? React with 👍 / 👎.


#### Thread 7: src/lib/seams/prompt-compiler-seam/mock.ts (Line 8)

- **Author:** @chatgpt-codex-connector
- **Relevance:** Relevant
- **Suggested Owner Bucket:** `General`
- **Discussion URL:** [Link to GitHub](https://github.com/Phazzie/meechiescoloringbook/pull/127#discussion_r3356080431)
- **Comment:**
    > **<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Preserve input-specific prompt compilation**
    >
    > When any test or probe calls this mock with a `PromptCompilerInput` other than `promptCompilerInputFixture`, it now returns the sample fixture prompt and metadata regardless of the requested description, density, line thickness, border, or caption. The previous mock interpolated those fields into the compiled prompt, so this change can let code that drops or misroutes prompt-compiler inputs still pass against the mock while producing the wrong prompt shape for non-sample inputs.
    >
    > Useful? React with 👍 / 👎.
