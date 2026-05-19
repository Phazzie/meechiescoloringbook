// Purpose: Probe for DriftDetectionSeam.
// Why: Pure deterministic seam — no external I/O; probe is not applicable.
// Info flow: N/A (pure seam).
export const probeDriftDetectionSeam = () => {
	// Pure seam: all behavior is deterministic and fully covered by contract tests.
	// No network call, filesystem read, or env var is required.
};
