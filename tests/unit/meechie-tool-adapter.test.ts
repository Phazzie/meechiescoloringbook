// Purpose: Unit tests for meechie-tool adapter covering all tool types and edge cases.
// Why: Ensure each Meechie tool produces deterministic, contract-valid output.
// Info flow: Tool inputs -> adapter -> verified outputs for all 9 tool types.
import { describe, expect, it } from 'vitest';
import { meechieToolAdapter } from '../../src/lib/adapters/meechie-tool.adapter';

describe('meechie-tool adapter', () => {
	describe('apology_translator', () => {
		it('translates known apology with exact match', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'apology_translator',
				apology: "I'm sorry you feel that way"
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolId).toBe('apology_translator');
				expect(result.value.headline).toBe('What That Really Meant');
				expect(result.value.response).toContain('not sorry');
			}
		});

		it('translates second known apology', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'apology_translator',
				apology: "It won't happen again"
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.response).toContain('happen again');
			}
		});

		it('returns fallback for unknown apology', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'apology_translator',
				apology: 'My bad for everything'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.response).toContain('paperwork');
			}
		});
	});

	describe('red_flag_or_run', () => {
		it('classifies run scenario correctly', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'red_flag_or_run',
				situation: 'He is not looking for anything serious right now'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.headline).toBe('Run');
			}
		});

		it('classifies flag scenario with ex keyword', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'red_flag_or_run',
				situation: 'He still has photos of his ex everywhere'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.headline).toBe('Red flag');
				expect(result.value.response).toContain('ex');
			}
		});

		it('returns default response for ambiguous situation', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'red_flag_or_run',
				situation: 'He is always busy with meetings'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.headline).toBe('Red flag');
				expect(result.value.response).toContain('names');
			}
		});
	});

	describe('wwmd', () => {
		it('matches trigger with includesAny keyword', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'wwmd',
				dilemma: 'He sent me a hey stranger text'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.headline).toBe('Meechie Move');
				expect(result.value.response).toContain('resurfaced');
			}
		});

		it('matches trigger with includesAll keywords', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'wwmd',
				dilemma: 'He said he was working late but I saw him at the club'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.response).toContain('work');
			}
		});

		it('returns fallback for unmatched dilemma', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'wwmd',
				dilemma: 'Should I move to a new city for a fresh start?'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.response).toContain('boundary');
			}
		});
	});

	describe('lineup', () => {
		it('ranks items with ordinal suffixes', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'lineup',
				prompt: 'Rate these excuses',
				items: ['Traffic', 'Phone died', 'Overslept']
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.headline).toBe('Ranked and Ruled');
				expect(result.value.response).toContain('1st place');
				expect(result.value.response).toContain('2nd place');
				expect(result.value.response).toContain('3rd place');
			}
		});

		it('uses th suffix for 4th+ items', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'lineup',
				prompt: 'Rank these',
				items: ['A', 'B', 'C', 'D']
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.response).toContain('4th place');
			}
		});

		it('returns error for lineup with fewer than minimum items', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'lineup',
				prompt: 'Rate this excuse',
				items: ['Traffic']
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('LINEUP_TOO_SHORT');
			}
		});
	});

	describe('horoscope', () => {
		it('returns horoscope for known sign', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'horoscope',
				sign: 'Leo'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.headline).toContain('Leo');
				expect(result.value.response).toContain('headline');
			}
		});

		it('returns horoscope for each zodiac sign', async () => {
			const signs = [
				'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
				'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
			] as const;
			for (const sign of signs) {
				const result = await meechieToolAdapter.respond({
					toolId: 'horoscope',
					sign
				});
				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.toolId).toBe('horoscope');
					expect(result.value.headline).toContain(sign);
					expect(result.value.response.length).toBeGreaterThan(0);
				}
			}
		});
	});

	describe('receipts', () => {
		it('interpolates claim and reality into template', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'receipts',
				claim: 'He said he was at work',
				reality: 'His location showed the mall'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.headline).toBe('Paper Trail');
				expect(result.value.response).toContain('He said he was at work');
				expect(result.value.response).toContain('His location showed the mall');
				expect(result.value.response).toContain('Court is in session');
			}
		});
	});

	describe('caption_this', () => {
		it('interpolates moment into template', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'caption_this',
				moment: 'Walking out of that meeting like a boss'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.headline).toBe('Caption Locked');
				expect(result.value.response).toContain('Walking out of that meeting like a boss');
				expect(result.value.response).toContain('pretty, paid');
			}
		});
	});

	describe('clapback', () => {
		it('interpolates comment into template', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'clapback',
				comment: 'You think you are better than everyone'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.headline).toBe('Return Fire');
				expect(result.value.response).toContain('You think you are better than everyone');
				expect(result.value.response).toContain('cheap seats');
			}
		});
	});

	describe('meechie_explains', () => {
		it('returns known term definition', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'meechie_explains',
				term: 'situationship'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.headline).toBe('Street Glossary');
				expect(result.value.response).toContain('renting access');
			}
		});

		it('returns known definition for gaslighting', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'meechie_explains',
				term: 'gaslighting'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.response).toContain('lies');
			}
		});

		it('returns fallback for unknown term', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'meechie_explains',
				term: 'benching'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.response).toContain('benching');
				expect(result.value.response).toContain('free trial');
			}
		});
	});

	describe('whitespace normalization', () => {
		it('normalizes extra whitespace in apology input', async () => {
			const result = await meechieToolAdapter.respond({
				toolId: 'apology_translator',
				apology: "  I'm   sorry  you   feel   that   way  "
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.response).toContain('not sorry');
			}
		});
	});
});


	describe('random_meechie', () => {
		it('returns curated saying with machine-readable quote score details', async () => {
			const result = await meechieToolAdapter.respond({ toolId: 'random_meechie' });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.quoteScore).toBeDefined();
				expect(result.value.quoteScore?.subscores).toHaveLength(10);
				expect(result.value.quoteScore?.reasons.length).toBeGreaterThan(0);
			}
		});
	});
