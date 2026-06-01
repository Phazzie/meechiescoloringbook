// Purpose: Define ImageGenerationSeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests.
//
// NOTE on naming: ProviderImage is the raw image token the xAI provider returns.
// The discriminated union enforces that exactly one representation is present
// (url for link-format responses, b64 for base64-format responses). It is NOT
// the same as GeneratedImage in contracts/image-generation.contract.ts, which is
// the fully-normalized API wire format (id + format + mimeType + data + encoding)
// that the pipeline builds before sending to the client. The pipeline is the
// translation boundary.
import type { Result } from '../../../../contracts/shared.contract';

export type ImageFormat = 'url' | 'b64_json';

export type ImageGenerationRequest = {
  prompt: string;
  negativePrompt?: string;
  n: number;
  size: string;
  format: ImageFormat;
  seed?: number;
  userTag?: string;
};

export type ProviderImage =
  | { id: string; url: string; b64?: never }
  | { id: string; b64: string; url?: never };

export type ImageGenerationResult = {
  images: ProviderImage[];
  rawModelInfo: Record<string, unknown>;
  timingMs: number;
};

// IMAGE_CONFIG_ERROR: config/env validation failures (distinct from request validation).
// IMAGE_VALIDATION_ERROR: request payload validation failures.
export type ImageGenerationError =
  | { code: 'IMAGE_VALIDATION_ERROR'; message: string }
  | { code: 'IMAGE_CONFIG_ERROR'; message: string }
  | { code: 'IMAGE_HTTP_ERROR'; message: string; details?: Record<string, string> }
  | { code: 'IMAGE_NETWORK_ERROR'; message: string }
  | { code: 'IMAGE_EMPTY_RESPONSE'; message: string };

export type ImageGenerationSeam = {
  generate: (request: ImageGenerationRequest) => Promise<Result<ImageGenerationResult, ImageGenerationError>>;
};
