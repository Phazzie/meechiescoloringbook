// Purpose: Unit tests for the one call to the packaging adapter in the app.
// Why: There used to be three, byte-similar and separately maintained, and all three handled the
//      seam's two failure shapes slightly differently while agreeing on the one thing that was
//      wrong: they kept `message` and threw `code` away. These tests pin that both shapes now come
//      back as one classified attempt, that a rejection never escapes to a caller's catch (which on
//      every surface writes the field a FAILED GENERATION uses), and that only this module reaches
//      the adapter.
// Info flow: mocked OutputPackagingSeam -> packagePageVariant -> assertions.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { globSync } from 'node:fs';
import { outputPackagingAdapter } from '../../src/lib/adapters/output-packaging-seam';
import { packagePageVariant } from '../../src/lib/components/page-packaging';
import type { GeneratedImage } from '../../contracts/image-generation.contract';

const IMAGE: GeneratedImage = {
	id: 'image-1',
	data: 'aGk=',
	format: 'png',
	mimeType: 'image/png',
	encoding: 'base64'
};

const PRINT_FILE = {
	filename: 'meechie-page.pdf',
	mimeType: 'application/pdf',
	dataBase64: 'cGRm'
};

describe('packagePageVariant', () => {
	it('asks the seam for exactly one variant', () => {
		// Never `variants: ['print', 'square']`. The adapter returns on its first error WITHOUT its
		// accumulated files, so asking for both at once loses the printable PDF whenever the share
		// canvas is what breaks — and the PDF is the product.
		const spy = vi
			.spyOn(outputPackagingAdapter, 'package')
			.mockResolvedValue({ ok: true, value: { files: [PRINT_FILE] } });

		return packagePageVariant('square', [IMAGE], 'base', 'A4').then(() => {
			expect(spy).toHaveBeenCalledTimes(1);
			expect(spy.mock.calls[0][0].variants).toEqual(['square']);
			expect(spy.mock.calls[0][0].pageSize).toBe('A4');
			expect(spy.mock.calls[0][0].fileBaseName).toBe('base');
		});
	});

	it('returns the files and no failure when the variant was built', async () => {
		vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: true,
			value: { files: [PRINT_FILE] }
		});

		const attempt = await packagePageVariant('print', [IMAGE], 'base', 'US_Letter');

		expect(attempt).toEqual({
			variant: 'print',
			files: [PRINT_FILE],
			failure: null,
			pageSize: 'US_Letter'
		});
	});

	it('classifies a seam refusal by its code, not by its message', async () => {
		vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: false,
			error: {
				code: 'CANVAS_UNAVAILABLE',
				message: 'Canvas context unavailable for resizing.'
			}
		});

		const attempt = await packagePageVariant('square', [IMAGE], 'base', 'US_Letter');

		expect(attempt.files).toEqual([]);
		expect(attempt.failure?.cause).toBe('unsupported_here');
		// The code is the thing all three call sites used to drop on the floor.
		expect(attempt.failure?.message).not.toContain('Canvas context unavailable');
		expect(attempt.failure?.detail).toBe('Canvas context unavailable for resizing.');
	});

	it('turns a rejection into an attempt rather than letting it reach the caller', async () => {
		// The adapter has no try/catch of its own: pdf-lib's embedPng, embedJpg and save all throw,
		// and so does the canvas. A rejection escaping here lands in the caller's outer catch, which
		// on every surface writes the field a failed generation uses — directly above the button
		// that buys another one.
		vi.spyOn(outputPackagingAdapter, 'package').mockRejectedValue(
			new Error('pdf-lib exploded')
		);

		const attempt = await packagePageVariant('print', [IMAGE], 'base', 'US_Letter');

		expect(attempt.files).toEqual([]);
		expect(attempt.failure?.cause).toBe('unknown');
		expect(attempt.failure?.message).not.toContain('pdf-lib');
		expect(attempt.failure?.detail).toBe('pdf-lib exploded');
	});

	it('carries the page size it packaged for, not one a caller might change later', async () => {
		// The Page Controls stay enabled while packaging runs. The attempt is what the export row
		// reads the paper off, so it has to be a fact about the files rather than a live value.
		vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: false,
			error: { code: 'PNG_ENCODING_FAILED', message: 'nope' }
		});

		const attempt = await packagePageVariant('print', [IMAGE], 'base', 'A4');

		expect(attempt.pageSize).toBe('A4');
	});
});

describe('only one module packages a page', () => {
	it('is the only place in src/ that calls the packaging adapter', () => {
		// The invariant three copies of this function existed to violate. `SharePageButton` holds the
		// same rule for `navigator.share` and `PrintPageButton` for `print()`, for the same reason: a
		// fix made in one copy is a fix the other copies do not get.
		const callers = globSync('src/**/*.{ts,svelte}').filter((path) => {
			// The seam's own implementation, and `output-packaging.adapter.ts`, which is the legacy
			// flat-path re-export shim rather than a caller.
			if (path.includes('adapters/output-packaging')) return false;
			if (path.endsWith('page-packaging.ts')) return false;
			return /\boutputPackagingAdapter\b/.test(readFileSync(path, 'utf8'));
		});

		expect(callers).toEqual([]);
	});
});
