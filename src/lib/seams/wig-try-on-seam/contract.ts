// Purpose: Define WigTryOnSeam contract types.
// Why: Keep AI try-on interface explicit and swappable across Gemini / fallback providers.
// Info flow: selfie + wig image -> Gemini multi-image API -> illustrated portrait Result.
import type { Result } from '../../../../contracts/shared.contract';

export type WigTryOnRequest = {
  selfieBase64: string;
  selfieMimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  wigImageBase64: string;
  wigImageMimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  wigName: string;
  wigStyle: string;
  signal?: AbortSignal;
};

export type WigTryOnResult = {
  portraitBase64: string;
  portraitMimeType: string;
  timingMs: number;
};

export type WigTryOnError =
  | { code: 'WIG_TRY_ON_CONFIG_ERROR'; message: string }
  | { code: 'WIG_TRY_ON_VALIDATION_ERROR'; message: string }
  | { code: 'WIG_TRY_ON_HTTP_ERROR'; message: string; details?: Record<string, string> }
  | { code: 'WIG_TRY_ON_NETWORK_ERROR'; message: string }
  | { code: 'WIG_TRY_ON_EMPTY_RESPONSE'; message: string }
  | { code: 'WIG_TRY_ON_PARSE_ERROR'; message: string };

export type WigTryOnSeam = {
  tryOn: (request: WigTryOnRequest) => Promise<Result<WigTryOnResult, WigTryOnError>>;
};
