// Purpose: Provide fixture data for WigTryOnSeam.
// Why: Ensure deterministic mock and test inputs without live Gemini API calls.
// Info flow: fixtures -> mocks/tests.
import type { WigTryOnRequest } from './contract';

// Minimal 1x1 transparent PNG in base64 — safe placeholder for test selfie/wig images.
const PLACEHOLDER_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export const wigTryOnRequestFixture: WigTryOnRequest = {
  selfieBase64: PLACEHOLDER_BASE64,
  selfieMimeType: 'image/png',
  wigImageBase64: PLACEHOLDER_BASE64,
  wigImageMimeType: 'image/png',
  wigName: 'Sleek Straight Goddess',
  wigStyle: 'Straight Lace Front, Natural Black, medium length'
};

export const wigTryOnHttpErrorFixture = {
  code: 'WIG_TRY_ON_HTTP_ERROR' as const,
  message: 'Gemini API returned 429 Too Many Requests',
  details: { status: '429' }
};

export const wigTryOnConfigErrorFixture = {
  code: 'WIG_TRY_ON_CONFIG_ERROR' as const,
  message: 'GEMINI_API_KEY is not set.'
};
