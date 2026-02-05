// Purpose: Deterministic adapter for MeechieToolSeam.
// Why: Provide consistent Meechie responses without external dependencies.
// Info flow: Tool input -> response template -> output payload.
import type {
	MeechieToolInput,
	MeechieToolOutput,
	MeechieToolSeam
} from '../../../contracts/meechie-tool.contract';
import type { Result } from '../../../contracts/shared.contract';

const normalize = (value: string): string => value.trim().replace(/\s+/g, ' ');

const toKey = (value: string): string => normalize(value).toLowerCase();

const apologyMap = new Map<string, string>([
	[
		"i'm sorry you feel that way",
		"I'm not sorry for what I did. I'm sorry you noticed. Meechie don't accept returns on half-ass apologies."
	],
	[
		"it won't happen again",
		"It will happen again but quieter. Meechie heard that one before."
	]
]);

const horoscopeMap: Record<string, string> = {
	Aries: 'You moving fast, but check where you aiming. Speed without direction is just noise.',
	Taurus: 'Comfort is your love language. Just make sure it is not your excuse.',
	Gemini: 'You got two sides and both got opinions. Pick the one that keeps you paid.',
	Cancer: 'You feel everything. That does not mean everything deserves a response.',
	Leo: 'You right a lot. Just do not confuse being right with being loud.',
	Virgo: 'You see the details. Make sure you see the blessings too.',
	Libra: 'You are not indecisive, you just do not want to be the bad guy. Pick one.',
	Scorpio: 'You already know who is lying. Stop waiting for proof.',
	Sagittarius: 'Freedom is your thing. Make sure you are not running from yourself.',
	Capricorn: 'You always on grind. Do not let the grind grind you.',
	Aquarius: 'You are ahead of the curve. Just do not forget the people with you.',
	Pisces: 'You can read the room. Make sure the room can read you.'
};

const explainsMap = new Map<string, string>([
	[
		'situationship',
		'A situationship is when he wants girlfriend benefits on a stranger budget. Meechie do not offer samples.'
	],
	[
		'gaslighting',
		'Gaslighting is when he lies, you catch him, and somehow you apologizing. Meechie does not negotiate with terrorists.'
	],
	[
		'breadcrumbing',
		'Breadcrumbing is when they feed you crumbs to keep you hungry. Meechie eats a full plate or nothing.'
	],
	[
		'love bombing',
		'Love bombing is fireworks up front with no foundation. Meechie likes steady lights, not flashes.'
	],
	[
		'ghosting',
		'Ghosting is when they disappear without a word. Meechie keeps the door locked after that.'
	]
]);

const lineupComments = [
	'worst one of the bunch. That lie been dead.',
	'not creative, just committed to nonsense.',
	'you tried, but the effort is still weak.',
	'low effort, but at least you showed up.',
	'cute story. Still a no.',
	'barely holding together. Try again.'
];

const buildLineup = (prompt: string, items: string[]): string => {
	const lines = items.map((item, index) => {
		const place = index + 1;
		const suffix = place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th';
		const comment = lineupComments[index] ?? lineupComments[lineupComments.length - 1];
		return `${place}${suffix} place: "${normalize(item)}" — ${comment}`;
	});
	return `${normalize(prompt)}\n${lines.join('\n')}`;
};

const classifyRedFlag = (situation: string): { headline: string; response: string } => {
	const normalized = toKey(situation);
	const runKeywords = [
		'not ready for a relationship',
		'not ready for a relationship but',
		'keep seeing',
		'no relationship',
		'not looking for anything serious'
	];
	const flagKeywords = ['ex', 'photos', 'still has', 'museum', 'still friends'];
	if (runKeywords.some((keyword) => normalized.includes(keyword))) {
		return {
			headline: 'RUN',
			response: 'RUN. That is not a relationship. That is a subscription they will not pay for.'
		};
	}
	if (flagKeywords.some((keyword) => normalized.includes(keyword))) {
		return {
			headline: 'Red flag',
			response: 'Red flag. They keeping a museum. Are you visiting or the new exhibit?'
		};
	}
	return {
		headline: 'Red flag',
		response: 'Red flag. Need more information before Meechie signs off.'
	};
};

const wwmdResponse = (dilemma: string): string => {
	const normalized = toKey(dilemma);
	if (normalized.includes('hey stranger') || normalized.includes('left me on read')) {
		return "Leave them on read for six days. Then reply 'who this?' Meechie does not reward tardiness.";
	}
	if (normalized.includes('coffee') && normalized.includes('talk')) {
		return "Go. Look incredible. Let them talk. Say 'that's crazy' three times. Leave first.";
	}
	return 'Keep your dignity. Respond once, then focus on your own plans.';
};

const captionResponse = (moment: string): string =>
	`Caption: "${normalize(moment)}" — Meechie says make them watch you glow.`;

const clapbackResponse = (comment: string): string =>
	`Response: "${normalize(comment)}"? Cool. Meanwhile you doing nothing and still tired.`;

const receiptsResponse = (claim: string, reality: string): string =>
	`The receipts show: ${normalize(claim)} vs ${normalize(reality)}. Meechie got timestamps.`;

const apologyResponse = (apology: string): string => {
	const key = toKey(apology);
	return (
		apologyMap.get(key) ??
		"Translation: that apology does not clear the balance. Meechie needs actions, not excuses."
	);
};

const explainsResponse = (term: string): string => {
	const key = toKey(term);
	return (
		explainsMap.get(key) ??
		`${normalize(term)} is when they want perks without responsibility. Meechie is not impressed.`
	);
};

export const meechieToolAdapter: MeechieToolSeam = {
	respond: async (input: MeechieToolInput): Promise<Result<MeechieToolOutput>> => {
		switch (input.toolId) {
			case 'apology_translator':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: 'Translation',
						response: apologyResponse(input.apology)
					}
				};
			case 'red_flag_or_run': {
				const verdict = classifyRedFlag(input.situation);
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
						headline: 'WWMD',
						response: wwmdResponse(input.dilemma)
					}
				};
			case 'lineup':
				if (input.items.length < 2) {
					return {
						ok: false,
						error: {
							code: 'LINEUP_TOO_SHORT',
							message: 'Lineup requires at least two items to rank.'
						}
					};
				}
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: 'The Lineup',
						response: buildLineup(input.prompt, input.items)
					}
				};
			case 'horoscope':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: `Meechie's Horoscope — ${input.sign}`,
						response: horoscopeMap[input.sign] ?? 'Meechie says trust your instincts.'
					}
				};
			case 'receipts':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: 'The Receipts',
						response: receiptsResponse(input.claim, input.reality)
					}
				};
			case 'caption_this':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: 'Caption This',
						response: captionResponse(input.moment)
					}
				};
			case 'clapback':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: 'Clapback',
						response: clapbackResponse(input.comment)
					}
				};
			case 'meechie_explains':
				return {
					ok: true,
					value: {
						toolId: input.toolId,
						headline: 'Meechie Explains It',
						response: explainsResponse(input.term)
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
