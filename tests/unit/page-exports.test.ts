// Purpose: Unit tests for the export-row descriptions and what the row says about a failed
//           packaging attempt.
// Why: The studio's download row used to render one hardcoded label per file, so nothing about a
//      download was derived from the download. These tests pin the derivations that replaced it —
//      including that they stay total over the seam's own variant enum rather than over a list
//      copied into this module. An attempt's failure is now a classified `ExportFailure` rather
//      than the seam's own string, so these also pin that no seam wording reaches this module at
//      all.
// Info flow: packaging attempts / generated images -> described exports + failure lines + the
//            rebuild label -> assertions.
import { describe, expect, it } from 'vitest';
import {
	base64ByteLength,
	describeOriginalImageExport,
	describePackagedExport,
	describePackagedExports,
	fileTypeLabel,
	formatByteSize,
	generatedImageByteLength,
	failedExportVariants,
	mergeRebuiltAttempts,
	pageExportFailures,
	pageExportRetryLabel,
	summarisePageExportFailures,
	type PageExportAttempt
} from '../../src/lib/core/page-exports';
import { classifyExportFailure } from '../../src/lib/core/export-failure';
import { OutputVariantSchema } from '../../src/lib/seams/output-packaging-seam/contract';
import type { OutputVariant } from '../../src/lib/seams/output-packaging-seam/contract';
import type { PackagedFile } from '../../src/lib/seams/output-packaging-seam/contract';
import type { GeneratedImage } from '../../contracts/image-generation.contract';

const pdfFile = (dataBase64: string): PackagedFile => ({
	filename: 'meechie-coloring-page-1.pdf',
	mimeType: 'application/pdf',
	dataBase64
});

/** A failed attempt, classified exactly as `packagePageVariant` classifies one. */
const canvasFailure = (variant: OutputVariant) =>
	classifyExportFailure(variant, {
		code: 'CANVAS_UNAVAILABLE',
		message: 'Canvas context unavailable for resizing.'
	});

/** A failed attempt whose cause is one a rebuild could get past. */
const encodeFailure = (variant: OutputVariant) =>
	classifyExportFailure(variant, {
		code: 'PNG_ENCODING_FAILED',
		message: 'Failed to encode PNG data.'
	});

describe('base64ByteLength', () => {
	it('agrees with the bytes a real round-trip produces, at every padding length', () => {
		// One, two and three trailing bytes are the three padding cases: `==`, `=`, and none.
		for (const text of ['a', 'ab', 'abc', 'abcd', 'the whole receipt']) {
			const encoded = Buffer.from(text, 'utf8').toString('base64');
			expect(base64ByteLength(encoded)).toBe(Buffer.byteLength(text, 'utf8'));
		}
	});

	it('measures a payload far larger than anything it would be reasonable to decode twice', () => {
		const bytes = new Uint8Array(500_000).fill(7);
		const encoded = Buffer.from(bytes).toString('base64');
		expect(base64ByteLength(encoded)).toBe(500_000);
	});

	it('ignores the line breaks a wrapped encoder inserts', () => {
		const encoded = Buffer.from('the whole receipt', 'utf8').toString('base64');
		const wrapped = `${encoded.slice(0, 4)}\n${encoded.slice(4)}`;
		expect(base64ByteLength(wrapped)).toBe(base64ByteLength(encoded));
	});

	it('reports nothing for an empty payload', () => {
		expect(base64ByteLength('')).toBe(0);
		expect(base64ByteLength('   ')).toBe(0);
	});
});

describe('formatByteSize', () => {
	it('reads in bytes below a kilobyte', () => {
		expect(formatByteSize(0)).toBe('0 B');
		expect(formatByteSize(1)).toBe('1 B');
		expect(formatByteSize(1023)).toBe('1023 B');
	});

	it('reads in whole kilobytes up to a megabyte', () => {
		expect(formatByteSize(1024)).toBe('1 KB');
		expect(formatByteSize(1024 * 412)).toBe('412 KB');
	});

	it('reads in megabytes with one decimal above that', () => {
		expect(formatByteSize(1024 * 1024)).toBe('1.0 MB');
		expect(formatByteSize(Math.round(1024 * 1024 * 3.47))).toBe('3.5 MB');
	});

	it('never renders a negative or non-finite size', () => {
		expect(formatByteSize(-1)).toBe('0 B');
		expect(formatByteSize(Number.NaN)).toBe('0 B');
		expect(formatByteSize(Number.POSITIVE_INFINITY)).toBe('0 B');
	});
});

describe('fileTypeLabel', () => {
	it('names the media types the packaging seam actually produces', () => {
		expect(fileTypeLabel('application/pdf')).toBe('PDF');
		expect(fileTypeLabel('image/png')).toBe('PNG');
		expect(fileTypeLabel('image/jpeg')).toBe('JPG');
		expect(fileTypeLabel('image/webp')).toBe('WEBP');
		expect(fileTypeLabel('image/svg+xml')).toBe('SVG');
	});

	it('matches regardless of case, since the schema constrains the field to any non-empty string', () => {
		expect(fileTypeLabel('Application/PDF')).toBe('PDF');
	});

	it('falls back rather than guessing at a type it does not know', () => {
		expect(fileTypeLabel('application/octet-stream')).toBe('File');
	});
});

describe('describePackagedExport', () => {
	it('names the printable file and the paper it is sized for', () => {
		const described = describePackagedExport('print', pdfFile('cGRm'), 'US_Letter');

		expect(described).toMatchObject({
			kind: 'print',
			label: 'Printable PDF',
			purpose: 'US Letter — ready to print',
			filename: 'meechie-coloring-page-1.pdf',
			mimeType: 'application/pdf',
			href: 'data:application/pdf;base64,cGRm'
		});
	});

	it('follows the page size the reader actually chose', () => {
		expect(describePackagedExport('print', pdfFile('cGRm'), 'A4').purpose).toBe(
			'A4 — ready to print'
		);
	});

	it('names the share variants by what they are for', () => {
		const square = describePackagedExport(
			'square',
			{ filename: 'page-square.png', mimeType: 'image/png', dataBase64: 'cG5n' },
			'US_Letter'
		);
		const chat = describePackagedExport(
			'chat',
			{ filename: 'page-chat.png', mimeType: 'image/png', dataBase64: 'cG5n' },
			'US_Letter'
		);

		expect(square).toMatchObject({
			kind: 'square',
			label: 'Square PNG',
			purpose: 'square crop — for posting'
		});
		expect(chat).toMatchObject({
			kind: 'chat',
			label: 'Chat PNG',
			purpose: 'smaller square — for sending'
		});
	});

	it('takes the label from the file rather than from the variant it was asked for', () => {
		// The seam emits PNG for the print variant when `outputFormat` is `png`, so a variant-only
		// label would call a PNG a PDF. This is the defect the old row had in its worst form: one
		// constant string for every file.
		const printedPng = describePackagedExport(
			'print',
			{ filename: 'page.png', mimeType: 'image/png', dataBase64: 'cG5n' },
			'US_Letter'
		);

		expect(printedPng.label).toBe('Printable PNG');
	});

	it('reports the decoded size of the bytes behind the link', () => {
		const dataBase64 = Buffer.from(new Uint8Array(2048).fill(1)).toString('base64');

		const described = describePackagedExport('print', pdfFile(dataBase64), 'US_Letter');

		expect(described.byteLength).toBe(2048);
		expect(described.sizeLabel).toBe('2 KB');
	});

	it('describes every variant the seam defines', () => {
		// Driven off the seam's own enum, so a variant added there without a description here fails
		// this test instead of silently rendering `undefined` in the export row.
		for (const variant of OutputVariantSchema.options) {
			const described = describePackagedExport(variant, pdfFile('cGRm'), 'US_Letter');
			expect(described.kind).toBe(variant);
			expect(described.label).not.toContain('undefined');
			expect(described.purpose).not.toContain('undefined');
			expect(described.label.endsWith(' PDF')).toBe(true);
			expect(described.purpose.length).toBeGreaterThan(0);
		}
	});
});

describe('describePackagedExports', () => {
	it('keeps the order the variants were requested in, and skips the ones that failed', () => {
		const attempts: PageExportAttempt[] = [
			{
				variant: 'print',
				files: [pdfFile('cGRm')],
				failure: null, pageSize: 'US_Letter'
			},
			{ variant: 'square', files: [], failure: canvasFailure('square'), pageSize: 'US_Letter' }
		];

		expect(describePackagedExports(attempts).map((item) => item.kind)).toEqual([
			'print'
		]);
	});

	it('describes every file in an attempt, not only the first', () => {
		const attempts: PageExportAttempt[] = [
			{
				variant: 'print',
				files: [
					{ filename: 'page-1.pdf', mimeType: 'application/pdf', dataBase64: 'cGRm' },
					{ filename: 'page-2.pdf', mimeType: 'application/pdf', dataBase64: 'cGRm' }
				],
				failure: null,
				pageSize: 'US_Letter'
			}
		];

		expect(
			describePackagedExports(attempts).map((item) => item.filename)
		).toEqual(['page-1.pdf', 'page-2.pdf']);
	});

	it('labels each file by the paper its own attempt was packaged for', () => {
		// The page size travels on the attempt precisely so the row cannot describe a file as paper
		// it was not made on — which is what reading a caller's live spec did whenever the reader
		// moved Page Size while a generation was in flight.
		const attempts: PageExportAttempt[] = [
			{ variant: 'print', files: [pdfFile('cGRm')], failure: null, pageSize: 'US_Letter' },
			{ variant: 'print', files: [pdfFile('cGRmMg==')], failure: null, pageSize: 'A4' }
		];

		const described = describePackagedExports(attempts);

		expect(described[0].purpose).toContain('US Letter');
		expect(described[0].purpose).not.toContain('A4');
		expect(described[1].purpose).toContain('A4');
		expect(described[1].purpose).not.toContain('US Letter');
	});

	it('describes nothing when nothing was packaged', () => {
		expect(describePackagedExports([])).toEqual([]);
	});
});

describe('generatedImageByteLength', () => {
	it('measures base64 payloads as decoded bytes', () => {
		expect(
			generatedImageByteLength({
				id: 'image-1',
				format: 'png',
				mimeType: 'image/png',
				data: Buffer.from(new Uint8Array(300).fill(2)).toString('base64'),
				encoding: 'base64'
			})
		).toBe(300);
	});

	it('measures utf8 SVG markup in bytes rather than characters', () => {
		// A curly quote is one character and three bytes, and Meechie's page titles are full of them.
		const svg = '<svg>’</svg>';

		expect(
			generatedImageByteLength({
				id: 'image-1',
				format: 'svg',
				mimeType: 'image/svg+xml',
				data: svg,
				encoding: 'utf8'
			})
		).toBe(Buffer.byteLength(svg, 'utf8'));
	});
});

describe('describeOriginalImageExport', () => {
	const pngImage: GeneratedImage = {
		id: 'image-1',
		format: 'png',
		mimeType: 'image/png',
		data: 'cG5n',
		encoding: 'base64'
	};

	it('describes nothing when there is no image', () => {
		expect(describeOriginalImageExport(null, 'meechie-coloring-page')).toBeNull();
		expect(describeOriginalImageExport(undefined, 'meechie-coloring-page')).toBeNull();
	});

	it('describes nothing for an encoding no data URL can carry', () => {
		expect(
			describeOriginalImageExport(
				{ ...pngImage, encoding: 'utf8', data: 'not really png' },
				'meechie-coloring-page'
			)
		).toBeNull();
	});

	it('names the file after the same page as the packaged downloads, with its real extension', () => {
		const described = describeOriginalImageExport(
			{ ...pngImage, format: 'webp', mimeType: 'image/webp' },
			'meechie-coloring-page-77'
		);

		expect(described).toMatchObject({
			kind: 'original',
			filename: 'meechie-coloring-page-77-original.webp',
			mimeType: 'image/webp',
			label: 'Original WEBP',
			purpose: 'exactly what the generator sent',
			href: 'data:image/webp;base64,cG5n'
		});
	});

	it('cannot collide with a packaged file of the same type', () => {
		// The `-original` suffix is what makes that true, and what lets the export row stay unkeyed.
		const packaged = describePackagedExport(
			'print',
			{ filename: 'meechie-coloring-page-77.png', mimeType: 'image/png', dataBase64: 'cG5n' },
			'US_Letter'
		);
		const original = describeOriginalImageExport(pngImage, 'meechie-coloring-page-77');

		expect(original?.filename).not.toBe(packaged.filename);
	});

	it('carries utf8 SVG markup through as a percent-encoded data URL', () => {
		const described = describeOriginalImageExport(
			{
				id: 'image-1',
				format: 'svg',
				mimeType: 'image/svg+xml',
				data: '<svg></svg>',
				encoding: 'utf8'
			},
			'meechie-coloring-page-9'
		);

		expect(described).toMatchObject({
			filename: 'meechie-coloring-page-9-original.svg',
			label: 'Original SVG',
			href: 'data:image/svg+xml;utf8,%3Csvg%3E%3C%2Fsvg%3E'
		});
	});
});

describe('summarisePageExportFailures', () => {
	it('says nothing when every variant was built', () => {
		expect(
			summarisePageExportFailures([
				{ variant: 'print', files: [pdfFile('cGRm')], failure: null, pageSize: 'US_Letter' },
				{ variant: 'square', files: [pdfFile('cGRm')], failure: null, pageSize: 'US_Letter' }
			])
		).toBe('');
		expect(summarisePageExportFailures([])).toBe('');
	});

	it('affirms the page, and says nothing else', () => {
		const summary = summarisePageExportFailures([
			{ variant: 'print', files: [], failure: canvasFailure('print'), pageSize: 'US_Letter' },
			{ variant: 'square', files: [pdfFile('cGRm')], failure: null, pageSize: 'US_Letter' }
		]);

		// The reader's page is finished; only a free local step failed. A notice that reads like the
		// generation failed invites them to pay for another one. What went wrong is one line per
		// failed variant below this, written by `export-failure.ts` — this opening asserts nothing
		// about a variant, which is what lets two variants fail for two different reasons.
		expect(summary).toBe('Your page is on the paper.');
	});
});

describe('pageExportFailures', () => {
	it('returns one classified failure per failed variant, in request order', () => {
		const failures = pageExportFailures([
			{ variant: 'print', files: [], failure: canvasFailure('print'), pageSize: 'US_Letter' },
			{ variant: 'square', files: [pdfFile('cGRm')], failure: null, pageSize: 'US_Letter' },
			{ variant: 'chat', files: [], failure: encodeFailure('chat'), pageSize: 'US_Letter' }
		]);

		expect(failures.map((failure) => failure.variant)).toEqual(['print', 'chat']);
	});

	it('never carries a seam string into anything a reader is shown', () => {
		// The whole point of the rebuild. The adapter's own sentence is kept for a bug report and
		// must not appear in the words on screen.
		for (const variant of OutputVariantSchema.options) {
			const [failure] = pageExportFailures([
				{ variant, files: [], failure: canvasFailure(variant), pageSize: 'US_Letter' }
			]);
			expect(failure.detail).toBe('Canvas context unavailable for resizing.');
			expect(failure.message).not.toContain('Canvas context unavailable');
			expect(failure.message).not.toContain('undefined');
		}
	});

	it('names every variant the seam defines', () => {
		for (const variant of OutputVariantSchema.options) {
			const [failure] = pageExportFailures([
				{ variant, files: [], failure: canvasFailure(variant), pageSize: 'US_Letter' }
			]);
			expect(failure.message.startsWith('The ')).toBe(true);
			expect(failure.message).toContain('could not be built.');
		}
	});
});

describe('pageExportRetryLabel', () => {
	it('offers nothing when every variant was built', () => {
		expect(
			pageExportRetryLabel([
				{ variant: 'print', files: [pdfFile('cGRm')], failure: null, pageSize: 'US_Letter' }
			])
		).toBeNull();
		expect(pageExportRetryLabel([])).toBeNull();
	});

	it('offers nothing when no failed variant could land differently', () => {
		// A browser with no canvas has no canvas a second later. A button here would be a lie about
		// what pressing it does — the defect the storage classifier already names.
		expect(
			pageExportRetryLabel([
				{ variant: 'print', files: [], failure: canvasFailure('print'), pageSize: 'US_Letter' },
				{ variant: 'square', files: [], failure: canvasFailure('square'), pageSize: 'US_Letter' }
			])
		).toBeNull();
	});

	it('offers the rebuild when any failed variant could land differently', () => {
		// One control for the row, not one per variant: a page whose print PDF can be rebuilt is
		// worth pressing for even when its share image provably cannot be.
		expect(
			pageExportRetryLabel([
				{ variant: 'print', files: [], failure: encodeFailure('print'), pageSize: 'US_Letter' },
				{ variant: 'square', files: [], failure: canvasFailure('square'), pageSize: 'US_Letter' }
			])
		).toBe('Build the downloads again');
	});

	it('does not say "try again", which under a page-making button reads as another generation', () => {
		const label = pageExportRetryLabel([
			{ variant: 'print', files: [], failure: encodeFailure('print'), pageSize: 'US_Letter' }
		]);

		expect(label).not.toMatch(/try again/i);
		expect(label).toContain('downloads');
	});
});

describe('failedExportVariants', () => {
	it('names only the variants that failed', () => {
		expect(
			failedExportVariants([
				{ variant: 'print', files: [pdfFile('cGRm')], failure: null, pageSize: 'US_Letter' },
				{ variant: 'square', files: [], failure: encodeFailure('square'), pageSize: 'US_Letter' }
			])
		).toEqual(['square']);
	});

	it('names nothing when every variant was built', () => {
		expect(
			failedExportVariants([
				{ variant: 'print', files: [pdfFile('cGRm')], failure: null, pageSize: 'US_Letter' }
			])
		).toEqual([]);
	});
});

describe('mergeRebuiltAttempts', () => {
	it('keeps a download the rebuild deliberately did not re-run', () => {
		// The regression this exists to stop. Re-packaging a variant that already succeeded can take
		// away a file the reader has: the commonest failure here is memory, and its commonest shape
		// is "the PDF built, the 1080px share canvas did not". Re-running the PDF under that same
		// pressure turns the one control offered against a partial failure into a way to make it
		// total.
		const printAttempt: PageExportAttempt = {
			variant: 'print',
			files: [pdfFile('cGRm')],
			failure: null,
			pageSize: 'US_Letter'
		};
		const previous: PageExportAttempt[] = [
			printAttempt,
			{ variant: 'square', files: [], failure: encodeFailure('square'), pageSize: 'US_Letter' }
		];
		const rebuiltSquare: PageExportAttempt = {
			variant: 'square',
			files: [pdfFile('c3F1YXJl')],
			failure: null,
			pageSize: 'US_Letter'
		};

		const merged = mergeRebuiltAttempts(previous, [rebuiltSquare]);

		expect(merged[0]).toBe(printAttempt);
		expect(merged[1]).toBe(rebuiltSquare);
	});

	it('keeps the original request order, matching by variant rather than position', () => {
		const previous: PageExportAttempt[] = [
			{ variant: 'print', files: [], failure: encodeFailure('print'), pageSize: 'A4' },
			{ variant: 'square', files: [pdfFile('cGRm')], failure: null, pageSize: 'A4' },
			{ variant: 'chat', files: [], failure: encodeFailure('chat'), pageSize: 'A4' }
		];

		const merged = mergeRebuiltAttempts(previous, [
			{ variant: 'chat', files: [pdfFile('Y2hhdA==')], failure: null, pageSize: 'A4' },
			{ variant: 'print', files: [pdfFile('cHJpbnQ=')], failure: null, pageSize: 'A4' }
		]);

		expect(merged.map((attempt) => attempt.variant)).toEqual([
			'print',
			'square',
			'chat'
		]);
		expect(merged.every((attempt) => attempt.failure === null)).toBe(true);
	});

	it('leaves a failure in place when its rebuild failed too', () => {
		const previous: PageExportAttempt[] = [
			{ variant: 'square', files: [], failure: encodeFailure('square'), pageSize: 'US_Letter' }
		];

		const merged = mergeRebuiltAttempts(previous, [
			{ variant: 'square', files: [], failure: canvasFailure('square'), pageSize: 'US_Letter' }
		]);

		// The newer classification wins, so the sentence follows what happened this time.
		expect(merged[0].failure?.cause).toBe('unsupported_here');
	});
});
