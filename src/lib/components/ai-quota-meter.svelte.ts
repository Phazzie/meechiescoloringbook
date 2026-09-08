// Purpose: Hold every AI quota reading a surface has received, one slot per server bucket, and keep
//          each reading on screen exactly as long as it stays true.
// Why: This machinery existed twice — `StudioState` and `DescribePageState` each carried their own
//      `aiQuota` field, their own `setAiQuota`, and their own `cancelQuotaExpiry` ClockSeam timer,
//      byte-similar and independently maintained. It spread by copying, so it stopped where copying
//      stopped: six of the app's eight billable call sites discarded the quota headers entirely,
//      including every single call to `/api/generate`, the route that pays for the coloring pages
//      this app exists to make. One implementation is what lets the seventh surface get it for free.
// Info flow: postJson onResponseHeaders -> record(headers, requestedAtMs, bucket) -> readAiQuota ->
//            AiQuotaLedger -> textMessage / pictureMessage -> AiQuotaLine.svelte.
// Invariants:
//   - A reading is filed under the bucket named on the snapshot itself, never one a caller picked.
//   - The two buckets expire on independent timers, because the server refills them on independent
//     windows. One shared timer would clear a live reading when the other bucket's window closed.
//   - The instant a reading is anchored to is when its REQUEST STARTED, not when its response
//     arrived. `/api/generate` routinely runs for minutes against a 60-second window, so anchoring
//     at receipt would put a reset instant far into the future for a bucket that had already
//     refilled — the meter would then refuse a call the server would have allowed.
//   - `null` means "not known" and must never gate a control. A surface refuses a click only on a
//     server statement it currently holds, never on a guess.
import { clockSeam } from '$lib/adapters/clock-seam';
import type { ClockSeam } from '$lib/seams/clock-seam/contract';
import {
	aiActionsLeft,
	describeAiQuota,
	describePictureQuota,
	emptyAiQuotaLedger,
	IMAGE_UNITS_PER_PICTURE,
	readAiQuota,
	recordQuotaReading,
	STUDIO_TEXT_QUOTA_COST,
	type AiQuotaBucket,
	type AiQuotaLedger,
	type AiQuotaSnapshot,
	type QuotaActionDescription,
	type QuotaHeaderSource
} from '$lib/core/ai-quota';

/**
 * Render a reset instant as a wall-clock time, seconds included.
 *
 * Seconds are shown rather than rounded away: the window is sixty seconds long, so a bucket
 * refilling at 3:42:55 rendered as "3:42" invites the reader to retry most of a minute early and be
 * refused. A quota label wrong by nearly a whole window is the defect this feature exists to
 * remove, not one to reintroduce in the formatting.
 */
const defaultFormatTime = (date: Date): string =>
	date.toLocaleTimeString([], {
		hour: 'numeric',
		minute: '2-digit',
		second: '2-digit'
	});

export type AiQuotaMeterOptions = {
	/**
	 * Injectable so a test drives expiry instead of waiting sixty seconds for it.
	 *
	 * Resolved through a function on every use rather than captured once, because the state classes
	 * that own a meter expose `clock` as an assignable field and tests replace it *after*
	 * construction. A meter that snapshotted the clock in its constructor would keep the real one
	 * and schedule expiry against wall time while the test drove a fake — silently, since nothing
	 * would fail until a timer that never fires makes an assertion hang or a reading outlive its
	 * window.
	 */
	clock?: () => ClockSeam;
	/** Injectable so an assertion does not depend on the test runner's locale. */
	formatTime?: (date: Date) => string;
};

/**
 * Every quota reading one surface currently holds, and the sentences it can say about them.
 *
 * One of these per state class, not one per app: readings are per browser tab and arrive on the
 * responses that tab actually received, so a shared singleton would report one tab's spending in
 * another's meter.
 */
export class AiQuotaMeter {
	private ledger = $state<AiQuotaLedger>(emptyAiQuotaLedger());
	private readonly clock: () => ClockSeam;
	private readonly formatTime: (date: Date) => string;
	/**
	 * One cancellation handle per bucket, keyed by bucket name.
	 *
	 * Per bucket rather than one shared handle: the windows are independent, so an image reading
	 * expiring must not cancel the timer holding a live text reading on screen.
	 */
	private readonly cancelExpiry = new Map<AiQuotaBucket, () => void>();

	constructor(options: AiQuotaMeterOptions = {}) {
		this.clock = options.clock ?? ((): ClockSeam => clockSeam);
		this.formatTime = options.formatTime ?? defaultFormatTime;
	}

	/** The `text` bucket reading, or `null` when the server has not reported one. */
	get text(): AiQuotaSnapshot | null {
		return this.ledger.text;
	}

	/** The `image` bucket reading, or `null` when the server has not reported one. */
	get image(): AiQuotaSnapshot | null {
		return this.ledger.image;
	}

	/**
	 * Take the quota headers off one response and file them under `bucket`.
	 *
	 * Called on every response the route produces, refusals included — a refusal is exactly when the
	 * reader most needs to be told what the limit is and when it lifts. A response without usable
	 * quota headers leaves the previous reading alone rather than blanking the meter on one odd
	 * reply.
	 *
	 * `requestedAtMs` is when the request was SENT. See this file's invariants for why.
	 */
	record(
		source: QuotaHeaderSource,
		requestedAtMs: number,
		bucket: AiQuotaBucket
	): void {
		const snapshot = readAiQuota(source, requestedAtMs, { bucket });
		if (!snapshot) return;
		this.ledger = recordQuotaReading(this.ledger, snapshot);
		this.scheduleExpiry(snapshot);
	}

	/**
	 * Stop showing a reading the moment it stops being true.
	 *
	 * A reading is valid only until its own reset instant: the bucket is a fixed window, so at
	 * `resetAtMs` it refills whether or not the reader made another request. Without this, a reader
	 * told the desk is full who does the sensible thing — wait — goes on being told the desk is full
	 * after it emptied, because the sentence derives from this value alone and nothing else would
	 * touch it. That is the same defect as the invented counter this feature replaced: a number on
	 * screen the server had stopped agreeing with.
	 *
	 * Through `ClockSeam` rather than `setTimeout`, per `AGENTS.md`'s classification of clock/time as
	 * a seam. An instant already past fires on the next tick, which is right: a window that closed
	 * before the response arrived has nothing left to report.
	 */
	private scheduleExpiry(snapshot: AiQuotaSnapshot): void {
		this.cancelExpiry.get(snapshot.bucket)?.();
		const cancel = this.clock().scheduleAt(snapshot.resetAtMs, () => {
			this.ledger = { ...this.ledger, [snapshot.bucket]: null };
			this.cancelExpiry.delete(snapshot.bucket);
		});
		this.cancelExpiry.set(snapshot.bucket, cancel);
	}

	/** The text-bucket sentence, priced and named by the caller's own action. */
	textMessage(action: QuotaActionDescription = {}): string {
		return describeAiQuota(this.ledger.text, this.formatTime, action);
	}

	/**
	 * The image-bucket sentence for a page asking for `picturesPerPage` pictures.
	 *
	 * Never derived from `this.ledger.text`. That substitution — narrating the 20-unit text bucket
	 * under a button that spends the 8-unit image bucket — is the defect this class was written to
	 * end, and the separate slots are what make it impossible to write by accident.
	 */
	pictureMessage(picturesPerPage: number = 1): string {
		return describePictureQuota(
			this.ledger.image,
			this.formatTime,
			picturesPerPage
		);
	}

	/**
	 * The server has told us, and not yet un-told us, that it will refuse the next text action.
	 *
	 * Only ever true while a reading is both present and unexpired. `null` means "not known", which
	 * never blocks anything: a panel that says the desk is full above buttons that still submit is
	 * the same disagreement between screen and server this whole feature exists to end.
	 */
	textExhausted(unitsPerAction: number = STUDIO_TEXT_QUOTA_COST): boolean {
		return (
			this.ledger.text !== null &&
			aiActionsLeft(this.ledger.text, unitsPerAction) === 0
		);
	}

	/**
	 * As `textExhausted`, for the bucket that funds pictures.
	 *
	 * Priced through `IMAGE_UNITS_PER_PICTURE` exactly as `pictureMessage` is, so the sentence and
	 * the gate can never disagree — a panel saying the desk is full above a button that still
	 * submits is the disagreement between screen and server this whole feature exists to end.
	 */
	pictureExhausted(picturesPerPage: number = 1): boolean {
		return (
			this.ledger.image !== null &&
			aiActionsLeft(
				this.ledger.image,
				Math.max(1, picturesPerPage) * IMAGE_UNITS_PER_PICTURE
			) === 0
		);
	}

	/**
	 * Release every pending expiry timer.
	 *
	 * Called when a surface tears down. A timer left running holds a reference to this meter and
	 * fires against a ledger nobody is reading.
	 */
	dispose(): void {
		for (const cancel of this.cancelExpiry.values()) cancel();
		this.cancelExpiry.clear();
	}
}
