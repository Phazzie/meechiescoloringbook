// Purpose: Build a consistent 429 response for RateLimitSeam rejections.
// Why: Keep every API route's rate-limit response shape (status, body, Retry-After) identical.
// Info flow: RateLimitError -> JSON Response with Retry-After header.
import { json } from '@sveltejs/kit';
import type { RateLimitError } from '../seams/rate-limit-seam/contract';

export const rateLimitedResponse = (error: RateLimitError) =>
	json(
		{ ok: false, error: { code: error.code, message: error.message } },
		{
			status: 429,
			headers: { 'Retry-After': String(Math.max(1, Math.ceil(error.retryAfterMs / 1000))) }
		}
	);
