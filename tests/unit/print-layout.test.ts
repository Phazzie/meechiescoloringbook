/*
 * Purpose: Pin the geometry of the app's deliverable — where a coloring page lands on a sheet of
 *          paper, and how much of that sheet stays blank.
 * Why: The packaged download is offered on every page-making surface as "Printable PDF · US Letter —
 *      ready to print", and on `main` at `e6c450b` it was the one file in the app that was not.
 *      `Math.min(pageWidth / w, pageHeight / h)` with no margin is edge-to-edge by construction: all
 *      six paper x source combinations landed with a 0.0pt margin on at least one axis, and the
 *      shipped default — US Letter holding the 1024x1024 the provider is asked for — touched both
 *      vertical edges. The bug was survivable for fifteen runs because the packaging math had no
 *      test at all: the seam's suite covered `parseSvgSize` and a fixture-backed mock, and nothing
 *      else, because everything else needed a canvas.
 * Info flow: `planPrintPlacement` / `printCanvasPx` / `placementToPx` -> assertions here.
 * Invariants: The margin invariant below is the red proof. Restoring the old no-margin arithmetic
 *      must fail it — if a future edit makes it pass with the margin removed, the test has stopped
 *      measuring the thing it exists for.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	PAGE_DIMENSIONS_PT,
	POINTS_PER_INCH,
	POINTS_PER_MM,
	PRINT_RASTER_DPI,
	PRINT_SAFE_MARGIN_MM,
	PRINT_SAFE_MARGIN_PT,
	placedDpi,
	placementToPx,
	planPrintPlacement,
	printCanvasPx,
	type PrintPageSize
} from '$lib/core/print-layout';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const PAPERS: PrintPageSize[] = ['US_Letter', 'A4'];

/**
 * The floor the invariant is measured against, stated here and owned by nothing under test.
 *
 * 0.25in is the widest unprintable hardware border on common consumer printers — the strip the
 * mechanism physically cannot mark, which no file can override. Artwork inside it is clipped.
 *
 * Deliberately **not** `PRINT_SAFE_MARGIN_PT`. The first draft of this file asserted the invariant
 * against that constant, which made it self-referential: setting `PRINT_SAFE_MARGIN_MM` to 0 moved
 * both sides of the comparison at once and fourteen margin tests went on passing on a layout that
 * bleeds to the edge. That is the defect this whole run is about, sailing through its own red proof.
 * Run 15's close-out had already written the general lesson down — the red proof is a check on the
 * tests, not a formality — and this file had to learn it again.
 */
const HARDWARE_CLEARANCE_PT = 0.25 * POINTS_PER_INCH;

/** Shapes worth covering: the one the app actually makes, plus the extremes around it. */
const SOURCES: Array<{ name: string; width: number; height: number }> = [
	{ name: 'the provider default', width: 1024, height: 1024 },
	{ name: 'portrait', width: 1024, height: 1536 },
	{ name: 'landscape', width: 1536, height: 1024 },
	{ name: 'a print-resolution sheet', width: 2550, height: 3300 },
	{ name: 'a wide panorama', width: 4000, height: 300 },
	{ name: 'a tall strip', width: 300, height: 4000 },
	{ name: 'one pixel', width: 1, height: 1 }
];

describe('print-layout: the margin invariant', () => {
	// The red proof. Every one of these lands at exactly 0.0pt under the arithmetic this replaced.
	for (const paper of PAPERS) {
		for (const source of SOURCES) {
			it(`keeps the artwork ${PRINT_SAFE_MARGIN_MM}mm clear of every edge — ${paper}, ${source.name}`, () => {
				const placement = planPrintPlacement(source, paper);
				const { page, image } = placement;

				const left = image.x;
				const right = page.width - (image.x + image.width);
				const bottom = image.y;
				const top = page.height - (image.y + image.height);

				for (const edge of [left, right, top, bottom]) {
					// Measured against the printer's physical limit, not against the constant that
					// produced it. The epsilon is for floating-point millimetre conversion, not slack.
					expect(edge).toBeGreaterThanOrEqual(HARDWARE_CLEARANCE_PT - 1e-9);
					expect(edge).toBeGreaterThanOrEqual(PRINT_SAFE_MARGIN_PT - 1e-9);
				}
				expect(placement.marginPt).toBeGreaterThanOrEqual(HARDWARE_CLEARANCE_PT - 1e-9);
			});
		}
	}

	it('reports the smallest of the four edges as marginPt', () => {
		// A square on portrait paper: the left/right margin is the safe margin exactly, and the
		// top/bottom margin is much larger. The smallest is the one that matters.
		const placement = planPrintPlacement({ width: 1024, height: 1024 }, 'US_Letter');
		const left = placement.image.x;
		const top = placement.page.height - (placement.image.y + placement.image.height);

		expect(placement.marginPt).toBeCloseTo(left, 6);
		expect(placement.marginPt).toBeCloseTo(PRINT_SAFE_MARGIN_PT, 6);
		expect(placement.marginPt).toBeGreaterThanOrEqual(HARDWARE_CLEARANCE_PT);
		expect(top).toBeGreaterThan(placement.marginPt);
	});
});

describe('print-layout: the regression this module was written for', () => {
	it('no longer bleeds the shipped default to both vertical edges', () => {
		const placement = planPrintPlacement({ width: 1024, height: 1024 }, 'US_Letter');

		// What `main` produced: 612.0 x 612.0pt at x=0, y=90 — the full 8.5in width, zero margin.
		expect(placement.image.width).not.toBeCloseTo(612, 3);
		expect(placement.image.x).toBeGreaterThan(0);

		// What it produces now: the safe box is 8.5in - 24mm wide, and a square fills it.
		const expectedSide =
			8.5 * POINTS_PER_INCH - 2 * PRINT_SAFE_MARGIN_MM * POINTS_PER_MM;
		expect(placement.image.width).toBeCloseTo(expectedSide, 6);
		expect(placement.image.height).toBeCloseTo(expectedSide, 6);
	});

	it('agrees with the browser print path on how much paper stays blank', () => {
		// The number is not defined twice. `@page { margin: 12mm }` in the app shell is the browser
		// print path's margin, and core adopts it; this reads the stylesheet so the two cannot drift
		// apart silently. Before this run they disagreed by the whole margin: 12mm against zero.
		//
		// The first version of this guard was a single lazy regex over the raw file, and CodeRabbit
		// was right that it did not guard what its comment claimed. Measured rather than argued:
		// a `/* margin: 12mm; was the old value */` comment inside the block made it read **12** out
		// of the comment while the live declaration said 8. Comments are stripped first, every
		// `@page` block is enumerated rather than the first one taken, and more than one block
		// declaring a margin is a failure rather than a coin toss about which one governs.
		const layout = readFileSync(
			resolve(repoRoot, 'src/routes/+layout.svelte'),
			'utf8'
		);
		const withoutComments = layout.replace(/\/\*[\s\S]*?\*\//g, '');

		const blocks = [
			...withoutComments.matchAll(/@page([^{]*)\{([^}]*)\}/g)
		].map((match) => ({ prelude: match[1].trim(), body: match[2] }));

		const declaringMargin = blocks.filter((block) => /\bmargin\s*:/.test(block.body));
		expect(
			declaringMargin.length,
			`expected exactly one @page block declaring a margin in src/routes/+layout.svelte, found ${declaringMargin.length}`
		).toBe(1);

		// The unqualified `@page`, which is the one that governs every sheet. A margin that only
		// arrived via `@page :first` would not be the print job's margin.
		expect(
			declaringMargin[0].prelude,
			'the @page block carrying the margin is qualified, so it does not govern every sheet'
		).toBe('');

		// One length, not the four-value shorthand: core has a single margin and a per-edge rule
		// here would mean the two can no longer be compared at all.
		const margin = /\bmargin\s*:\s*([\d.]+)mm\s*;/.exec(declaringMargin[0].body);
		expect(
			margin,
			`@page declares a margin this test cannot compare to PRINT_SAFE_MARGIN_MM: ${declaringMargin[0].body.trim()}`
		).not.toBeNull();
		expect(Number(margin?.[1])).toBe(PRINT_SAFE_MARGIN_MM);
	});
});

describe('print-layout: the placement itself', () => {
	it('preserves aspect ratio rather than cropping or stretching', () => {
		for (const paper of PAPERS) {
			for (const source of SOURCES) {
				const { image } = planPrintPlacement(source, paper);
				expect(image.width / image.height).toBeCloseTo(source.width / source.height, 6);
			}
		}
	});

	it('centres the artwork in the safe box', () => {
		for (const paper of PAPERS) {
			for (const source of SOURCES) {
				const { page, image } = planPrintPlacement(source, paper);
				expect(image.x + image.width / 2).toBeCloseTo(page.width / 2, 6);
				expect(image.y + image.height / 2).toBeCloseTo(page.height / 2, 6);
			}
		}
	});

	it('fills the safe box on its constraining axis', () => {
		// Letterboxing means one axis touches the safe box exactly. If neither does, the artwork is
		// needlessly smaller than the paper allows.
		for (const paper of PAPERS) {
			for (const source of SOURCES) {
				const { content, image } = planPrintPlacement(source, paper);
				const fillsWidth = Math.abs(image.width - content.width) < 1e-6;
				const fillsHeight = Math.abs(image.height - content.height) < 1e-6;
				expect(fillsWidth || fillsHeight).toBe(true);
				expect(image.width).toBeLessThanOrEqual(content.width + 1e-9);
				expect(image.height).toBeLessThanOrEqual(content.height + 1e-9);
			}
		}
	});

	it('uses the real paper, not a rounding of it', () => {
		expect(PAGE_DIMENSIONS_PT.US_Letter).toEqual({ width: 612, height: 792 });
		// 210 x 297mm. The adapter used to write 595 x 842, which is fine while the artwork covers
		// the sheet and wrong once the safe box is derived by subtracting from it.
		expect(PAGE_DIMENSIONS_PT.A4.width).toBeCloseTo(595.276, 3);
		expect(PAGE_DIMENSIONS_PT.A4.height).toBeCloseTo(841.89, 2);
	});

	it('lays out a degenerate source without emitting NaN', () => {
		// A failed decode reports width 0; `NaN` in a PDF content stream is a file that may not open.
		for (const source of [
			{ width: 0, height: 0 },
			{ width: 0, height: 1024 },
			{ width: Number.NaN, height: Number.NaN },
			{ width: -100, height: 200 },
			{ width: Number.POSITIVE_INFINITY, height: 100 }
		]) {
			const { content, image, marginPt } = planPrintPlacement(source, 'US_Letter');
			for (const value of [image.x, image.y, image.width, image.height, marginPt]) {
				expect(Number.isFinite(value)).toBe(true);
			}
			// The documented fallback: it takes the shape of the safe box and fills it.
			expect(image.width).toBeCloseTo(content.width, 6);
			expect(image.height).toBeCloseTo(content.height, 6);
			expect(marginPt).toBeGreaterThanOrEqual(HARDWARE_CLEARANCE_PT - 1e-9);
		}
	});
});

describe('print-layout: the raster', () => {
	it('is a whole sheet at print resolution', () => {
		// Unchanged in value from the 2550 x 3300 the adapter used to hardcode, so the paper this app
		// defaults to gets the same canvas it always did.
		expect(printCanvasPx('US_Letter')).toEqual({ width: 2550, height: 3300 });
		// A4 now gets A4's raster rather than Letter's.
		expect(printCanvasPx('A4')).toEqual({ width: 2480, height: 3508 });
		expect(PRINT_RASTER_DPI).toBe(300);
	});

	it('flips the origin for a canvas and keeps the placement in proportion', () => {
		const placement = planPrintPlacement({ width: 1024, height: 1024 }, 'US_Letter');
		const px = placementToPx(placement);
		const canvas = printCanvasPx('US_Letter');
		const perPoint = PRINT_RASTER_DPI / POINTS_PER_INCH;

		expect(px.x).toBeCloseTo(placement.image.x * perPoint, 6);
		expect(px.width).toBeCloseTo(placement.image.width * perPoint, 6);
		// A canvas measures y down from the top; a PDF measures it up from the bottom. On a square
		// on portrait paper the two are equal by symmetry, so this asserts against the arithmetic.
		const topDown =
			placement.page.height - (placement.image.y + placement.image.height);
		expect(px.y).toBeCloseTo(topDown * perPoint, 6);

		// The drawn rectangle stays on the sheet, with the margin intact in pixels.
		expect(px.x).toBeGreaterThan(0);
		expect(px.x + px.width).toBeLessThanOrEqual(canvas.width + 1e-6);
		expect(px.y + px.height).toBeLessThanOrEqual(canvas.height + 1e-6);
	});

	it('flips the origin asymmetrically when the artwork is not centred by symmetry', () => {
		// A landscape source on portrait paper: large top/bottom margins, and the y flip is only
		// visible because `image.y` and the top-down y differ from each other by the letterboxing.
		const placement = planPrintPlacement({ width: 1536, height: 1024 }, 'US_Letter');
		const px = placementToPx(placement, 72);
		const topDown =
			placement.page.height - (placement.image.y + placement.image.height);
		expect(px.y).toBeCloseTo(topDown, 6);
		expect(px.height).toBeCloseTo(placement.image.height, 6);
	});
});

describe('print-layout: placedDpi', () => {
	it('reports the resolution the artwork is actually reproduced at', () => {
		const placement = planPrintPlacement({ width: 1024, height: 1024 }, 'US_Letter');
		const inches = placement.image.width / POINTS_PER_INCH;
		expect(placedDpi(1024, placement)).toBeCloseTo(1024 / inches, 6);
		// The provider's 1024px over roughly seven and a half inches of paper.
		expect(placedDpi(1024, placement)).toBeGreaterThan(130);
		expect(placedDpi(1024, placement)).toBeLessThan(150);
	});

	it('returns 0 rather than Infinity for an unusable source width', () => {
		const placement = planPrintPlacement({ width: 1024, height: 1024 }, 'US_Letter');
		expect(placedDpi(0, placement)).toBe(0);
		expect(placedDpi(Number.NaN, placement)).toBe(0);
	});
});
