// Purpose: Provide fixture data for RateLimitSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { RateLimitCheckInput } from './contract';

export const baseCheckInputFixture: RateLimitCheckInput = {
  key: 'generate:127.0.0.1',
  limit: 3,
  windowMs: 60_000,
  now: 0
};

export const otherKeyCheckInputFixture: RateLimitCheckInput = {
  ...baseCheckInputFixture,
  key: 'generate:10.0.0.9'
};

export const invalidRateLimitResultFixture = {
  allowed: true,
  remaining: -1
};
