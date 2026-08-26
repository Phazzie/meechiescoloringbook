// Purpose: Define provider-neutral WigTryOnSeam contract types.
// Why: Keep the try-on interface explicit while allowing the backing image-edit provider to change.
// Info flow: selfie + wig image -> image-edit adapter -> raster portrait Result.
import type { Result } from '../../../../contracts/shared.contract';

export type WigTryOnMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export type WigTryOnRequest = {
  selfieBase64: string;
  selfieMimeType: WigTryOnMimeType;
  wigImageBase64: string;
  wigImageMimeType: WigTryOnMimeType;
  /**
   * Catalogue display name, e.g. "Honey Blonde Bombshell". Carried across the seam because the
   * wig photo alone is not enough: the product shots are lit with pink neon, and an image-edit
   * model reads that cast as the hair colour unless the real colour is also stated in words.
   */
  wigName: string;
  /**
   * Catalogue style descriptor in words, e.g. "Layered Lace Front, Honey Blonde, medium length".
   * Same reason as `wigName` — it is the only colour and texture signal the model can trust.
   */
  wigStyle: string;
  signal?: AbortSignal;
};

export type WigTryOnResult = {
  portraitBase64: string;
  // Runtime validation narrows provider output to WigTryOnMimeType before public use.
  portraitMimeType: string;
  timingMs: number;
};

export type WigTryOnError =
  | { code: 'WIG_TRY_ON_CONFIG_ERROR'; message: string }
  | { code: 'WIG_TRY_ON_VALIDATION_ERROR'; message: string }
  | { code: 'WIG_TRY_ON_HTTP_ERROR'; message: string; details?: Record<string, string> }
  | { code: 'WIG_TRY_ON_TIMEOUT_ERROR'; message: string }
  | { code: 'WIG_TRY_ON_ABORTED'; message: string }
  | { code: 'WIG_TRY_ON_NETWORK_ERROR'; message: string }
  | { code: 'WIG_TRY_ON_EMPTY_RESPONSE'; message: string }
  | { code: 'WIG_TRY_ON_PARSE_ERROR'; message: string };

export type WigTryOnSeam = {
  tryOn: (request: WigTryOnRequest) => Promise<Result<WigTryOnResult, WigTryOnError>>;
};
