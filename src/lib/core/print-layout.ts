// Purpose: Own every geometric decision about putting a coloring page on a sheet of paper — the
//          paper's size, the margin that must stay blank, where the artwork lands inside what is
//          left, and how large a raster has to be to hold that at print resolution.
// Why: The packaged download is the app's deliverable. Every surface that makes a page offers it as
//      "Printable PDF · US Letter — ready to print", and until this module existed it was the one
//      file in the app that was not: the adapter scaled the artwork by
//      `Math.min(pageWidth / w, pageHeight / h)` and centred it, which is edge-to-edge by
//      construction. Measured on `main`, all six paper x source combinations landed with a **0.0pt**
//      margin on at least one axis, and the shipped default — US Letter holding the 1024x1024 the
//      provider is asked for in `image-generation-pipeline.ts` — touched both vertical edges of the
//      sheet. No consumer printer can mark there, so printing it at 100% clips the outer border the
//      spec draws, and "shrink to fit" silently rescales instead.
//      `+layout.svelte` had already written the defect down in a comment beside the browser print
//      path — "The packaged PDF bleeds its image to all four edges; this does not" — and left it.
// Info flow: source image's intrinsic pixel size + the reader's chosen page size
//            -> `planPrintPlacement` -> a placement in PostScript points
//            -> the PDF renderer directly, or through `placementToPx` -> the PNG renderer.
// Invariants: The placed artwork is never closer than `PRINT_SAFE_MARGIN_MM` to any edge of the
//      sheet, on any paper, for any source size, including degenerate ones. Aspect ratio is
//      preserved: the artwork is letterboxed inside the safe box, never cropped and never stretched
//      — a coloring page that has been cropped has lost part of the picture, which is worse than a
//      smaller one.

/** The two papers the spec offers. Kept structurally identical to `PageSizeSchema`'s enum. */
export type PrintPageSize = 'US_Letter' | 'A4';

/** PDF and PostScript both measure in points, and `pdf-lib` takes points. */
export const POINTS_PER_INCH = 72;
const MM_PER_INCH = 25.4;
export const POINTS_PER_MM = POINTS_PER_INCH / MM_PER_INCH;

/**
 * The paper, in points.
 *
 * US Letter is 8.5 x 11in exactly. A4 is 210 x 297mm, which is 595.276 x 841.890pt — the adapter
 * used to write `595 x 842`, a rounding that was invisible while the artwork covered the whole
 * sheet. It stops being invisible once the safe box is derived by subtracting from these numbers,
 * so the real paper is used.
 */
export const PAGE_DIMENSIONS_PT: Record<PrintPageSize, { width: number; height: number }> = {
	US_Letter: { width: 8.5 * POINTS_PER_INCH, height: 11 * POINTS_PER_INCH },
	A4: { width: 210 * POINTS_PER_MM, height: 297 * POINTS_PER_MM }
};

/**
 * How much of every edge stays blank.
 *
 * 12mm, which is not a new number: it is what `@page { margin: 12mm }` in `src/routes/+layout.svelte`
 * already reserves when the reader prints from inside the app. Before this module the two paths
 * disagreed — the same finished page came out one size through the browser and a different, larger,
 * clipped size through the downloaded PDF. One definition is the point; `tests/unit/print-layout.test.ts`
 * reads the stylesheet and fails if the two drift apart.
 *
 * It also has to clear the printer's own unprintable border, which is hardware and cannot be
 * overridden from a file: ~6.4mm (0.25in) on the widest common consumer printers, less on most.
 * 12mm is comfortably outside that, and leaves somewhere to hold the sheet.
 */
export const PRINT_SAFE_MARGIN_MM = 12;

/** The same margin in points, which is what the placement is computed in. */
export const PRINT_SAFE_MARGIN_PT = PRINT_SAFE_MARGIN_MM * POINTS_PER_MM;

/**
 * The resolution the print raster is built at.
 *
 * 300dpi is the usual floor for line art. On US Letter this makes a 2550 x 3300 canvas, which is
 * exactly the `PRINT_WIDTH` / `PRINT_HEIGHT` pair the adapter used to hardcode — so the print PNG's
 * canvas does not change size on the paper this app defaults to. What changes is that A4 now gets
 * A4's raster instead of Letter's, and that a PNG source gets a raster at all.
 */
export const PRINT_RASTER_DPI = 300;

/** A rectangle in whatever unit the caller is working in. */
export type PrintRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

/** Where the artwork goes, and what it costs. */
export type PrintPlacement = {
	/** The sheet. */
	page: { width: number; height: number };
	/** The sheet minus the safe margin on all four edges — everything the artwork may use. */
	content: PrintRect;
	/**
	 * The artwork's rectangle, letterboxed inside `content` and centred.
	 *
	 * `y` is measured from the **bottom** edge, because that is PDF's origin and the PDF renderer is
	 * the one consumer that cannot convert. `placementToPx` flips it for the canvas renderers, whose
	 * origin is the top-left.
	 */
	image: PrintRect;
	/**
	 * The smallest distance from the artwork to any edge of the sheet.
	 *
	 * Always at least `PRINT_SAFE_MARGIN_PT`; larger on the axis the letterboxing does not fill.
	 * Reported rather than recomputed by callers so a test can assert the invariant on the value the
	 * renderer actually used.
	 */
	marginPt: number;
};

/** A finite number strictly greater than zero — the only kind of image dimension that can be laid out. */
const isUsableDimension = (value: number): boolean => Number.isFinite(value) && value > 0;

/**
 * Where a source image of this pixel size lands on this paper.
 *
 * The source's dimensions are only ever used as a ratio, so their unit does not matter — pixels from
 * a decoded PNG and points from an embedded PDF image give the same answer.
 *
 * A source with a dimension that is not a usable number — zero, negative, `NaN` from a failed
 * decode — is laid out as if it were the shape of the safe box, filling it. That is a deliberate
 * choice over propagating `NaN` into `page.drawImage`: a wrongly-proportioned page is a visible
 * problem a reader can act on, and a PDF with `NaN` in its content stream is a file that may not
 * open at all.
 */
export const planPrintPlacement = (
	source: { width: number; height: number },
	pageSize: PrintPageSize
): PrintPlacement => {
	const page = PAGE_DIMENSIONS_PT[pageSize];

	// Guard the margin itself: on any paper this app offers, two margins are a small fraction of the
	// sheet, but a content box must never be inverted, so it is clamped rather than assumed.
	const margin = Math.min(PRINT_SAFE_MARGIN_PT, page.width / 2, page.height / 2);
	const content: PrintRect = {
		x: margin,
		y: margin,
		width: page.width - margin * 2,
		height: page.height - margin * 2
	};

	const usable =
		isUsableDimension(source.width) && isUsableDimension(source.height);
	const sourceWidth = usable ? source.width : content.width;
	const sourceHeight = usable ? source.height : content.height;

	const scale = Math.min(content.width / sourceWidth, content.height / sourceHeight);
	const width = sourceWidth * scale;
	const height = sourceHeight * scale;

	const image: PrintRect = {
		x: content.x + (content.width - width) / 2,
		y: content.y + (content.height - height) / 2,
		width,
		height
	};

	return {
		page: { width: page.width, height: page.height },
		content,
		image,
		marginPt: Math.min(
			image.x,
			page.width - (image.x + image.width),
			image.y,
			page.height - (image.y + image.height)
		)
	};
};

/**
 * The full-sheet raster size for a page, in device pixels at `dpi`.
 *
 * The print PNG is a whole sheet, not a cropped picture: it carries the same blank margin the PDF
 * does, so the two print files are the same page rendered twice rather than two different layouts.
 */
export const printCanvasPx = (
	pageSize: PrintPageSize,
	dpi: number = PRINT_RASTER_DPI
): { width: number; height: number } => {
	const page = PAGE_DIMENSIONS_PT[pageSize];
	return {
		width: Math.round((page.width / POINTS_PER_INCH) * dpi),
		height: Math.round((page.height / POINTS_PER_INCH) * dpi)
	};
};

/**
 * The placed rectangle converted to canvas pixels, with the origin flipped to the top-left.
 *
 * PDF measures `y` up from the bottom of the sheet and a canvas measures it down from the top. Doing
 * the flip here, once, is what lets both renderers consume one placement — the alternative is each
 * renderer doing its own arithmetic on the same numbers, which is how they drifted apart in the
 * first place.
 */
export const placementToPx = (
	placement: PrintPlacement,
	dpi: number = PRINT_RASTER_DPI
): PrintRect => {
	const perPoint = dpi / POINTS_PER_INCH;
	const topDownY =
		placement.page.height - (placement.image.y + placement.image.height);
	return {
		x: placement.image.x * perPoint,
		y: topDownY * perPoint,
		width: placement.image.width * perPoint,
		height: placement.image.height * perPoint
	};
};

/**
 * The resolution the artwork is actually reproduced at once it is placed, in dots per inch.
 *
 * Diagnostic rather than decorative: it is the number that says whether a 1024px source is being
 * asked to cover eight inches of paper. Not used to reject anything — the app has one provider and
 * one size, and refusing to package the only image it can make would be worse than printing it.
 */
export const placedDpi = (
	sourcePixelWidth: number,
	placement: PrintPlacement
): number => {
	if (!isUsableDimension(sourcePixelWidth) || placement.image.width <= 0) return 0;
	return sourcePixelWidth / (placement.image.width / POINTS_PER_INCH);
};
