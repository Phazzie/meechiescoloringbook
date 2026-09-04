// Purpose: Define the ClockSeam contract — reading the current instant and scheduling work at one.
// Why: `AGENTS.md` classifies clock/time as a seam. Anything that needs to know "now", or to act
//      when a particular instant arrives, must cross this boundary instead of calling `Date.now()`
//      or `setTimeout` directly, so the behaviour is drivable from a test rather than dependent on
//      when the suite happens to run.
// Info flow: caller -> ClockSeam -> real host clock (adapter) or a controllable fake (mock).

/**
 * Neither operation can fail: reading a clock and arming a timer are total on every host this app
 * runs on. The contract therefore returns plain values rather than `Result<>`, and is synchronous
 * — an async `now()` would report the instant it resolved, not the instant it was asked for.
 */
export type ClockSeam = {
	/** Milliseconds since the Unix epoch, UTC. */
	now(): number;
	/**
	 * Run `callback` once, when the clock reaches `epochMs`. An instant already in the past runs on
	 * the next turn of the event loop rather than never. Any instant is accepted, however far
	 * ahead: the adapter re-arms in bounded chunks rather than handing a host timer a delay it
	 * would overflow and fire immediately. Returns a cancel function; calling it after the callback
	 * has run, or more than once, is a no-op.
	 */
	scheduleAt(epochMs: number, callback: () => void): () => void;
};

/** Milliseconds in one calendar day. Day boundaries are counted in UTC. */
export const DAY_MS = 86_400_000;

/**
 * The first instant of the UTC day after the one containing `epochMs`.
 *
 * Pure arithmetic on the instant, deliberately not a `ClockSeam` method: callers that need "the
 * next midnight" should read the clock through the seam once and then derive the boundary, which
 * keeps the seam surface to the two things that actually touch the host.
 */
export const nextUtcDayBoundary = (epochMs: number): number =>
	(Math.floor(epochMs / DAY_MS) + 1) * DAY_MS;
