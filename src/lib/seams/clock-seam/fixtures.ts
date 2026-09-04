// Purpose: Deterministic instants for ClockSeam mock and contract tests.
// Why: A clock test that reads the real clock proves nothing repeatable. These are the instants the
//      mock starts from and the tests assert against.
// Info flow: fixtures -> mock/tests.

/** Mid-afternoon UTC, comfortably inside a day so a rollover has to be driven deliberately. */
export const sampleInstantMs = Date.parse('2026-09-03T14:30:00.000Z');

/** The last minute of the same UTC day — one nudge away from rolling over. */
export const lateInstantMs = Date.parse('2026-09-03T23:59:00.000Z');

/** The first instant of the following UTC day. */
export const nextDayBoundaryMs = Date.parse('2026-09-04T00:00:00.000Z');

// --- Fault fixtures: instants that must be rejected before any timer is armed. ---

/** `setTimeout(fn, NaN)` fires immediately, so a NaN instant is the dangerous case, not a no-op. */
export const notANumberInstant = Number.NaN;

/** Arithmetic on a missing date can produce this; `setTimeout` clamps it to fire at once. */
export const infiniteInstant = Number.POSITIVE_INFINITY;

/** A fractional millisecond is always a bug in instant arithmetic. */
export const fractionalInstant = 1_772_000_000_000.5;

/** Every instant the seam must refuse, for table-driven contract tests. */
export const invalidInstants = [notANumberInstant, infiniteInstant, fractionalInstant] as const;
