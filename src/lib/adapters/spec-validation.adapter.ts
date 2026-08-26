// Purpose: Preserve the legacy import path for the canonical SpecValidationSeam adapter.
// Why: Existing consumers can migrate independently without maintaining duplicate behavior.
// Info flow: Legacy imports -> canonical self-contained adapter -> consumers.
export { specValidationAdapter } from './spec-validation-seam';
