// Purpose: Provide fixture data for RateLimitSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { RateLimitCheckInput } from './contract';

export const baseRateLimitCheckFixture: RateLimitCheckInput = {
	key: '203.0.113.10',
	maxRequests: 3,
	windowMs: 60_000,
	now: 1_000_000
};

export const exceededRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	now: baseRateLimitCheckFixture.now + 1
};

export const nextWindowRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	now: baseRateLimitCheckFixture.now + baseRateLimitCheckFixture.windowMs
};

// Fault fixtures: non-positive maxRequests/windowMs must fail closed rather than
// allow unlimited requests or divide by a degenerate window.
export const invalidMaxRequestsRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	maxRequests: 0
};

export const invalidWindowMsRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	windowMs: 0
};

// Infinity is not < 1, so it must be rejected by an explicit finiteness check —
// otherwise it disables blocking (maxRequests: Infinity) or window resets
// (windowMs: Infinity) instead of failing closed.
export const infiniteMaxRequestsRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	maxRequests: Infinity
};

export const infiniteWindowMsRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	windowMs: Infinity
};

// A backward clock step (NTP correction) must land before the exhausted
// window's start, not just outside its forward span — otherwise the stale,
// already-exhausted window is reused and the client is locked out for longer
// than windowMs instead of getting a fresh window.
export const backwardClockRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	now: baseRateLimitCheckFixture.now - 1_000
};

// Fractional bounds pass the finiteness/>=1 check but are not integers — a
// direct contract caller (the seam type accepts plain `number`) must still be
// rejected, since allowing them through can produce fractional remaining/resetAt
// values that violate the RateLimitResult integer contract.
export const fractionalMaxRequestsRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	maxRequests: 1.5
};

export const fractionalWindowMsRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	windowMs: 1.5
};

// now is also just `number` on the contract, so a direct caller passing a
// fractional, negative, or non-finite clock value must fail closed too —
// otherwise it is stored as windowStart/used to compute resetAt and breaks
// the RateLimitResult integer/non-negative contract.
export const fractionalNowRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	now: 1.5
};

export const negativeNowRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	now: -1
};

export const infiniteNowRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	now: Infinity
};

export const nanNowRateLimitCheckFixture: RateLimitCheckInput = {
	...baseRateLimitCheckFixture,
	now: NaN
};
