// Purpose: Mock WigTryOnSeam behavior using fixtures.
// Why: Keep tests deterministic without live Gemini API calls.
// Info flow: tests -> mock -> fixtures.
import type { WigTryOnRequest, WigTryOnResult, WigTryOnSeam } from './contract';
import type { Result } from '../../../../contracts/shared.contract';
import {
	wigTryOnHttpErrorFixture,
	wigTryOnConfigErrorFixture
} from './fixtures';

// Minimal SVG portrait as a base64 stand-in for the Gemini-generated illustrated portrait.
const buildMockPortraitBase64 = (wigName: string): string => {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">
    <rect width="400" height="500" fill="#1a1a1a"/>
    <circle cx="200" cy="180" r="80" fill="#c8a080"/>
    <rect x="100" y="80" width="200" height="120" rx="10" fill="#2a1a0a" opacity="0.8"/>
    <text x="200" y="420" text-anchor="middle" fill="#FF1493" font-size="16" font-family="sans-serif">${wigName}</text>
    <text x="200" y="450" text-anchor="middle" fill="#ffffff" font-size="12" font-family="sans-serif">Mock Try-On Portrait</text>
  </svg>`;
	return Buffer.from(svg).toString('base64');
};

export const createMockWigTryOnSeam = (
	scenario: 'sample' | 'http_error' | 'config_error' = 'sample'
): WigTryOnSeam => ({
	tryOn: async (
		request: WigTryOnRequest
	): Promise<
		Result<
			WigTryOnResult,
			typeof wigTryOnHttpErrorFixture | typeof wigTryOnConfigErrorFixture
		>
	> => {
		if (scenario === 'config_error') {
			return { ok: false, error: wigTryOnConfigErrorFixture };
		}
		if (scenario === 'http_error') {
			return { ok: false, error: wigTryOnHttpErrorFixture };
		}

		return {
			ok: true,
			value: {
				portraitBase64: buildMockPortraitBase64(request.wigName),
				portraitMimeType: 'image/svg+xml',
				timingMs: 42
			}
		};
	}
});
