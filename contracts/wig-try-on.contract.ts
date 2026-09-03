// Purpose: Define the /api/wig-try-on endpoint request and response contract.
// Why: Keep client/server wig try-on shape deterministic and schema-validated.
// Info flow: UI selfie+wigId -> server xAI call -> portrait base64 payload.
import { z } from 'zod';
import { resultSchema } from './shared.contract';

export const WigTryOnRequestSchema = z.object({
	selfieBase64: z.string().min(1),
	selfieMimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
	wigId: z.string().min(1)
});

export const WigTryOnResponseValueSchema = z.object({
	portraitBase64: z.string().min(1),
	portraitMimeType: z.string().min(1)
});

export const WigTryOnResultSchema = resultSchema(WigTryOnResponseValueSchema);

export type WigTryOnRequest = z.infer<typeof WigTryOnRequestSchema>;
export type WigTryOnResponseValue = z.infer<typeof WigTryOnResponseValueSchema>;
