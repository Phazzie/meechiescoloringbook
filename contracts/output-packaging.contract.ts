/*
 * Purpose: Legacy compatibility re-export for OutputPackagingSeam contract.
 * Why: Support legacy import paths while routing to self-contained seam module.
 * Info flow: Legacy consumers -> contracts/output-packaging.contract.ts -> src/lib/seams/output-packaging-seam/contract.ts.
 * Invariants: Must preserve identical exported schemas, types, and validation contracts.
 */
export * from '../src/lib/seams/output-packaging-seam/contract';
