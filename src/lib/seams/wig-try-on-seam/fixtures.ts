// Purpose: Provide fixture data for WigTryOnSeam.
// Why: Ensure deterministic mock and test inputs without live provider calls.
// Info flow: fixtures -> mocks/tests.
import type { WigTryOnError, WigTryOnRequest, WigTryOnResult } from './contract';

// Minimal 1x1 transparent PNG in base64 — safe placeholder for test selfie/wig images.
export const WIG_TRY_ON_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export const wigTryOnRequestFixture: WigTryOnRequest = {
  selfieBase64: WIG_TRY_ON_PNG_BASE64,
  selfieMimeType: 'image/png',
  wigImageBase64: WIG_TRY_ON_PNG_BASE64,
  wigImageMimeType: 'image/png',
  wigName: 'Sleek Straight Goddess',
  wigStyle: 'Straight Lace Front, Natural Black, medium length'
};

export const wigTryOnPortraitFixture: WigTryOnResult = {
  portraitBase64: WIG_TRY_ON_PNG_BASE64,
  portraitMimeType: 'image/png',
  timingMs: 42
};

export const wigTryOnFaultResultFixture = {
  portraitBase64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64'),
  portraitMimeType: 'image/svg+xml',
  timingMs: 42
};

export const wigTryOnHttpErrorFixture = {
  code: 'WIG_TRY_ON_HTTP_ERROR' as const,
  message: 'Image-edit provider rejected the request.',
  details: { status: '429' }
} satisfies WigTryOnError;

export const wigTryOnConfigErrorFixture = {
  code: 'WIG_TRY_ON_CONFIG_ERROR' as const,
  message: 'Image-edit provider configuration is unavailable.'
} satisfies WigTryOnError;

export const wigTryOnValidationErrorFixture = {
  code: 'WIG_TRY_ON_VALIDATION_ERROR' as const,
  message: 'Wig try-on request failed validation.'
} satisfies WigTryOnError;

export const wigTryOnNetworkErrorFixture = {
  code: 'WIG_TRY_ON_NETWORK_ERROR' as const,
  message: 'Image-edit provider network request failed.'
} satisfies WigTryOnError;

export const wigTryOnEmptyResponseFixture = {
  code: 'WIG_TRY_ON_EMPTY_RESPONSE' as const,
  message: 'Image-edit provider returned no portrait.'
} satisfies WigTryOnError;

export const wigTryOnParseErrorFixture = {
  code: 'WIG_TRY_ON_PARSE_ERROR' as const,
  message: 'Image-edit provider returned an unreadable response.'
} satisfies WigTryOnError;

export const wigTryOnTimeoutErrorFixture = {
  code: 'WIG_TRY_ON_TIMEOUT_ERROR' as const,
  message: 'Wig try-on request timed out.'
} satisfies WigTryOnError;

export const wigTryOnAbortedErrorFixture = {
  code: 'WIG_TRY_ON_ABORTED' as const,
  message: 'Wig try-on request was canceled by the caller.'
} satisfies WigTryOnError;
