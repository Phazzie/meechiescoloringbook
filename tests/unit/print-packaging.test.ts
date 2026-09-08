/*
 * Purpose: Measure the real bytes the packaging adapter produces — not a mock of them — and assert
 *          that a coloring page lands inside the printable area of the sheet.
 * Why: `print-layout.test.ts` proves the plan is right. This proves the adapter follows it, which is
 *      a different claim and the one that broke: the geometry was inline in the adapter, and the
 *      only thing standing between it and a reader's printer was that nobody had ever read the
 *      output. The seam's own suite could not: every path it wanted to reach needed a canvas.
 *      A PNG source does not — `imageToPngBase64` passes PNG through untouched and `pdf-lib`
 *      decodes and embeds PNG in pure JavaScript — so the whole PDF branch runs here, on real bytes,
 *      with no browser.
 * Info flow: a synthesised PNG of known size -> `outputPackagingAdapter.package` -> the PDF's own
 *            page box and content stream -> assertions in PostScript points.
 * Invariants: Everything here is read back out of the produced PDF. Nothing asserts against a value
 *      the adapter was handed; if a number is not in the file, this file does not claim it.
 */
import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { outputPackagingAdapter } from '$lib/adapters/output-packaging-seam';
import { edgeMargins, readPlacedRect } from '../helpers/pdf-placement';
import {
	PAGE_DIMENSIONS_PT,
	POINTS_PER_INCH,
	planPrintPlacement,
	type PrintPageSize
} from '$lib/core/print-layout';
import type { OutputPackagingInput } from '$lib/seams/output-packaging-seam/contract';

/** The printer's physical limit, stated independently of the constant the adapter uses. */
const HARDWARE_CLEARANCE_PT = 0.25 * POINTS_PER_INCH;

const crcTable = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n += 1) {
		let c = n;
		for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

const crc32 = (buffer: Buffer): number => {
	let c = 0xffffffff;
	for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer): Buffer => {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
};

/**
 * A real, valid, opaque-white PNG of exactly `width` x `height`.
 *
 * Synthesised rather than committed as a binary fixture so the dimensions under test are visible in
 * the test that depends on them — the placement is a function of the source's aspect ratio, and a
 * checked-in blob would hide the input to the thing being measured.
 */
const makePng = (width: number, height: number): string => {
	const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // colour type: truecolour RGB
	// 10, 11, 12 are compression, filter and interlace methods — all 0.
	const raw = Buffer.alloc(height * (1 + width * 3), 0xff);
	for (let y = 0; y < height; y += 1) raw[y * (1 + width * 3)] = 0; // filter byte per scanline
	return Buffer.concat([
		signature,
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]).toString('base64');
};

const packagePdf = async (
	source: { width: number; height: number },
	pageSize: PrintPageSize
) => {
	const input: OutputPackagingInput = {
		images: [
			{
				id: 'coloring-page-test-1',
				format: 'png',
				mimeType: 'image/png',
				encoding: 'base64',
				data: makePng(source.width, source.height)
			}
		],
		outputFormat: 'pdf',
		fileBaseName: 'coloring-page-test',
		pageSize,
		variants: ['print']
	};
	const result = await outputPackagingAdapter.package(input);
	expect(result.ok).toBe(true);
	if (!result.ok) throw new Error('packaging failed');
	expect(result.value.files).toHaveLength(1);
	return result.value.files[0];
};

describe('the packaged print PDF, measured on its own bytes', () => {
	const CASES: Array<{ paper: PrintPageSize; source: { width: number; height: number }; name: string }> = [
		{ paper: 'US_Letter', source: { width: 1024, height: 1024 }, name: 'the shipped default' },
		{ paper: 'US_Letter', source: { width: 512, height: 768 }, name: 'a portrait source' },
		{ paper: 'US_Letter', source: { width: 768, height: 512 }, name: 'a landscape source' },
		{ paper: 'A4', source: { width: 1024, height: 1024 }, name: 'a square on A4' },
		{ paper: 'A4', source: { width: 512, height: 768 }, name: 'a portrait source on A4' }
	];

	for (const { paper, source, name } of CASES) {
		it(`leaves a printable margin on all four edges — ${name}, ${paper}`, async () => {
			const file = await packagePdf(source, paper);
			expect(file.mimeType).toBe('application/pdf');

			const rect = readPlacedRect(Buffer.from(file.dataBase64, 'base64'));

			// On `main` at `e6c450b`, the left and right margins here were 0 for the shipped
			// default, and at least one of the four was 0 in every case in this table.
			for (const edge of edgeMargins(rect)) {
				expect(edge).toBeGreaterThanOrEqual(HARDWARE_CLEARANCE_PT - 1e-6);
			}

			// Aspect ratio survived the round trip through the file.
			expect(rect.width / rect.height).toBeCloseTo(source.width / source.height, 3);
		});
	}

	it('puts the page on the paper the reader chose, at its true size', async () => {
		const letter = readPlacedRect(
			Buffer.from((await packagePdf({ width: 1024, height: 1024 }, 'US_Letter')).dataBase64, 'base64')
		);
		expect(letter.pageWidth).toBeCloseTo(PAGE_DIMENSIONS_PT.US_Letter.width, 3);
		expect(letter.pageHeight).toBeCloseTo(PAGE_DIMENSIONS_PT.US_Letter.height, 3);

		const a4 = readPlacedRect(
			Buffer.from((await packagePdf({ width: 1024, height: 1024 }, 'A4')).dataBase64, 'base64')
		);
		expect(a4.pageWidth).toBeCloseTo(PAGE_DIMENSIONS_PT.A4.width, 3);
		expect(a4.pageHeight).toBeCloseTo(PAGE_DIMENSIONS_PT.A4.height, 3);
	});

	it('places the artwork exactly where core planned it', async () => {
		// The adapter is wiring. If these ever disagree, the geometry has grown a second home.
		for (const { paper, source } of CASES) {
			const rect = readPlacedRect(
				Buffer.from((await packagePdf(source, paper)).dataBase64, 'base64')
			);
			const planned = planPrintPlacement(source, paper).image;
			expect(rect.x).toBeCloseTo(planned.x, 2);
			expect(rect.y).toBeCloseTo(planned.y, 2);
			expect(rect.width).toBeCloseTo(planned.width, 2);
			expect(rect.height).toBeCloseTo(planned.height, 2);
		}
	});
});
