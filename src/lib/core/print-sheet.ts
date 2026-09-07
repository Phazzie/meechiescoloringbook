// Purpose: Everything the app needs to decide about putting a coloring page on actual paper —
//          whether there is anything to print, what the print control says, and what the browser
//          should call the sheet when the reader saves it instead of printing it.
// Why: Four surfaces tell the reader to "Print it. Color it." — `VerdictPageStudio.svelte`,
//      `MeechieTools.svelte`, `MeechieModePage.svelte` and `StudioHero.svelte` — and the generate
//      button says "Printing the truth…" while it works. Until now none of them could print. There
//      was no print control anywhere in the app and not one `@media print` rule in the repository,
//      so the reader who did what every one of those sentences told them to do and pressed Print
//      got the *app*: measured on `main` at `f86ffdc`, four sheets of navigation, hero photography
//      and eight photographic mode cards, 938 KB of ink, and nothing on any of them to colour.
// Info flow: how many previews are on the surface (+ the page's own title) -> this module -> the
//            print button's label and disabled state, the sentence explaining why it is off, and
//            the document title the print job runs under.
//
// Pure. It reads no clock, touches no DOM and calls no browser API: `window.print()` lives in
// `PrintPageButton.svelte`, which is the one place in the app that talks to the printer.

/** How many sheets a print job would produce, and why it might produce none. */
export type PrintJobStatus =
	/** There is at least one finished picture on this surface. */
	| 'ready'
	/** There is no picture yet, so printing would emit blank paper. */
	| 'no-page';

/** A print job as the reader meets it: one button, one label, one reason it might be off. */
export type PrintJob = {
	status: PrintJobStatus;
	/** Sheets this job would produce — one per finished picture. Never negative. */
	sheetCount: number;
	canPrint: boolean;
	/** What the button says. Names the number when it is more than one, so nobody is surprised. */
	buttonLabel: string;
	/**
	 * Why the button is off, or `''` when it is not.
	 *
	 * Doubles as the sentence printed on the fallback sheet when someone reaches for their
	 * browser's own Print command on a screen that has no page on it. Both surfaces need the same
	 * sentence, which is why it is one string here rather than two written separately.
	 */
	blockedReason: string;
	/**
	 * What the browser calls this print job.
	 *
	 * Chromium and Firefox use `document.title` as the default filename when the reader picks
	 * "Save as PDF" from the print dialog, and print it into the page header. Left alone, every
	 * sheet anyone ever saves out of this app is called the same thing, because every route's
	 * title is about the app rather than about the page on the paper.
	 */
	documentTitle: string;
};

/**
 * The name a saved sheet gets when the page has no title of its own to use.
 *
 * Not the route title: this is the *page* on the paper, and a file called after the app tells the
 * reader nothing once it is sitting in a downloads folder beside eleven others.
 */
export const FALLBACK_PRINT_TITLE = 'Meechie coloring page';

/** Above this the print dialog's filename field truncates, and long names help nobody. */
const MAX_DOCUMENT_TITLE_LENGTH = 80;

/**
 * Characters no major filesystem accepts in a name, plus the C0 control range.
 *
 * The print dialog's filename comes straight from `document.title`, so a verdict containing `?` or
 * `/` — and Meechie's verdicts contain both — reaches the save dialog as an invalid name that each
 * platform then mangles in its own way. Replaced with a space rather than deleted, so `Who/What`
 * does not become `WhoWhat`.
 */
// eslint-disable-next-line no-control-regex
const FILENAME_HOSTILE = /[\u0000-\u001f<>:"/\\|?*]+/g;

/**
 * Turn a page title into something a print dialog can put in its filename field.
 *
 * Trailing dots and spaces go too: Windows silently strips them from filenames, so a title ending
 * in one produces a saved file whose name is not the name the dialog showed.
 */
export const printDocumentTitle = (
	pageTitle: string | null | undefined,
	fallback: string = FALLBACK_PRINT_TITLE
): string => {
	const cleaned = (pageTitle ?? '')
		.replace(FILENAME_HOSTILE, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[. ]+$/, '')
		.trim();
	if (cleaned.length === 0) return fallback;
	if (cleaned.length <= MAX_DOCUMENT_TITLE_LENGTH) return cleaned;
	const sliced = cleaned.slice(0, MAX_DOCUMENT_TITLE_LENGTH).trim();
	const lastSpace = sliced.lastIndexOf(' ');
	// Only break on a word boundary when one is far enough in to leave a usable name behind.
	const trimmed = lastSpace > MAX_DOCUMENT_TITLE_LENGTH / 2 ? sliced.slice(0, lastSpace) : sliced;
	return trimmed.replace(/[.,;:\-\s]+$/, '').trim() || fallback;
};

/**
 * The sentence a reader gets when there is nothing on the paper.
 *
 * It says what to do, not what went wrong — nothing has gone wrong. Exported so the print-only
 * fallback sheet in the layout and the disabled button cannot drift into saying two different
 * things about one state.
 */
export const NOTHING_TO_PRINT =
	'No coloring page on this screen yet. Make one first — printing puts the picture on paper, not the app.';

/** A count that is actually a count: no negatives, no fractions, no NaN. */
const toSheetCount = (value: number): number =>
	Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/**
 * Describe the print job for a surface holding `sheetCount` finished pictures.
 *
 * The count is passed in rather than the pictures themselves: this module has no business knowing
 * what a `GeneratedImage` is, and every caller already has the preview array it renders from.
 */
export const describePrintJob = (input: {
	sheetCount: number;
	pageTitle?: string | null;
}): PrintJob => {
	const sheetCount = toSheetCount(input.sheetCount);
	const documentTitle = printDocumentTitle(input.pageTitle);
	if (sheetCount === 0) {
		return {
			status: 'no-page',
			sheetCount: 0,
			canPrint: false,
			buttonLabel: 'Print',
			blockedReason: NOTHING_TO_PRINT,
			documentTitle
		};
	}
	return {
		status: 'ready',
		sheetCount,
		canPrint: true,
		buttonLabel: sheetCount === 1 ? 'Print this page' : `Print ${sheetCount} pages`,
		blockedReason: '',
		documentTitle
	};
};
