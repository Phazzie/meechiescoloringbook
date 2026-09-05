/*
 * Purpose: Preserve legacy import path for the canonical SessionSeam adapter.
 * Why: Existing consumers can migrate independently without duplicating logic.
 * Info flow: Legacy imports -> canonical adapter -> browser storage.
 * Invariants: Must preserve identical sessionAdapter singleton export.
 */
export { sessionAdapter } from './session-seam';
