// Purpose: Unit tests for what a reader is told when a download could not be built, and whether the
//          free rebuild is offered.
// Why: Three separately maintained copies of one packaging call read `result.error.message`,
//      discarded `result.error.code`, and wrote a caught exception's message into the same
//      reader-facing field. These tests pin the two rules that replaced that — an exception's or a
//      seam's words never become a reader's sentence, and a button is offered only where pressing it
//      could land differently — and the guard that keeps the code table total over the adapter's own
//      codes rather than over a list copied into the classifier.
// Info flow: seam error / thrown value + variant -> classifyExportFailure -> assertions.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyExportFailure } from '../../src/lib/core/export-failure';
import { OutputVariantSchema } from '../../src/lib/seams/output-packaging-seam/contract';

const ADAPTER_PATH = 'src/lib/adapters/output-packaging-seam/index.ts';

/**
 * Every `code:` literal the packaging adapter can emit, read from the adapter itself.
 *
 * The guard `storage-failure.test.ts` established, for the same reason: a table hand-copied from an
 * adapter is a table that stops agreeing with it. `ENCODING_ERROR_CODES[...]` is a computed lookup
 * rather than a literal, so its three values are picked up by the second pattern.
 */
const adapterErrorCodes = (): string[] => {
	const source = readFileSync(ADAPTER_PATH, 'utf8');
	const literals = [...source.matchAll(/code:\s*'([A-Z_]+)'/g)].map(
		(match) => match[1]
	);
	const computed = [...source.matchAll(/^\s*(?:png|jpg|webp):\s*'([A-Z_]+)'/gm)].map(
		(match) => match[1]
	);
	return [...new Set([...literals, ...computed])];
};

describe('the adapter code table stays total', () => {
	it('reads at least the ten codes the adapter is known to emit', () => {
		// A sanity check on the reader itself: a regex that silently stopped matching would make
		// every assertion below vacuously true.
		expect(adapterErrorCodes().length).toBeGreaterThanOrEqual(10);
	});

	it('classifies every code the packaging adapter emits as something other than unknown', () => {
		// `unknown` is the branch that offers the rebuild. A new adapter failure landing there by
		// default would invite a reader to press a button against a condition that cannot change,
		// which is exactly the defect this classifier was written to remove.
		for (const code of adapterErrorCodes()) {
			const failure = classifyExportFailure('print', {
				code,
				message: 'developer wording'
			});
			expect(failure.cause, `${code} is not named by CAUSE_BY_CODE`).not.toBe(
				'unknown'
			);
		}
	});
});

describe('classifyExportFailure', () => {
	it('never puts the seam’s own words in the sentence, and keeps them as detail', () => {
		const failure = classifyExportFailure('square', {
			code: 'CANVAS_UNAVAILABLE',
			message: 'Canvas context unavailable for resizing.'
		});

		expect(failure.message).not.toContain('Canvas context unavailable');
		expect(failure.detail).toBe('Canvas context unavailable for resizing.');
	});

	it('never puts a thrown exception’s words in the sentence, and keeps them as detail', () => {
		const failure = classifyExportFailure(
			'print',
			new Error('pdf-lib could not embed these bytes')
		);

		expect(failure.message).not.toContain('pdf-lib');
		expect(failure.detail).toBe('pdf-lib could not embed these bytes');
		expect(failure.cause).toBe('unknown');
	});

	it('reads an Error carrying a code as a thrown exception, not as a seam refusal', () => {
		// The one hole through which an exception's own words could reach the sentence: `Error` can
		// carry a `code`, and a shape check alone would read it as a `SeamError` and pass its message
		// through. Same closure as `storage-failure.ts`.
		const thrown = Object.assign(new Error('ENOENT, no such thing'), {
			code: 'CANVAS_UNAVAILABLE'
		});

		const failure = classifyExportFailure('print', thrown);

		expect(failure.cause).toBe('unknown');
		expect(failure.message).not.toContain('ENOENT');
		expect(failure.detail).toBe('ENOENT, no such thing');
	});

	it('offers no rebuild when the browser will never do it', () => {
		for (const code of ['BROWSER_REQUIRED', 'CANVAS_UNAVAILABLE']) {
			const failure = classifyExportFailure('print', { code, message: 'nope' });
			expect(failure.cause).toBe('unsupported_here');
			expect(failure.retry.kind).toBe('none');
			// And says so, rather than leaving a reader pressing nothing.
			expect(failure.message).toContain('will not help');
		}
	});

	it('offers the rebuild when the draw or the encode missed', () => {
		for (const code of [
			'PNG_ENCODING_FAILED',
			'SVG_IMAGE_LOAD_FAILED',
			'IMAGE_RESIZE_FAILED'
		]) {
			const failure = classifyExportFailure('print', { code, message: 'nope' });
			expect(failure.cause).toBe('render_failed');
			expect(failure.retry.kind).toBe('now');
			// The promise that makes it worth pressing: this is the one retry in the app with no
			// quota, no provider and no network behind it.
			expect(failure.message).toContain('costs nothing');
			expect(failure.message).toContain('does not use another generation');
		}
	});

	it('offers no rebuild for a picture this step cannot read, and says whose fault it is', () => {
		for (const code of [
			'PNG_ENCODING_UNSUPPORTED',
			'JPG_ENCODING_UNSUPPORTED',
			'WEBP_ENCODING_UNSUPPORTED',
			'UNSUPPORTED_IMAGE_FORMAT'
		]) {
			const failure = classifyExportFailure('square', { code, message: 'nope' });
			expect(failure.cause).toBe('unreadable_image');
			expect(failure.retry.kind).toBe('none');
			// Every other sentence here implies the device is at fault; a reader who reads this one
			// that way goes looking for a browser setting that does not exist.
			expect(failure.message).toContain('a fault in this app, not in your browser');
		}
	});

	it('offers no rebuild and no consolation when there was no page at all', () => {
		const failure = classifyExportFailure('print', {
			code: 'NO_IMAGES',
			message: 'No images provided for packaging.'
		});

		expect(failure.cause).toBe('no_page');
		expect(failure.retry.kind).toBe('none');
		// Nothing "still works" to name when there is no page. Claiming otherwise would be the same
		// invented reassurance the old sentence gave.
		expect(failure.message).not.toContain('still');
	});

	it('names what the reader still has, per variant', () => {
		// The half of the sentence the old wording had no room for, and the half that decides whether
		// a free local failure reads as a lost page or a missing convenience.
		const print = classifyExportFailure('print', {
			code: 'PNG_ENCODING_FAILED',
			message: 'nope'
		});
		expect(print.message).toContain('The original image is still in the list below');
		expect(print.message).toContain('Print still works');

		for (const variant of ['square', 'chat'] as const) {
			const failure = classifyExportFailure(variant, {
				code: 'PNG_ENCODING_FAILED',
				message: 'nope'
			});
			expect(failure.message).toContain(
				'The printable download and the original image are unaffected.'
			);
		}
	});

	it('writes a whole sentence for every variant the seam defines', () => {
		for (const variant of OutputVariantSchema.options) {
			const failure = classifyExportFailure(variant, {
				code: 'PNG_ENCODING_FAILED',
				message: 'nope'
			});
			expect(failure.variant).toBe(variant);
			expect(failure.message).not.toContain('undefined');
			expect(failure.message).toContain('could not be built.');
		}
	});

	it('never claims the generation failed', () => {
		// Packaging runs after the image exists and after it has been paid for, so it never can. A
		// notice that reads otherwise is what sends a reader to buy a second generation.
		for (const variant of OutputVariantSchema.options) {
			for (const code of [
				'NO_IMAGES',
				'BROWSER_REQUIRED',
				'CANVAS_UNAVAILABLE',
				'PNG_ENCODING_FAILED',
				'UNSUPPORTED_IMAGE_FORMAT',
				'SOMETHING_NEW'
			]) {
				const { message } = classifyExportFailure(variant, { code, message: 'x' });
				expect(message).not.toMatch(/generation failed/i);
				expect(message).not.toMatch(/your page failed/i);
				expect(message).not.toMatch(/try generating/i);
			}
		}
	});

	it('falls back to a rebuild for a value that is not an error at all', () => {
		const failure = classifyExportFailure('chat', 'a bare string');

		expect(failure.cause).toBe('unknown');
		expect(failure.detail).toBe('a bare string');
		expect(failure.retry.kind).toBe('now');
	});

	it('carries no detail when there is nothing underneath', () => {
		expect(classifyExportFailure('print', undefined).detail).toBeNull();
		expect(classifyExportFailure('print', new Error('')).detail).toBeNull();
		expect(
			classifyExportFailure('print', { code: 'NO_IMAGES', message: '' }).detail
		).toBeNull();
	});
});
