// Purpose: Validate WigCatalogSeam inputs and outputs.
// Why: Keep runtime wig data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> typed Wig objects or errors.
import { z } from 'zod';

export const affiliateProgramSchema = z.enum(['beautyforever', 'wigsbuy', 'luvmehair']);
export const hairTypeSchema = z.enum(['human', 'synthetic', 'blend']);
export const wigLengthSchema = z.enum(['short', 'medium', 'long', 'extra-long']);
export const colorFamilySchema = z.enum(['black', 'brown', 'blonde', 'red', 'gray', 'vibrant', 'ombre']);

const packagedWigImagePathPattern = /^\/wigs\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png|webp)$/;
const absoluteHttpUrlPrefixPattern = /^https?:\/\//i;

const isAbsoluteHttpUrl = (value: string): boolean => {
  if (value !== value.trim() || !absoluteHttpUrlPrefixPattern.test(value)) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const wigImageUrlSchema = z
  .string()
  .refine(
    (value) => packagedWigImagePathPattern.test(value) || isAbsoluteHttpUrl(value),
    'Expected an absolute HTTP(S) URL or a safe packaged /wigs image path.'
  );

export const wigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().min(1),
  affiliateProgram: affiliateProgramSchema,
  affiliateUrl: z.string().url(),
  imageUrl: wigImageUrlSchema,
  priceUsd: z.number().positive(),
  style: z.string().min(1),
  hairType: hairTypeSchema,
  length: wigLengthSchema,
  color: z.string().min(1),
  colorFamily: colorFamilySchema,
  tags: z.array(z.string())
});

export const wigCatalogSchema = z.array(wigSchema);

export const validateWig = (input: unknown) => wigSchema.parse(input);
export const validateWigCatalog = (input: unknown) => wigCatalogSchema.parse(input);
