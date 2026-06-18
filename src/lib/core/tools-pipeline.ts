// Purpose: Centralize Meechie tools endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers transport-only while preserving safety and contract checks.
// Info flow: Raw request body -> input validation + safety checks -> tool adapter -> contract response.
import { meechieToolAdapter } from '$lib/adapters/meechie-tool-seam';
import { findDisallowedKeywords } from '$lib/core/constants';
import { buildPipelineError as buildError } from './pipeline-error';
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
};

export const runToolsPipeline = async (
	body: unknown,
	deps: ToolsPipelineDeps
): Promise<ToolsPipelineResponse> => {
	const parsedInput = MeechieToolInputSchema.safeParse(body);
	if (!parsedInput.success) {
		return buildError(400, 'MEECHIE_TOOL_INPUT_INVALID', 'Meechie tool input is invalid.');
	}

	const disallowedKeywords = findDisallowedKeywords(parsedInput.data);
	if (disallowedKeywords.length > 0) {
		return buildError(400, 'DISALLOWED_CONTENT', 'Meechie tool input contains disallowed content.', {
			keywords: disallowedKeywords.join(',')
		});
	}

	const result = await deps.respond(parsedInput.data);
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
	respond: (input) => meechieToolAdapter.respond(input)
};
