// Purpose: Centralize Meechie tools endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers transport-only while preserving safety and contract checks.
// Info flow: Raw request body -> input validation + safety checks -> tool adapter -> contract response.
import { meechieToolAdapter } from '$lib/adapters/meechie-tool-seam';
import { findDisallowedKeywords } from '$lib/core/constants';
import {
	MeechieToolInputSchema,
	MeechieToolResultSchema
} from '../../../contracts/meechie-tool.contract';
import { z } from 'zod';

type MeechieToolResult = z.infer<typeof MeechieToolResultSchema>;

type ToolsPipelineResponse = {
	status: number;
	body: MeechieToolResult;
};

type ToolsPipelineDeps = {
	respond: typeof meechieToolAdapter.respond;
	signal?: AbortSignal;
};

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

export type MeechieToolAbortCheck = { ok: true } | { ok: false; response: ToolsPipelineResponse };

// Exported so the route can short-circuit an already-aborted request before consuming
// rate-limit quota or triggering the paid AI provider call — see checkGenerateAbort in
// generate-pipeline.ts for why this must run ahead of body parsing.
export const checkMeechieToolAbort = (signal?: AbortSignal): MeechieToolAbortCheck => {
	if (signal?.aborted) {
		return {
			ok: false,
			response: buildError(
				499,
				'MEECHIE_TOOL_ABORTED',
				'Meechie tool request was canceled by the caller.'
			)
		};
	}
	return { ok: true };
};

export type MeechieToolInputShapeCheck =
	| { ok: true; data: z.infer<typeof MeechieToolInputSchema> }
	| { ok: false; response: ToolsPipelineResponse };

// Exported so the route can reject schema-invalid bodies before consuming rate-limit
// quota, without duplicating the MEECHIE_TOOL_INPUT_INVALID code/message in two places.
export const checkMeechieToolInputShape = (body: unknown): MeechieToolInputShapeCheck => {
	const parsedInput = MeechieToolInputSchema.safeParse(body);
	if (!parsedInput.success) {
		return {
			ok: false,
			response: buildError(400, 'MEECHIE_TOOL_INPUT_INVALID', 'Meechie tool input is invalid.')
		};
	}
	return { ok: true, data: parsedInput.data };
};

export type MeechieToolSafetyCheck =
	| { ok: true }
	| { ok: false; response: ToolsPipelineResponse };

// Exported so the route can reject disallowed-content bodies before consuming
// rate-limit quota, without duplicating the DISALLOWED_CONTENT code/message.
export const checkMeechieToolSafety = (
	data: z.infer<typeof MeechieToolInputSchema>
): MeechieToolSafetyCheck => {
	const disallowedKeywords = findDisallowedKeywords(data);
	if (disallowedKeywords.length > 0) {
		return {
			ok: false,
			response: buildError(
				400,
				'DISALLOWED_CONTENT',
				'Meechie tool input contains disallowed content.',
				{ keywords: disallowedKeywords.join(',') }
			)
		};
	}
	return { ok: true };
};

export const runToolsPipeline = async (
	body: unknown,
	deps: ToolsPipelineDeps
): Promise<ToolsPipelineResponse> => {
	const abortCheck = checkMeechieToolAbort(deps.signal);
	if (!abortCheck.ok) return abortCheck.response;

	const shapeCheck = checkMeechieToolInputShape(body);
	if (!shapeCheck.ok) return shapeCheck.response;
	const parsedInput = { data: shapeCheck.data };

	const safetyCheck = checkMeechieToolSafety(parsedInput.data);
	if (!safetyCheck.ok) return safetyCheck.response;

	const result = await deps.respond(parsedInput.data, deps.signal);
	const parsedResult = MeechieToolResultSchema.safeParse(result);
	if (!parsedResult.success) {
		return buildError(500, 'MEECHIE_TOOL_OUTPUT_INVALID', 'Meechie tool output did not match contract.');
	}

	return {
		status: 200,
		body: parsedResult.data
	};
};

export const toolsPipelineDeps: ToolsPipelineDeps = {
	respond: (input, signal) => meechieToolAdapter.respond(input, signal)
};
