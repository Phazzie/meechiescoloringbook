// Purpose: Centralize chat-interpretation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin and make chat/spec validation behavior easy to test in isolation.
// Info flow: Raw request body -> provider completion -> JSON extraction + validation -> contract response.
import { providerAdapter } from '$lib/adapters/provider-adapter.adapter';
import { specValidationAdapter } from '$lib/adapters/spec-validation-seam';
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import { selectTextModel } from '$lib/core/text-model';
import { env } from '$env/dynamic/private';
import {
	ChatInterpretationInputSchema,
	ChatInterpretationResultSchema
} from '../../../contracts/chat-interpretation.contract';
import {
	ColoringPageSpecSchema,
	RawColoringPageSpecSchema
} from '../../../contracts/spec-validation.contract';
import { z } from 'zod';

const CHAT_MODEL = selectTextModel(env.XAI_TEXT_MODEL);

type ChatInterpretationResult = z.infer<typeof ChatInterpretationResultSchema>;

type ChatPipelineResponse = {
	status: number;
	body: ChatInterpretationResult;
};

type ChatPipelineDeps = {
	createChatCompletion: typeof providerAdapter.createChatCompletion;
	validateSpec: typeof specValidationAdapter.validate;
	signal?: AbortSignal;
};

const extractSingleJsonObject = (content: string): Record<string, unknown> | null => {
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

export type ChatInterpretationAbortCheck =
	| { ok: true }
	| { ok: false; response: ChatPipelineResponse };

// Exported so the route can short-circuit an already-aborted request before
// consuming rate-limit quota — see checkGenerateAbort in generate-pipeline.ts
// for why an internal-only check is no longer sufficient once routes preflight
// + rate-limit ahead of the pipeline call.
export const checkChatInterpretationAbort = (signal?: AbortSignal): ChatInterpretationAbortCheck => {
	if (signal?.aborted) {
		return {
			ok: false,
			response: buildError(499, 'CHAT_ABORTED', 'Chat interpretation request was canceled by the caller.')
		};
	}
	return { ok: true };
};

export type ChatInterpretationConfigCheck =
	| { ok: true }
	| { ok: false; response: ChatPipelineResponse };

// Exported so the route can reject a missing XAI_API_KEY before consuming rate-limit
// quota. Takes the raw key value rather than a config seam: both AppConfigSeam (requires
// every app-wide field) and ImageProviderConfigSeam (its other 3 fields are only
// defaulted for undefined, not for an explicitly-empty-string env value) can still throw
// for reasons unrelated to XAI_API_KEY itself, which would falsely 503 a working chat
// deployment. Checking the key directly has no such coupling.
export const checkChatInterpretationProviderConfig = (
	apiKey: string | undefined
): ChatInterpretationConfigCheck => {
	if (!apiKey) {
		return {
			ok: false,
			response: buildError(503, 'CHAT_CONFIG_ERROR', 'XAI_API_KEY is not configured. Chat interpretation requires an xAI API key.')
		};
	}
	return { ok: true };
};

export type ChatInterpretationInputShapeCheck =
	| { ok: true; data: z.infer<typeof ChatInterpretationInputSchema> }
	| { ok: false; response: ChatPipelineResponse };

// Exported so the route can reject schema-invalid bodies before consuming rate-limit
// quota, without duplicating the CHAT_INPUT_INVALID code/message in two places.
export const checkChatInterpretationInputShape = (
	body: unknown
): ChatInterpretationInputShapeCheck => {
	const parsedInput = ChatInterpretationInputSchema.safeParse(body);
	if (!parsedInput.success) {
		return {
			ok: false,
			response: buildError(400, 'CHAT_INPUT_INVALID', 'Chat interpretation input is invalid.')
		};
	}
	return { ok: true, data: parsedInput.data };
};

export const runChatInterpretationPipeline = async (
	body: unknown,
	deps: ChatPipelineDeps
): Promise<ChatPipelineResponse> => {
	const abortCheck = checkChatInterpretationAbort(deps.signal);
	if (!abortCheck.ok) return abortCheck.response;

	const shapeCheck = checkChatInterpretationInputShape(body);
	if (!shapeCheck.ok) return shapeCheck.response;
	const parsedInput = { data: shapeCheck.data };

	const chatResult = await deps.createChatCompletion({
		model: CHAT_MODEL,
		messages: [
			{ role: 'system', content: SYSTEM_CONSTANTS.CHAT_SYSTEM_PROMPT },
			{ role: 'user', content: parsedInput.data.message }
		],
		signal: deps.signal
	});
	if (!chatResult.ok) {
		return buildError(502, chatResult.error.code, chatResult.error.message, chatResult.error.details);
	}

	const parsedSpec = extractSingleJsonObject(chatResult.value.content);
	if (!parsedSpec) {
		return buildError(502, 'CHAT_RESPONSE_INVALID', 'Chat response did not include JSON.');
	}

	const rawParse = RawColoringPageSpecSchema.safeParse(parsedSpec);
	if (!rawParse.success) {
		return buildError(502, 'CHAT_SPEC_INVALID', 'Chat response did not match the expected spec shape.');
	}

	const validation = await deps.validateSpec({ spec: rawParse.data });
	if (!validation.ok) {
		const firstIssue = validation.issues[0];
		return buildError(
			422,
			'CHAT_SPEC_INVALID',
			firstIssue ? firstIssue.message : 'Chat spec failed validation.',
			{ issueCount: String(validation.issues.length) }
		);
	}

	const strictParse = ColoringPageSpecSchema.safeParse(rawParse.data);
	if (!strictParse.success) {
		return buildError(422, 'CHAT_SPEC_INVALID', 'Chat response did not satisfy the full spec constraints.');
	}

	const result: ChatInterpretationResult = {
		ok: true,
		value: {
			spec: strictParse.data
		}
	};
	const parsedResult = ChatInterpretationResultSchema.safeParse(result);
	if (!parsedResult.success) {
		return buildError(500, 'CHAT_OUTPUT_INVALID', 'Chat interpretation output did not match contract.');
	}

	return {
		status: 200,
		body: parsedResult.data
	};
};

export const chatInterpretationPipelineDeps: ChatPipelineDeps = {
	createChatCompletion: (input) => providerAdapter.createChatCompletion(input),
	validateSpec: (input) => specValidationAdapter.validate(input)
};
