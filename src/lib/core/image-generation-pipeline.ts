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

const RESPONSE_FORMAT = 'b64_json' as const;
const DEFAULT_IMAGE_SIZE = '1024x1024';
const REQUIRED_PHRASES = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES;

const decodeBase64ToUtf8 = (b64: string): string => {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(b64, 'base64').toString('utf8');
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (error) {
    console.error('decodeBase64ToUtf8: failed to decode base64 string', error);
    return '';
  }
};

// Matches an SVG payload whose decoded text reaches an <svg> root tag after only
// a BOM/whitespace, XML declaration, comments, and/or a doctype \u2014 anchored to the
// start so an <svg substring deeper in unrelated text can't cause a false match.
// Each preamble alternative consumes up to its closing token via a negative
// lookahead (rather than a lazy [\s\S]*?) so repeated/unterminated tokens can't
// trigger catastrophic backtracking.
const SVG_TEXT_PATTERN =
  /^(?:[\s\uFEFF]|<\?xml(?:(?!\?>)[\s\S])*\?>|<!--(?:(?!-->)[\s\S])*-->|<!DOCTYPE(?:(?!>)[\s\S])*>)*<svg[\s>]/i;

type DetectedImage = Pick<GeneratedImage, 'format' | 'mimeType' | 'data' | 'encoding'>;

const WEBP_HEADER_B64_LENGTH = 16; // base64 chars covering the 12-byte RIFF size + format code

// The 5-char b64 prefix "UklGR" only constrains the top 6 of byte 3's 8 bits, so corrupt
// headers like "RIFD"/"RIFE"/"RIFG" can also match it — decode the real header bytes and
// check both the "RIFF" container signature and the "WEBP" format code exactly.
const hasWebpHeader = (b64: string): boolean => {
  const headerB64 = b64.slice(0, WEBP_HEADER_B64_LENGTH);
  if (headerB64.length < WEBP_HEADER_B64_LENGTH) return false;
  try {
    const bytes =
      typeof Buffer !== 'undefined'
        ? Buffer.from(headerB64, 'base64')
        : Uint8Array.from(atob(headerB64), (c) => c.charCodeAt(0));
    if (bytes.length < 12) return false;
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const format = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    return riff === 'RIFF' && format === 'WEBP';
  } catch (error) {
    console.error('hasWebpHeader: failed to decode base64 header', error);
    return false;
  }
};

const detectImageFromBase64 = (b64: string): DetectedImage => {
  if (b64.startsWith('/9j/')) return { format: 'jpg', mimeType: 'image/jpeg', data: b64, encoding: 'base64' };
  if (b64.startsWith('iVBORw0KGgo')) return { format: 'png', mimeType: 'image/png', data: b64, encoding: 'base64' };
  if (b64.startsWith('UklGR') && hasWebpHeader(b64)) {
    return { format: 'webp', mimeType: 'image/webp', data: b64, encoding: 'base64' };
  }
  const decoded = decodeBase64ToUtf8(b64);
  if (SVG_TEXT_PATTERN.test(decoded.slice(0, 1024))) {
    return { format: 'svg', mimeType: 'image/svg+xml', data: decoded, encoding: 'utf8' };
  }
  console.warn('detectImageFromBase64: unrecognized header, defaulting to png');
  return { format: 'png', mimeType: 'image/png', data: b64, encoding: 'base64' };
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
    const detected = detectImageFromBase64(image.b64);
    images.push({ id: `image-${index + 1}`, ...detected });
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
