// Purpose: Document RateLimitSeam probe strategy.
// Why: The limiter is pure in-process state driven by an injectable clock; there is no external
//      system to probe (no network, filesystem, or third-party service involved).
// Info flow: N/A — deterministic unit tests in test.ts cover all limiter behavior directly.
