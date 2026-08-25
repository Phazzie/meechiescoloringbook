// Purpose: Preserve the self-contained SpecValidationSeam contract import path.
// Why: Keep contract-layer definitions canonical without duplicating their implementation.
// Info flow: Self-contained seam import -> root contract definition.
export * from '../../../../contracts/spec-validation.contract';
