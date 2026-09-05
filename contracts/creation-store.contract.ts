/*
 * Purpose: Legacy compatibility re-export for CreationStoreSeam contract.
 * Why: Support legacy import paths while routing to self-contained seam module.
 * Info flow: Legacy consumers -> contracts/creation-store.contract.ts -> src/lib/seams/creation-store-seam/contract.ts.
 * Invariants: Must preserve identical exported schemas, types, and constants.
 */
export * from '../src/lib/seams/creation-store-seam/contract';
