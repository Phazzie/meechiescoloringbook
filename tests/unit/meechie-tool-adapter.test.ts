// Purpose: Unit tests for meechie-tool adapter covering all tool types.
// Why: Ensure every tool correctly routes to the AI provider and returns a contract-valid output.
// Info flow: Tool inputs -> mocked AI provider -> verified outputs for all 11 tool types.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockCreateChatCompletion = vi.fn();

vi.mock('../../src/lib/adapters/provider-adapter.adapter', () => ({
	createProviderAdapter: () => ({
		createChatCompletion: mockCreateChatCompletion,
		createImageGeneration: vi.fn()
	})
}));

const { meechieToolAdapter } = await import('../../src/lib/adapters/meechie-tool-seam');
const { meechieVoicePack } = await import('../../src/lib/seams/meechie-voice-seam/voice-pack');

const providerOk = (headline: string, response: string, extra?: Record<string, unknown>) => ({
	ok: true as const,
	value: {
		model: 'test-model',
		content: JSON.stringify({ headline, response, ...extra })
	}
});

beforeEach(() => {
	mockCreateChatCompletion.mockReset();
});

describe('meechie-tool adapter', () => {
	describe('apology_translator', () => {
		it('returns ok with correct toolId', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('What That Really Meant', 'Translation: you were managing optics. Meechie logic: name the act and the harm.')
			);
			const result = await meechieToolAdapter.respond({
				toolId: 'apology_translator',
				apology: "I'm sorry you feel that way"
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('apology_translator');
				expect(result.value.headline).toBe('What That Really Meant');
				expect(result.value.response).toBeTruthy();
			}
		});

		it('passes the apology text in the user message', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('What That Really Meant', 'Translation: noted.')
			);
			await meechieToolAdapter.respond({
				toolId: 'apology_translator',
				apology: 'My bad for everything'
			});
			const call = mockCreateChatCompletion.mock.calls[0][0];
			expect(call.messages[1].content).toContain('My bad for everything');
		});
	});

	describe('red_flag_or_run', () => {
		it('returns ok with correct toolId', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Run.', 'Fault: them. Consequence: access revoked immediately.')
			);
			const result = await meechieToolAdapter.respond({
				toolId: 'red_flag_or_run',
				situation: 'He is not looking for anything serious right now'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('red_flag_or_run');
				expect(result.value.headline).toBeTruthy();
				expect(result.value.response).toBeTruthy();
			}
		});

		it('passes the situation text in the user message', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Red Flag.', 'Fault: them. Consequence: probation.')
			);
			await meechieToolAdapter.respond({
				toolId: 'red_flag_or_run',
				situation: 'He still has photos of his ex everywhere'
			});
			const call = mockCreateChatCompletion.mock.calls[0][0];
			expect(call.messages[1].content).toContain('He still has photos of his ex everywhere');
		});
	});

	describe('wwmd', () => {
		it('returns ok with correct toolId', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Meechie Move', 'Fault: them. Consequence: silence returned. Move: upgrade your plans.')
			);
			const result = await meechieToolAdapter.respond({
				toolId: 'wwmd',
				dilemma: 'He sent me a hey stranger text'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('wwmd');
				expect(result.value.response).toBeTruthy();
			}
		});

		it('passes the dilemma text in the user message', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Meechie Move', 'Fault: them. Consequence: noted.')
			);
			await meechieToolAdapter.respond({
				toolId: 'wwmd',
				dilemma: 'Should I move to a new city for a fresh start?'
			});
			const call = mockCreateChatCompletion.mock.calls[0][0];
			expect(call.messages[1].content).toContain('Should I move to a new city');
		});
	});

	describe('lineup', () => {
		it('returns ok and includes ordinal labels in the user message', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Ranked and Ruled', '1st place: "Traffic" — creative at least. 2nd place: "Phone died" — classic.')
			);
			const result = await meechieToolAdapter.respond({
				toolId: 'lineup',
				prompt: 'Rate these excuses',
				items: ['Traffic', 'Phone died']
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('lineup');
			}
			const call = mockCreateChatCompletion.mock.calls[0][0];
			expect(call.messages[1].content).toContain('Lineup');
			expect(call.messages[1].content).toContain('1st');
			expect(call.messages[1].content).toContain('2nd');
		});

		it('includes 4th ordinal for four items', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Ranked and Ruled', '1st place: "A". 2nd place: "B". 3rd place: "C". 4th place: "D".')
			);
			await meechieToolAdapter.respond({
				toolId: 'lineup',
				prompt: 'Rank these',
				items: ['A', 'B', 'C', 'D']
			});
			const call = mockCreateChatCompletion.mock.calls[0][0];
			expect(call.messages[1].content).toContain('4th');
		});

		it('uses correct ordinal suffixes for teen and twenties lineup positions', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Ranked and Ruled', 'Lineup ranked.')
			);
			await meechieToolAdapter.respond({
				toolId: 'lineup',
				prompt: 'Rank these',
				items: Array.from({ length: 23 }, (_, i) => `Item ${i + 1}`)
			});
			const call = mockCreateChatCompletion.mock.calls[0][0];
			const content = call.messages[1].content;
			expect(content).toContain('11th: Item 11');
			expect(content).toContain('12th: Item 12');
			expect(content).toContain('13th: Item 13');
			expect(content).toContain('21st: Item 21');
			expect(content).toContain('22nd: Item 22');
			expect(content).toContain('23rd: Item 23');
			expect(content).not.toContain('11st: Item 11');
			expect(content).not.toContain('12nd: Item 12');
			expect(content).not.toContain('13rd: Item 13');
			expect(content).not.toContain('21th: Item 21');
			expect(content).not.toContain('22th: Item 22');
			expect(content).not.toContain('23th: Item 23');
		});
	});

	describe('horoscope', () => {
		it('returns ok with sign in the user message', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Meechie Forecast — Leo', 'You are the headline. Stop auditioning for side roles.')
			);
			const result = await meechieToolAdapter.respond({ toolId: 'horoscope', sign: 'Leo' });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('horoscope');
			}
			const call = mockCreateChatCompletion.mock.calls[0][0];
			expect(call.messages[1].content).toContain('Leo');
		});

		it('passes each zodiac sign to the provider', async () => {
			const signs = [
				'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
				'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
			] as const;
			for (const sign of signs) {
				mockCreateChatCompletion.mockResolvedValue(
					providerOk(`Meechie Forecast — ${sign}`, `${sign} energy noted. Act accordingly.`)
				);
				const result = await meechieToolAdapter.respond({ toolId: 'horoscope', sign });
				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.toolId).toBe('horoscope');
					expect(result.value.response.length).toBeGreaterThan(0);
				}
			}
		});
	});

	describe('receipts', () => {
		it('returns ok and passes both claim and reality to provider', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Paper Trail', 'He said work. Location said the mall. The receipt is submitted.')
			);
			const result = await meechieToolAdapter.respond({
				toolId: 'receipts',
				claim: 'He said he was at work',
				reality: 'His location showed the mall'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('receipts');
			}
			const call = mockCreateChatCompletion.mock.calls[0][0];
			expect(call.messages[1].content).toContain('He said he was at work');
			expect(call.messages[1].content).toContain('His location showed the mall');
		});
	});

	describe('caption_this', () => {
		it('returns ok and passes the moment to provider', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Caption Locked', 'Walking out of that meeting looking like the verdict.')
			);
			const result = await meechieToolAdapter.respond({
				toolId: 'caption_this',
				moment: 'Walking out of that meeting like a boss'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('caption_this');
			}
			const call = mockCreateChatCompletion.mock.calls[0][0];
			expect(call.messages[1].content).toContain('Walking out of that meeting like a boss');
		});
	});

	describe('clapback', () => {
		it('returns ok and passes the comment to provider', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Return Fire', 'Keep watching from the cheap seats.')
			);
			const result = await meechieToolAdapter.respond({
				toolId: 'clapback',
				comment: 'You think you are better than everyone'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('clapback');
			}
			const call = mockCreateChatCompletion.mock.calls[0][0];
			expect(call.messages[1].content).toContain('You think you are better than everyone');
		});
	});

	describe('meechie_explains', () => {
		it('returns ok and passes the term to provider', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Street Glossary', 'A situationship is him renting access with no contract and no deposit.')
			);
			const result = await meechieToolAdapter.respond({
				toolId: 'meechie_explains',
				term: 'situationship'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('meechie_explains');
			}
			const call = mockCreateChatCompletion.mock.calls[0][0];
			expect(call.messages[1].content).toContain('situationship');
		});

		it('passes unknown terms to the provider too', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Street Glossary', 'Benching is low-tier contract access — texts when convenient.')
			);
			const result = await meechieToolAdapter.respond({
				toolId: 'meechie_explains',
				term: 'benching'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('meechie_explains');
				expect(result.value.response.length).toBeGreaterThan(0);
			}
		});
	});

	describe('rate_excuse', () => {
		it('returns ok with a numeric rating', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('2/10', 'Phones die. Your character did not have to go with it.', { rating: 2 })
			);
			const result = await meechieToolAdapter.respond({
				toolId: 'rate_excuse',
				excuse: 'My phone died and I left you on read.'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('rate_excuse');
				expect(result.value.rating).toBe(2);
			}
		});

		it('clamps rating to 1–10 range and derives headline from clamped value', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('15/10', 'Ridiculous.', { rating: 15 })
			);
			const result = await meechieToolAdapter.respond({
				toolId: 'rate_excuse',
				excuse: 'Best excuse ever'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.rating).toBe(10);
				expect(result.value.headline).toBe('10/10');
			}
		});

		it('returns MEECHIE_TOOL_PROVIDER_INVALID when rating is missing for rate_excuse', async () => {
			mockCreateChatCompletion.mockResolvedValue({
				ok: true,
				value: { model: 'test-model', content: JSON.stringify({ headline: '?/10', response: 'No rating.' }) }
			});
			const result = await meechieToolAdapter.respond({
				toolId: 'rate_excuse',
				excuse: 'Some excuse'
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('MEECHIE_TOOL_PROVIDER_INVALID');
			}
		});
	});

	describe('random_meechie', () => {
		it('returns ok with a fresh AI-generated response', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Random Meechie', 'Keep playing and your cousin is getting a Bundt cake and a front row seat.')
			);
			const result = await meechieToolAdapter.respond({ toolId: 'random_meechie' });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('random_meechie');
				expect(result.value.response.length).toBeGreaterThan(0);
				expect(result.value.quoteScore).toBeUndefined();
			}
		});
	});

	describe('system prompt', () => {
		it('always sends a Meechie system prompt as the first message', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Random Meechie', 'He forgot I was me.')
			);
			await meechieToolAdapter.respond({ toolId: 'random_meechie' });
			const call = mockCreateChatCompletion.mock.calls[0][0];
			expect(call.messages[0].role).toBe('system');
			expect(call.messages[0].content).toContain('You are Meechie');
			expect(call.messages[0].content).toContain('NEVER DO THIS');
		});

		it('carries every voice-pack line into the prompt exactly once', async () => {
			mockCreateChatCompletion.mockResolvedValue(
				providerOk('Random Meechie', 'He forgot I was me.')
			);
			await meechieToolAdapter.respond({ toolId: 'random_meechie' });
			const prompt: string = mockCreateChatCompletion.mock.calls[0][0].messages[0].content;
			for (const quote of meechieVoicePack.responses.quotes) {
				expect(prompt.split(`"${quote.text}"`).length - 1).toBe(1);
			}
		});
	});

	describe('error handling', () => {
		it('returns PROVIDER_API_KEY_MISSING when key is absent', async () => {
			mockCreateChatCompletion.mockResolvedValue({
				ok: false,
				error: { code: 'PROVIDER_API_KEY_MISSING', message: 'XAI_API_KEY is required.' }
			});
			const result = await meechieToolAdapter.respond({ toolId: 'random_meechie' });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('PROVIDER_API_KEY_MISSING');
			}
		});

		it('returns MEECHIE_TOOL_PROVIDER_ERROR on non-key provider failure', async () => {
			mockCreateChatCompletion.mockResolvedValue({
				ok: false,
				error: { code: 'PROVIDER_HTTP_ERROR', message: 'Bad gateway.' }
			});
			const result = await meechieToolAdapter.respond({ toolId: 'random_meechie' });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('MEECHIE_TOOL_PROVIDER_ERROR');
			}
		});

		it('returns MEECHIE_TOOL_PROVIDER_INVALID on unparseable response', async () => {
			mockCreateChatCompletion.mockResolvedValue({
				ok: true,
				value: { model: 'test-model', content: 'not json at all' }
			});
			const result = await meechieToolAdapter.respond({ toolId: 'random_meechie' });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('MEECHIE_TOOL_PROVIDER_INVALID');
			}
		});

		it('returns MEECHIE_TOOL_PROVIDER_INVALID when response is missing required fields', async () => {
			mockCreateChatCompletion.mockResolvedValue({
				ok: true,
				value: { model: 'test-model', content: JSON.stringify({ headline: 'Only a headline' }) }
			});
			const result = await meechieToolAdapter.respond({ toolId: 'random_meechie' });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('MEECHIE_TOOL_PROVIDER_INVALID');
			}
		});

		it('returns MEECHIE_TOOL_PROVIDER_INVALID when headline or response is empty string', async () => {
			mockCreateChatCompletion.mockResolvedValue({
				ok: true,
				value: { model: 'test-model', content: JSON.stringify({ headline: '', response: 'Something.' }) }
			});
			const result = await meechieToolAdapter.respond({ toolId: 'random_meechie' });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('MEECHIE_TOOL_PROVIDER_INVALID');
			}
		});
	});
});
