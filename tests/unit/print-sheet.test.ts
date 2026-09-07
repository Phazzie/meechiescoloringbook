// Purpose: Unit tests for the print job's policy — when the app can print, what the control says,
//          and what the browser calls the sheet the reader saves.
// Why: The app told the reader to "Print it. Color it." on four surfaces and had no way to print,
//      no print control and no `@media print` rule anywhere in the repository. These tests pin the
//      decisions that replaced that, and in particular the two that are invisible from the outside:
//      that a surface with no picture reports itself as unprintable rather than emitting blank
//      paper, and that a page title reaches the print dialog's filename field as something a
//      filesystem will actually accept.
// Info flow: sheet counts and page titles -> `describePrintJob` / `printDocumentTitle` ->
//            assertions.
import { describe, expect, it } from 'vitest';
import {
	describePrintJob,
	printDocumentTitle,
	FALLBACK_PRINT_TITLE,
	NOTHING_TO_PRINT
} from '../../src/lib/core/print-sheet';

describe('describePrintJob', () => {
	it('refuses to print a surface holding no picture, and says what to do instead', () => {
		const job = describePrintJob({ sheetCount: 0, pageTitle: 'Receipt Energy' });
		expect(job.status).toBe('no-page');
		expect(job.canPrint).toBe(false);
		expect(job.sheetCount).toBe(0);
		expect(job.blockedReason).toBe(NOTHING_TO_PRINT);
	});

	it('offers to print one finished page', () => {
		const job = describePrintJob({ sheetCount: 1, pageTitle: 'Receipt Energy' });
		expect(job.status).toBe('ready');
		expect(job.canPrint).toBe(true);
		expect(job.buttonLabel).toBe('Print this page');
		// Nothing is wrong, so there is nothing to explain.
		expect(job.blockedReason).toBe('');
	});

	it('names the number of sheets when a job would produce more than one', () => {
		expect(describePrintJob({ sheetCount: 3 }).buttonLabel).toBe('Print 3 pages');
	});

	// The count comes from an array length today, but it is a number on a public boundary and a
	// negative or fractional one must not produce "Print -1 pages" or an enabled button.
	it.each([
		[-1, 0],
		[0, 0],
		[Number.NaN, 0],
		[Number.POSITIVE_INFINITY, 0],
		[2.7, 2]
	])('normalises a sheet count of %p to %p', (given, expected) => {
		const job = describePrintJob({ sheetCount: given });
		expect(job.sheetCount).toBe(expected);
		expect(job.canPrint).toBe(expected > 0);
	});

	it('falls back to a page-shaped name when the surface has no title yet', () => {
		expect(describePrintJob({ sheetCount: 1 }).documentTitle).toBe(FALLBACK_PRINT_TITLE);
		expect(describePrintJob({ sheetCount: 1, pageTitle: null }).documentTitle).toBe(
			FALLBACK_PRINT_TITLE
		);
	});

	// A blocked job still carries a document title. The reader can reach the print dialog through
	// their browser's own Print command whatever this button says, and the sheet they save there
	// should still be named after the page rather than after the app.
	it('carries a document title even when it cannot print', () => {
		expect(describePrintJob({ sheetCount: 0, pageTitle: 'Receipt Energy' }).documentTitle).toBe(
			'Receipt Energy'
		);
	});
});

describe('printDocumentTitle', () => {
	it('keeps a title a filesystem can already accept', () => {
		expect(printDocumentTitle('Receipt Energy')).toBe('Receipt Energy');
	});

	// The one that matters. Meechie's page titles routinely contain `?` and `/` — the app's own
	// nav link is "Who Fucked Up?" — and `document.title` is what the print dialog puts straight
	// into its filename field.
	it('replaces characters a filename cannot hold, without gluing the words together', () => {
		expect(printDocumentTitle('Who Fucked Up? claim/reality')).toBe(
			'Who Fucked Up claim reality'
		);
		expect(printDocumentTitle('a<b>c:d"e|f*g')).toBe('a b c d e f g');
	});

	it('strips control characters rather than passing them to the save dialog', () => {
		// Built from code points rather than typed, so this file stays free of control bytes.
		const [nul, unitSeparator] = [0, 31].map((code) => String.fromCharCode(code));
		const raw = `Receipt${nul}Energy${unitSeparator}`;
		expect(printDocumentTitle(raw)).toBe('Receipt Energy');
	});

	it('drops trailing dots and spaces, which Windows silently removes from filenames', () => {
		expect(printDocumentTitle('Receipt Energy...')).toBe('Receipt Energy');
		expect(printDocumentTitle('Receipt Energy   ')).toBe('Receipt Energy');
	});

	it('falls back when nothing printable survives', () => {
		expect(printDocumentTitle('')).toBe(FALLBACK_PRINT_TITLE);
		expect(printDocumentTitle('   ')).toBe(FALLBACK_PRINT_TITLE);
		expect(printDocumentTitle('///')).toBe(FALLBACK_PRINT_TITLE);
		expect(printDocumentTitle(undefined)).toBe(FALLBACK_PRINT_TITLE);
	});

	it('honours a caller-supplied fallback', () => {
		expect(printDocumentTitle('', 'Sheet')).toBe('Sheet');
	});

	it('shortens a long title at a word boundary, with no trailing punctuation', () => {
		const long =
			'He said he was asleep and the receipt says otherwise, which is the whole story here';
		const shortened = printDocumentTitle(long);
		expect(shortened.length).toBeLessThanOrEqual(80);
		// Cut between words, not through one.
		expect(long.startsWith(shortened)).toBe(true);
		expect(shortened).not.toMatch(/[.,;:\-\s]$/);
	});

	it('still returns a usable name when a long title has no word boundary to break on', () => {
		const shortened = printDocumentTitle('x'.repeat(200));
		expect(shortened).toBe('x'.repeat(80));
	});
});
