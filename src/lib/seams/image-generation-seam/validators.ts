// Purpose: Validate ImageGenerationSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';
import { MAX_PROMPT_LENGTH } from '../../../../contracts/image-generation.contract';

// Shared with the adapter's buildPrompt so the combined-length check below matches exactly
// what gets sent to the provider, instead of drifting from a second hardcoded copy.
export const NEGATIVE_PROMPT_SEPARATOR = '\n\nNegative prompt: ';

export const imageGenerationRequestSchema = z
  .object({
    prompt: z.string().min(1).max(MAX_PROMPT_LENGTH),
    negativePrompt: z.string().max(MAX_PROMPT_LENGTH).optional(),
    n: z.number().int().min(1).max(10),
    size: z.string().min(1),
    format: z.enum(['url', 'b64_json']),
    seed: z.number().int().optional(),
    userTag: z.string().optional()
  })
  // prompt and negativePrompt each independently satisfy MAX_PROMPT_LENGTH above, but the
  // adapter's buildPrompt concatenates them into one string sent to the provider — without
  // this check, a caller could combine two near-max-length fields into a payload roughly
  // double the intended provider prompt limit.
  .superRefine((data, ctx) => {
    if (!data.negativePrompt) return;
    const combinedLength =
      data.prompt.length + NEGATIVE_PROMPT_SEPARATOR.length + data.negativePrompt.length;
    if (combinedLength > MAX_PROMPT_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `prompt and negativePrompt combined (via the provider's "${NEGATIVE_PROMPT_SEPARATOR.trim()}" separator) must not exceed ${MAX_PROMPT_LENGTH} characters.`,
        path: ['negativePrompt']
      });
    }
  });

export const generatedImageSchema = z.object({
  id: z.string().min(1),
  url: z.string().url().optional(),
  b64: z.string().optional()
});

export const imageGenerationResultSchema = z.object({
  images: z.array(generatedImageSchema),
  rawModelInfo: z.record(z.unknown()),
  timingMs: z.number()
});

export const validateImageGenerationRequest = (input: unknown) =>
  imageGenerationRequestSchema.parse(input);

export const validateImageGenerationResult = (input: unknown) =>
  imageGenerationResultSchema.parse(input);
