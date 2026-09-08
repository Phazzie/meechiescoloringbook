// Purpose: Read the AI quota the server actually enforces out of its own response headers, and
//          turn it into the sentences each surface shows about the bucket it spends.
// Why: All six billable routes carry RateLimit-Limit, RateLimit-Remaining and RateLimit-Reset on
//      every response, success and denial alike, and a denial adds Retry-After. The studio used to
//      throw all of that away and show an invented in-memory counter instead, so the number on
//      screen had never been agreed to by the thing doing the limiting.
//      It then threw away almost all of it a second way: the server meters TWO independent buckets
//      — `text` (20 units: verdicts, rewrites, read-backs) and `image` (8 units: every coloring
//      page, wig try-on and picture) — and the app only ever read `text`. The sentence on the home
//      studio was derived from the text bucket and sat above a "make the page" button that spends
//      the image bucket, on a separate window with a different limit. Carrying `bucket` on every
//      snapshot is what makes that mix-up unrepresentable rather than merely discouraged.
// Info flow: fetch Response headers -> readAiQuota(bucket) -> AiQuotaSnapshot -> recordQuotaReading
//            -> AiQuotaLedger -> describeAiQuota / describePictureQuota -> UI.
// Invariants: Pure. No I/O, no clock of its own — the caller passes the instant. A header set that
//             is absent, malformed or negative yields `null` rather than a guessed number: a
//             surface says nothing before it says something untrue. A reading is filed under the
//             bucket it names and never under one a caller chose.

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

/**
 * What one chat interpretation charges the same bucket.
 *
 * `runChatInterpretationPipeline` makes exactly one billable provider call, so one read-back costs
 * one unit. Here rather than in the pipeline for the same reason as above: the server charges it and
 * `/describe` divides the remaining units by it to say how many more read-backs the reader can ask
 * for. `chat-interpretation-pipeline.ts` imports this constant; there is no second definition.
 */
export const CHAT_INTERPRETATION_QUOTA_COST = 1;

/**
 * What one Meechie tool verdict charges the text bucket.
 *
 * `runToolsPipeline` makes one billable provider call, so one verdict costs one unit. Here rather
 * than in the pipeline for the same reason as the two above: the server charges it and the mode
 * routes and the toolkit hub divide the remaining units by it to say how many more verdicts the
 * reader can ask for. `tools-pipeline.ts` imports this constant; there is no second definition.
 */
export const MEECHIE_TOOL_QUOTA_COST = 1;

/**
 * What one wig try-on charges the IMAGE bucket.
 *
 * The same eight units a minute that fund coloring pages. `wig-try-on-pipeline.ts` imports it, and
 * the studio needs it to say what a try-on costs a reader who is also making pages.
 */
export const WIG_TRY_ON_QUOTA_COST = 1;

/**
 * What one picture charges the image bucket.
 *
 * `runGeneratePipeline` calls `consumeQuota(imageRequest.variations)` — the same value that becomes
 * the provider's `n` — so a page costs one unit per picture it asks for, and a four-variation
 * request costs four. A surface pricing a page at a flat 1 would tell a reader with two units left
 * that they can afford a four-picture page they cannot.
 */
export const IMAGE_UNITS_PER_PICTURE = 1;

/**
 * Which of the server's two independent buckets a reading describes.
 *
 * They are not interchangeable and never have been: `text` holds 20 units and funds verdicts,
 * rewrites and read-backs; `image` holds 8 and funds every coloring page, wig try-on and picture
 * this app makes. They refill on separate windows, so a reading from one says nothing whatsoever
 * about the other.
 *
 * It is a required field on every snapshot rather than an optional label because narrating one
 * bucket's number under the other's button is the exact defect this type exists to make
 * unrepresentable — the studio's meter did precisely that, reporting the text bucket above a
 * "make the page" button that spends the image bucket. A snapshot that cannot say which bucket it
 * came from is not a reading; it is a number.
 */
export type AiQuotaBucket = 'text' | 'image';

/** The quota state the server reported on one response. Units, not actions — see `aiActionsLeft`. */
export type AiQuotaSnapshot = {
	/** Which bucket this reading describes. See `AiQuotaBucket` — never inferred, always carried. */
	bucket: AiQuotaBucket;
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
	options: { bucket: AiQuotaBucket; exhausted?: boolean }
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
	// Deliberately computed from the CALLER's clock and a delta, never from a server timestamp.
	// A server epoch value would have to be read on the browser's timeline to be scheduled against,
	// and the two clocks are unrelated: a device five minutes fast would treat a fresh window as
	// already expired and re-enable controls the server still refuses, while a slow one would hold
	// them disabled long after the bucket refilled. The delta keeps every value on one clock, so
	// skew cancels out. Its known cost is recorded in DECISIONS.md: the delta is relative to the
	// instant the quota was CHARGED, and the caller can only anchor it to the instant it sent the
	// request, so a route that does work before charging reports a reset that is early by that much.
	return {
		bucket: options.bucket,
		limit,
		remaining,
		resetAtMs: nowMs + secondsUntilReset * 1_000,
		exhausted: options.exhausted === true || retryAfterSeconds !== null
	};
};

/**
 * How many more AI actions the reported units will actually pay for.
 *
 * Integer division, deliberately: a bucket holding one unit is not empty, but it cannot afford a
 * two-unit action, and telling the reader they have a call left when the next one will be refused
 * is the same kind of lie as the counter this replaces.
 *
 * `unitsPerAction` is the cost of the action *this surface* offers, because one bucket pays for
 * actions of different prices — a studio rewrite is two units, a `/describe` read-back is one — and
 * a surface that divided by someone else's cost would understate or overstate its own. It defaults
 * to the studio's cost so no existing caller changes behaviour. A cost below one would report an
 * allowance the bucket cannot fund, so it is clamped rather than trusted.
 */
export const aiActionsLeft = (
	snapshot: AiQuotaSnapshot,
	unitsPerAction: number = STUDIO_TEXT_QUOTA_COST
): number =>
	Math.max(0, Math.floor(snapshot.remaining / Math.max(1, unitsPerAction)));

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
 * What a surface calls the action it is counting, and what that action costs.
 *
 * Both are the surface's own facts. Naming the action matters as much as pricing it: one bucket
 * funds actions of different prices, so two pages can honestly report different numbers from the
 * same reading, and a reader can only tell those apart if each sentence says what it is counting.
 */
export type QuotaActionDescription = {
	/** Units one of these actions charges. Defaults to the studio's rewrite cost. */
	unitsPerAction?: number;
	/** Singular noun for the action. Defaults to `AI call`. */
	actionNoun?: string;
	/**
	 * Plural form, when a trailing `s` would not produce it.
	 *
	 * The default rule is `actionNoun + 's'`, which is right for "page" and "read-back" and wrong for
	 * anything with a qualifier — "verdict or rewrite" becomes "verdict or rewrites", which reads as
	 * one verdict and several rewrites rather than several of either. A surface that needs a real
	 * plural states it rather than having the rule guess.
	 */
	actionNounPlural?: string;
};

/**
 * The sentence a surface puts under its AI buttons, or `''` when the server has not reported a
 * quota yet — before the first AI call there is genuinely nothing to say, and saying nothing is the
 * point of this whole change.
 */
export const describeAiQuota = (
	snapshot: AiQuotaSnapshot | null,
	formatTime: (date: Date) => string,
	action: QuotaActionDescription = {}
): string => {
	if (!snapshot) return '';
	const left = aiActionsLeft(snapshot, action.unitsPerAction);
	if (left === 0) {
		// Two different states, and conflating them was a real defect: a bucket holding three units
		// is NOT empty, it just cannot fund a four-unit page — and on the home studio that same
		// bucket still pays for a one-unit wig try-on sitting enabled further down the screen.
		// Saying "the desk is full" there contradicts a control the reader can plainly still use.
		if (snapshot.remaining > 0) {
			const noun = action.actionNoun ?? 'AI call';
			return `Not enough left for this ${noun}. Ready again at ${formatQuotaResetTime(snapshot, formatTime)}.`;
		}
		return `Meechie's desk is full. Ready again at ${formatQuotaResetTime(snapshot, formatTime)}.`;
	}
	const singular = action.actionNoun ?? 'AI call';
	const noun =
		left === 1 ? singular : (action.actionNounPlural ?? `${singular}s`);
	return `${left} ${noun} left before ${formatQuotaResetTime(snapshot, formatTime)}.`;
};

/**
 * The sentence a page-making surface puts under its "make the page" button.
 *
 * Priced in pictures, because that is what the server charges: a page asking for `picturesPerPage`
 * variations costs that many units of the image bucket. Counted in pages rather than pictures
 * because a page is what the reader is about to ask for — telling someone with 6 units they have
 * "6 pictures left" when their next page costs 4 is the same arithmetic the studio's meter got
 * wrong in the other direction.
 *
 * `picturesPerPage` is the *current* spec's `variations` rather than a constant, so a surface that
 * lets the reader ask for four pictures reports the allowance for the page they configured.
 */
export const describePictureQuota = (
	snapshot: AiQuotaSnapshot | null,
	formatTime: (date: Date) => string,
	picturesPerPage: number = 1,
	actionNoun: string = 'page'
): string =>
	describeAiQuota(snapshot, formatTime, {
		unitsPerAction: Math.max(1, picturesPerPage) * IMAGE_UNITS_PER_PICTURE,
		actionNoun
	});

/**
 * Every bucket reading a surface currently holds, one slot each.
 *
 * A surface that spends both buckets — every mode route does, one `/api/tools` call for the verdict
 * and one `/api/generate` call for the picture — needs both numbers at once and must not let either
 * overwrite the other. A single `AiQuotaSnapshot | null` field cannot express that: the second
 * response silently replaces the first, and whichever call happened to land last becomes "the"
 * quota for a button that does not spend it.
 */
export type AiQuotaLedger = {
	text: AiQuotaSnapshot | null;
	image: AiQuotaSnapshot | null;
};

/** A ledger holding no readings at all — what every surface starts with. */
export const emptyAiQuotaLedger = (): AiQuotaLedger => ({
	text: null,
	image: null
});

/**
 * How far apart two `resetAtMs` values may be and still describe the same window.
 *
 * `RateLimit-Reset` is whole seconds, `Math.ceil`-ed by the guard, and each reading anchors it to
 * its own request instant — so two responses from the same window land on the same absolute reset
 * instant give or take that rounding. Two seconds covers the ceil at both ends with room to spare,
 * and is far below the 60-second window it has to distinguish.
 */
export const QUOTA_WINDOW_MATCH_TOLERANCE_MS = 2_000;

/**
 * Whether `incoming` describes the bucket more recently than `stored` does.
 *
 * Needed because responses do not arrive in the order the server charged them. Two requests that
 * spend the same bucket can be in flight at once — on the home studio a coloring page and a wig
 * try-on both charge `image`, guarded by separate `isGenerating` / `isTryingOn` flags — and a
 * generation that charged first routinely returns *after* a try-on that charged second. Taking
 * whichever landed last would then put the older, higher `remaining` back on screen: a meter
 * reporting more allowance than the reader has, which is the failure this whole module exists to
 * prevent.
 *
 * Two rules, in order:
 *
 * 1. **A later window wins outright.** A greater `resetAtMs` means the bucket has refilled since,
 *    so the reading is newer whatever its `remaining` says — and an earlier window is stale even
 *    when its numbers look healthier.
 * 2. **Within one window, the lower `remaining` is the newer reading.** A fixed window only ever
 *    counts down, so a smaller number cannot predate a larger one. Ties keep the incoming reading,
 *    which carries the fresher `exhausted` flag at no cost to the count.
 */
const supersedes = (
	incoming: AiQuotaSnapshot,
	stored: AiQuotaSnapshot | null
): boolean => {
	if (stored === null) return true;
	if (incoming.resetAtMs > stored.resetAtMs + QUOTA_WINDOW_MATCH_TOLERANCE_MS) {
		return true;
	}
	if (incoming.resetAtMs < stored.resetAtMs - QUOTA_WINDOW_MATCH_TOLERANCE_MS) {
		return false;
	}
	return incoming.remaining <= stored.remaining;
};

/**
 * File a reading under the bucket it names, leaving the other slot untouched.
 *
 * Pure, and returns a new ledger rather than mutating: the snapshot itself says where it belongs,
 * so no caller ever chooses the slot, and a caller therefore cannot file an image reading under
 * `text`. That is the whole reason `bucket` is carried on the snapshot instead of being passed
 * alongside it here.
 *
 * A reading that does not `supersede` the one already filed is **discarded**, and the ledger is
 * returned unchanged — identity included, so a caller can tell nothing happened.
 */
export const recordQuotaReading = (
	ledger: AiQuotaLedger,
	snapshot: AiQuotaSnapshot
): AiQuotaLedger =>
	supersedes(snapshot, ledger[snapshot.bucket])
		? { ...ledger, [snapshot.bucket]: snapshot }
		: ledger;
