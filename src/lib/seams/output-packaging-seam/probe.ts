/*
 * Purpose: Probe entry point for OutputPackagingSeam.
 * Why: Allow verification tooling to probe packaging behavior.
 * Info flow: Probe execution -> probe result -> evidence capture.
 * Invariants: OutputPackagingSeam in Node/CI resolves to BROWSER_REQUIRED for canvas-based rendering; live probing requires browser environment.
 */
// N/A (browser-only): OutputPackagingSeam is probed via browser test suite.
export {};
