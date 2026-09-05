/*
 * Purpose: Preserve legacy import path for the canonical CreationStoreSeam adapter.
 * Why: Existing consumers and helper unit tests can migrate independently without duplicating logic.
 * Info flow: Legacy imports -> canonical adapter -> browser storage.
 * Invariants: Must preserve identical creationStoreAdapter, parseRecords, and ParsedRecords exports.
 */
export { creationStoreAdapter, parseRecords, type ParsedRecords } from './creation-store-seam';
