// Purpose: Define the /api/wig-try-on endpoint request and response contract.
// Why: Keep client/server wig try-on shape deterministic and schema-validated.
// Info flow: UI selfie+wigId -> server Gemini call -> portrait base64 payload.
import { z } from 'zod';
import { resultSchema } from './shared.contract';

// Bounds the cost of the catalog lookup/comparison that runs ahead of rate
// limiting (see checkWigCatalogPreflight) and the length of any unknown ID
// echoed back in the WIG_NOT_FOUND error — far above any real catalog ID
// (longest current entry is 7 chars), so it never rejects legitimate requests.
const MAX_WIG_ID_LENGTH = 64;

export const WigTryOnRequestSchema = z.object({
	selfieBase64: z.string().min(1),
	selfieMimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
	wigId: z.string().min(1).max(MAX_WIG_ID_LENGTH)
});

export const WigTryOnResponseValueSchema = z.object({
	portraitBase64: z.string().min(1),
	portraitMimeType: z.string().min(1)
});

export const WigTryOnResultSchema = resultSchema(WigTryOnResponseValueSchema);

export type WigTryOnRequest = z.infer<typeof WigTryOnRequestSchema>;
export type WigTryOnResponseValue = z.infer<typeof WigTryOnResponseValueSchema>;
