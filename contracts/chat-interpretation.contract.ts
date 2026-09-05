/*
 * Purpose: Backward-compatible re-export for ChatInterpretationSeam canonical contract.
 * Why: Maintain legacy flat contract import paths while canonical definitions live under src/lib/seams/chat-interpretation-seam/.
 * Info flow: Re-export only.
 * Invariants: Fully mirrors canonical contract exports.
 */
export * from '../src/lib/seams/chat-interpretation-seam/contract';
