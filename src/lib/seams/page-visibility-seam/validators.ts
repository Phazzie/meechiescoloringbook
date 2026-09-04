// Purpose: Validate PageVisibilitySeam input from the host.
// Why: `document.visibilityState` is a string the host supplies, and only two values are defined.
//      Anything else must resolve to a definite answer rather than leaking an unknown state into a
//      boolean the UI acts on.
// Info flow: adapter -> validators -> a definite visibility.
import { z } from 'zod';

/** The two states the Page Visibility API defines. */
export const visibilityStateSchema = z.enum(['visible', 'hidden']);

/**
 * True unless the host definitely says the page is hidden.
 *
 * Biased towards "visible" on purpose: the only consequence of a wrong `true` is a refresh nobody
 * needed, while a wrong `false` silently withholds one the reader is waiting on.
 */
export const isVisibleState = (value: unknown): boolean => {
	const parsed = visibilityStateSchema.safeParse(value);
	return parsed.success ? parsed.data === 'visible' : true;
};
