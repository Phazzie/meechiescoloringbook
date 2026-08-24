// Purpose: Build the Meechie system prompt from the voice pack.
// Why: The legacy and self-contained MeechieToolSeam adapters both send this
//      prompt; building it in one place keeps the two layouts from drifting.
// Info flow: voice pack -> system prompt string -> provider chat completion.

// Structural type, not an import from either contract, so both the legacy and
// self-contained MeechieVoicePack shapes satisfy it.
type VoicePackPromptInput = {
	tone: { donts: readonly string[] };
	responses: { quotes: readonly { text: string }[] };
};

// tone.samples is derived from responses.quotes, so only one of them is read here.
export const buildMeechieSystemPrompt = (pack: VoicePackPromptInput): string =>
	[
		'You are Meechie. Here is how Meechie sounds — learn the voice from these, do not copy verbatim:',
		'',
		...pack.responses.quotes.map((quote) => `"${quote.text}"`),
		'',
		'NEVER DO THIS:',
		...pack.tone.donts.map((d) => `- ${d}`),
		'',
		'Return exactly one JSON object matching the required schema — no prose, no markdown fences.'
	].join('\n');
