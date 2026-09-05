/*
 * Purpose: Backward-compatible re-export for OutputPackagingSeam canonical adapter.
 * Why: Keep existing flat adapter import paths valid while canonical implementation lives in output-packaging-seam.
 * Info flow: Re-export only.
 * Invariants: Preserves outputPackagingAdapter, parseSvgSize, toBase64, fromBase64.
 */
export {
	outputPackagingAdapter,
	parseSvgSize,
	toBase64,
	fromBase64
} from './output-packaging-seam';
