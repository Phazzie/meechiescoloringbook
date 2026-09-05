/*
 * Purpose: Re-export fixture-backed mock for MeechieStudioTextSeam.
 * Why: Maintain backward compatibility for legacy contract tests and test suites.
 * Info flow: Callers -> modular meechie-studio-text seam mock.
 * Invariants: Delegate directly to createMeechieStudioTextMock in meechie-studio-text-seam/mock.
 */
export { createMeechieStudioTextMock } from '$lib/seams/meechie-studio-text-seam/mock';
