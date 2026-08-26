// Purpose: Preserve the legacy import path for the canonical SpecValidationSeam contract.
// Why: Existing consumers can migrate independently without maintaining a duplicate contract.
// Info flow: Legacy imports -> canonical self-contained contract -> consumers.
export * from '../src/lib/seams/spec-validation-seam/contract';
