/*
 * Purpose: Lock the pinned xAI text, image-generation, and image-edit model ids.
 * Why: Each provider path has a separately verified model id, so changing the wig-edit model
 *      must not silently alter the working text or image-generation paths.
 * Info flow: model constants -> these assertions -> provider adapters use the proven pins.
 */
import { describe, expect, it } from 'vitest';
import { IMAGE_EDIT_MODEL, IMAGE_MODEL, TEXT_MODEL } from '../../src/lib/core/models';

describe('TEXT_MODEL', () => {
	it('pins a current xAI text model', () => {
		expect(TEXT_MODEL).toBe('grok-4.6');
	});

	it('is not any retired model id', () => {
		expect(TEXT_MODEL).not.toBe('grok-4-1-fast-reasoning');
	});

	// This assertion used to pin 'grok-imagine-image' and explicitly reject the 2.0 id, to stop
	// an upgrade nobody had measured. That guard did its job: it held the line until the probe
	// existed. On 2026-08-26 both models were driven through POST /v1/images/generations with a
	// representative coloring-page prompt, twice each. The old model rendered the title and then
	// filled the item list with hallucinated near-misses of it ('HE FIONE DIED', 'TK IONE DIED'),
	// which is not a page anyone can colour; 2.0 produced correct text or clean write-in lines in
	// every sample. The pin moved because of that evidence, not because 2.0 is newer.
	it('pins the probe-verified image-generation model', () => {
		expect(IMAGE_MODEL).toBe('grok-imagine-image-2.0');
		expect(IMAGE_MODEL).not.toBe('grok-4-1-fast-reasoning');
	});

	// Generation and edit now share a model id, which is fine, but they are still separate pins.
	// Keep them asserted independently so that changing one path can never silently move the
	// other - that separation is the whole reason this file exists.
	it('pins each provider path independently', () => {
		expect(IMAGE_EDIT_MODEL).toBe('grok-imagine-image-2.0');
		expect(IMAGE_MODEL).toBe('grok-imagine-image-2.0');
		expect(TEXT_MODEL).toBe('grok-4.6');
	});
});
