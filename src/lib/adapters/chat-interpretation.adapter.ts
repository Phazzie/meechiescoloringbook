/*
 * Purpose: Backward-compatible re-export for ChatInterpretationSeam canonical adapter.
 * Why: Keep existing flat adapter import paths valid while canonical implementation lives in chat-interpretation-seam.
 * Info flow: Re-export only.
 * Invariants: Preserves chatInterpretationAdapter export.
 */
export { chatInterpretationAdapter } from './chat-interpretation-seam';
