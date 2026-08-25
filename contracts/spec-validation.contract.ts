// Purpose: Preserve the legacy SpecValidationSeam contract import path.
// Why: Keep one canonical schema implementation while older callers migrate.
// Info flow: Legacy contract import -> canonical self-contained contract.
export * from '../src/lib/seams/spec-validation-seam/contract';
