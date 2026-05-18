// Purpose: Centralize chat-interpretation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin and make chat/spec validation behavior easy to test in isolation.
// Info flow: Raw request body -> provider completion -> JSON extraction + validation -> contract response.
import { providerAdapter } from '$lib/adapters/provider-adapter.adapter';
import { specValidationAdapter } from '$lib/adapters/spec-validation.adapter';
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
};

const extractSingleJsonObject = (content: string): string | null => {
	const trimmed = content.trim();
	if (!trimmed.startsWith('{')) {
		return null;
	}

	try {
		const parsed = JSON.parse(trimmed);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return trimmed;
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
	const parsedInput = ChatInterpretationInputSchema.safeParse(body);
	if (!parsedInput.success) {
		return buildError(400, 'CHAT_INPUT_INVALID', 'Chat interpretation input is invalid.');
	}

	const chatResult = await deps.createChatCompletion({
		model: CHAT_MODEL,
		messages: [
			{ role: 'system', content: SYSTEM_CONSTANTS.CHAT_SYSTEM_PROMPT },
			{ role: 'user', content: parsedInput.data.message }
		]
	});
	if (!chatResult.ok) {
		return buildError(502, chatResult.error.code, chatResult.error.message, chatResult.error.details);
	}

	const extracted = extractSingleJsonObject(chatResult.value.content);
	if (!extracted) {
		return buildError(502, 'CHAT_RESPONSE_INVALID', 'Chat response did not include JSON.');
	}

	let parsedSpec: unknown = null;
	try {
		parsedSpec = JSON.parse(extracted);
	} catch {
		return buildError(502, 'CHAT_RESPONSE_INVALID', 'Chat response JSON could not be parsed.');
	}

	const rawParse = RawColoringPageSpecSchema.safeParse(parsedSpec);
	if (!rawParse.success) {
		return buildError(502, 'CHAT_SPEC_INVALID', 'Chat response did not match the expected spec shape.');
	}

	const validation = await deps.validateSpec({ spec: rawParse.data });
	if (!validation.ok) {
		return buildError(
			422,
			'CHAT_SPEC_INVALID',
			validation.issues[0]?.message ?? 'Chat spec failed validation.',
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
