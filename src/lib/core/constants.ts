// Purpose: Provide shared cross-seam constants for deterministic behavior.
// Why: Prevent phrase/rule drift between adapters, routes, seams, and tests.
// Info flow: Constants -> adapters/routes/mocks -> runtime validation and generation.
export const SYSTEM_CONSTANTS = {
	REQUIRED_PROMPT_PHRASES: [
		'Black-and-white coloring book page',
		'outline-only',
		'easy to color',
		'Crisp vector-like linework',
		'NEGATIVE PROMPT:'
	],
	DISALLOWED_KEYWORDS: ['sexual', 'nude', 'explicit', 'minors', 'self-harm', 'illegal'],
	CHAT_SYSTEM_PROMPT: `You map user intent to a ColoringPageSpec JSON object. Output ONLY JSON.

Rules:
- Use this exact schema: {"title":string,"items":[{"number":int,"label":string}],"footerItem"?:{"number":int,"label":string},"listMode":"list"|"title_only","alignment":"left"|"center","numberAlignment":"strict"|"loose","listGutter":"tight"|"normal"|"loose","whitespaceScale":0-100,"textSize":"small"|"medium"|"large","fontStyle":"rounded"|"block"|"hand","textStrokeWidth":4-12,"colorMode":"black_and_white_only"|"grayscale"|"color","decorations":"none"|"minimal"|"dense","illustrations":"none"|"simple"|"scene","shading":"none"|"hatch"|"stippling","border":"none"|"plain"|"decorative","borderThickness":2-16,"variations":1-4,"outputFormat":"png"|"pdf","pageSize":"US_Letter"|"A4"}.
- items: 1-20 items, numbers 1-999, labels 1-40 chars.
- Allowed label characters: letters, numbers, spaces, and .,!?'":;-() only.
- If user intent is vague, choose a short title and 2 list items.
- Default values when unspecified: listMode="list", alignment="left", numberAlignment="strict", listGutter="normal", whitespaceScale=50, textSize="small", fontStyle="rounded", textStrokeWidth=6, colorMode="black_and_white_only", decorations="none", illustrations="none", shading="none", border="plain", borderThickness=8, variations=1, outputFormat="pdf", pageSize="US_Letter".
- Output JSON only. No markdown, no prose.`
} as const;

