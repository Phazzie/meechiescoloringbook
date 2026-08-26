// Purpose: Verify provider errors become stable public errors without diagnostics.
// Why: Public API responses must not expose provider bodies, URLs, credentials, or tenant identifiers.
// Info flow: Internal provider failure + fallback -> exact allowlisted public error.
import { describe, expect, it } from 'vitest';
import { toPublicProviderError } from '../../src/lib/core/public-provider-error';

const providerLeakCanary =
	'RAW_PROVIDER_BODY https://api.x.ai/v1/responses?key=xai-secret-canary 550e8400-e29b-41d4-a716-446655440000 account=acct-canary team=team-canary';

describe('toPublicProviderError', () => {
	it('preserves an allowlisted code while replacing message and dropping details', () => {
		const result = toPublicProviderError(
			{
				code: 'PROVIDER_HTTP_ERROR',
				message: providerLeakCanary,
				details: { body: providerLeakCanary }
			},
			{ code: 'FALLBACK', message: 'Fallback.' }
		);

		expect(result).toEqual({
			code: 'PROVIDER_HTTP_ERROR',
			message: 'AI provider request failed.'
		});
		expect(JSON.stringify(result)).not.toContain('xai-secret-canary');
		expect(result).not.toHaveProperty('details');
	});

	it('replaces an unknown code and every diagnostic field with the caller fallback', () => {
		const result = toPublicProviderError(
			{
				code: providerLeakCanary,
				message: providerLeakCanary,
				details: { body: providerLeakCanary }
			},
			{ code: 'SAFE_FALLBACK', message: 'Safe fallback.' }
		);

		expect(result).toEqual({
			code: 'SAFE_FALLBACK',
			message: 'Safe fallback.'
		});
	});

	it('preserves the stable empty-image code used by the generation pipeline', () => {
		const result = toPublicProviderError(
			{
				code: 'PROVIDER_EMPTY_IMAGE',
				message: providerLeakCanary
			},
			{ code: 'IMAGE_GENERATION_FAILED', message: 'Image generation failed.' }
		);

		expect(result).toEqual({
			code: 'PROVIDER_EMPTY_IMAGE',
			message: 'Provider returned no images.'
		});
	});
});
