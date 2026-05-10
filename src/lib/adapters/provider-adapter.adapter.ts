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
import { z } from 'zod';

// Raw xAI API response shapes — validated at the seam boundary before normalization.
// These are intentionally permissive (.passthrough(), optional fields) because
// we only care about extracting the fields we use; extras are irrelevant.
const XAIChatChoiceSchema = z
	.object({
		message: z.object({ content: z.string().nullish() }).passthrough().nullish(),
		text: z.string().nullish()
	})
	.passthrough();

export const XAIChatResponseSchema = z
	.object({
		model: z.string().nullish(),
		// nullable so { choices: null } maps to PROVIDER_EMPTY_CHAT rather than PROVIDER_INVALID_RESPONSE
		choices: z.array(XAIChatChoiceSchema).nullable().optional()
	})
	.passthrough();

const XAIImageEntrySchema = z
	.object({
		url: z.string().nullish(),
		b64_json: z.string().nullish(),
		revised_prompt: z.string().nullish()
	})
	.passthrough();

export const XAIImageResponseSchema = z
	.object({
		// nullable so { data: null } maps to PROVIDER_EMPTY_IMAGE rather than PROVIDER_INVALID_RESPONSE
		data: z.array(XAIImageEntrySchema).nullable().optional(),
		revised_prompt: z.string().nullish(),
		revisedPrompt: z.string().nullish()
	})
	.passthrough();

export type ProviderAdapterConfig = {
	apiKey?: string | null;
	baseUrl?: string | null;
};

const DEFAULT_BASE_URL = 'https://api.x.ai';
const CHAT_PATH = '/v1/chat/completions';
const IMAGE_PATH = '/v1/images/generations';

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
	const parsed = XAIChatResponseSchema.safeParse(payload);
	if (!parsed.success) {
		return {
			ok: false,
			error: buildError(
				'PROVIDER_INVALID_RESPONSE',
				'Provider chat response did not match expected shape.'
			)
		};
	}
	const data = parsed.data;
	const choice = data.choices?.[0];
	const messageContent = choice?.message?.content;
	const legacyText = choice?.text;
	const content =
		typeof messageContent === 'string' && messageContent.trim().length > 0
			? messageContent
			: typeof legacyText === 'string' && legacyText.trim().length > 0
				? legacyText
				: '';
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
			model: typeof data.model === 'string' && data.model.trim().length > 0 ? data.model : fallbackModel,
			content: content.trim()
		}
	};
};

const normalizeImageOutput = (
	payload: unknown
): Result<ProviderImageOutput> => {
	const parsed = XAIImageResponseSchema.safeParse(payload);
	if (!parsed.success) {
		return {
			ok: false,
			error: buildError(
				'PROVIDER_INVALID_RESPONSE',
				'Provider image response did not match expected shape.'
			)
		};
	}
	const data = parsed.data;
	const images = (data.data ?? [])
		.map((entry) => ({
			url: typeof entry.url === 'string' ? entry.url : undefined,
			b64_json: typeof entry.b64_json === 'string' ? entry.b64_json : undefined
		}))
		.filter((entry) => entry.url || entry.b64_json);
	if (images.length === 0) {
		return {
			ok: false,
			error: buildError('PROVIDER_EMPTY_IMAGE', 'Provider returned no images.')
		};
	}
	const rawRevisedPrompt =
		data.revised_prompt ??
		data.revisedPrompt ??
		data.data?.find((entry) => typeof entry.revised_prompt === 'string')?.revised_prompt;

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
			const response = await fetch(`${baseUrl}${CHAT_PATH}`, {
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
});

export const providerAdapter = createProviderAdapter();
