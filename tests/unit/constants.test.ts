// Purpose: Unit tests for system constants structure and safety keywords.
// Why: Ensure required prompt phrases and disallowed keywords are present and non-empty.
// Info flow: SYSTEM_CONSTANTS -> structure/content assertions.
import { describe, expect, it } from 'vitest';
import { SYSTEM_CONSTANTS } from '../../src/lib/core/constants';

describe('SYSTEM_CONSTANTS', () => {
	describe('REQUIRED_PROMPT_PHRASES', () => {
		it('is a non-empty array', () => {
			expect(Array.isArray(SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES)).toBe(true);
			expect(SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES.length).toBeGreaterThan(0);
		});

		it('contains the core coloring book phrase', () => {
			expect(SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES).toContain(
				'Black-and-white coloring book page'
			);
		});

		it('contains the outline-only phrase', () => {
			expect(SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES).toContain('outline-only');
		});

		it('contains the easy to color phrase', () => {
			expect(SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES).toContain('easy to color');
		});

		it('contains the vector linework phrase', () => {
			expect(SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES).toContain(
				'Crisp vector-like linework'
			);
		});

		it('contains the negative prompt heading', () => {
			expect(SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES).toContain('NEGATIVE PROMPT:');
		});

		it('every phrase is a non-empty string', () => {
			for (const phrase of SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES) {
				expect(typeof phrase).toBe('string');
				expect(phrase.length).toBeGreaterThan(0);
			}
		});
	});

	describe('DISALLOWED_KEYWORDS', () => {
		it('is a non-empty array', () => {
			expect(Array.isArray(SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS)).toBe(true);
			expect(SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS.length).toBeGreaterThan(0);
		});

		it('contains known safety keywords', () => {
			const keywords = SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS;
			expect(keywords).toContain('nude');
			expect(keywords).toContain('minors');
			expect(keywords).toContain('self-harm');
		});

		it('every keyword is a non-empty lowercase string', () => {
			for (const keyword of SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS) {
				expect(typeof keyword).toBe('string');
				expect(keyword.length).toBeGreaterThan(0);
				expect(keyword).toBe(keyword.toLowerCase());
			}
		});
	});

	describe('CHAT_SYSTEM_PROMPT', () => {
		it('is a non-empty string', () => {
			expect(typeof SYSTEM_CONSTANTS.CHAT_SYSTEM_PROMPT).toBe('string');
			expect(SYSTEM_CONSTANTS.CHAT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
		});

		it('instructs JSON-only output', () => {
			expect(SYSTEM_CONSTANTS.CHAT_SYSTEM_PROMPT).toContain('Output ONLY JSON');
		});

		it('references ColoringPageSpec schema', () => {
			expect(SYSTEM_CONSTANTS.CHAT_SYSTEM_PROMPT).toContain('ColoringPageSpec');
		});

		it('defines default values', () => {
			expect(SYSTEM_CONSTANTS.CHAT_SYSTEM_PROMPT).toContain('Default values when unspecified');
		});

		it('includes item constraints', () => {
			expect(SYSTEM_CONSTANTS.CHAT_SYSTEM_PROMPT).toContain('items: 1-20 items');
		});
	});
});
