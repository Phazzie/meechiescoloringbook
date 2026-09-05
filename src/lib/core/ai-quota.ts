// Purpose: Read the AI quota the server actually enforces out of its own response headers, and
//          turn it into the sentences the studio shows.
// Why: Every /api/meechie-studio-text response — success and denial alike — carries
//      RateLimit-Limit, RateLimit-Remaining and RateLimit-Reset, and a denial adds Retry-After.
//      The studio used to throw all of that away and show an invented in-memory counter instead,
//      so the number on screen had never been agreed to by the thing doing the limiting.
// Info flow: fetch Response headers -> readAiQuota -> AiQuotaSnapshot -> describeAiQuota -> UI.
// Invariants: Pure. No I/O, no clock of its own — the caller passes the instant. A header set that
//             is absent, malformed or negative yields `null` rather than a guessed number: the
//             studio says nothing before it says something untrue.

/**
 * What one AI text action charges the caller's quota bucket.
 *
 * The studio-text pipeline can make two sequential provider calls for a single action (the initial
 * call plus its own bounded correction retry), so one action costs two units, not one. It lives
 * here, in the dependency-free core, because both sides need the same number: the server charges
 * it, and the studio divides the remaining units by it to say how many more actions the reader can
 * take. Two definitions would drift, and the drift would show up as a meter that overcounts.
 */
export const STUDIO_TEXT_QUOTA_COST = 2;

/** The quota state the server reported on one response. Units, not actions — see `aiActionsLeft`. */
export type AiQuotaSnapshot = {
	/** Units the caller's bucket holds per window. */
	limit: number;
	/** Units left in the bucket after this response was charged. */
	remaining: number;
	/** When the bucket refills, as an absolute instant so the reading never goes stale. */
	resetAtMs: number;
	/** True when this snapshot came from a response that was refused for being over quota. */
	exhausted: boolean;
};

/** The only part of `Response.headers` this module needs, so tests need no `Response`. */
export type QuotaHeaderSource = {
	get: (name: string) => string | null;
};

const readCount = (source: QuotaHeaderSource, name: string): number | null => {
	const raw = source.get(name);
	if (raw === null) return null;
	const trimmed = raw.trim();
	if (trimmed.length === 0) return null;
	const parsed = Number(trimmed);
	// A quota expressed as a fraction, a negative, or `Infinity` is a header this code does not
	// understand, and reporting a number nobody sent is the exact failure being fixed here.
	if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
	return parsed;
};

/**
 * Read a quota snapshot out of one response's headers, or `null` when the response did not carry a
 * usable one.
 *
 * `nowMs` is passed in rather than read, so the absolute reset instant is derived from the clock
 * the caller is already using and this module stays pure.
 */
export const readAiQuota = (
	source: QuotaHeaderSource,
	nowMs: number,
	options: { exhausted?: boolean } = {}
): AiQuotaSnapshot | null => {
	const limit = readCount(source, 'RateLimit-Limit');
	const remaining = readCount(source, 'RateLimit-Remaining');
	const resetSeconds = readCount(source, 'RateLimit-Reset');
	if (limit === null || remaining === null || resetSeconds === null) return null;
	// A bucket cannot hold more than its own limit. A response claiming otherwise is not a reading
	// worth showing.
	if (remaining > limit) return null;
	// `Retry-After` is only sent on a denial, and it is the authority on when this caller may
	// return. Where both are present it is the one that was computed for the refusal.
	const retryAfterSeconds = readCount(source, 'Retry-After');
	const secondsUntilReset = retryAfterSeconds ?? resetSeconds;
	return {
		limit,
		remaining,
		resetAtMs: nowMs + secondsUntilReset * 1_000,
		exhausted: options.exhausted === true || retryAfterSeconds !== null
	};
};

/**
 * How many more AI text actions the reported units will actually pay for.
 *
 * Integer division, deliberately: a bucket holding one unit is not empty, but it cannot afford a
 * two-unit action, and telling the reader they have a call left when the next one will be refused
 * is the same kind of lie as the counter this replaces.
 */
export const aiActionsLeft = (snapshot: AiQuotaSnapshot): number =>
	Math.max(0, Math.floor(snapshot.remaining / STUDIO_TEXT_QUOTA_COST));

/**
 * The clock time the bucket refills, for a reader.
 *
 * A wall-clock time rather than a countdown on purpose: a rendered "ready in 34s" is wrong 34
 * seconds later and this app has no ticker to keep it honest, whereas an instant stays true for as
 * long as it is on screen.
 */
export const formatQuotaResetTime = (
	snapshot: AiQuotaSnapshot,
	formatTime: (date: Date) => string
): string => formatTime(new Date(snapshot.resetAtMs));

/**
 * The sentence the studio puts under the AI buttons, or `''` when the server has not reported a
 * quota yet — before the first AI call there is genuinely nothing to say, and saying nothing is the
 * point of this whole change.
 */
export const describeAiQuota = (
	snapshot: AiQuotaSnapshot | null,
	formatTime: (date: Date) => string
): string => {
	if (!snapshot) return '';
	const left = aiActionsLeft(snapshot);
	if (left === 0) {
		return `Meechie's desk is full. Ready again at ${formatQuotaResetTime(snapshot, formatTime)}.`;
	}
	return `${left} AI call${left === 1 ? '' : 's'} left before ${formatQuotaResetTime(snapshot, formatTime)}.`;
};
