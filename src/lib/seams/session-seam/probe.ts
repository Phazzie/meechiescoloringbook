/*
 * Purpose: Probe entry point for SessionSeam.
 * Why: Allow verification tooling to probe browser session lifecycle behavior.
 * Info flow: Probe execution -> probe result -> evidence capture.
 * Invariants: SessionSeam in Node/CI resolves to BROWSER_REQUIRED; live probing requires headless browser environment.
 */
// N/A (browser-only): SessionSeam is probed via probes/browser-seams.probe.mjs.
export {};
