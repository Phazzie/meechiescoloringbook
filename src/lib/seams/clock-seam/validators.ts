// Purpose: Validate ClockSeam inputs.
// Why: `scheduleAt` is the one place a caller can hand this seam a value, and a bad instant fails
//      silently in the worst possible way — `setTimeout(fn, NaN)` fires immediately, so a timer
//      meant for midnight would run instantly and, if it re-arms itself, spin forever.
// Info flow: adapter/mock -> validators -> a checked instant, or a thrown error.
import { z } from 'zod';

/**
 * Milliseconds since the Unix epoch. Finite and integral: `Date.now()` and arithmetic on it are
 * always both, so anything else is a caller bug rather than a runtime condition.
 */
export const epochMsSchema = z
	.number()
	.finite('Instant must be a finite number of milliseconds since the epoch.')
	.int('Instant must be a whole number of milliseconds.');

/**
 * Throws on an invalid instant rather than arming a timer that misfires. `ClockSeam` has no
 * `Result<>` arm by design (see `contract.ts`), and this is a programmer error — a caller passing
 * `NaN` wants a stack trace at the call site, not a silently dropped timer.
 */
export const validateEpochMs = (value: number): number => epochMsSchema.parse(value);
