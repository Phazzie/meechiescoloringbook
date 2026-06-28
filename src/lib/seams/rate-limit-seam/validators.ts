// Purpose: Validate RateLimitSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';

export const rateLimitCheckInputSchema = z.object({
  key: z.string().min(1),
  limit: z.number().int().positive(),
  windowMs: z.number().int().positive(),
  now: z.number().int().nonnegative()
});

export const rateLimitResultSchema = z.union([
  z.object({ allowed: z.literal(true), remaining: z.number().int().nonnegative() }),
  z.object({
    allowed: z.literal(false),
    remaining: z.literal(0),
    retryAfterMs: z.number().int().positive()
  })
]);

export const validateRateLimitResult = (input: unknown) => rateLimitResultSchema.parse(input);
