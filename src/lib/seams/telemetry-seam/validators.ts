// Purpose: Validate TelemetrySeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';
import { UnknownRecordSchema } from '../../../../contracts/shared.contract';

export const telemetryEventSchema = z.object({
  name: z.enum([
    'generation_requested',
    'generation_succeeded',
    'generation_failed',
    'prompt_compiler_fallback'
  ]),
  timestamp: z.string().min(1),
  metadata: UnknownRecordSchema.optional()
});

export const validateTelemetryEvent = (input: unknown) => telemetryEventSchema.parse(input);
