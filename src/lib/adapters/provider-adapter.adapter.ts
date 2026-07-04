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
import {
	fetchWithTimeout,
	fetchWithRetry,
	isAbortError,
	isTimeoutError,
	isCircuitOpenError,
	createCircuitBreaker,
	RETRYABLE_STATUSES
} from '$lib/core/http-resilience';

export type ProviderAdapterConfig = {
	apiKey?: string | null;
	baseUrl?: string | null;
};

const DEFAULT_BASE_URL = 'https://api.x.ai';
const CHAT_PATH = '/v1/chat/completions';
const IMAGE_PATH = '/v1/images/generations';
const CHAT_TIMEOUT_MS = 60_000;
const IMAGE_TIMEOUT_MS = 120_000;
const RETRY_OPTIONS = { maxAttempts: 3, baseDelayMs: 1_000 } as const;
// After 3 consecutive provider failures, fail fast for 30s instead of spending up to
// maxAttempts * timeout on a request the provider is very unlikely to fulfill.
const CIRCUIT_BREAKER_OPTIONS = { failureThreshold: 3, cooldownMs: 30_000 } as const;
const CIRCUIT_OPEN_MESSAGE =
	'Provider is temporarily unavailable after repeated errors; failing fast.';

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

const buildHttpError = (
	response: Response,
	payload: unknown
): Result<never> => {
	const rawMessage =
		typeof (payload as { error?: { message?: string } })?.error?.message ===
		'string'
			? (payload as { error?: { message?: string } })?.error?.message
			: typeof (payload as { message?: string })?.message === 'string'
				? (payload as { message?: string })?.message
				: response.statusText;
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
): ProviderAdapterSeam => {
	// Shared across chat and image calls: both hit the same provider, so a string of
	// failures on one is meaningful evidence the other will fail too.
	const breaker = createCircuitBreaker(CIRCUIT_BREAKER_OPTIONS);

	return {
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
					}),
					signal: input.signal
				};
				const response = await fetchWithRetry(
					() => fetchWithTimeout(url, requestInit, CHAT_TIMEOUT_MS),
					{ ...RETRY_OPTIONS, breaker, signal: input.signal, deferSuccessOnOk: true }
				);
				// Success for an `ok` response is deferred (see deferSuccessOnOk) until the body is
				// actually read: a stalled or dropped body after 2xx headers is a real availability
				// problem the breaker needs to see, not a free pass recorded before we know the read
				// will complete.
				let payload: unknown;
				try {
					payload = await readJson(response);
				} catch (error) {
					if (response.ok && !isAbortError(error)) {
						breaker.recordFailure();
					}
					throw error;
				}
				if (response.ok) {
					breaker.recordSuccess();
				} else {
					return buildHttpError(response, payload);
				}
				return normalizeChatOutput(payload, input.model);
			} catch (error) {
				if (isCircuitOpenError(error)) {
					return {
						ok: false,
						error: buildError('PROVIDER_CIRCUIT_OPEN', CIRCUIT_OPEN_MESSAGE)
					};
				}
				if (isAbortError(error)) {
					return {
						ok: false,
						error: buildError('PROVIDER_ABORTED', 'Chat completion request was aborted.')
					};
				}
				if (isTimeoutError(error)) {
					return {
						ok: false,
						error: buildError('PROVIDER_TIMEOUT', 'Chat completion request timed out.')
					};
				}
				return {
					ok: false,
					error: buildError(
						'PROVIDER_NETWORK_ERROR',
						error instanceof Error ? error.message : 'Provider request failed.'
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
			if (breaker.isOpen()) {
				return {
					ok: false,
					error: buildError('PROVIDER_CIRCUIT_OPEN', CIRCUIT_OPEN_MESSAGE)
				};
			}
			const baseUrl = getBaseUrl(config);
			// Tracks whether the breaker was already updated from the HTTP response status, so the
			// catch block below only records a failure for a genuine transport/timeout error — not
			// for an exception thrown while parsing or normalizing an already-received response.
			let breakerRecorded = false;
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
				if (RETRYABLE_STATUSES.has(response.status)) {
					breaker.recordFailure();
				} else {
					breaker.recordSuccess();
				}
				breakerRecorded = true;
				const payload = await readJson(response);
				if (!response.ok) {
					return buildHttpError(response, payload);
				}
				return normalizeImageOutput(payload);
			} catch (error) {
				if (!breakerRecorded && !isAbortError(error)) {
					breaker.recordFailure();
				}
				if (isAbortError(error)) {
					return {
						ok: false,
						error: buildError('PROVIDER_ABORTED', 'Image generation request was aborted.')
					};
				}
				if (isTimeoutError(error)) {
					return {
						ok: false,
						error: buildError('PROVIDER_TIMEOUT', 'Image generation request timed out.')
					};
				}
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
};

export const providerAdapter = createProviderAdapter();
