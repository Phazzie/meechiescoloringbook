// Purpose: Preserve the legacy import path for the canonical MeechieToolSeam contract.
// Why: Existing consumers can migrate independently without maintaining a duplicate contract.
// Info flow: Legacy imports -> canonical self-contained contract -> consumers.
export * from '../src/lib/seams/meechie-tool-seam/contract';
