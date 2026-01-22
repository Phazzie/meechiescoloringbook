import { z } from 'zod';
import { compiledPromptSchema, promptCompilerInputSchema } from '../prompt-compiler-seam/validators';
import { generatedImageSchema } from '../image-generation-seam/validators';

export const galleryRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  request: promptCompilerInputSchema,
  compiled: compiledPromptSchema,
  images: z.array(generatedImageSchema)
});

export const validateGalleryRecord = (input: unknown) => galleryRecordSchema.parse(input);
