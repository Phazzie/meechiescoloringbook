// Purpose: Centralize chat-interpretation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin and make chat/spec validation behavior easy to test in isolation.
// Info flow: Raw request body -> cancellation/schema checks -> quota charge -> provider completion -> JSON extraction + validation -> contract response.
import { providerAdapter } from '$lib/adapters/provider-adapter-seam';
import { specValidationAdapter } from '$lib/adapters/spec-validation-seam';
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import { TEXT_MODEL } from '$lib/core/models';
import { toPublicProviderError } from '$lib/core/public-provider-error';
// Type-only: erased at build time, so the deterministic core keeps no runtime edge into $lib/server.
import type { QuotaGate } from '$lib/server/rate-limit-route';
import {
	ChatInterpretationInputSchema,
	ChatInterpretationResultSchema
} from '$lib/seams/chat-interpretation-seam/contract';
import {
	ColoringPageSpecSchema,
	RawColoringPageSpecSchema
} from '../../../contracts/spec-validation.contract';
import { z } from 'zod';

const CHAT_MODEL = TEXT_MODEL;

/** One text-bucket unit per interpretation: this pipeline makes exactly one billable provider call. */
const CHAT_QUOTA_COST = 1;

type ChatInterpretationResult = z.infer<typeof ChatInterpretationResultSchema>;

type ChatPipelineResponse = {
	status: number;
	body: ChatInterpretationResult;
	/** Rate-limit headers from the guard, verbatim. Present on every post-charge response. */
	headers?: Record<string, string>;
};

/** The adapter-backed half of the deps, safe to preset at module scope. */
export type ChatPipelineAdapterDeps = {
	createChatCompletion: typeof providerAdapter.createChatCompletion;
	validateSpec: typeof specValidationAdapter.validate;
	signal?: AbortSignal;
};

export type ChatPipelineDeps = ChatPipelineAdapterDeps & {
	/**
	 * Required. Built per request from the route's own event so the charge lands on the real caller.
	 * Deliberately not optional: an optional gate is a production bypass waiting to happen.
	 */
	consumeQuota: QuotaGate;
};

const extractSingleJsonObject = (
	content: string
): Record<string, unknown> | null => {
	const trimmed = content.trim();
	if (!trimmed.startsWith('{')) {
		return null;
	}

	try {
		const parsed = JSON.parse(trimmed);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		return null;
	} catch {
		return null;
	}
};

const buildError = (
	status: number,
	code: string,
	message: string,
	details?: Record<string, string>
): ChatPipelineResponse => ({
	status,
	body: {
		ok: false,
		error: {
			code,
			message,
			...(details ? { details } : {})
		}
	}
});

export const runChatInterpretationPipeline = async (
	body: unknown,
	deps: ChatPipelineDeps
): Promise<ChatPipelineResponse> => {
	if (deps.signal?.aborted) {
		return buildError(
			499,
			'CHAT_ABORTED',
			'Chat interpretation request was canceled by the caller.'
		);
	}

	const parsedInput = ChatInterpretationInputSchema.safeParse(body);
	if (!parsedInput.success) {
		return buildError(
			400,
			'CHAT_INPUT_INVALID',
			'Chat interpretation input is invalid.'
		);
	}

	// Charge here and nowhere else: every local rejection above this line costs the caller nothing,
	// and nothing below it reaches the provider without a metered unit.
	const quota = await deps.consumeQuota(CHAT_QUOTA_COST);
	// Taken from the guard's decision as-is. Recomputing RateLimit-Reset from a route clock drifts
	// from the store that issued it.
	const quotaHeaders = quota.headers;
	if (!quota.ok) {
		return {
			status: quota.status,
			body: quota.body,
			headers: quotaHeaders
		};
	}

	// Every response from here on is post-charge, so it advertises the caller's remaining quota.
	const withQuotaHeaders = (
		response: ChatPipelineResponse
	): ChatPipelineResponse => ({ ...response, headers: quotaHeaders });

	const chatResult = await deps.createChatCompletion({
		model: CHAT_MODEL,
		messages: [
			{ role: 'system', content: SYSTEM_CONSTANTS.CHAT_SYSTEM_PROMPT },
			{ role: 'user', content: parsedInput.data.message }
		]
	});
	if (!chatResult.ok) {
		const publicError = toPublicProviderError(chatResult.error, {
			code: 'CHAT_PROVIDER_ERROR',
			message: 'Chat interpretation provider request failed.'
		});
		return withQuotaHeaders(
			buildError(502, publicError.code, publicError.message)
		);
	}

	const parsedSpec = extractSingleJsonObject(chatResult.value.content);
	if (!parsedSpec) {
		return withQuotaHeaders(
			buildError(
				502,
				'CHAT_RESPONSE_INVALID',
				'Chat response did not include JSON.'
			)
		);
	}

	const rawParse = RawColoringPageSpecSchema.safeParse(parsedSpec);
	if (!rawParse.success) {
		return withQuotaHeaders(
			buildError(
				502,
				'CHAT_SPEC_INVALID',
				'Chat response did not match the expected spec shape.'
			)
		);
	}

	const validation = await deps.validateSpec({ spec: rawParse.data });
	if (!validation.ok) {
		const firstIssue = validation.issues[0];
		return withQuotaHeaders(
			buildError(
				422,
				'CHAT_SPEC_INVALID',
				firstIssue ? firstIssue.message : 'Chat spec failed validation.',
				{ issueCount: String(validation.issues.length) }
			)
		);
	}

	const strictParse = ColoringPageSpecSchema.safeParse(rawParse.data);
	if (!strictParse.success) {
		return withQuotaHeaders(
			buildError(
				422,
				'CHAT_SPEC_INVALID',
				'Chat response did not satisfy the full spec constraints.'
			)
		);
	}

	const result: ChatInterpretationResult = {
		ok: true,
		value: {
			spec: strictParse.data
		}
	};
	const parsedResult = ChatInterpretationResultSchema.safeParse(result);
	if (!parsedResult.success) {
		return withQuotaHeaders(
			buildError(
				500,
				'CHAT_OUTPUT_INVALID',
				'Chat interpretation output did not match contract.'
			)
		);
	}

	return withQuotaHeaders({
		status: 200,
		body: parsedResult.data
	});
};

export const chatInterpretationPipelineDeps: ChatPipelineAdapterDeps = {
	createChatCompletion: (input) => providerAdapter.createChatCompletion(input),
	validateSpec: (input) => specValidationAdapter.validate(input)
};
