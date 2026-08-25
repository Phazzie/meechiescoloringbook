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
import { fetchWithTimeout, fetchWithRetry, isAbortError, isTimeoutError } from '$lib/core/http-resilience';

export type ProviderAdapterConfig = {
	apiKey?: string | null;
	baseUrl?: string | null;
};

const DEFAULT_BASE_URL = 'https://api.x.ai';
const CHAT_PATH = '/v1/chat/completions';
const IMAGE_PATH = '/v1/images/generations';
// A real grok-4.6 studio generation completed near the former 60s boundary. A timeout retry
// discarded that work and could push the total request beyond the browser budget, so the
// server budget allows a slow first attempt to finish. Browser budgets remain higher.
const CHAT_TIMEOUT_MS = 110_000;
const IMAGE_TIMEOUT_MS = 120_000;
const RETRY_OPTIONS = { maxAttempts: 3, baseDelayMs: 1_000 } as const;

const normalizeBaseUrl = (baseUrl: string): string => {
	const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
	return trimmed.endsWith('/v1') ? trimmed.slice(0, -3) : trimmed;
};

const getApiKey = (config: ProviderAdapterConfig): string | null => {
	const key = config.apiKey || env.XAI_API_KEY;
	return key && key.length > 0 ? key : null;
};

const getBaseUrl = (config: ProviderAdapterConfig): string =>
	normalizeBaseUrl(config.baseUrl || env.XAI_BASE_URL || DEFAULT_BASE_URL);

const buildError = (
	code: string,
	message: string,
	details?: Record<string, string>
): SeamError => ({
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

// Providers disagree on error shape. xAI returns a bare string under `error`, while the
// OpenAI-compatible shape nests `error.message`. Reading only the nested form silently
// discarded xAI's actual text and surfaced a bare "Bad Request" instead — which is why the
// retired-model outage (grok-4-1-fast-reasoning) was invisible until the model id was
// checked by hand. Every known shape is read, in most-specific-first order.
const readProviderMessage = (payload: unknown): string | undefined => {
	const body = payload as {
		error?: { message?: unknown } | string;
		message?: unknown;
		detail?: unknown;
	} | null;
	if (!body) return undefined;
	const candidates: unknown[] = [
		typeof body.error === 'object' && body.error !== null ? body.error.message : undefined,
		typeof body.error === 'string' ? body.error : undefined,
		body.message,
		body.detail
	];
	for (const candidate of candidates) {
		if (typeof candidate === 'string' && candidate.trim().length > 0) {
			return candidate.trim();
		}
	}
	return undefined;
};

const buildHttpError = (
	response: Response,
	payload: unknown
): Result<never> => {
	const rawMessage = readProviderMessage(payload) ?? response.statusText;
	const message =
		rawMessage && rawMessage.length > 0
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
		data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
	if (!content || content.trim().length === 0) {
		return {
			ok: false,
			error: buildError(
				'PROVIDER_EMPTY_CHAT',
				'Provider returned empty chat content.'
			)
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

const normalizeImageOutput = (
	payload: unknown
): Result<ProviderImageOutput> => {
	const data = payload as {
		data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
		revised_prompt?: string;
		revisedPrompt?: string;
	};
	const images = Array.isArray(data?.data)
		? data.data
				.map((entry) => ({
					url: typeof entry.url === 'string' ? entry.url : undefined,
					b64_json:
						typeof entry.b64_json === 'string' ? entry.b64_json : undefined
				}))
				.filter((entry) => entry.url || entry.b64_json)
		: [];
	if (images.length === 0) {
		return {
			ok: false,
			error: buildError('PROVIDER_EMPTY_IMAGE', 'Provider returned no images.')
		};
	}
	const rawRevisedPrompt =
		typeof data?.revised_prompt === 'string'
			? data.revised_prompt
			: typeof data?.revisedPrompt === 'string'
				? data.revisedPrompt
				: data?.data?.find((entry) => typeof entry.revised_prompt === 'string')
						?.revised_prompt;
	const revisedPrompt =
		typeof rawRevisedPrompt === 'string' && rawRevisedPrompt.trim().length > 0
			? rawRevisedPrompt
			: undefined;
	return {
		ok: true,
		value: {
			images,
			revisedPrompt
		}
	};
};

export const createProviderAdapter = (
	config: ProviderAdapterConfig = {}
): ProviderAdapterSeam => ({
	createChatCompletion: async (
		input: ProviderChatInput
	): Promise<Result<ProviderChatOutput>> => {
		const apiKey = getApiKey(config);
		if (!apiKey) {
			return {
				ok: false,
				error: buildError(
					'PROVIDER_API_KEY_MISSING',
					'XAI_API_KEY is required.'
				)
			};
		}
		const baseUrl = getBaseUrl(config);
		try {
			const url = `${baseUrl}${CHAT_PATH}`;
			const requestInit: RequestInit = {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model: input.model,
					messages: input.messages,
					...(input.responseFormat
						? { response_format: input.responseFormat }
						: {})
				})
			};
			const response = await fetchWithRetry(
				() => fetchWithTimeout(url, requestInit, CHAT_TIMEOUT_MS),
				RETRY_OPTIONS
			);
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
					isAbortError(error) || isTimeoutError(error)
						? 'Chat completion request timed out.'
						: error instanceof Error ? error.message : 'Provider request failed.'
				)
			};
		}
	},
	createImageGeneration: async (
		input: ProviderImageInput
	): Promise<Result<ProviderImageOutput>> => {
		const apiKey = getApiKey(config);
		if (!apiKey) {
			return {
				ok: false,
				error: buildError(
					'PROVIDER_API_KEY_MISSING',
					'XAI_API_KEY is required.'
				)
			};
		}
		const baseUrl = getBaseUrl(config);
		try {
			const url = `${baseUrl}${IMAGE_PATH}`;
			const requestInit: RequestInit = {
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
			};
			const response = await fetchWithTimeout(url, requestInit, IMAGE_TIMEOUT_MS);
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
					isAbortError(error) || isTimeoutError(error)
						? 'Image generation request timed out.'
						: error instanceof Error ? error.message : 'Provider request failed.'
				)
			};
		}
	}
});

export const providerAdapter = createProviderAdapter();
