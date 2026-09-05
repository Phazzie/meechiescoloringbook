/*
 * Purpose: Re-export fixture-backed mock for ProviderAdapterSeam.
 * Why: Maintain backward compatibility for legacy contract tests and test suites.
 * Info flow: Callers -> modular provider-adapter seam mock.
 * Invariants: Delegate directly to createProviderAdapterMock in provider-adapter-seam/mock.
 */
export { createProviderAdapterMock } from '$lib/seams/provider-adapter-seam/mock';
