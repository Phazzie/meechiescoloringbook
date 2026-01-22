import { z } from 'zod';

export const telemetryEventSchema = z.object({
  name: z.enum([
    'generation_requested',
    'generation_succeeded',
    'generation_failed',
    'prompt_compiler_fallback'
  ]),
  timestamp: z.string().min(1),
  metadata: z.record(z.unknown()).optional()
});

export const validateTelemetryEvent = (input: unknown) => telemetryEventSchema.parse(input);
