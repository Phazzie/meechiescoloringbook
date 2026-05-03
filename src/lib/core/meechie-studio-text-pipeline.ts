// Purpose: Centralize Meechie studio AI text endpoint orchestration.
// Why: Keep provider calls, JSON parsing, and contract validation testable.
// Info flow: Request body -> ProviderAdapterSeam -> structured studio text result.
import { env } from '$env/dynamic/private';
import { createProviderAdapter } from '$lib/adapters/provider-adapter.adapter';
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import {
	MeechieStudioTextInputSchema,
	MeechieStudioTextOutputSchema,
	MeechieStudioTextResultSchema
} from '../../../contracts/meechie-studio-text.contract';
import type { ProviderAdapterSeam } from '../../../contracts/provider-adapter.contract';
import { z } from 'zod';

const TEXT_MODEL = env.XAI_TEXT_MODEL || 'grok-4.1-fast-reasoning';

type MeechieStudioTextResult = z.infer<typeof MeechieStudioTextResultSchema>;

type PipelineResponse = {
	status: number;
	body: MeechieStudioTextResult;
};

export type MeechieStudioTextPipelineDeps = {
	createProvider: typeof createProviderAdapter;
};

const buildError = (status: number, code: string, message: string): PipelineResponse => ({
	status,
	body: {
		ok: false,
		error: {
			code,
			message
		}
	}
});

const findDisallowedKeywords = (input: unknown): string[] => {
	const text = JSON.stringify(input).toLowerCase();
	return SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS.filter((keyword) =>
		text.includes(keyword.toLowerCase())
	);
};

const actionInstruction = (actionId: string): string => {
	switch (actionId) {
		case 'regenerate':
			return 'Create a fresh alternate take. Do not copy the current wording.';
		case 'make_prettier':
			return 'Make the wording more polished, glamorous, and printable without weakening the verdict.';
		case 'make_meaner':
			return 'Make the wording sharper and more direct while avoiding threats, slurs, or dehumanizing language.';
		case 'make_more_specific':
			return 'Use more of the supplied evidence and avoid generic advice.';
		default:
			return 'Generate the first verdict, quote, and coloring-page text from the evidence.';
	}
};

const buildMessages = (input: z.infer<typeof MeechieStudioTextInputSchema>) => [
	{
		role: 'system' as const,
		content:
			'You write Meechie coloring-book text. Return exactly one JSON object and no prose. ' +
			'Required keys: verdict, quote, pageTitle, pageItems, rating, qualityState, revisionNote. ' +
			'pageItems must be 2 to 6 objects with number and label. qualityState is ready, needs_more_evidence, or blocked.'
	},
	{
		role: 'user' as const,
		content: JSON.stringify({
			action: input.actionId,
			instruction: actionInstruction(input.actionId),
			mode: { id: input.modeId, label: input.modeLabel },
			theme: input.themeLabel,
			evidence: input.evidence,
			dedication: input.dedication,
			voice: input.voice,
			currentText: input.currentText
		})
	}
];

const parseProviderText = (content: string, model: string): MeechieStudioTextResult => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		return {
			ok: false,
			error: {
				code: 'MEECHIE_STUDIO_TEXT_PROVIDER_INVALID',
				message: 'Provider text response did not match contract.'
			}
		};
	}

	const output = MeechieStudioTextOutputSchema.safeParse({
		...(parsed as Record<string, unknown>),
		modelMetadata: {
			provider: 'xai',
			model
		}
	});
	if (!output.success) {
		return {
			ok: false,
			error: {
				code: 'MEECHIE_STUDIO_TEXT_PROVIDER_INVALID',
				message: 'Provider text response did not match contract.'
			}
		};
	}
	return {
		ok: true,
		value: output.data
	};
};

export const runMeechieStudioTextPipeline = async (
	body: unknown,
	deps: MeechieStudioTextPipelineDeps
): Promise<PipelineResponse> => {
	const parsedInput = MeechieStudioTextInputSchema.safeParse(body);
	if (!parsedInput.success) {
		return buildError(400, 'MEECHIE_STUDIO_TEXT_INPUT_INVALID', 'Meechie studio text input is invalid.');
	}

	const disallowedKeywords = findDisallowedKeywords(parsedInput.data);
	if (disallowedKeywords.length > 0) {
		return buildError(400, 'DISALLOWED_CONTENT', 'Meechie studio text input contains disallowed content.');
	}

	const provider: ProviderAdapterSeam = deps.createProvider({});
	const providerResult = await provider.createChatCompletion({
		model: TEXT_MODEL,
		messages: buildMessages(parsedInput.data)
	});
	if (!providerResult.ok) {
		const missingKey = providerResult.error.code === 'PROVIDER_API_KEY_MISSING';
		return {
			status: missingKey ? 401 : 502,
			body: {
				ok: false,
				error: {
					...providerResult.error,
					message: missingKey
						? 'AI text generation requires XAI_API_KEY to be set on the server.'
						: providerResult.error.message
				}
			}
		};
	}

	const result = parseProviderText(providerResult.value.content, providerResult.value.model);
	const parsedResult = MeechieStudioTextResultSchema.safeParse(result);
	if (!parsedResult.success) {
		return buildError(500, 'MEECHIE_STUDIO_TEXT_OUTPUT_INVALID', 'Meechie studio text output did not match contract.');
	}

	return {
		status: result.ok ? 200 : 502,
		body: parsedResult.data
	};
};

export const meechieStudioTextPipelineDeps: MeechieStudioTextPipelineDeps = {
	createProvider: createProviderAdapter
};
