// Purpose: Adapter for MeechieToolSeam.
// Why: Provide consistent Meechie responses and AI-backed random sayings behind one seam.
// Info flow: Tool input -> voice pack/provider -> response template or generated saying -> output payload.
import { env } from '$env/dynamic/private';
import type {
	MeechieToolInput,
	MeechieToolOutput,
	MeechieToolSeam
} from '../../../contracts/meechie-tool.contract';
import type { MeechieVoicePack } from '../../../contracts/meechie-voice.contract';
import type { Result } from '../../../contracts/shared.contract';
import type { ProviderAdapterSeam } from '../../../contracts/provider-adapter.contract';
import { createProviderAdapter } from './provider-adapter.adapter';
import { meechieVoiceAdapter } from './meechie-voice.adapter';

const TEXT_MODEL = env.XAI_TEXT_MODEL || 'grok-4-1-fast-reasoning';

const normalize = (value: string): string => value.trim().replace(/\s+/g, ' ');

const toKey = (value: string): string => normalize(value).toLowerCase();

const applyTemplate = (
	template: string,
	values: Record<string, string>
): string =>
	Object.entries(values).reduce(
		(current, [key, value]) => current.split(`{${key}}`).join(value),
		template
	);

const buildLineup = (
	pack: MeechieVoicePack,
	prompt: string,
	items: string[]
): string => {
	const comments = pack.responses.lineup.comments;
	const lines = items.map((item, index) => {
		const place = index + 1;
		const suffix =
			place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th';
		const comment = comments[index] ?? comments[comments.length - 1];
		return `${place}${suffix} place: "${normalize(item)}" — ${comment}`;
	});
	return `${normalize(prompt)}\n${lines.join('\n')}`;
};

const classifyRedFlag = (
	pack: MeechieVoicePack,
	situation: string
): { headline: string; response: string } => {
	const normalized = toKey(situation);
	const {
		runKeywords,
		flagKeywords,
		runResponse,
		flagResponse,
		defaultResponse
	} = pack.responses.redFlagOrRun;
	if (runKeywords.some((keyword) => normalized.includes(keyword))) {
		return {
			headline: runResponse.headline,
			response: `Fault: them. Consequence: they lose access immediately. ${runResponse.response}`
		};
	}
	if (flagKeywords.some((keyword) => normalized.includes(keyword))) {
		return {
			headline: flagResponse.headline,
			response: `Fault: them. Consequence: probation until evidence improves. ${flagResponse.response}`
		};
	}
	return {
		headline: defaultResponse.headline,
		response: `Fault: unknown until facts arrive. Consequence: no upgrade without proof. ${defaultResponse.response}`
	};
};

type WwmdTrigger = MeechieVoicePack['responses']['wwmd']['triggers'][number];

const matchesTrigger = (normalized: string, trigger: WwmdTrigger): boolean => {
	if (
		trigger.includesAll &&
		!trigger.includesAll.every((keyword) => normalized.includes(keyword))
	) {
		return false;
	}
	if (
		trigger.includesAny &&
		!trigger.includesAny.some((keyword) => normalized.includes(keyword))
	) {
		return false;
	}
	return true;
};

const evidencePattern = (text: string): string => {
	const normalized = toKey(text);
	if (/\b(?:left on read|on read|seen|delivered)\b/.test(normalized))
		return 'read-receipt trail';
	if (/\b(?:screenshot|receipts|proof|timestamp)\b/.test(normalized))
		return 'timestamp and screenshot trail';
	if (/\b(?:location|live|map|pin)\b/.test(normalized)) return 'location trail';
	return 'story has no verifiable trail';
};

const whoFault = (text: string): string => {
	const normalized = toKey(text);
	if (/(?:i was|i did|my bad|i forgot)/.test(normalized)) return 'you';
	if (/\b(?:he|she|they|him|her)\b/.test(normalized)) return 'them';
	return 'both sides';
};

const wwmdResponse = (pack: MeechieVoicePack, dilemma: string): string => {
	const normalized = toKey(dilemma);
	const match = pack.responses.wwmd.triggers.find((trigger) =>
		matchesTrigger(normalized, trigger)
	);
	const fault = whoFault(dilemma);
	if (match) {
		return `Fault: ${fault}. Consequence: protect access, not feelings. Move: ${match.response}`;
	}
	return `Fault: ${fault}. Consequence: no boundary means repeated behavior. Move: ${pack.responses.wwmd.fallback}`;
};

const structuredSocialFrame = (
	subject: string,
	detail: string,
	consequence: string
): string =>
	`Role: ${subject}. Object: ${detail}. Place: timeline and real life. Consequence: ${consequence}.`;

const captionResponse = (pack: MeechieVoicePack, moment: string): string => {
	const cleanMoment = normalize(moment);
	const base = applyTemplate(pack.responses.caption.template, {
		moment: cleanMoment
	});
	return `${base} ${structuredSocialFrame('main character', cleanMoment, 'watchers get commentary, not access')}`;
};

const clapbackResponse = (pack: MeechieVoicePack, comment: string): string => {
	const cleanComment = normalize(comment);
	const base = applyTemplate(pack.responses.clapback.template, {
		comment: cleanComment
	});
	return `${base} ${structuredSocialFrame('critic', cleanComment, 'cheap shots lose priority seating')}`;
};

const receiptsResponse = (
	pack: MeechieVoicePack,
	claim: string,
	reality: string
): string => {
	const cleanClaim = normalize(claim);
	const cleanReality = normalize(reality);
	const base = applyTemplate(pack.responses.receipts.template, {
		claim: cleanClaim,
		reality: cleanReality
	});
	return `${base} ${structuredSocialFrame('speaker vs facts', `${cleanClaim} / ${cleanReality}`, 'evidence wins and access gets adjusted')}`;
};

const apologyResponse = (pack: MeechieVoicePack, apology: string): string => {
	const key = toKey(apology);
	const mapped = pack.responses.apologyTranslator.exactMap[key];
	if (mapped) return mapped;
	const weakStructure =
		/sorry you feel|if i hurt|mistakes were made|didn't mean/.test(key);
	if (weakStructure) {
		return 'Translation: you centered optics, not impact. Meechie logic: name the act, name the harm, offer repair, and accept the consequence window.';
	}
	return `${pack.responses.apologyTranslator.fallback} Meechie logic: apology must include action, repayment, and timeline.`;
};

const explainsResponse = (pack: MeechieVoicePack, term: string): string => {
	const key = toKey(term);
	return (
		pack.responses.explains.map[key] ??
		applyTemplate(pack.responses.explains.fallbackTemplate, {
			term: normalize(term)
		})
	);
};

const rateExcuse = (
	pack: MeechieVoicePack,
	excuse: string
): { rating: number; commentary: string } => {
	const normalized = toKey(excuse);
	const match = pack.responses.excuseRatings.find((r) =>
		r.keywords.some((keyword) => normalized.includes(keyword))
	);
	const base = match ?? pack.responses.excuseRatingFallback;
	return {
		...base,
		commentary: `${base.commentary} Evidence pattern: ${evidencePattern(excuse)}.`
	};
};

const cleanGeneratedSaying = (content: string): string => {
	const firstRawLine =
		content
			.split(/\r?\n+/)
			.map((line) => line.trim())
			.find((line) => line.length > 0) ?? content;
	const firstLine = normalize(firstRawLine)
		.replace(/^["'“”]+|["'“”]+$/g, '')
		.trim();
	return firstLine.length > 220
		? `${firstLine.slice(0, 217).trim()}...`
		: firstLine;
};

const generateRandomSaying = async (
	pack: MeechieVoicePack,
	provider: ProviderAdapterSeam
): Promise<Result<string>> => {
	const examples = pack.responses.randomSayings
		.slice(0, 8)
		.map((saying) => `- ${saying}`)
		.join('\n');
	const providerResult = await provider.createChatCompletion({
		model: TEXT_MODEL,
		messages: [
			{
				role: 'system',
				content:
					'Generate one original Meechie coloring-book saying. Return one sharp line only: no JSON, no markdown, no explanation. Keep it printable, specific, funny, and under 24 words.'
			},
			{
				role: 'user',
				content: `Use these as voice examples without copying them:\n${examples}`
			}
		]
	});
	if (!providerResult.ok) {
		return providerResult;
	}
	const saying = cleanGeneratedSaying(providerResult.value.content);
	if (!saying) {
		return {
			ok: false,
			error: {
				code: 'MEECHIE_RANDOM_EMPTY',
				message: 'AI generated an empty Meechie saying.'
			}
		};
	}
	return {
		ok: true,
		value: saying
	};
};

const horoscopeHeadline = (pack: MeechieVoicePack, sign: string): string =>
	applyTemplate(pack.responses.headlines.horoscopeTemplate, { sign });

export type MeechieToolAdapterDeps = {
	getVoicePack: typeof meechieVoiceAdapter.getVoicePack;
	createProvider: typeof createProviderAdapter;
};

export const createMeechieToolAdapter = (
	deps: MeechieToolAdapterDeps = {
		getVoicePack: (input) => meechieVoiceAdapter.getVoicePack(input),
		createProvider: createProviderAdapter
	}
): MeechieToolSeam => ({
	respond: async (
		input: MeechieToolInput
	): Promise<Result<MeechieToolOutput>> => {
		const voiceResult = await deps.getVoicePack({ voiceId: 'meechie' });
		if (!voiceResult.ok) {
			return voiceResult;
		}

		const pack = voiceResult.value;

		switch (input.toolId) {
			case 'apology_translator':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: pack.responses.headlines.apologyTranslator,
						response: apologyResponse(pack, input.apology)
					}
				};
			case 'red_flag_or_run': {
				const verdict = classifyRedFlag(pack, input.situation);
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: verdict.headline,
						response: verdict.response
					}
				};
			}
			case 'wwmd':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: pack.responses.headlines.wwmd,
						response: wwmdResponse(pack, input.dilemma)
					}
				};
			case 'lineup':
				if (input.items.length < pack.responses.lineup.minItems) {
					return {
						ok: false,
						error: {
							code: 'LINEUP_TOO_SHORT',
							message: pack.responses.lineup.tooShortMessage
						}
					};
				}
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: pack.responses.headlines.lineup,
						response: buildLineup(pack, input.prompt, input.items)
					}
				};
			case 'horoscope':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: horoscopeHeadline(pack, input.sign),
						response:
							pack.responses.horoscope.map[input.sign] ??
							pack.responses.horoscope.fallback
					}
				};
			case 'receipts':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: pack.responses.headlines.receipts,
						response: receiptsResponse(pack, input.claim, input.reality)
					}
				};
			case 'caption_this':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: pack.responses.headlines.caption,
						response: captionResponse(pack, input.moment)
					}
				};
			case 'clapback':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: pack.responses.headlines.clapback,
						response: clapbackResponse(pack, input.comment)
					}
				};
			case 'meechie_explains':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: pack.responses.headlines.explains,
						response: explainsResponse(pack, input.term)
					}
				};
			case 'rate_excuse': {
				const { rating, commentary } = rateExcuse(pack, input.excuse);
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: `${rating}/10`,
						response: commentary,
						rating
					}
				};
			}
			case 'random_meechie': {
				const saying = await generateRandomSaying(
					pack,
					deps.createProvider({})
				);
				if (!saying.ok) {
					return saying;
				}
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: 'Random Meechie',
						response: saying.value
					}
				};
			}
			default:
				return {
					ok: false,
					error: {
						code: 'UNKNOWN_TOOL',
						message: 'Tool not supported.'
					}
				};
		}
	}
});

export const meechieToolAdapter = createMeechieToolAdapter();
