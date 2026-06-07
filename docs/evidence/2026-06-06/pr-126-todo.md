### [#126](https://github.com/Phazzie/meechiescoloringbook/pull/126) - Four quick wins: dedup, actionable errors, consistent naming, safer date

#### Thread 1: src/lib/core/constants.ts (Line 35)

- **Author:** @gemini-code-assist
- **Relevance:** Relevant
- **Suggested Owner Bucket:** `Backend / Seams`
- **Discussion URL:** [Link to GitHub](https://github.com/Phazzie/meechiescoloringbook/pull/126#discussion_r3355865038)
- **Comment:**
    > ![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)
    >
    > The `findDisallowedKeywords` function takes an `input` of type `unknown`. If `input` is `undefined`, `JSON.stringify(input)` returns `undefined`, and calling `.toLowerCase()` on it will throw a `TypeError`. Additionally, if `input` contains circular references or other non-serializable values, `JSON.stringify` will throw an error. Wrapping this in a `try-catch` block and handling `undefined` safely will prevent potential runtime crashes.
    >
    > ```suggestion
    > export const findDisallowedKeywords = (input: unknown): string[] => {
    > 	try {
    > 		const text = (JSON.stringify(input) || '').toLowerCase();
    > 		return SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS.filter((keyword) =>
    > 			text.includes(keyword.toLowerCase())
    > 		);
    > 	} catch {
    > 		return [];
    > 	}
    > };
    > ```


#### Thread 2: src/lib/core/constants.ts (Line 35)

- **Author:** @copilot-pull-request-reviewer
- **Relevance:** Relevant
- **Suggested Owner Bucket:** `Backend / Seams`
- **Discussion URL:** [Link to GitHub](https://github.com/Phazzie/meechiescoloringbook/pull/126#discussion_r3355874850)
- **Comment:**
    > `findDisallowedKeywords` can throw at runtime for some `unknown` inputs: `JSON.stringify(undefined)` returns `undefined` (so `.toLowerCase()` crashes), and `JSON.stringify` can also throw (e.g. BigInt or circular structures). Since this is now a shared exported helper used for safety checks, it should be defensive and ideally fail closed (treat uninspectable input as disallowed) rather than crashing the pipeline.


#### Thread 3: src/lib/core/image-generation-pipeline.ts (Line 77)

- **Author:** @copilot-pull-request-reviewer
- **Relevance:** Relevant
- **Suggested Owner Bucket:** `Backend / Seams`
- **Discussion URL:** [Link to GitHub](https://github.com/Phazzie/meechiescoloringbook/pull/126#discussion_r3355874902)
- **Comment:**
    > The new error message now exposes `missing` phrases, but `missingRequiredPhrases()` lowercases phrases for comparison, so the surfaced list is lowercased and may not match the exact required prompt text. Consider clarifying that the list is case-insensitive/normalized to avoid confusing callers.
