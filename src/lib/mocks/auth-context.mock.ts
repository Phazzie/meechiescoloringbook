/*
 * Purpose: Re-export fixture-backed mock for AuthContextSeam.
 * Why: Maintain backward compatibility for legacy contract tests and test suites.
 * Info flow: Callers -> modular auth-context seam mock.
 * Invariants: Delegate directly to createAuthContextMock in auth-context-seam/mock.
 */
export { createAuthContextMock } from '$lib/seams/auth-context-seam/mock';
