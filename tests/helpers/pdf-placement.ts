/*
 * Purpose: Read a PDF's page box and the rectangle an image was drawn into, out of the file's own
 *          bytes.
 * Why: The packaged print PDF is the app's deliverable, and the only honest assertion about where
 *      the artwork lands is one made on the file a reader would send to a printer — not on the
 *      numbers the adapter was handed on the way there. Shared by `tests/unit/print-packaging.test.ts`
 *      (which packages in jsdom) and `tests/e2e/print.spec.ts` (which pulls the real download out of
 *      a real browser) so the two measure identically; they were one copied function until the
 *      second caller appeared, and SonarCloud's duplication gate has already failed a pull request
 *      in this repo for exactly that.
 * Info flow: PDF bytes -> inflated content streams -> composed transformation matrix -> a rectangle
 *            in PostScript points.
 * Invariants: Depends on no PDF library. `pdf-lib` writes these files, so parsing them with
 *      `pdf-lib` would let one bug hide the other; this reads the container format instead.
 */
import { inflateSync } from 'node:zlib';

/** A 2D affine transform in PDF's `[a b c d e f]` form, row-vector convention. */
type Matrix = [number, number, number, number, number, number];

/** Where an image ended up, and on what size sheet. All values in PostScript points. */
export type PlacedRect = {
	pageWidth: number;
	pageHeight: number;
	x: number;
	y: number;
	width: number;
	height: number;
};

/**
 * Every `stream ... endstream` body in the file, inflated where it is Flate-encoded.
 *
 * `pdf-lib` compresses both the content stream and the object stream holding the page dictionary, so
 * neither the drawing operators nor the `/MediaBox` are present in the file as readable text.
 */
const inflateStreams = (bytes: Buffer): string[] => {
	const raw = bytes.toString('latin1');
	const out: string[] = [raw];
	const marker = /stream\r?\n/g;
	let found: RegExpExecArray | null;
	while ((found = marker.exec(raw)) !== null) {
		const start = found.index + found[0].length;
		const end = raw.indexOf('endstream', start);
		if (end === -1) continue;
		const body = Buffer.from(raw.slice(start, end), 'latin1');
		try {
			out.push(inflateSync(body).toString('latin1'));
		} catch {
			// Not Flate-encoded, or not a stream we can read. Either way its plain bytes are already
			// in `raw`, so nothing is lost by skipping it.
		}
	}
	return out;
};

/** PDF concatenates row-vector matrices: `A x B`. */
const compose = (a: Matrix, b: Matrix): Matrix => [
	a[0] * b[0] + a[1] * b[2],
	a[0] * b[1] + a[1] * b[3],
	a[2] * b[0] + a[3] * b[2],
	a[2] * b[1] + a[3] * b[3],
	a[4] * b[0] + a[5] * b[2] + b[4],
	a[4] * b[1] + a[5] * b[3] + b[5]
];

/**
 * The rectangle the first drawn image occupies on the first page.
 *
 * `pdf-lib` does not write one matrix per `drawImage`. It writes four — a translate, an identity, a
 * scale, another identity — so reading "the" `cm` operator gets whichever comes first, which is the
 * translate, and reports the image as one point wide. They are composed here instead, which is what
 * a PDF renderer does, and is therefore the reading that stays correct if `pdf-lib` changes how it
 * decomposes the transform.
 *
 * Throws rather than returning a partial answer: a caller that cannot find the drawing has not
 * measured a smaller margin, it has measured nothing.
 */
export const readPlacedRect = (pdfBytes: Buffer): PlacedRect => {
	const streams = inflateStreams(pdfBytes);

	const mediaBox = streams
		.map((text) =>
			/\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/.exec(text)
		)
		.find((match) => match !== null);
	if (!mediaBox) throw new Error('no /MediaBox found in the PDF');

	const content = streams.find((text) => / Do\b/.test(text) && text.includes(' cm'));
	if (!content) throw new Error('no image draw found in any of the PDF streams');

	const matrices = [
		...content.matchAll(
			/(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+cm/g
		)
	].map((match) => match.slice(1, 7).map(Number) as Matrix);
	if (matrices.length === 0) throw new Error('no cm operator in the PDF content stream');

	// `cm` sets CTM = M x CTM, so the matrix written last is applied to the unit square first;
	// accumulating as `M x acc` in stream order reproduces that.
	const ctm = matrices.reduce<Matrix>((acc, m) => compose(m, acc), [1, 0, 0, 1, 0, 0]);

	// This app never rotates or skews a page. If the composed transform is not axis-aligned then
	// `width` and `height` below are not the picture's width and height, and saying so is better
	// than reporting them.
	if (Math.abs(ctm[1]) > 1e-9 || Math.abs(ctm[2]) > 1e-9) {
		throw new Error(`the image transform is not axis-aligned: ${JSON.stringify(ctm)}`);
	}

	return {
		pageWidth: Number(mediaBox[3]) - Number(mediaBox[1]),
		pageHeight: Number(mediaBox[4]) - Number(mediaBox[2]),
		x: ctm[4],
		y: ctm[5],
		width: ctm[0],
		height: ctm[3]
	};
};

/** The four distances from the artwork to the edges of the sheet, in points. */
export const edgeMargins = (rect: PlacedRect): number[] => [
	rect.x,
	rect.pageWidth - (rect.x + rect.width),
	rect.y,
	rect.pageHeight - (rect.y + rect.height)
];
