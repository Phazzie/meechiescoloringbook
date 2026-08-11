// Purpose: Define ImageGenerationSeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests.
import type { Result } from '../../../../contracts/shared.contract';

export type ImageFormat = 'url' | 'b64_json';

export type ImageGenerationRequest = {
  prompt: string;
  negativePrompt?: string;
  n: number;
  aspectRatio: string;
  resolution: string;
  format: ImageFormat;
  seed?: number;
  userTag?: string;
  signal?: AbortSignal;
};

export type GeneratedImage = {
  id: string;
  url?: string;
  b64?: string;
};

export type ImageGenerationResult = {
  images: GeneratedImage[];
  rawModelInfo: Record<string, unknown>;
  timingMs: number;
};

// IMAGE_CONFIG_ERROR: config/env validation failures (distinct from request validation).
// IMAGE_VALIDATION_ERROR: request payload validation failures.
// IMAGE_TIMEOUT_ERROR: provider request timed out before the response was fully read.
// IMAGE_ABORTED: caller canceled the request before completion.
export type ImageGenerationError =
  | { code: 'IMAGE_VALIDATION_ERROR'; message: string }
  | { code: 'IMAGE_CONFIG_ERROR'; message: string }
  | { code: 'IMAGE_HTTP_ERROR'; message: string; details?: Record<string, string> }
  | { code: 'IMAGE_TIMEOUT_ERROR'; message: string }
  | { code: 'IMAGE_ABORTED'; message: string }
  | { code: 'IMAGE_NETWORK_ERROR'; message: string }
  | { code: 'IMAGE_EMPTY_RESPONSE'; message: string };

export type ImageGenerationSeam = {
  generate: (request: ImageGenerationRequest) => Promise<Result<ImageGenerationResult, ImageGenerationError>>;
};
