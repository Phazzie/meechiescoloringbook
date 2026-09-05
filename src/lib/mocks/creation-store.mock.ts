/*
 * Purpose: Re-export fixture-backed mock for CreationStoreSeam.
 * Why: Maintain backward compatibility for legacy contract tests and test suites.
 * Info flow: Callers -> modular creation-store seam mock.
 * Invariants: Delegate directly to createCreationStoreMock in creation-store-seam/mock.
 */
export { createCreationStoreMock } from '$lib/seams/creation-store-seam/mock';
