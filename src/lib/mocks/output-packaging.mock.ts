/*
 * Purpose: Re-export fixture-backed mock for OutputPackagingSeam.
 * Why: Maintain backward compatibility for legacy contract tests and test suites.
 * Info flow: Callers -> modular output-packaging seam mock.
 * Invariants: Delegate directly to createOutputPackagingMock in output-packaging-seam/mock.
 */
export { createOutputPackagingMock } from '$lib/seams/output-packaging-seam/mock';
