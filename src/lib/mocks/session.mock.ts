/*
 * Purpose: Re-export fixture-backed mock for SessionSeam.
 * Why: Maintain backward compatibility for legacy contract tests and test suites.
 * Info flow: Callers -> modular session seam mock.
 * Invariants: Delegate directly to createSessionMock in session-seam/mock.
 */
export { createSessionMock } from '$lib/seams/session-seam/mock';
