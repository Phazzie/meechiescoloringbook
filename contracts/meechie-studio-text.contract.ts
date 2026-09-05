/*
 * Purpose: Backward-compatible re-export for MeechieStudioTextSeam canonical contract.
 * Why: Maintain legacy flat contract import paths while canonical definitions live under src/lib/seams/meechie-studio-text-seam/.
 * Info flow: Re-export only.
 * Invariants: Fully mirrors canonical contract exports.
 */
export * from '../src/lib/seams/meechie-studio-text-seam/contract';
