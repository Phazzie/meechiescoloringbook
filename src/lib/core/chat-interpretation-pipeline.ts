// Purpose: Centralize chat-interpretation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin and make chat/spec validation behavior easy to test in isolation.
// Info flow: Raw request body -> provider completion -> JSON extraction + validation -> contract response.
import { providerAdapter } from '$lib/adapters/provider-adapter.adapter';
import { specValidationAdapter } from '$lib/adapters/spec-validation.adapter';
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import {
	ChatInterpretationInputSchema,
	ChatInterpretationResultSchema
} from '../../../contracts/chat-interpretation.contract';
import {
	ColoringPageSpecSchema,
	RawColoringPageSpecSchema
} from '../../../contracts/spec-validation.contract';
import { z } from 'zod';

const CHAT_MODEL = 'grok-4-1-fast-reasoning';

type ChatInterpretationResult = z.infer<typeof ChatInterpretationResultSchema>;

type ChatPipelineResponse = {
	status: number;
	body: ChatInterpretationResult;
};

type ChatPipelineDeps = {
	createChatCompletion: typeof providerAdapter.createChatCompletion;
	validateSpec: typeof specValidationAdapter.validate;
};

const extractJson = (content: string): string | null => {
	const start = content.indexOf('{');
	const end = content.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) {
		return null;
	}
	return content.slice(start, end + 1);
};

const buildError = (
	code: string,
	message: string,
	details?: Record<string, string>
): ChatPipelineResponse => ({
	status: 200,
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
		return buildError('CHAT_INPUT_INVALID', 'Chat interpretation input is invalid.');
	}

	const chatResult = await deps.createChatCompletion({
		model: CHAT_MODEL,
		messages: [
			{ role: 'system', content: SYSTEM_CONSTANTS.CHAT_SYSTEM_PROMPT },
			{ role: 'user', content: parsedInput.data.message }
		]
	});
	if (!chatResult.ok) {
		return {
			status: 200,
			body: {
				ok: false,
				error: chatResult.error
			}
		};
	}

	const extracted = extractJson(chatResult.value.content);
	if (!extracted) {
		return buildError('CHAT_RESPONSE_INVALID', 'Chat response did not include JSON.');
	}

	let parsedSpec: unknown = null;
	try {
		parsedSpec = JSON.parse(extracted);
	} catch {
		return buildError('CHAT_RESPONSE_INVALID', 'Chat response JSON could not be parsed.');
	}

	const rawParse = RawColoringPageSpecSchema.safeParse(parsedSpec);
	if (!rawParse.success) {
		return buildError('CHAT_SPEC_INVALID', 'Chat response did not match the expected spec shape.');
	}

	const validation = await deps.validateSpec({ spec: rawParse.data });
	if (!validation.ok) {
		const firstIssue = validation.issues[0];
		return buildError(
			'CHAT_SPEC_INVALID',
			firstIssue ? firstIssue.message : 'Chat spec failed validation.',
			{ issueCount: String(validation.issues.length) }
		);
	}

	const strictParse = ColoringPageSpecSchema.safeParse(rawParse.data);
	if (!strictParse.success) {
		return buildError(
			'CHAT_SPEC_INVALID',
			'Chat response did not satisfy the full spec constraints.'
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
		return buildError('CHAT_OUTPUT_INVALID', 'Chat interpretation output did not match contract.');
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
