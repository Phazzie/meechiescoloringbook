// Purpose: Unit tests for the send policy — whether a page can be handed to somebody else, which
//          file goes, what the control says, what travels with the picture, and what a cancelled
//          send means.
// Why: The app told the reader on two surfaces to "Send it to whoever needs to see it" and had no
//      way to send anything: zero matches for `navigator.share` in the whole repository, and no
//      send action in `studioActions`. These tests pin the decisions that replaced that, and in
//      particular the three that are invisible from the outside — that a browser which cannot take
//      a file says so instead of failing at the share sheet, that the clipboard is only ever
//      offered a PNG, and that backing out of the share sheet is not an error.
// Info flow: export rows + a browser capability -> `describeShareJob` / `chooseShareExports` /
//            `decodeDataUrl` -> assertions.
import { describe, expect, it } from 'vitest';
import {
	APP_SHARE_NAME,
	chooseShareExports,
	decodeDataUrl,
	describeShareFailure,
	describeShareJob,
	FALLBACK_SHARE_TITLE,
	isShareCancellation,
	NOTHING_TO_SEND,
	SHARE_UNSUPPORTED,
	shareMessageText
} from '../../src/lib/core/share-page';
import type { PageExport, PageExportKind } from '../../src/lib/core/page-exports';

const exportRow = (kind: PageExportKind, mimeType: string, filename: string): PageExport => ({
	kind,
	filename,
	mimeType,
	href: `data:${mimeType};base64,AAAA`,
	label: 'label',
	purpose: 'purpose',
	sizeLabel: '1 KB',
	byteLength: 1024
});

const printPdf = exportRow('print', 'application/pdf', 'page.pdf');
const squarePng = exportRow('square', 'image/png', 'page-square.png');
const chatPng = exportRow('chat', 'image/png', 'page-chat.png');
const originalPng = exportRow('original', 'image/png', 'page-original.png');
const originalSvg = exportRow('original', 'image/svg+xml', 'page-original.svg');

describe('describeShareJob', () => {
	it('refuses to send from a surface holding no picture, and says what to do instead', () => {
		const job = describeShareJob({ exports: [], pageTitle: 'Receipt Energy', capability: 'files' });
		expect(job.status).toBe('no-page');
		expect(job.canSend).toBe(false);
		expect(job.buttonLabel).toBe('Send');
		expect(job.blockedReason).toBe(NOTHING_TO_SEND);
		expect(job.payload.files).toEqual([]);
	});

	it('reports no page before it reports no capability, so a cold screen reads the same everywhere', () => {
		// The prerendered document is the one the service worker replays offline, and no browser
		// capability is known while it is being built. With no page there is nothing to send on any
		// device, and that is the sentence both the built document and the hydrated one must show.
		for (const capability of ['files', 'clipboard-image', 'none'] as const) {
			expect(describeShareJob({ exports: [], capability }).blockedReason).toBe(NOTHING_TO_SEND);
		}
	});

	it('offers to send a finished page through the share sheet', () => {
		const job = describeShareJob({
			exports: [printPdf, squarePng, originalPng],
			pageTitle: 'Receipt Energy',
			capability: 'files'
		});
		expect(job.status).toBe('ready');
		expect(job.method).toBe('web-share');
		expect(job.canSend).toBe(true);
		expect(job.buttonLabel).toBe('Send this page');
		expect(job.blockedReason).toBe('');
		// The square PNG: the whole page letterboxed onto white, not cropped, and the one file a
		// chat previews inline.
		expect(job.payload.files).toEqual([squarePng]);
	});

	it('sends every picture of a multi-picture page, and counts them on the button', () => {
		const second = exportRow('square', 'image/png', 'page-2-square.png');
		const job = describeShareJob({
			exports: [printPdf, squarePng, second],
			capability: 'files'
		});
		expect(job.payload.files).toEqual([squarePng, second]);
		expect(job.buttonLabel).toBe('Send 2 pages');
	});

	it('falls back to the clipboard, one PNG only, when the browser has no share sheet', () => {
		const second = exportRow('square', 'image/png', 'page-2-square.png');
		const job = describeShareJob({
			exports: [printPdf, squarePng, second],
			capability: 'clipboard-image'
		});
		expect(job.status).toBe('ready');
		expect(job.method).toBe('clipboard-image');
		expect(job.buttonLabel).toBe('Copy the picture');
		// One image is all a platform clipboard holds. Copying two and keeping the last would be a
		// lie told in a confirmation message.
		expect(job.payload.files).toEqual([squarePng]);
	});

	it('says so when the page exists and the browser cannot hand it over', () => {
		const job = describeShareJob({
			exports: [printPdf, squarePng],
			capability: 'none'
		});
		expect(job.status).toBe('unsupported');
		expect(job.canSend).toBe(false);
		expect(job.blockedReason).toBe(SHARE_UNSUPPORTED);
		// The downloads are right there and they work, so the sentence points at them.
		expect(job.blockedReason).toContain('Download it from the row above');
	});

	it('says so when the only file is one the clipboard will not take', () => {
		// A PDF is the one export no clipboard accepts and no messenger previews. Reporting this as
		// "unsupported" up front is the difference between a disabled button that explains itself
		// and a rejected promise after the reader has already pressed it.
		const job = describeShareJob({ exports: [printPdf], capability: 'clipboard-image' });
		expect(job.status).toBe('unsupported');
		expect(job.payload.files).toEqual([]);
	});
});

describe('chooseShareExports', () => {
	it('prefers the square render, then the chat one, then the original, then the PDF', () => {
		const all = [printPdf, originalPng, chatPng, squarePng];
		expect(chooseShareExports(all, 'web-share')).toEqual([squarePng]);
		expect(chooseShareExports([printPdf, originalPng, chatPng], 'web-share')).toEqual([chatPng]);
		expect(chooseShareExports([printPdf, originalPng], 'web-share')).toEqual([originalPng]);
		expect(chooseShareExports([printPdf], 'web-share')).toEqual([printPdf]);
	});

	it('will send an SVG original through the share sheet but never through the clipboard', () => {
		// The clipboard is specified around a small set of media types and PNG is the only image one
		// carried by all three engines; the share sheet gets the final say itself, at the click.
		expect(chooseShareExports([originalSvg], 'web-share')).toEqual([originalSvg]);
		expect(chooseShareExports([originalSvg], 'clipboard-image')).toEqual([]);
	});

	it('is case-insensitive about the media type, because the row does not promise a case', () => {
		const shouty = { ...squarePng, mimeType: 'IMAGE/PNG' };
		expect(chooseShareExports([shouty], 'clipboard-image')).toEqual([shouty]);
	});

	it('offers nothing at all when there is no method', () => {
		expect(chooseShareExports([squarePng, printPdf], 'none')).toEqual([]);
	});
});

describe('shareMessageText', () => {
	it('carries the page title, Meechie’s line, and where it came from', () => {
		const text = shareMessageText('Receipt Energy', 'The story folded before the receipt opened.');
		expect(text).toContain('Receipt Energy');
		expect(text).toContain('The story folded before the receipt opened.');
		expect(text).toContain(APP_SHARE_NAME);
	});

	it('names the page even when there is no title and no line', () => {
		expect(shareMessageText(null, null)).toContain(FALLBACK_SHARE_TITLE);
		expect(shareMessageText('   ', '')).toContain(FALLBACK_SHARE_TITLE);
	});

	it('does not repeat the line when the title already carries it', () => {
		// The mode routes and the tools hub compact the page title *out of* the verdict, so the two
		// are frequently the same sentence. Sending `Receipt Energy — “Receipt Energy”` is what
		// happens when each call site is left to decide this for itself.
		const text = shareMessageText('Receipt Energy Rules', 'receipt energy');
		expect(text).not.toContain('“');
		expect(text.startsWith('Receipt Energy Rules\n')).toBe(true);
	});

	it('flattens a multi-line verdict rather than sending a ragged block', () => {
		const text = shareMessageText('Receipt Energy', 'He said\n\n  he was  asleep.');
		expect(text).toContain('He said he was asleep.');
	});

	it('caps a runaway quote at a word boundary instead of mid-word', () => {
		const text = shareMessageText('Receipt Energy', `${'receipt '.repeat(200)}end`);
		expect(text.length).toBeLessThanOrEqual(281);
		expect(text.endsWith('…')).toBe(true);
		// Cut between words: no half-word before the ellipsis.
		expect(text).not.toMatch(/recei…$/);
	});
});

describe('isShareCancellation', () => {
	it('treats backing out of the share sheet as the non-event it is', () => {
		expect(isShareCancellation('AbortError')).toBe(true);
		expect(isShareCancellation('NotAllowedError')).toBe(true);
	});

	it('still reports a real failure', () => {
		expect(isShareCancellation('TypeError')).toBe(false);
		expect(isShareCancellation('DataError')).toBe(false);
		expect(isShareCancellation('')).toBe(false);
	});
});

describe('describeShareFailure', () => {
	it('affirms the page before it names the failure', () => {
		// Sending happens long after the paid generation succeeded. A message that reads like the
		// generation failed invites the reader to buy another one to fix a free local step — the
		// same defect the packaging failure sentence exists to avoid.
		expect(describeShareFailure('Permission denied.')).toBe(
			'Your page is fine — this browser would not send it: Permission denied.'
		);
	});

	it('still affirms the page when the browser says nothing useful', () => {
		expect(describeShareFailure('   ')).toBe('Your page is fine — this browser would not send it.');
	});
});

describe('decodeDataUrl', () => {
	it('recovers exactly the bytes a packaged file carries', () => {
		const bytes = new Uint8Array([0, 1, 2, 250, 255]);
		const base64 = Buffer.from(bytes).toString('base64');
		const decoded = decodeDataUrl(`data:image/png;base64,${base64}`);
		expect(decoded?.mimeType).toBe('image/png');
		expect([...(decoded?.bytes ?? [])]).toEqual([...bytes]);
	});

	it('recovers an SVG original, which arrives percent-encoded rather than base64', () => {
		const markup = '<svg xmlns="http://www.w3.org/2000/svg"><title>Receipt Energy</title></svg>';
		const decoded = decodeDataUrl(`data:image/svg+xml;utf8,${encodeURIComponent(markup)}`);
		expect(decoded?.mimeType).toBe('image/svg+xml');
		expect(new TextDecoder().decode(decoded?.bytes)).toBe(markup);
	});

	it('counts bytes, not characters, for text a coloring page title routinely contains', () => {
		const markup = '<svg><title>“Receipt Energy” — 100%</title></svg>';
		const decoded = decodeDataUrl(`data:image/svg+xml;utf8,${encodeURIComponent(markup)}`);
		expect(decoded?.bytes.length).toBe(Buffer.byteLength(markup, 'utf8'));
		expect(decoded?.bytes.length).toBeGreaterThan(markup.length);
	});

	it('returns nothing rather than a guess for anything it cannot read', () => {
		// A malformed file handed to a share sheet fails inside the target app, where this app can
		// no longer explain it.
		expect(decodeDataUrl('https://example.com/page.png')).toBeNull();
		expect(decodeDataUrl('data:image/png;base64')).toBeNull();
		expect(decodeDataUrl('data:image/png;base64,!!!not base64!!!')).toBeNull();
		expect(decodeDataUrl('data:image/svg+xml;utf8,%E0%A4%A')).toBeNull();
	});

	it('falls back to a neutral media type when the URL declares none', () => {
		expect(decodeDataUrl('data:,plain')?.mimeType).toBe('application/octet-stream');
	});
});
