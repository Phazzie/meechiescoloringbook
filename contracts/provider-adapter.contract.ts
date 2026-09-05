/*
 * Purpose: Backward-compatible re-export for ProviderAdapterSeam canonical contract.
 * Why: Maintain legacy flat contract import paths while canonical definitions live under src/lib/seams/provider-adapter-seam/.
 * Info flow: Re-export only.
 * Invariants: Fully mirrors canonical contract exports.
 */
export * from '../src/lib/seams/provider-adapter-seam/contract';
