// Purpose: Define the ClockSeam contract — reading the current instant and scheduling work at one.
// Why: `AGENTS.md` classifies clock/time as a seam. Anything that needs to know "now", or to act
//      when a particular instant arrives, must cross this boundary instead of calling `Date.now()`
//      or `setTimeout` directly, so the behaviour is drivable from a test rather than dependent on
//      when the suite happens to run.
// Info flow: caller -> ClockSeam -> real host clock (adapter) or a controllable fake (mock).

/**
 * Reading the clock cannot fail, and neither operation is async — an async `now()` would report the
 * instant it resolved, not the instant it was asked for. `scheduleAt` has exactly one failure mode,
 * declared on it below; everything else returns a plain value rather than a `Result<>`.
 */
export type ClockSeam = {
	/** Milliseconds since the Unix epoch, UTC. */
	now(): number;
	/**
	 * Run `callback` once, when the clock reaches `epochMs`. An instant already in the past runs on
	 * the next turn of the event loop rather than never. Any *valid* instant is accepted, however
	 * far ahead: the adapter re-arms in bounded chunks rather than handing a host timer a delay it
	 * would overflow and fire immediately. Returns a cancel function; calling it after the callback
	 * has run, or more than once, is a no-op.
	 *
	 * **Failure mode — throws synchronously.** `epochMs` must be a finite integer. `NaN`,
	 * `Infinity`, and fractional instants throw before anything is armed, and every implementation
	 * of this contract must do so; `fixtures.ts` carries one of each as fault data. The
	 * precondition is enforced rather than tolerated because `setTimeout(fn, NaN)` fires
	 * immediately: silently accepting a bad instant would turn a midnight timer into an instant
	 * one, and a self-re-arming timer into a spin. Callers doing date arithmetic that can produce
	 * `NaN` — `new Date(userInput).getTime()`, say — must check before calling.
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
