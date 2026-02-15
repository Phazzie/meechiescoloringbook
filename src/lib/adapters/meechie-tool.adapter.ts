// Purpose: Deterministic adapter for MeechieToolSeam.
// Why: Provide consistent Meechie responses without external dependencies.
// Info flow: Tool input -> voice pack -> response template -> output payload.
import type {
	MeechieToolInput,
	MeechieToolOutput,
	MeechieToolSeam
} from '../../../contracts/meechie-tool.contract';
import type { MeechieVoicePack } from '../../../contracts/meechie-voice.contract';
import type { Result } from '../../../contracts/shared.contract';
import { meechieVoiceAdapter } from './meechie-voice.adapter';

const normalize = (value: string): string => value.trim().replace(/\s+/g, ' ');

const toKey = (value: string): string => normalize(value).toLowerCase();

const applyTemplate = (template: string, values: Record<string, string>): string =>
	Object.entries(values).reduce(
		(current, [key, value]) => current.split(`{${key}}`).join(value),
		template
	);

const buildLineup = (pack: MeechieVoicePack, prompt: string, items: string[]): string => {
	const comments = pack.responses.lineup.comments;
	const lines = items.map((item, index) => {
		const place = index + 1;
		const suffix = place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th';
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
	const { runKeywords, flagKeywords, runResponse, flagResponse, defaultResponse } =
		pack.responses.redFlagOrRun;
	if (runKeywords.some((keyword) => normalized.includes(keyword))) {
		return runResponse;
	}
	if (flagKeywords.some((keyword) => normalized.includes(keyword))) {
		return flagResponse;
	}
	return defaultResponse;
};

type WwmdTrigger = MeechieVoicePack['responses']['wwmd']['triggers'][number];

const matchesTrigger = (normalized: string, trigger: WwmdTrigger): boolean => {
	if (trigger.includesAll && !trigger.includesAll.every((keyword) => normalized.includes(keyword))) {
		return false;
	}
	if (trigger.includesAny && !trigger.includesAny.some((keyword) => normalized.includes(keyword))) {
		return false;
	}
	return true;
};

const wwmdResponse = (pack: MeechieVoicePack, dilemma: string): string => {
	const normalized = toKey(dilemma);
	const match = pack.responses.wwmd.triggers.find((trigger) => matchesTrigger(normalized, trigger));
	return match ? match.response : pack.responses.wwmd.fallback;
};

const captionResponse = (pack: MeechieVoicePack, moment: string): string =>
	applyTemplate(pack.responses.caption.template, { moment: normalize(moment) });

const clapbackResponse = (pack: MeechieVoicePack, comment: string): string =>
	applyTemplate(pack.responses.clapback.template, { comment: normalize(comment) });

const receiptsResponse = (pack: MeechieVoicePack, claim: string, reality: string): string =>
	applyTemplate(pack.responses.receipts.template, {
		claim: normalize(claim),
		reality: normalize(reality)
	});

const apologyResponse = (pack: MeechieVoicePack, apology: string): string => {
	const key = toKey(apology);
	return pack.responses.apologyTranslator.exactMap[key] ?? pack.responses.apologyTranslator.fallback;
};

const explainsResponse = (pack: MeechieVoicePack, term: string): string => {
	const key = toKey(term);
	return pack.responses.explains.map[key] ??
		applyTemplate(pack.responses.explains.fallbackTemplate, { term: normalize(term) });
};

const horoscopeHeadline = (pack: MeechieVoicePack, sign: string): string =>
	applyTemplate(pack.responses.headlines.horoscopeTemplate, { sign });

export const meechieToolAdapter: MeechieToolSeam = {
	respond: async (input: MeechieToolInput): Promise<Result<MeechieToolOutput>> => {
		const voiceResult = await meechieVoiceAdapter.getVoicePack({ voiceId: 'meechie' });
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
							pack.responses.horoscope.map[input.sign] ?? pack.responses.horoscope.fallback
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
};
