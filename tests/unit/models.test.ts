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

	it('keeps the last live-verified image model until a separate probe-backed upgrade', () => {
		expect(IMAGE_MODEL).toBe('grok-imagine-image');
		expect(IMAGE_MODEL).not.toBe('grok-imagine-image-2.0');
	});

	it('pins the multi-image edit model without changing the other provider paths', () => {
		expect(IMAGE_EDIT_MODEL).toBe('grok-imagine-image-2.0');
		expect(IMAGE_MODEL).toBe('grok-imagine-image');
		expect(TEXT_MODEL).toBe('grok-4.6');
	});
});
