// Purpose: Prove the two content-safety checks in this app refuse the same words.
// Why: SafetyPolicySeam guards /api/generate; findDisallowedKeywords guards /api/tools and
//      /api/meechie-studio-text. They read the same constant now, and they did not before —
//      the seam kept 'suicide' and 'extremist' in a local array, so two of the three routes
//      accepted content the third refused.
// Info flow: SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS -> both enforcement paths -> refusal assertions.
import { describe, expect, it } from 'vitest';
import { SYSTEM_CONSTANTS, findDisallowedKeywords } from '../../src/lib/core/constants';
import { createSafetyPolicySeam } from '../../src/lib/seams/safety-policy-seam/policy';
import {
	safeGenerateRequestFixture,
	safeUserRequestFixture
} from '../../src/lib/seams/safety-policy-seam/fixtures';

// The loop is the point. A fifth keyword added to the shared constant is covered the moment it is
// added; a keyword enforced in only one of the two paths fails here rather than in production.
describe.each(SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS)('the keyword "%s"', (keyword) => {
	const seam = createSafetyPolicySeam();

	it('is refused by SafetyPolicySeam in a user request', () => {
		const result = seam.validateUserRequest({
			...safeUserRequestFixture,
			description: `a page about ${keyword}`
		});
		expect(result.ok).toBe(false);
	});

	it('is refused by SafetyPolicySeam in a generate request', () => {
		const result = seam.validateGenerateRequest({
			...safeGenerateRequestFixture,
			spec: { ...safeGenerateRequestFixture.spec, title: `a page about ${keyword}` }
		});
		expect(result.ok).toBe(false);
	});

	it('is reported by findDisallowedKeywords, which is what the other two routes call', () => {
		expect(findDisallowedKeywords({ question: `a page about ${keyword}` })).toContain(keyword);
	});
});

describe('safety keyword parity', () => {
	// Case is not the interesting part of either check — both lowercase the text they scan. What is
	// interesting is that they agree about it, because a request arrives however the reader typed it.
	it('holds regardless of how the reader capitalised the word', () => {
		const seam = createSafetyPolicySeam();
		for (const keyword of SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS) {
			const shouted = keyword.toUpperCase();
			expect(
				seam.validateUserRequest({ ...safeUserRequestFixture, description: shouted }).ok
			).toBe(false);
			expect(findDisallowedKeywords({ question: shouted })).toContain(keyword);
		}
	});

	it('leaves a request with none of the words alone', () => {
		const seam = createSafetyPolicySeam();
		expect(seam.validateUserRequest(safeUserRequestFixture)).toEqual({ ok: true });
		expect(seam.validateGenerateRequest(safeGenerateRequestFixture)).toEqual({ ok: true });
		expect(findDisallowedKeywords({ question: 'a page about paying rent on time' })).toEqual([]);
	});
});
