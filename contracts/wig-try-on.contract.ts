// Purpose: Define the /api/wig-try-on endpoint request and response contract.
// Why: Keep client/server wig try-on shape deterministic and schema-validated.
// Info flow: UI selfie+wigId -> server Gemini call -> portrait base64 payload.
import { z } from 'zod';
import { resultSchema } from './shared.contract';

// Bounds the cost of the catalog lookup/comparison that runs ahead of rate
// limiting (see checkWigCatalogPreflight) and the length of any unknown ID
// echoed back in the WIG_NOT_FOUND error — far above any real catalog ID
// (longest current entry is 7 chars), so it never rejects legitimate requests.
export const MAX_WIG_ID_LENGTH = 64;

// Bounds selfieBase64 before checkWigCatalogPreflight, which runs ahead of
// rate limiting — generous headroom above the ~11.2M-character base64 string
// a legitimate 8MB selfie produces (SelfieUpload.svelte's client-side
// MAX_SIZE_MB cap), so it never rejects legitimate requests.
// Exported for src/lib/seams/wig-try-on-seam/validators.ts, whose canonical
// wigTryOnRequestSchema validates the same `selfieBase64` field for the live Gemini adapter and
// must enforce the identical cap rather than drift from this contract's bound.
export const MAX_SELFIE_BASE64_LENGTH = 12_000_000;

export const WigTryOnRequestSchema = z.object({
	selfieBase64: z.string().min(1).max(MAX_SELFIE_BASE64_LENGTH),
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
