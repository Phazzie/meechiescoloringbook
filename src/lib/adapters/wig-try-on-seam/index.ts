// Purpose: Implement WigTryOnSeam with live Gemini 2.5 Flash Image API calls.
// Why: Isolate Gemini API I/O behind the seam contract so tests can swap in a mock.
// Info flow: validated selfie + wig base64 -> gemini-2.5-flash-image generateContent -> portrait base64 Result.
import type {
	WigTryOnRequest,
	WigTryOnResult,
	WigTryOnSeam,
	WigTryOnError
} from '../../seams/wig-try-on-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';
import { validateWigTryOnRequest } from '../../seams/wig-try-on-seam/validators';
import type { AppConfigSeam } from '../../seams/app-config-seam/contract';

const WIG_TRY_ON_PROMPT = [
	'You are an AI artist. Using the first image (a selfie) and the second image (a wig product photo),',
	'create a glamorous illustrated portrait of the person wearing that wig.',
	'Style: bold coloring book line art — clean outlines, minimal fill, high contrast black and white,',
	'with the wig rendered in the same style as shown in the product photo.',
	'The face should be flattering and recognizable. The wig should sit naturally on the head.',
	'Output a single portrait illustration only — no background text or labels.'
].join(' ');

type GeminiPart =
	| { text: string }
	| { inline_data: { mime_type: string; data: string } };

type GeminiResponse = {
	candidates?: Array<{
		content?: {
			parts?: GeminiPart[];
		};
	}>;
};

const errorResult = (
	error: WigTryOnError
): Result<WigTryOnResult, WigTryOnError> => ({
	ok: false,
	error
});

export const createWigTryOnSeam = (configSeam: AppConfigSeam): WigTryOnSeam => ({
	tryOn: async (
		request: WigTryOnRequest
	): Promise<Result<WigTryOnResult, WigTryOnError>> => {
		let validated: WigTryOnRequest;
		try {
			validated = validateWigTryOnRequest(request);
		} catch {
			return errorResult({
				code: 'WIG_TRY_ON_VALIDATION_ERROR',
				message: 'Wig try-on request failed validation.'
			});
		}

		let apiKey: string;
		try {
			const config = configSeam.getConfig();
			apiKey = config.geminiApiKey;
		} catch {
			return errorResult({
				code: 'WIG_TRY_ON_CONFIG_ERROR',
				message: 'Gemini configuration is invalid. Ensure GEMINI_API_KEY is set.'
			});
		}

		if (!apiKey) {
			return errorResult({
				code: 'WIG_TRY_ON_CONFIG_ERROR',
				message: 'GEMINI_API_KEY is not configured. The wig try-on feature requires a Gemini API key.'
			});
		}

		const model = 'gemini-2.5-flash-image';
		const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

		const requestBody = {
			contents: [
				{
					role: 'user',
					parts: [
						{ text: WIG_TRY_ON_PROMPT },
						{
							inline_data: {
								mime_type: validated.selfieMimeType,
								data: validated.selfieBase64
							}
						},
						{
							inline_data: {
								mime_type: validated.wigImageMimeType,
								data: validated.wigImageBase64
							}
						}
					]
				}
			],
			generationConfig: {
				responseModalities: ['IMAGE', 'TEXT']
			}
		};

		const start = Date.now();
		let response: Response;
		try {
			response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});
		} catch (error) {
			return errorResult({
				code: 'WIG_TRY_ON_NETWORK_ERROR',
				message: error instanceof Error ? error.message : 'Gemini API network request failed.'
			});
		}

		if (!response.ok) {
			const text = await response.text().catch(() => '');
			return errorResult({
				code: 'WIG_TRY_ON_HTTP_ERROR',
				message: `Gemini API returned ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
				details: { status: String(response.status) }
			});
		}

		let geminiResponse: GeminiResponse;
		try {
			geminiResponse = (await response.json()) as GeminiResponse;
		} catch {
			return errorResult({
				code: 'WIG_TRY_ON_PARSE_ERROR',
				message: 'Failed to parse Gemini API response.'
			});
		}

		const parts = geminiResponse.candidates?.[0]?.content?.parts ?? [];
		const imagePart = parts.find(
			(p): p is { inline_data: { mime_type: string; data: string } } =>
				'inline_data' in p && typeof p.inline_data?.data === 'string'
		);

		if (!imagePart) {
			return errorResult({
				code: 'WIG_TRY_ON_EMPTY_RESPONSE',
				message: 'Gemini returned no image in the response.'
			});
		}

		return {
			ok: true,
			value: {
				portraitBase64: imagePart.inline_data.data,
				portraitMimeType: imagePart.inline_data.mime_type,
				timingMs: Date.now() - start
			}
		};
	}
});
