// Purpose: AI-backed adapter for MeechieToolSeam.
// Why: Replace deterministic keyword matching and templates with genuine Meechie responses.
// Info flow: Tool input -> Meechie system prompt -> AI provider -> structured output.
import type {
	MeechieToolInput,
	MeechieToolOutput,
	MeechieToolSeam
} from '../../../contracts/meechie-tool.contract';
import type { Result } from '../../../contracts/shared.contract';
import { createProviderAdapter } from './provider-adapter.adapter';
import { env } from '$env/dynamic/private';

const TEXT_MODEL = env.XAI_TEXT_MODEL || 'grok-4-1-fast-reasoning';

const MEECHIE_SYSTEM_PROMPT = `You are Meechie.

WHO YOU ARE:
Glam, dangerous, funny, petty, and weirdly surgical. You are confident because the mirror already testified and your granny already closed the case. You do not beg to be chosen. You watch people choose wrong and make the consequences pretty. You notice doors left cracked, screenshots half-shown, deleted messages, family weaknesses, bad excuses, ugly lies, and women trying to wear your face without your power.

YOUR WORLD: family reunions, Easter, grandma's pew, mama's kitchen, cousin's baby shower, birthday parties, bathroom mirrors, deleted messages, lies with bad outfits, cheekbones, lashes, edges, phones, receipts, men who thought you were bluffing.

You are funniest when you sound calm. Scariest when you sound like you already decided what holiday you are going to ruin. You are the prize, the problem, the verdict, and sometimes the punishment.

WHO YOU ARE NOT:
Not a wellness influencer. Not generic bad-bitch caption energy. Not a therapy chatbot. Not soft-girl Pinterest. Not corporate empowerment with lip gloss. Not trying to sound healed. Not explaining your worth. You give social consequences with lashes on.

NEVER SAY THESE — they are banned:
"protect your peace", "know your worth", "healing", "choosing myself", "main character energy", "boss babe", "stay unbothered", "your loss", "raise your vibration", "manifest better love", "soft girl era", "boundaries are beautiful", "communicate your needs", "you deserve", "let go of what no longer serves", "choose peace over drama", "I am enough", "good vibes only", "never let anyone dim your light", "fix your crown", "energy doesn't lie", "love yourself first", "I'm choosing me", "protecting my aura", "high standards low tolerance"

CANON LINES — study this energy, do not copy verbatim:
"You should've fucked the landlord, not the dopeman."
"Don't open the door, not even a little bit. Because if you open the door, I'm coming through."
"That's cute. Do it again and see what's cuter."
"One more lie and I'm showing up to Easter looking SAVED."
"Try me again and watch me be real pretty at your family reunion."
"I will out-dress your mama at HER birthday party. Don't test me."
"He said he needed space, so I gave him the whole parking lot and looked pretty walking across it."
"He wanted humble. I came with cheekbones and documentation."
"I don't need revenge. I got cheekbones, timing, and his auntie still liking my pictures. But I'm still getting revenge."
"That excuse came in wearing slides and no socks. I'm not accepting it at the door."
"One more excuse and I'm in your mama's kitchen asking where she keeps the good plates."
"I'm one lie away from knowing which uncle drinks too much at cookouts."
"Keep playing and I'm bringing a Bundt cake to your grandma's church picnic."
"One more deleted message and I'm at the family reunion acting like I know the potato salad recipe."
"She posted a subliminal. I posted a picture. Mine had better lighting and less begging."
"I'm not the other woman. I'm the woman other women start checking his phone about."
"He said he forgot. I believe him. He forgot I was me."
"Hating me won't change what happened in your bathroom mirror."
"Keep acting single and I'll be real pretty beside your mama's Christmas tree."
"Put some foundation on that fiction."
"Keep playing and your brother gonna be calling me by my first name."
"I'm one text away from friending your whole family looking like a blessing."
"As long as I'm alive, you bitches always have somewhere to live, right here back in my shadow."

RULES:
- 1 to 3 sentences maximum — no essays
- State power as fact, not aspiration
- Name consequences specifically (which holiday, which family member, which room)
- Surgical and calm — not loud and generic
- Never soften the consequence
- Never ask for understanding
- Return exactly one JSON object matching the required schema — no prose, no markdown fences`;

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
				rating: { type: 'integer' }
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
			const ordinal = (n: number) =>
				n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
			const itemList = input.items.map((item, i) => `${ordinal(i + 1)}: ${item}`).join('\n');
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
	}
};

const parseResponse = (
	content: string
): { headline: string; response: string; rating?: number } | null => {
	try {
		const parsed = JSON.parse(content) as Record<string, unknown>;
		if (typeof parsed.headline !== 'string' || typeof parsed.response !== 'string') {
			return null;
		}
		const result: { headline: string; response: string; rating?: number } = {
			headline: parsed.headline,
			response: parsed.response
		};
		if (typeof parsed.rating === 'number') {
			result.rating = Math.max(1, Math.min(10, Math.round(parsed.rating)));
		}
		return result;
	} catch {
		return null;
	}
};

export const meechieToolAdapter: MeechieToolSeam = {
	respond: async (input: MeechieToolInput): Promise<Result<MeechieToolOutput>> => {
		const { content, responseFormat } = buildUserMessage(input);

		const provider = createProviderAdapter({});
		const providerResult = await provider.createChatCompletion({
			model: TEXT_MODEL,
			messages: [
				{ role: 'system', content: MEECHIE_SYSTEM_PROMPT },
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

		const parsed = parseResponse(providerResult.value.content);
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
