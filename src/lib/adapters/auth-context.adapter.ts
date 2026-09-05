/*
 * Purpose: Preserve legacy import path for the canonical AuthContextSeam adapter.
 * Why: Existing consumers can migrate independently without duplicating logic.
 * Info flow: Legacy imports -> canonical adapter -> identity resolution.
 * Invariants: Must preserve identical authContextAdapter singleton export.
 */
export { authContextAdapter } from './auth-context-seam';
