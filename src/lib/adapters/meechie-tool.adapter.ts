// Purpose: AI-backed adapter for MeechieToolSeam.
// Why: Replace deterministic keyword matching and templates with genuine Meechie responses.
// Info flow: Tool input -> voice pack -> system prompt -> AI provider -> structured output.
import type {
	MeechieToolInput,
	MeechieToolOutput,
	MeechieToolSeam
} from '../../../contracts/meechie-tool.contract';
import type { Result } from '../../../contracts/shared.contract';
import { createProviderAdapter } from './provider-adapter.adapter';
import { meechieVoiceAdapter } from './meechie-voice.adapter';
import { selectTextModel } from '$lib/core/text-model';
import { env } from '$env/dynamic/private';
import { formatOrdinal } from '$lib/core/ordinal';
import { buildMeechieSystemPrompt } from '$lib/core/meechie-system-prompt';

const TEXT_MODEL = selectTextModel(env.XAI_TEXT_MODEL);

const STANDARD_RESPONSE_FORMAT = {
	type: 'json_schema',
	json_schema: {
		name: 'meechie_tool_response',
		strict: true,
		schema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				headline: { type: 'string' },
				response: { type: 'string' }
			},
			required: ['headline', 'response']
		}
	}
};

const RATE_EXCUSE_RESPONSE_FORMAT = {
	type: 'json_schema',
	json_schema: {
		name: 'meechie_rate_excuse_response',
		strict: true,
		schema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				headline: { type: 'string' },
				response: { type: 'string' },
				rating: { type: 'integer', minimum: 1, maximum: 10 }
			},
			required: ['headline', 'response', 'rating']
		}
	}
};

type UserMessage = {
	content: string;
	responseFormat: Record<string, unknown>;
};

const buildUserMessage = (input: MeechieToolInput): UserMessage => {
	switch (input.toolId) {
		case 'red_flag_or_run':
			return {
				content: [
					'Tool: Red Flag or Run',
					`Situation: ${input.situation}`,
					'',
					'Give a verdict. Is this RUN or RED FLAG?',
					'headline: the verdict — 2 to 4 words (e.g. "Run." or "Red Flag.")',
					'response: 1 to 3 sentences. Name the fault, state the consequence, call the access decision. Use "Fault:" and "Consequence:" as prefixes.'
				].join('\n'),
				responseFormat: STANDARD_RESPONSE_FORMAT
			};

		case 'wwmd':
			return {
				content: [
					'Tool: What Would Meechie Do',
					`Dilemma: ${input.dilemma}`,
					'',
					'What would Meechie do?',
					'headline: 2 to 4 words (e.g. "Meechie Move")',
					'response: 1 to 3 sentences. Use "Fault:" "Consequence:" "Move:" as prefixes. The Move must be specific, not generic.'
				].join('\n'),
				responseFormat: STANDARD_RESPONSE_FORMAT
			};

		case 'apology_translator':
			return {
				content: [
					'Tool: Apology Translator',
					`Apology: ${input.apology}`,
					'',
					'Translate what this apology actually means in plain Meechie.',
					'headline: 3 to 5 words (e.g. "What That Really Meant")',
					'response: Start with "Translation:" and give 1 sentence of what they were really doing. Then "Meechie logic:" and 1 sentence on what an actual apology requires from them specifically.'
				].join('\n'),
				responseFormat: STANDARD_RESPONSE_FORMAT
			};

		case 'rate_excuse':
			return {
				content: [
					'Tool: Rate This Excuse',
					`Excuse: ${input.excuse}`,
					'',
					'Rate this excuse 1 to 10. 1 means insulting everyone in the room. 10 means barely credible.',
					'headline: the score as "N/10"',
					'response: 1 to 2 sentences of Meechie commentary. Be specific to this exact excuse — what detail gives it away, what contradicts it, what it cost the person saying it.',
					'rating: integer from 1 to 10'
				].join('\n'),
				responseFormat: RATE_EXCUSE_RESPONSE_FORMAT
			};

		case 'caption_this':
			return {
				content: [
					'Tool: Caption This',
					`Moment: ${input.moment}`,
					'',
					'Write a Meechie caption for this moment.',
					'headline: 2 to 4 words (e.g. "Caption Locked")',
					'response: One sentence. Specific to this moment. Glamorous and a little dangerous. Not generic.'
				].join('\n'),
				responseFormat: STANDARD_RESPONSE_FORMAT
			};

		case 'clapback':
			return {
				content: [
					'Tool: Clapback',
					`Comment or criticism: ${input.comment}`,
					'',
					'Write a Meechie clapback to this.',
					'headline: 2 to 4 words (e.g. "Return Fire")',
					'response: One sentence. Surgical. Reference something specific about the comment — the cheap seats they are watching from, the audacity of the choice, or what this person just lost access to.'
				].join('\n'),
				responseFormat: STANDARD_RESPONSE_FORMAT
			};

		case 'receipts':
			return {
				content: [
					'Tool: Receipts',
					`What was claimed: ${input.claim}`,
					`What actually happened: ${input.reality}`,
					'',
					'Present the receipts.',
					'headline: 2 to 4 words (e.g. "Paper Trail")',
					'response: 1 to 2 sentences. Name the contradiction directly and specifically. State the consequence for the record.'
				].join('\n'),
				responseFormat: STANDARD_RESPONSE_FORMAT
			};

		case 'meechie_explains':
			return {
				content: [
					'Tool: Meechie Explains',
					`Term: ${input.term}`,
					'',
					'Explain this term in Meechie voice.',
					'headline: 2 to 4 words (e.g. "Street Glossary")',
					'response: One sentence definition. References contracts, access tiers, premium pricing, or specific social consequences. Not generic empowerment language.'
				].join('\n'),
				responseFormat: STANDARD_RESPONSE_FORMAT
			};

		case 'random_meechie':
			return {
				content: [
					'Tool: Random Meechie',
					'Generate a fresh Meechie line. Do not copy canon lines verbatim.',
					'Match the energy: specific, glam, dangerous, and calm.',
					'It should feel like it belongs in the canon — a holiday, a family member, a consequence, a specific thing they did wrong.',
					'headline: "Random Meechie"',
					'response: One to two sentences. Make it quotable.'
				].join('\n'),
				responseFormat: STANDARD_RESPONSE_FORMAT
			};

		case 'lineup': {
			const itemList = input.items
				.map((item, i) => `${formatOrdinal(i + 1)}: ${item}`)
				.join('\n');
			return {
				content: [
					'Tool: Lineup',
					`Prompt: ${input.prompt}`,
					`Items:\n${itemList}`,
					'',
					'Rank these items from best to worst in Meechie voice.',
					'headline: 2 to 4 words (e.g. "Ranked and Ruled")',
					'response: A numbered list. Each line: "Nth place: \\"item\\" — one Meechie sentence specific to why this item ranked here." Do not use generic filler — every comment should land on the specific item.'
				].join('\n'),
				responseFormat: STANDARD_RESPONSE_FORMAT
			};
		}

		case 'horoscope':
			return {
				content: [
					'Tool: Meechie Horoscope',
					`Sign: ${input.sign}`,
					'',
					`Give a Meechie horoscope for ${input.sign}.`,
					`headline: "Meechie Forecast — ${input.sign}"`,
					`response: One sentence. Reference something true about ${input.sign}'s energy — their reputation, their pattern, their tell. End with an access boundary, a consequence, or a specific move they need to make.`
				].join('\n'),
				responseFormat: STANDARD_RESPONSE_FORMAT
			};

		default: {
			const _exhaustive: never = input;
			throw new Error(`Unknown toolId: ${(_exhaustive as { toolId: string }).toolId}`);
		}
	}
};

const parseResponse = (
	content: string,
	toolId: MeechieToolInput['toolId']
): { headline: string; response: string; rating?: number } | null => {
	try {
		let sanitized = content.trim();
		if (sanitized.startsWith('```')) {
			sanitized = sanitized.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
		}
		const parsed = JSON.parse(sanitized) as Record<string, unknown>;
		const headline =
			typeof parsed.headline === 'string' ? parsed.headline.trim() : '';
		const response =
			typeof parsed.response === 'string' ? parsed.response.trim() : '';
		if (!headline || !response) {
			return null;
		}

		if (toolId === 'rate_excuse') {
			if (typeof parsed.rating !== 'number') {
				return null;
			}
			const rating = Math.max(1, Math.min(10, Math.round(parsed.rating)));
			return { headline: `${rating}/10`, response, rating };
		}

		return { headline, response };
	} catch {
		return null;
	}
};

export const meechieToolAdapter: MeechieToolSeam = {
	respond: async (
		input: MeechieToolInput
	): Promise<Result<MeechieToolOutput>> => {
		const voiceResult = await meechieVoiceAdapter.getVoicePack({
			voiceId: 'meechie'
		});
		if (!voiceResult.ok) {
			return {
				ok: false,
				error: {
					code: 'MEECHIE_VOICE_PACK_ERROR',
					message: 'Failed to load Meechie voice pack.'
				}
			};
		}
		const systemPrompt = buildMeechieSystemPrompt(voiceResult.value);

		const { content, responseFormat } = buildUserMessage(input);
		const provider = createProviderAdapter({});
		const providerResult = await provider.createChatCompletion({
			model: TEXT_MODEL,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content }
			],
			responseFormat
		});

		if (!providerResult.ok) {
			return {
				ok: false,
				error: {
					code:
						providerResult.error.code === 'PROVIDER_API_KEY_MISSING'
							? 'PROVIDER_API_KEY_MISSING'
							: 'MEECHIE_TOOL_PROVIDER_ERROR',
					message:
						providerResult.error.code === 'PROVIDER_API_KEY_MISSING'
							? 'AI tools require XAI_API_KEY to be set on the server.'
							: providerResult.error.message
				}
			};
		}

		const parsed = parseResponse(providerResult.value.content, input.toolId);
		if (!parsed) {
			return {
				ok: false,
				error: {
					code: 'MEECHIE_TOOL_PROVIDER_INVALID',
					message: 'AI tool response did not match expected format.'
				}
			};
		}

		return {
			ok: true,
			value: {
				toolId: input.toolId,
				headline: parsed.headline,
				response: parsed.response,
				...(parsed.rating !== undefined ? { rating: parsed.rating } : {})
			}
		};
	}
};
