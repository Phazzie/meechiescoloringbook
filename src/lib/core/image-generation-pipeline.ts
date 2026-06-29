// Purpose: Centralize image-generation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin and make validation/provider behavior easier to test.
// Info flow: Raw request body -> validation -> ImageGenerationSeam -> contract-shaped response.
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import { pageSizeLine } from '$lib/core/prompt-template';
import { z } from 'zod';
import {
  ImageGenerationInputSchema,
  ImageGenerationResultSchema,
  type GeneratedImage
} from '../../../contracts/image-generation.contract';
import type { PageSize } from '../../../contracts/spec-validation.contract';
import type { ImageGenerationSeam } from '$lib/seams/image-generation-seam/contract';
import type { ImageProviderConfigSeam } from '$lib/seams/image-provider-config-seam/contract';

const RESPONSE_FORMAT = 'b64_json' as const;
const DEFAULT_IMAGE_SIZE = '1024x1024';
const REQUIRED_PHRASES = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES;

const imageFormatFromBase64 = (
  data: string
): Pick<GeneratedImage, 'format' | 'mimeType'> => {
  if (data.startsWith('/9j/')) return { format: 'jpg', mimeType: 'image/jpeg' };
  if (data.startsWith('iVBORw0KGgo')) return { format: 'png', mimeType: 'image/png' };
  console.warn('imageFormatFromBase64: unrecognized header, defaulting to png');
  return { format: 'png', mimeType: 'image/png' };
};

type ImageGenerationResult = z.infer<typeof ImageGenerationResultSchema>;

type ImagePipelineResponse = {
  status: number;
  body: ImageGenerationResult;
};

export type ImagePipelineDeps = {
  imageGenerationSeam: ImageGenerationSeam;
  signal?: AbortSignal;
};

const missingRequiredPhrases = (prompt: string, pageSize: PageSize): string[] => {
  const promptLower = prompt.toLowerCase();
  const phrases = [...REQUIRED_PHRASES, pageSizeLine(pageSize)];
  return phrases.filter((phrase) => !promptLower.includes(phrase.toLowerCase()));
};

const buildError = (
  status: number,
  code: string,
  message: string
): ImagePipelineResponse => ({
  status,
  body: {
    ok: false,
    error: {
      code,
      message
    }
  }
});

export type ImageAbortCheck = { ok: true } | { ok: false; response: ImagePipelineResponse };

// Exported so the route can short-circuit an already-aborted request before running any
// preflight checks or consuming rate-limit quota — see checkGenerateAbort in
// generate-pipeline.ts for why the internal check in runImageGenerationPipeline alone is
// no longer sufficient now that routes preflight + rate-limit ahead of the pipeline call.
export const checkImageGenerationAbort = (signal?: AbortSignal): ImageAbortCheck => {
  if (signal?.aborted) {
    return {
      ok: false,
      response: buildError(499, 'IMAGE_ABORTED', 'Image generation request was canceled by the caller.')
    };
  }
  return { ok: true };
};

export type ImageInputShapeCheck =
  | { ok: true; data: z.infer<typeof ImageGenerationInputSchema> }
  | { ok: false; response: ImagePipelineResponse };

// Exported so the route can reject schema-invalid bodies before consuming rate-limit
// quota, without duplicating the IMAGE_INPUT_INVALID code/message in two places.
export const checkImageGenerationInputShape = (body: unknown): ImageInputShapeCheck => {
  const parsedInput = ImageGenerationInputSchema.safeParse(body);
  if (!parsedInput.success) {
    return {
      ok: false,
      response: buildError(400, 'IMAGE_INPUT_INVALID', 'Image generation input is invalid.')
    };
  }
  return { ok: true, data: parsedInput.data };
};

export type ImagePromptGuardCheck = { ok: true } | { ok: false; response: ImagePipelineResponse };

// Exported so the route can reject prompts missing required phrases before consuming
// rate-limit quota, without duplicating the PROMPT_MISSING_REQUIRED_PHRASES code/message.
// missingRequiredPhrases is pure/local (string matching) — safe to run again inside
// runImageGenerationPipeline.
export const checkImageGenerationPromptGuard = (
  data: z.infer<typeof ImageGenerationInputSchema>
): ImagePromptGuardCheck => {
  const missing = missingRequiredPhrases(data.prompt, data.spec.pageSize);
  if (missing.length > 0) {
    return {
      ok: false,
      response: buildError(
        400,
        'PROMPT_MISSING_REQUIRED_PHRASES',
        `Prompt missing required phrases (case-insensitive checks, normalized): ${missing.join(', ')}`
      )
    };
  }
  return { ok: true };
};

export type ImageProviderConfigCheck = { ok: true } | { ok: false; response: ImagePipelineResponse };

// Exported so the route can reject a missing/invalid provider config (e.g. unset XAI_API_KEY)
// before consuming rate-limit quota. Without this, getConfig() throwing only surfaced inside
// ImageGenerationSeam.generate(), by which point enforceAiRateLimit had already charged a slot
// for a request that could never reach the provider.
export const checkImageGenerationProviderConfig = (
  configSeam: ImageProviderConfigSeam
): ImageProviderConfigCheck => {
  try {
    configSeam.getConfig();
    return { ok: true };
  } catch {
    return {
      ok: false,
      response: buildError(
        503,
        'IMAGE_CONFIG_ERROR',
        'Image generation configuration is invalid. Ensure XAI_API_KEY and related environment variables are set.'
      )
    };
  }
};

export const runImageGenerationPipeline = async (
  body: unknown,
  deps: ImagePipelineDeps
): Promise<ImagePipelineResponse> => {
  const abortCheck = checkImageGenerationAbort(deps.signal);
  if (!abortCheck.ok) return abortCheck.response;

  const shapeCheck = checkImageGenerationInputShape(body);
  if (!shapeCheck.ok) return shapeCheck.response;
  const parsedInput = { data: shapeCheck.data };

  const { prompt, variations } = parsedInput.data;
  const promptGuardCheck = checkImageGenerationPromptGuard(parsedInput.data);
  if (!promptGuardCheck.ok) return promptGuardCheck.response;

  const seamResult = await deps.imageGenerationSeam.generate({
    prompt,
    n: variations,
    size: DEFAULT_IMAGE_SIZE,
    format: RESPONSE_FORMAT,
    signal: deps.signal
  });

  if (!seamResult.ok) {
    const statusByCode: Record<string, number> = {
      IMAGE_ABORTED: 499,
      IMAGE_TIMEOUT_ERROR: 504,
      IMAGE_CONFIG_ERROR: 503,
      IMAGE_VALIDATION_ERROR: 400,
      IMAGE_CIRCUIT_OPEN: 503
    };
    return {
      status: statusByCode[seamResult.error.code] ?? 502,
      body: {
        ok: false,
        error: seamResult.error
      }
    };
  }

  const images: GeneratedImage[] = [];
  for (const [index, image] of seamResult.value.images.entries()) {
    if (!image.b64) {
      continue;
    }
    const format = imageFormatFromBase64(image.b64);
    images.push({
      id: `image-${index + 1}`,
      ...format,
      data: image.b64,
      encoding: 'base64'
    });
  }

  if (images.length === 0) {
    return buildError(
      502,
      'PROVIDER_EMPTY_IMAGE',
      'Provider returned no images.'
    );
  }

  const revisedPrompt =
    typeof seamResult.value.rawModelInfo.revisedPrompt === 'string'
      ? seamResult.value.rawModelInfo.revisedPrompt
      : undefined;

  const result: ImageGenerationResult = {
    ok: true,
    value: {
      images,
      revisedPrompt,
      modelMetadata: {
        provider: 'xai',
        model:
          typeof seamResult.value.rawModelInfo.model === 'string'
            ? seamResult.value.rawModelInfo.model
            : 'unknown'
      }
    }
  };

  const parsedResult = ImageGenerationResultSchema.safeParse(result);
  if (!parsedResult.success) {
    return buildError(
      500,
      'IMAGE_OUTPUT_INVALID',
      'Image generation response did not match contract.'
    );
  }

  return {
    status: 200,
    body: parsedResult.data
  };
};
