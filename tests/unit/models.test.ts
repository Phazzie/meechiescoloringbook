/*
 * Purpose: Lock the pinned xAI text model id.
 * Why: xAI retired grok-4-1-fast-reasoning and every text call began returning HTTP 400.
 *      The id is pinned in code rather than read from XAI_TEXT_MODEL so a stale deployment
 *      variable can never silently override it again.
 * Info flow: TEXT_MODEL constant -> chat/tool/studio pipelines -> provider request.
 */
import { describe, expect, it } from 'vitest';
import { IMAGE_MODEL, TEXT_MODEL } from '../../src/lib/core/models';

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
});
