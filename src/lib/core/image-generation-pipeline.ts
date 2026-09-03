// Purpose: Centralize image-generation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin and make validation/provider behavior easier to test.
// Info flow: Raw request body -> validation -> quota charge (or precharged headers) -> ImageGenerationSeam -> contract-shaped response.
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import { pageSizeLine } from '$lib/core/prompt-template';
import { toPublicProviderError } from '$lib/core/public-provider-error';
// Type-only: erased at build time, so the deterministic core keeps no runtime edge into $lib/server.
import type { QuotaDecision, QuotaGate } from '$lib/server/rate-limit-route';
import { z } from 'zod';
import {
  ImageGenerationInputSchema,
  ImageGenerationResultSchema,
  type GeneratedImage
} from '../../../contracts/image-generation.contract';
import type { PageSize } from '../../../contracts/spec-validation.contract';
import type { ImageGenerationSeam } from '$lib/seams/image-generation-seam/contract';

const RESPONSE_FORMAT = 'b64_json' as const;
const DEFAULT_IMAGE_SIZE = '1024x1024';
const REQUIRED_PHRASES = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES;

const imageFormatFromBase64 = (
  data: string
): Pick<GeneratedImage, 'format' | 'mimeType'> => {
  if (data.startsWith('/9j/')) return { format: 'jpg', mimeType: 'image/jpeg' };
  if (data.startsWith('iVBORw0KGgo'))
    return { format: 'png', mimeType: 'image/png' };
  return { format: 'png', mimeType: 'image/png' };
};

type ImageGenerationResult = z.infer<typeof ImageGenerationResultSchema>;

type ImagePipelineResponse = {
  status: number;
  body: ImageGenerationResult;
  /** Rate-limit headers from the guard, verbatim. Present on every post-charge response. */
  headers?: Record<string, string>;
};

/**
 * How this run pays for its images. Required and closed on purpose: `charge` meters the caller
 * here, `precharged` means an outer pipeline already spent the units for this exact request and
 * hands down the headers its own decision produced. There is deliberately no third case - no
 * "skip", no optional gate - so an unmetered image call cannot be expressed at all, and
 * /api/generate cannot bill one user request twice.
 */
export type ImageQuota =
  | { mode: 'charge'; consumeQuota: QuotaGate }
  | { mode: 'precharged'; headers: Record<string, string> };

export type ImagePipelineDeps = {
  imageGenerationSeam: ImageGenerationSeam;
  /** Required. A caller that forgets it fails to typecheck rather than generating for free. */
  quota: ImageQuota;
  signal?: AbortSignal;
};

/**
 * `charge` spends the units now; `precharged` reuses the outer decision without touching the
 * store, so the second consumer of an already-paid-for request never double-charges.
 */
const resolveQuota = async (
  quota: ImageQuota,
  cost: number
): Promise<QuotaDecision> =>
  quota.mode === 'charge'
    ? quota.consumeQuota(cost)
    : { ok: true, headers: quota.headers };

const missingRequiredPhrases = (
  prompt: string,
  pageSize: PageSize
): string[] => {
  const promptLower = prompt.toLowerCase();
  const phrases = [...REQUIRED_PHRASES, pageSizeLine(pageSize)];
  return phrases.filter(
    (phrase) => !promptLower.includes(phrase.toLowerCase())
  );
};

const buildError = (
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>
): ImagePipelineResponse => ({
  status,
  body: {
    ok: false,
    error: {
      code,
      message
    }
  },
  ...(headers ? { headers } : {})
});

export const runImageGenerationPipeline = async (
  body: unknown,
  deps: ImagePipelineDeps
): Promise<ImagePipelineResponse> => {
  if (deps.signal?.aborted) {
    return buildError(
      499,
      'IMAGE_ABORTED',
      'Image generation request was canceled by the caller.'
    );
  }

  const parsedInput = ImageGenerationInputSchema.safeParse(body);
  if (!parsedInput.success) {
    return buildError(
      400,
      'IMAGE_INPUT_INVALID',
      'Image generation input is invalid.'
    );
  }

  const { prompt, variations, spec } = parsedInput.data;
  const missing = missingRequiredPhrases(prompt, spec.pageSize);
  if (missing.length > 0) {
    return buildError(
      400,
      'PROMPT_MISSING_REQUIRED_PHRASES',
      `Prompt missing required phrases (case-insensitive checks, normalized): ${missing.join(', ')}`
    );
  }

  // Charge here and nowhere else: the abort check, the schema parse and the required-phrase
  // check above all reject for free, and nothing below reaches the provider unmetered. The cost
  // is `variations` because that value is the provider's `n` on the very next line - a request
  // for four images spends four units, not one.
  const quota = await resolveQuota(deps.quota, variations);
  // Verbatim from the gate. Retry-After and the reset window come from the store's own instant;
  // recomputing them here would drift from the bucket that issued them.
  const quotaHeaders = quota.headers;
  if (!quota.ok) {
    return { status: quota.status, body: quota.body, headers: quotaHeaders };
  }

  // Every response from here on is post-charge, so it advertises the caller's remaining quota.
  const withQuotaHeaders = (
    response: ImagePipelineResponse
  ): ImagePipelineResponse => ({ ...response, headers: quotaHeaders });

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
      IMAGE_VALIDATION_ERROR: 400
    };
    const publicError = toPublicProviderError(seamResult.error, {
      code: 'IMAGE_GENERATION_FAILED',
      message: 'Image generation failed.'
    });
    return withQuotaHeaders({
      status: statusByCode[seamResult.error.code] ?? 502,
      body: {
        ok: false,
        error: publicError
      }
    });
  }

  const images: GeneratedImage[] = [];
  for (const image of seamResult.value.images) {
    if (!image.b64) {
      continue;
    }
    const format = imageFormatFromBase64(image.b64);
    images.push({
      // Numbered by position in this filtered, output-facing array, not the provider's
      // original index — a provider entry dropped for missing b64 must not leave a gap
      // (e.g. only "image-2" surviving with no "image-1" ever emitted).
      id: `image-${images.length + 1}`,
      ...format,
      data: image.b64,
      encoding: 'base64'
    });
  }

  if (images.length === 0) {
    return buildError(
      502,
      'PROVIDER_EMPTY_IMAGE',
      'Provider returned no images.',
      quotaHeaders
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
      'Image generation response did not match contract.',
      quotaHeaders
    );
  }

  return {
    status: 200,
    body: parsedResult.data,
    headers: quotaHeaders
  };
};
