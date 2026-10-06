// Purpose: Prove the two content-safety checks in this app refuse the same words, in both
//          directions — every shared keyword reaches both checks, and the seam's list is the shared
//          one rather than a copy that can be widened privately.
// Why: SafetyPolicySeam guards /api/generate; findDisallowedKeywords guards /api/tools and
//      /api/meechie-studio-text. They read the same constant now, and they did not before —
//      the seam kept 'suicide' and 'extremist' in a local array, so two of the three routes
//      accepted content the third refused.
// Info flow: SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS -> both enforcement paths -> refusal assertions,
//            plus an identity check on the list the seam actually iterates.
import { describe, expect, it } from 'vitest';
import { SYSTEM_CONSTANTS, findDisallowedKeywords } from '../../src/lib/core/constants';
import {
	createSafetyPolicySeam,
	enforcedDisallowedKeywords
} from '../../src/lib/seams/safety-policy-seam/policy';
import {
	safeGenerateRequestFixture,
	safeUserRequestFixture
} from '../../src/lib/seams/safety-policy-seam/fixtures';

// The loop covers one direction: a fifth keyword added to the shared constant is enforced on both
// paths the moment it is added. It cannot, on its own, catch a keyword added to the seam *only* —
// every case here comes from the shared constant, so a privately widened seam stays green. The
// identity assertion in the block below is what closes that direction.
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
	// The reverse direction, and the only assertion that fails mechanically on the original mistake.
	// `toBe`, not `toEqual`: the defect was `[...SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS, 'suicide',
	// 'extremist']`, and a spread produces a new array. Any copy — widened or not — fails here, so
	// the seam cannot acquire a keyword the other two routes do not have.
	//
	// What this does not prove, stated rather than implied: that `hasDisallowedContent` iterates this
	// exported list. It does today, on the line below its definition. A future edit that ignored the
	// export and built a second list inside the matcher would leave this green — so the export exists
	// to be used, not merely to be read.
	it('is the shared constant the seam iterates, not a copy of it', () => {
		expect(enforcedDisallowedKeywords).toBe(SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS);
	});

	it('refuses nothing the shared list does not name', () => {
		const seam = createSafetyPolicySeam();
		for (const innocuous of ['rent', 'excuses', 'a birthday card', 'minor key', 'extremely late']) {
			expect(seam.validateUserRequest({ ...safeUserRequestFixture, description: innocuous }).ok).toBe(
				true
			);
			expect(findDisallowedKeywords({ question: innocuous })).toEqual([]);
		}
	});

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
