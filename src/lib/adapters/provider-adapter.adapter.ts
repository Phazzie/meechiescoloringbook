// Purpose: Adapter implementation for ProviderAdapterSeam.
// Why: Perform authenticated xAI chat/image requests behind a single boundary.
// Info flow: Provider input -> xAI HTTP -> normalized output.
import type {
	ProviderAdapterSeam,
	ProviderChatInput,
	ProviderChatOutput,
	ProviderImageInput,
	ProviderImageOutput
} from '../../../contracts/provider-adapter.contract';
import type { Result, SeamError } from '../../../contracts/shared.contract';
import { env } from '$env/dynamic/private';

const DEFAULT_BASE_URL = 'https://api.x.ai';
const CHAT_PATH = '/v1/chat/completions';
const IMAGE_PATH = '/v1/images/generations';

const normalizeBaseUrl = (baseUrl: string): string => {
	const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
	return trimmed.endsWith('/v1') ? trimmed.slice(0, -3) : trimmed;
};

const getApiKey = (): string | null => {
	const key = env.XAI_API_KEY;
	return key && key.length > 0 ? key : null;
};

const buildError = (code: string, message: string, details?: Record<string, string>): SeamError => ({
	code,
	message,
	details
});

const readJson = async (response: Response): Promise<unknown | null> => {
	const text = await response.text();
	if (!text) {
		return null;
	}
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
};

const buildHttpError = (response: Response, payload: unknown): Result<never> => {
	const rawMessage =
		typeof (payload as { error?: { message?: string } })?.error?.message === 'string'
			? (payload as { error?: { message?: string } })?.error?.message
			: typeof (payload as { message?: string })?.message === 'string'
				? (payload as { message?: string })?.message
				: response.statusText;
	const message = rawMessage && rawMessage.length > 0
		? rawMessage
		: `Request failed with status ${response.status}`;
	return {
		ok: false,
		error: buildError('PROVIDER_HTTP_ERROR', message, {
			status: String(response.status)
		})
	};
};

const normalizeChatOutput = (
	payload: unknown,
	fallbackModel: string
): Result<ProviderChatOutput> => {
	const data = payload as {
		model?: string;
		choices?: Array<{ message?: { content?: string }; text?: string }>;
	};
	const content =
		data?.choices?.[0]?.message?.content ||
		data?.choices?.[0]?.text ||
		'';
	if (!content || content.trim().length === 0) {
		return {
			ok: false,
			error: buildError('PROVIDER_EMPTY_CHAT', 'Provider returned empty chat content.')
		};
	}
	return {
		ok: true,
		value: {
			model: data?.model ?? fallbackModel,
			content: content.trim()
		}
	};
};

const normalizeImageOutput = (payload: unknown): Result<ProviderImageOutput> => {
	const data = payload as {
		data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
		revised_prompt?: string;
		revisedPrompt?: string;
	};
	const images = Array.isArray(data?.data)
		? data.data
				.map((entry) => ({
					url: typeof entry.url === 'string' ? entry.url : undefined,
					b64_json: typeof entry.b64_json === 'string' ? entry.b64_json : undefined
				}))
				.filter((entry) => entry.url || entry.b64_json)
		: [];
	if (images.length === 0) {
		return {
			ok: false,
			error: buildError('PROVIDER_EMPTY_IMAGE', 'Provider returned no images.')
		};
	}
	const revisedPrompt =
		typeof data?.revised_prompt === 'string'
			? data.revised_prompt
			: typeof data?.revisedPrompt === 'string'
				? data.revisedPrompt
				: data?.data?.find((entry) => typeof entry.revised_prompt === 'string')?.revised_prompt;
	return {
		ok: true,
		value: {
			images,
			revisedPrompt
		}
	};
};

export const providerAdapter: ProviderAdapterSeam = {
	createChatCompletion: async (input: ProviderChatInput): Promise<Result<ProviderChatOutput>> => {
		const apiKey = getApiKey();
		if (!apiKey) {
			return {
				ok: false,
				error: buildError('PROVIDER_API_KEY_MISSING', 'XAI_API_KEY is required.')
			};
		}
		const baseUrl = normalizeBaseUrl(env.XAI_BASE_URL || DEFAULT_BASE_URL);
		try {
			const response = await fetch(`${baseUrl}${CHAT_PATH}`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model: input.model,
					messages: input.messages
				})
			});
			const payload = await readJson(response);
			if (!response.ok) {
				return buildHttpError(response, payload);
			}
			return normalizeChatOutput(payload, input.model);
		} catch (error) {
			return {
				ok: false,
				error: buildError(
					'PROVIDER_NETWORK_ERROR',
					error instanceof Error ? error.message : 'Provider request failed.'
				)
			};
		}
	},
	createImageGeneration: async (input: ProviderImageInput): Promise<Result<ProviderImageOutput>> => {
		const apiKey = getApiKey();
		if (!apiKey) {
			return {
				ok: false,
				error: buildError('PROVIDER_API_KEY_MISSING', 'XAI_API_KEY is required.')
			};
		}
		const baseUrl = normalizeBaseUrl(env.XAI_BASE_URL || DEFAULT_BASE_URL);
		try {
			const response = await fetch(`${baseUrl}${IMAGE_PATH}`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model: input.model,
					prompt: input.prompt,
					n: input.n,
					response_format: input.responseFormat
				})
			});
			const payload = await readJson(response);
			if (!response.ok) {
				return buildHttpError(response, payload);
			}
			return normalizeImageOutput(payload);
		} catch (error) {
			return {
				ok: false,
				error: buildError(
					'PROVIDER_NETWORK_ERROR',
					error instanceof Error ? error.message : 'Provider request failed.'
				)
			};
		}
	}
};
