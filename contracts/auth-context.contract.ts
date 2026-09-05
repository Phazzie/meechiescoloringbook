/*
 * Purpose: Legacy compatibility re-export for AuthContextSeam contract.
 * Why: Support legacy import paths while routing to self-contained seam module.
 * Info flow: Legacy consumers -> contracts/auth-context.contract.ts -> src/lib/seams/auth-context-seam/contract.ts.
 * Invariants: Must preserve identical exported schemas, types, and validation contracts.
 */
export * from '../src/lib/seams/auth-context-seam/contract';
