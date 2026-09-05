/*
 * Purpose: Preserve the legacy import path for the canonical SessionSeam contract.
 * Why: Existing consumers can migrate independently without maintaining duplicate contracts.
 * Info flow: Legacy imports -> canonical self-contained contract -> consumers.
 * Invariants: Must maintain full type and schema parity with canonical contract.
 */
export * from '../src/lib/seams/session-seam/contract';
