import { z } from 'zod';

export const safetyPolicyErrorSchema = z.object({
  code: z.enum([
    'DISALLOWED_CONTENT',
    'MISSING_OUTLINE_CONSTRAINT',
    'MISSING_NO_COLOR_CONSTRAINT'
  ]),
  message: z.string().min(1),
  details: z.array(z.string()).optional()
});

export const safetyPolicyResultSchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: safetyPolicyErrorSchema })
]);

export const validateSafetyPolicyResult = (input: unknown) => safetyPolicyResultSchema.parse(input);
