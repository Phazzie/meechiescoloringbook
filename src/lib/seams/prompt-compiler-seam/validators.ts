// Purpose: Validate PromptCompilerSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';

export const promptCompilerInputSchema = z.object({
  description: z.string().min(1),
  glamLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  density: z.enum(['simple', 'medium', 'busy']),
  lineThickness: z.enum(['thin', 'medium', 'thick']),
  borderStyle: z.enum(['none', 'simple', 'glam']),
  addCaption: z.boolean(),
  captionText: z.string().optional()
});

export const promptCompilerMetadataSchema = z.object({
  glamLevel: z.number(),
  density: z.enum(['simple', 'medium', 'busy']),
  lineThickness: z.enum(['thin', 'medium', 'thick']),
  borderStyle: z.enum(['none', 'simple', 'glam']),
  captionText: z.string().optional(),
  stylePreset: z.string(),
  enforcedConstraints: z.array(z.string())
});

export const compiledPromptSchema = z.object({
  imagePrompt: z.string().min(1),
  negativePrompt: z.string().min(1),
  metadata: promptCompilerMetadataSchema
});

export const validatePromptCompilerInput = (input: unknown) =>
  promptCompilerInputSchema.parse(input);

export const validateCompiledPrompt = (input: unknown) => compiledPromptSchema.parse(input);
