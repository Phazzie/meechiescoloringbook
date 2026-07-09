// Purpose: Per-route request budgets for the shared RateLimitSeam guard.
// Why: Centralize limit/window tuning instead of scattering magic numbers across route handlers.
// Info flow: route handler -> lookup config by route name -> enforceRateLimit.
import type { RateLimitRouteConfig } from './rate-limit-guard';

const ONE_MINUTE_MS = 60_000;

// Image/portrait generation calls the priciest provider requests (xAI/Gemini image models).
export const GENERATE_RATE_LIMIT: RateLimitRouteConfig = { limit: 8, windowMs: ONE_MINUTE_MS };
export const IMAGE_GENERATION_RATE_LIMIT: RateLimitRouteConfig = { limit: 8, windowMs: ONE_MINUTE_MS };
export const WIG_TRY_ON_RATE_LIMIT: RateLimitRouteConfig = { limit: 8, windowMs: ONE_MINUTE_MS };

// Text-only provider calls are cheaper per-call; allow a higher budget.
export const CHAT_INTERPRETATION_RATE_LIMIT: RateLimitRouteConfig = { limit: 20, windowMs: ONE_MINUTE_MS };
export const MEECHIE_STUDIO_TEXT_RATE_LIMIT: RateLimitRouteConfig = { limit: 20, windowMs: ONE_MINUTE_MS };
