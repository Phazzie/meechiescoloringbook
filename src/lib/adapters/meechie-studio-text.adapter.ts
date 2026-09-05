/*
 * Purpose: Backward-compatible re-export for MeechieStudioTextSeam canonical adapter.
 * Why: Keep existing flat adapter import paths valid while canonical implementation lives in meechie-studio-text-seam.
 * Info flow: Re-export only.
 * Invariants: Preserves createMeechieStudioTextAdapter export.
 */
export { createMeechieStudioTextAdapter } from './meechie-studio-text-seam';
