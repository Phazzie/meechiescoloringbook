/*
 * Purpose: The one place that decides what a reader is told when a finished coloring page cannot be
 *          packaged into one of its files — and whether rebuilding it is worth offering.
 * Why: Packaging is the last step of making a page and the cheapest one in the app. The picture
 *      already exists, it has already been paid for, and turning it into a PDF and a share PNG
 *      happens entirely on this device: no network, no provider, no quota. It was nonetheless the
 *      only failing step in the app with no way to run it again, and the only thing it said about
 *      itself was the adapter's own words. Three separately maintained copies of one twenty-line
 *      function — `studio-state.svelte.ts`, `page-artifact-state.svelte.ts` and
 *      `MeechieTools.svelte` — each read `result.error.message`, each discarded `result.error.code`,
 *      and each wrote a CAUGHT EXCEPTION's message into the same field on the way past. So a reader
 *      whose browser would not give the app a canvas was shown
 *      `Canvas context unavailable for resizing.` quoted mid-sentence, and a reader whose PDF
 *      library threw was shown whatever pdf-lib happened to say. Neither named a remedy, neither
 *      said which downloads still worked, and the only recourse either offered was the button that
 *      buys another generation — paying a provider to re-roll a picture the reader liked, to fix a
 *      free local render.
 * Info flow: seam `SeamError` / caught exception + the variant that was asked for
 *            -> classifyExportFailure -> ExportFailure -> `page-exports.ts` -> `PageExportRow`.
 * Invariants:
 *   - Pure. No clock, no `navigator`, no I/O, no packaging of its own.
 *   - A message that reached us from an EXCEPTION or from the seam is never shown to a reader. It
 *     becomes `detail`. This is the same rule `generation-failure.ts` and `storage-failure.ts`
 *     enforce, and this module is the third and last surface that was breaking it.
 *   - There is no allowlist of verbatim messages here, unlike `storage-failure.ts`. Every string
 *     `OutputPackagingSeam` can emit was written for a developer; none of the ten was written for a
 *     reader, so none of them is passed through.
 *   - A rebuild is offered only where a second attempt could land differently. A browser that has no
 *     canvas has no canvas a second later, and a picture in a shape this step cannot read is in the
 *     same shape a second later: those get a sentence naming what still works instead of a button
 *     that provably cannot.
 *   - Nothing here says what the reader still has. That was tried and it was WRONG: a per-variant
 *     sentence sees one attempt, so the square's "the printable download is unaffected" was a claim
 *     about a variant this function never saw — and it is false whenever both fail, which a WebP or
 *     SVG source hitting CANVAS_UNAVAILABLE does, because that print path transcodes through the
 *     same canvas the share renderer needs. What survived is measured from the whole attempt set by
 *     `pageExportSurvivors` in `page-exports.ts`, which is the only place that can see it.
 *   - Nothing here claims the page failed. Packaging runs after the image exists, so it never can.
 */

import type { OutputVariant } from '../seams/output-packaging-seam/contract';

/**
 * Why a download could not be built.
 *
 * Coarser than the adapter's ten codes on purpose, exactly as `StorageFailureCause` is coarser than
 * the creation store's: these are the distinctions that change what a reader should do next.
 */
export type ExportFailureCause =
	/**
	 * This browser will not do this at all — there is no canvas, or no document to make one in.
	 *
	 * The one cause where the reader's device is the answer and no amount of pressing changes it.
	 */
	| 'unsupported_here'
	/**
	 * The draw or the encode was attempted and missed.
	 *
	 * A canvas that cannot hand back its bytes and an image that will not load are both usually
	 * memory, on a page that is several megapixels at print resolution. This is the cause that makes
	 * a rebuild worth offering: the second attempt runs against a different heap.
	 */
	| 'render_failed'
	/**
	 * The picture is in a shape this step cannot take — an unsupported format, or a payload that is
	 * not base64 where base64 was required.
	 *
	 * Told apart from `render_failed` because nothing was attempted and nothing will be: the same
	 * bytes are refused identically next time. It is also the one cause that is this app's fault
	 * rather than the device's, and the sentence says so instead of implying the reader can fix it.
	 */
	| 'unreadable_image'
	/**
	 * Packaging was asked for with no picture to package.
	 *
	 * Should never reach a reader — every call site checks for images first — so it is not given a
	 * remedy it cannot use. It exists so `NO_IMAGES` is a named code rather than falling into
	 * `unknown`, which is the branch that offers the button.
	 */
	| 'no_page'
	/** Something threw, or the failure carried a code this app does not know. */
	| 'unknown';

/** Whether the reader is offered the rebuild, and what pressing it costs. */
export type ExportRetry =
	/** Rebuilding reproduces the same failure. The sentence carries what still works instead. */
	| { kind: 'none' }
	/**
	 * Pressing again is worth it, and free.
	 *
	 * There is no `after` variant, and unlike storage there is not even a device setting to change
	 * first. Packaging spends nothing at all: the picture is already in memory and the whole step is
	 * a canvas and a PDF, so the only thing a rebuild costs is the seconds it takes.
	 */
	| { kind: 'now' };

export type ExportFailure = {
	/** The variant that was asked for. Names the request, never a file that does not exist. */
	variant: OutputVariant;
	cause: ExportFailureCause;
	/** What the reader is told. Written to be read, and never the seam's or an exception's words. */
	message: string;
	retry: ExportRetry;
	/**
	 * The developer's string, kept for System Trace and a bug report.
	 *
	 * Never rendered as the reader's sentence. `null` where there was nothing underneath.
	 */
	detail: string | null;
};

/**
 * The adapter's codes, mapped to the distinctions that change what a reader should do.
 *
 * All ten of them, from `src/lib/adapters/output-packaging-seam/index.ts`.
 * `tests/unit/export-failure.test.ts` reads that adapter and fails if it ever emits a code this
 * table does not name, so a new failure mode cannot quietly land in `unknown` — which is the branch
 * that offers the rebuild, and therefore the one place a wrong default would invite a reader to
 * press a button against a condition that cannot change.
 */
const CAUSE_BY_CODE: Record<string, ExportFailureCause> = {
	NO_IMAGES: 'no_page',
	BROWSER_REQUIRED: 'unsupported_here',
	CANVAS_UNAVAILABLE: 'unsupported_here',
	PNG_ENCODING_FAILED: 'render_failed',
	SVG_IMAGE_LOAD_FAILED: 'render_failed',
	IMAGE_RESIZE_FAILED: 'render_failed',
	PNG_ENCODING_UNSUPPORTED: 'unreadable_image',
	JPG_ENCODING_UNSUPPORTED: 'unreadable_image',
	WEBP_ENCODING_UNSUPPORTED: 'unreadable_image',
	UNSUPPORTED_IMAGE_FORMAT: 'unreadable_image'
};

/**
 * What each variant is, in the reader's terms.
 *
 * The nouns describe the *request*, not a file type — when a variant fails there is no file to read
 * a media type off, so "the printable PDF" would assert something this module cannot see. Moved here
 * from `page-exports.ts`, where the same table existed to prefix a raw seam string.
 */
const SUBJECT: Record<OutputVariant, string> = {
	print: 'The printable download could not be built.',
	square: 'The square share image could not be built.',
	chat: 'The chat-sized image could not be built.'
};

/**
 * What a reader can do about a browser that will not give the app a canvas.
 *
 * Named as a capability rather than a setting, because unlike blocked site data there is usually no
 * switch: a canvas is missing in a hardened browser, a privacy extension that blocks canvas
 * readback, or a very old one. Promising a setting that may not exist is the same defect as
 * promising a retry that cannot work.
 */
const UNSUPPORTED_REMEDY =
	'This browser will not let the app draw the file, so trying again here will not help — a ' +
	'different browser will build it.';

/** The rebuild's own promise, said once so every retryable cause says it identically. */
const FREE_REBUILD = 'Building it again costs nothing and does not use another generation.';

/** The exception's own words, reduced to a string, for `detail` and never for `message`. */
const detailOf = (error: unknown): string | null => {
	if (error instanceof Error && error.message.length > 0) return error.message;
	if (typeof error === 'string' && error.length > 0) return error;
	return null;
};

/**
 * A `SeamError`-shaped value, recognised without trusting that it is one.
 *
 * The `instanceof Error` rejection is the same hole `storage-failure.ts` closes, for the same
 * reason: an `Error` can carry a `code`, and reading one as a seam refusal is the single path by
 * which an exception's own words could reach this module's `message` branch.
 */
const asSeamError = (error: unknown): { code: string; message: string } | null => {
	if (typeof error !== 'object' || error === null) return null;
	if (error instanceof Error) return null;
	const candidate = error as { code?: unknown; message?: unknown };
	if (typeof candidate.code !== 'string' || candidate.code.length === 0) return null;
	if (typeof candidate.message !== 'string') return null;
	return { code: candidate.code, message: candidate.message };
};

/**
 * What the reader is told, and whether the rebuild is offered.
 *
 * Split from `classifyExportFailure` so the sentence for a cause is decided in one expression that
 * reads top to bottom, rather than assembled across the branches that detect the cause.
 */
const describe = (
	cause: ExportFailureCause,
	variant: OutputVariant
): { message: string; retry: ExportRetry } => {
	const subject = SUBJECT[variant];
	switch (cause) {
		case 'unsupported_here':
			// No rebuild. `BROWSER_REQUIRED` and `CANVAS_UNAVAILABLE` are properties of the browser
			// this page is open in, and it answers identically every time. The sentence carries the
			// only thing that actually works instead.
			return {
				message: `${subject} ${UNSUPPORTED_REMEDY}`,
				retry: { kind: 'none' }
			};
		case 'render_failed':
		case 'unknown':
			// The rebuild, and the whole reason this module exists. A print sheet is 2550 x 3300 at
			// 300dpi and the encode allocates all of it twice; a second attempt runs against a heap
			// the first one has since released. `unknown` shares this branch because the commonest way
			// to land in it is pdf-lib throwing, which is the same story.
			return { message: `${subject} ${FREE_REBUILD}`, retry: { kind: 'now' } };
		case 'unreadable_image':
			// No rebuild: the same bytes are refused identically. Says plainly that this is the app's
			// own fault, because every other sentence here implies the device is at fault and a reader
			// who reads this one that way will go looking for a setting that does not exist.
			return {
				message:
					`${subject} The picture came back in a form this step cannot read, so building ` +
					`it again would produce the same result. That is a fault in this app, not in ` +
					`your browser.`,
				retry: { kind: 'none' }
			};
		case 'no_page':
			// No rebuild and no consolation: there is no page, so there is nothing that "still works"
			// to name. Every call site checks for images first, so a reader should never see this.
			return {
				message: `${subject} There was no finished page to build it from.`,
				retry: { kind: 'none' }
			};
	}
};

/**
 * What a reader is told when one packaging variant could not be built.
 *
 * `error` is deliberately `unknown`: three of the six sites this replaces were `catch` blocks
 * writing `error.message` onto the screen, and a classifier that only accepted a well-formed
 * `SeamError` would have left them exactly as they were.
 */
export const classifyExportFailure = (
	variant: OutputVariant,
	error: unknown
): ExportFailure => {
	const seamError = asSeamError(error);
	if (seamError) {
		const cause = CAUSE_BY_CODE[seamError.code] ?? 'unknown';
		return {
			...describe(cause, variant),
			variant,
			cause,
			// The seam's own message is diagnostic, not reader-facing. It goes where the exception's
			// words go.
			detail: seamError.message.length > 0 ? seamError.message : null
		};
	}
	return {
		...describe('unknown', variant),
		variant,
		cause: 'unknown',
		detail: detailOf(error)
	};
};
