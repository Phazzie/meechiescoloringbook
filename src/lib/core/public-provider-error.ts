// Purpose: Convert provider-facing failures into stable public API errors.
// Why: Provider diagnostics can contain response bodies, URLs, credentials, and tenant identifiers.
// Info flow: Internal provider error + route fallback -> allowlisted code/message without details.
type ProviderErrorLike = {
	code?: unknown;
	message?: unknown;
	details?: unknown;
};

export type PublicProviderError = {
	code: string;
	message: string;
};

const PUBLIC_PROVIDER_ERROR_MESSAGES: Readonly<Record<string, string>> = {
	PROVIDER_API_KEY_MISSING: 'AI provider is not configured.',
	PROVIDER_HTTP_ERROR: 'AI provider request failed.',
	PROVIDER_NETWORK_ERROR: 'AI provider request failed.',
	IMAGE_VALIDATION_ERROR: 'Image generation request is invalid.',
	IMAGE_CONFIG_ERROR: 'Image generation is temporarily unavailable.',
	IMAGE_HTTP_ERROR: 'Image generation provider request failed.',
	IMAGE_TIMEOUT_ERROR: 'Image generation timed out.',
	IMAGE_ABORTED: 'Image generation request was canceled.',
	IMAGE_NETWORK_ERROR: 'Image generation provider request failed.',
	IMAGE_EMPTY_RESPONSE: 'Image generation provider returned no images.',
	PROVIDER_EMPTY_IMAGE: 'Provider returned no images.',
	MEECHIE_VOICE_PACK_ERROR: 'Failed to load Meechie voice pack.',
	MEECHIE_TOOL_PROVIDER_ERROR: 'Meechie tool provider request failed.',
	MEECHIE_TOOL_PROVIDER_INVALID:
		'Meechie tool provider returned an invalid response.',
	MEECHIE_STUDIO_TEXT_PROVIDER_INVALID:
		'Provider text response did not match contract.',
	WIG_TRY_ON_VALIDATION_ERROR: 'Wig try-on request is invalid.',
	WIG_TRY_ON_CONFIG_ERROR: 'Wig try-on is temporarily unavailable.',
	WIG_TRY_ON_ABORTED: 'Wig try-on request was canceled.',
	WIG_TRY_ON_TIMEOUT_ERROR: 'Wig try-on request timed out.',
	WIG_TRY_ON_HTTP_ERROR: 'Wig try-on could not create a portrait.',
	WIG_TRY_ON_NETWORK_ERROR: 'Wig try-on could not create a portrait.',
	WIG_TRY_ON_PARSE_ERROR: 'Wig try-on could not create a portrait.',
	WIG_TRY_ON_EMPTY_RESPONSE: 'Wig try-on could not create a portrait.'
};

export const toPublicProviderError = (
	error: ProviderErrorLike,
	fallback: PublicProviderError
): PublicProviderError => {
	const candidateCode = typeof error.code === 'string' ? error.code : '';
	const publicMessage = PUBLIC_PROVIDER_ERROR_MESSAGES[candidateCode];
	if (!publicMessage) {
		return { code: fallback.code, message: fallback.message };
	}

	return { code: candidateCode, message: publicMessage };
};
