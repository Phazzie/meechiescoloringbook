// Purpose: Centralize xAI text-model fallback selection.
// Why: Keep every text-generation seam on the same default when XAI_TEXT_MODEL is absent.
// Info flow: optional configured model -> normalized model id -> provider request.
export const DEFAULT_TEXT_MODEL = 'grok-4-1-fast-reasoning';

export const selectTextModel = (
	configuredModel: string | undefined
): string => {
	const trimmedModel = configuredModel?.trim();
	return trimmedModel && trimmedModel.length > 0
		? trimmedModel
		: DEFAULT_TEXT_MODEL;
};
