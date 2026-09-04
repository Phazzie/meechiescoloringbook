// Purpose: Deterministic visibility states for PageVisibilitySeam mock and contract tests.
// Why: The behaviour worth testing is a transition, and a real one cannot be provoked in a unit
//      test without a browser.
// Info flow: fixtures -> mock/tests.

export const visibleState = 'visible';
export const hiddenState = 'hidden';

// --- Fault fixtures: values a host must never be allowed to turn into an unknown visibility. ---

/** Older engines and some embedded webviews reported this; it is not in the current spec. */
export const prerenderState = 'prerender';

/** A host that reports nothing at all. */
export const missingState = undefined;

/** Not a visibility state in any spec. */
export const nonsenseState = 'whenever';

/** Every value the seam must resolve to a definite answer rather than propagate. */
export const invalidStates = [prerenderState, missingState, nonsenseState] as const;
