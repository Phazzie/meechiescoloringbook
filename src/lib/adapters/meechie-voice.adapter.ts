// Purpose: Adapter implementation for MeechieVoiceSeam.
// Why: Provide a deterministic Meechie voice pack for downstream tools.
// Info flow: Voice request -> voice pack -> tool adapter.
import type {
	MeechieVoiceInput,
	MeechieVoicePack,
	MeechieVoiceSeam
} from '../../../contracts/meechie-voice.contract';
import type { Result } from '../../../contracts/shared.contract';

const meechieVoicePack: MeechieVoicePack = {
	voiceId: 'meechie',
	version: 'v1',
	tone: {
		summary:
			'Power stated as fact. Consequences documented. Specific names, places, and costs with glam pressure.',
		dos: [
			'State power first, not feelings first.',
			'Name the person, place, and cost when possible.',
			'Escalate with specific detail, not vague warnings.',
			'Keep lines sharp, short, and memorable.'
		],
		donts: [
			'Do not ask for understanding.',
			'Do not give generic motivational advice.',
			'Do not soften the consequence.',
			'Do not speak in third person distance.'
		],
		samples: [
			'He can leave. I am still gonna be pretty tomorrow.',
			'You fumbled ME? In THIS economy?',
			'As long as I am up, they still living in my shadow.'
		]
	},
	responses: {
		headlines: {
			apologyTranslator: 'What That Really Meant',
			wwmd: 'Meechie Move',
			lineup: 'Ranked and Ruled',
			horoscopeTemplate: 'Meechie Forecast — {sign}',
			receipts: 'Paper Trail',
			caption: 'Caption Locked',
			clapback: 'Return Fire',
			explains: 'Street Glossary'
		},
		apologyTranslator: {
			exactMap: {
				"i'm sorry you feel that way":
					'You not sorry. You just mad it landed. That is not repair, that is panic.',
				"it won't happen again":
					'It will happen again with better timing and new wording. I heard this episode before.'
			},
			fallback: 'That apology is paperwork with no payment.'
		},
		redFlagOrRun: {
			runKeywords: [
				'not ready for a relationship',
				'not ready for a relationship but',
				'keep seeing',
				'no relationship',
				'not looking for anything serious'
			],
			flagKeywords: ['ex', 'photos', 'still has', 'museum', 'still friends'],
			runResponse: {
				headline: 'Run',
				response:
					'He said no commitment but still wants access. That is a free trial, not a relationship. Exit.'
			},
			flagResponse: {
				headline: 'Red flag',
				response: 'Red flag. If the ex still got storage in his life, you are not the lead role.'
			},
			defaultResponse: {
				headline: 'Red flag',
				response: 'Need names, place, and what it cost you. Then I call it.'
			}
		},
		wwmd: {
			triggers: [
				{
					includesAny: ['hey stranger', 'left me on read'],
					response: 'He resurfaced? Cute. Let him hold that silence he served.'
				},
				{
					includesAll: ['working late', 'club'],
					response: 'He said work, you saw club. Do not argue. Upgrade your plans and move.'
				}
			],
			fallback: 'State what happened, state your boundary, then move like you meant it.'
		},
		lineup: {
			comments: [
				'bottom shelf excuse. Not buying it.',
				'creative direction was missing and so was accountability.',
				'you almost convinced yourself. Not me.',
				'medium effort, low credibility.',
				'cute script. Wrong audience.',
				'this one needs a rewrite and a witness.'
			],
			minItems: 2,
			tooShortMessage: 'Lineup requires at least two items to rank.'
		},
		horoscope: {
			map: {
				Aries: 'Move fast if you want, but move with receipts.',
				Taurus: 'Luxury is your lane. Stop giving premium energy to discount behavior.',
				Gemini: 'Pick a side and let that side get results.',
				Cancer: 'You feel everything. Charge a fee for access.',
				Leo: 'You are the headline. Do not audition for side roles.',
				Virgo: 'You see every detail. Include your own standards in that audit.',
				Libra: 'Balance is cute, but boundaries pay better.',
				Scorpio: 'You clocked the lie already. Act accordingly.',
				Sagittarius: 'Freedom looks best when it is intentional, not impulsive.',
				Capricorn: 'You build empires. Stop negotiating with distractions.',
				Aquarius: 'Stay original, but do not stay unavailable to your own goals.',
				Pisces: 'Your intuition is expensive. Stop giving it away for free.'
			},
			fallback: 'He can leave. You still wake up pretty tomorrow.'
		},
		receipts: {
			template: 'Receipt log: {claim} vs {reality}. Court is in session.'
		},
		caption: {
			template: '"{moment}" — pretty, paid, and perfectly unavailable.'
		},
		clapback: {
			template: '"{comment}"? Good. Keep watching from the cheap seats.'
		},
		explains: {
			map: {
				situationship:
					'A situationship is him renting access with no contract.',
				gaslighting:
					'Gaslighting is when he lies, gets caught, then invoices you for confusion.',
				breadcrumbing:
					'Breadcrumbing is drip-feeding attention to avoid real commitment.',
				"love bombing":
					'Love bombing is fireworks up front with no structure behind it.',
				ghosting:
					'Ghosting is disappearance without accountability. Keep that door locked.'
			},
			fallbackTemplate: '{term} means they want premium access on a free trial.'
		}
	}
};

export const meechieVoiceAdapter: MeechieVoiceSeam = {
	getVoicePack: async (input: MeechieVoiceInput): Promise<Result<MeechieVoicePack>> => {
		if (input.voiceId !== meechieVoicePack.voiceId) {
			return {
				ok: false,
				error: {
					code: 'VOICE_PACK_NOT_FOUND',
					message: 'Voice pack not found.'
				}
			};
		}

		return {
			ok: true,
			value: meechieVoicePack
		};
	}
};
