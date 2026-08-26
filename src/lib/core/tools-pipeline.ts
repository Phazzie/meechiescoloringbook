// Purpose: Centralize Meechie tools endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers transport-only while preserving safety and contract checks.
// Info flow: Raw request body -> input validation + safety checks -> quota charge -> tool adapter -> contract response.
import { meechieToolAdapter } from '$lib/adapters/meechie-tool-seam';
import { findDisallowedKeywords } from '$lib/core/constants';
import { toPublicProviderError } from '$lib/core/public-provider-error';
// Type-only: the gate itself is built by the route from its own RequestEvent, so core stays I/O free.
import type { QuotaGate } from '$lib/server/rate-limit-route';
import {
	MeechieToolInputSchema,
	MeechieToolResultSchema
} from '../../../contracts/meechie-tool.contract';
import { z } from 'zod';

type MeechieToolResult = z.infer<typeof MeechieToolResultSchema>;

type ToolsPipelineResponse = {
	status: number;
	body: MeechieToolResult;
	/** Quota headers from the gate, echoed verbatim. Absent until a charge has been made. */
	headers?: Record<string, string>;
};

type ToolsPipelineDeps = {
	respond: typeof meechieToolAdapter.respond;
	// Required, never optional: an optional gate is a production bypass that leaves the route unmetered.
	consumeQuota: QuotaGate;
};

/** Every Meechie tool answers through one provider chat completion, so every accepted request costs 1. */
const MEECHIE_TOOL_QUOTA_COST = 1;

const buildError = (
	status: number,
	code: string,
	message: string,
	details?: Record<string, string>
): ToolsPipelineResponse => ({
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

export const runToolsPipeline = async (
	body: unknown,
	deps: ToolsPipelineDeps
): Promise<ToolsPipelineResponse> => {
	const parsedInput = MeechieToolInputSchema.safeParse(body);
	if (!parsedInput.success) {
		return buildError(
			400,
			'MEECHIE_TOOL_INPUT_INVALID',
			'Meechie tool input is invalid.'
		);
	}

	const disallowedKeywords = findDisallowedKeywords(parsedInput.data);
	if (disallowedKeywords.length > 0) {
		return buildError(
			400,
			'DISALLOWED_CONTENT',
			'Meechie tool input contains disallowed content.',
			{
				keywords: disallowedKeywords.join(',')
			}
		);
	}

	// Last stop before billable work: input is well-formed and safe, so the caller pays from here on.
	// Anything rejected above costs nothing.
	const quota = await deps.consumeQuota(MEECHIE_TOOL_QUOTA_COST);
	if (!quota.ok) {
		// Status, body and headers verbatim from the gate. Recomputing Retry-After or
		// RateLimit-Reset here would drift from the store that issued them.
		return { status: quota.status, body: quota.body, headers: quota.headers };
	}
	const headers = quota.headers;

	const result = await deps.respond(parsedInput.data);
	const parsedResult = MeechieToolResultSchema.safeParse(result);
	if (!parsedResult.success) {
		return {
			...buildError(
				500,
				'MEECHIE_TOOL_OUTPUT_INVALID',
				'Meechie tool output did not match contract.'
			),
			headers
		};
	}
	if (!parsedResult.data.ok) {
		const publicError = toPublicProviderError(parsedResult.data.error, {
			code: 'MEECHIE_TOOL_FAILED',
			message: 'Meechie tool request failed.'
		});
		return {
			...buildError(502, publicError.code, publicError.message),
			headers
		};
	}

	return {
		status: 200,
		body: parsedResult.data,
		headers
	};
};

/**
 * Build the production dependencies around a gate the route owns. There is deliberately no
 * pre-built deps object: an unmetered one would be a ready-made bypass.
 */
export const createToolsPipelineDeps = (
	consumeQuota: QuotaGate
): ToolsPipelineDeps => ({
	respond: (input) => meechieToolAdapter.respond(input),
	consumeQuota
});
