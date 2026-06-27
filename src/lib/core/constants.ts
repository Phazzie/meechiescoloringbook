// Purpose: Provide shared cross-seam constants for deterministic behavior.
// Why: Prevent phrase/rule drift between adapters, routes, seams, and tests.
// Info flow: Constants -> adapters/routes/mocks -> runtime validation and generation.

// Single source of truth for the coloring-page title cap. Deliberately kept in this
// dependency-free module (no zod) rather than in contracts/spec-validation.contract.ts or
// src/lib/seams/spec-validation-seam/contract.ts, both of which pull in the full zod schema
// graph — compactColoringPageTitle is imported directly by client-side +page.svelte files,
// so importing either Zod-based contract there would bundle zod into the client for no reason.
export const MAX_TITLE_LENGTH = 80;

// Mirrors MAX_TITLE_LENGTH's rationale above: kept dependency-free so
// StudioInputPanel.svelte can import the cap directly instead of pulling in
// contracts/meechie-studio-text.contract.ts's zod schema graph for one number.
export const MAX_FREE_TEXT_LENGTH = 4000;

export const SYSTEM_CONSTANTS = {
	REQUIRED_PROMPT_PHRASES: [
		'Black-and-white coloring book page',
		'outline-only',
		'easy to color',
		'Crisp vector-like linework',
		'NEGATIVE PROMPT:'
	],
	DISALLOWED_KEYWORDS: ['minors', 'self-harm'],
	CHAT_SYSTEM_PROMPT: `You map user intent to a ColoringPageSpec JSON object. Output ONLY JSON.

Rules:
- Use this exact schema: {"title":string,"items":[{"number":int,"label":string}],"footerItem"?:{"number":int,"label":string},"listMode":"list"|"title_only","alignment":"left"|"center","numberAlignment":"strict"|"loose","listGutter":"tight"|"normal"|"loose","whitespaceScale":0-100,"textSize":"small"|"medium"|"large","fontStyle":"rounded"|"block"|"hand","textStrokeWidth":4-12,"colorMode":"black_and_white_only"|"grayscale"|"color","decorations":"none"|"minimal"|"dense","illustrations":"none"|"simple"|"scene","shading":"none"|"hatch"|"stippling","border":"none"|"plain"|"decorative","borderThickness":2-16,"variations":1-4,"outputFormat":"png"|"pdf","pageSize":"US_Letter"|"A4"}.
- title: 1-${MAX_TITLE_LENGTH} chars.
- items: 1-20 items, numbers 1-999, labels 1-40 chars.
- Allowed label characters: letters, numbers, spaces, and .,!?'":;-() only.
- If user intent is vague, choose a short title and 2 list items.
- Default values when unspecified: listMode="list", alignment="left", numberAlignment="strict", listGutter="normal", whitespaceScale=50, textSize="small", fontStyle="rounded", textStrokeWidth=6, colorMode="black_and_white_only", decorations="none", illustrations="none", shading="none", border="plain", borderThickness=8, variations=1, outputFormat="pdf", pageSize="US_Letter".
- Output JSON only. No markdown, no prose.`
} as const;

export const findDisallowedKeywords = (input: unknown): string[] => {
	if (input === undefined || input === null) {
		return [];
	}
	try {
		let serialized: string;
		try {
			serialized = JSON.stringify(input) ?? String(input);
		} catch {
			serialized = String(input);
		}
		const text = serialized.toLowerCase();
		return SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS.filter((keyword) =>
			text.includes(keyword.toLowerCase())
		);
	} catch {
		return [...SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS];
	}
};

