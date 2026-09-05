/*
 * Purpose: Backward-compatible re-export for ProviderAdapterSeam canonical adapter.
 * Why: Keep existing flat adapter import paths valid while canonical implementation lives in provider-adapter-seam.
 * Info flow: Re-export only.
 * Invariants: Preserves createProviderAdapter, providerAdapter, type ProviderAdapterConfig exports.
 */
export {
	createProviderAdapter,
	providerAdapter,
	type ProviderAdapterConfig
} from './provider-adapter-seam';
