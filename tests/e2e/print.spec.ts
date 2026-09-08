// Purpose: End-to-end cover for putting a coloring page on actual paper.
// Why: Every surface that makes a page tells the reader to "Print it. Color it.", and until this
//      run none of them could. What comes out of a printer is a rendering fact that only a real
//      browser in print media can see — a unit test cannot tell you that the navigation, the hero
//      photograph and eight photographic mode cards were being printed ahead of the picture, which
//      is what this app did on `main` at `f86ffdc`.
// Info flow: stubbed APIs -> a generated page on screen -> `emulateMedia({ media: 'print' })` ->
//            what is measurably on the sheet.
// Critical invariant: every assertion here is a measurement of the *print* rendering, never of the
//      screen one. `emulateMedia` is what makes the difference, and a test added below that forgets
//      it is asserting nothing about paper.
import { expect, test, type Page } from '@playwright/test';
// The stubbed endpoints and the load helper, shared with `share.spec.ts`. They used to be a copy
// in each file; SonarCloud's duplication gate measured the pair at 5.5% of new code against a 3%
// limit and failed the pull request that added the second one.
import { openRoute as open, stubPageApis as stub, STUB_QUOTE } from './support/page-fixtures';
// The same PDF reader the packaging unit test uses, so "what a printer receives" means one thing in
// this repo rather than two.
import { edgeMargins, readPlacedRect } from '../helpers/pdf-placement';
import { POINTS_PER_INCH } from '../../src/lib/core/print-layout';

test.setTimeout(120000);
test.describe.configure({ mode: 'parallel' });

/**
 * Take the home studio from a cold load to a finished picture on the paper.
 *
 * The wait on the verdict is load-bearing: "Create Coloring Page" is disabled until there is
 * something to make a page out of, so clicking straight after asking for the verdict clicks a
 * disabled button.
 */
const makeHomePage = async (page: Page): Promise<void> => {
	await open(page, '/');
	await page.getByTestId('home-evidence').fill('He said he was asleep at 2am.');
	await page.getByTestId('home-generate-verdict').click();
	await expect(page.getByTestId('home-verdict-quote')).toContainText(
		STUB_QUOTE
	);
	await page.getByTestId('home-create-page').click();
	await expect(page.getByTestId('home-generated-image')).toBeVisible();
};

/**
 * What is actually on the sheet.
 *
 * Visibility is measured from the layout rect, not from `getComputedStyle().display`: an element
 * inside a `display: none` ancestor reports its own display, so a style-based check counts every
 * hidden descendant of the hidden app as visible and passes on a page that prints everything.
 */
const onPaper = (page: Page) =>
	page.evaluate(() => {
		const visible = (element: Element): boolean => {
			const rect = element.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0;
		};
		const all = [...document.querySelectorAll('body *')];
		return {
			buttons: all.filter((el) => el.tagName === 'BUTTON' && visible(el)).length,
			fields: all.filter(
				(el) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && visible(el)
			).length,
			navLinks: [...document.querySelectorAll('.site-nav a')].filter(visible).length,
			images: [...document.querySelectorAll('img')].filter(visible).length,
			sheets: [...document.querySelectorAll('[data-print-sheet]')].filter(visible).length,
			fallbackShown: visible(document.querySelector('[data-testid="print-fallback"]')!)
		};
	});

test('the home studio prints the coloring page, not the app', async ({ page }) => {
	await stub(page);
	await open(page, '/');

	// Before there is a page, the control says so rather than opening a dialog onto blank paper.
	const print = page.getByTestId('home-print-page');
	await expect(print).toBeDisabled();
	await expect(print).toHaveText('Print');

	await page.getByTestId('home-evidence').fill('He said he was asleep at 2am.');
	await page.getByTestId('home-generate-verdict').click();
	await expect(page.getByTestId('home-verdict-quote')).toContainText(
		STUB_QUOTE
	);
	await page.getByTestId('home-create-page').click();
	await expect(page.getByTestId('home-generated-image')).toBeVisible();

	await expect(print).toBeEnabled();
	await expect(print).toHaveText('Print this page');

	await page.emulateMedia({ media: 'print' });
	const sheet = await onPaper(page);

	// The measurements that were 43, 10, 5 and 10 on `main` before this feature existed.
	expect(sheet.buttons).toBe(0);
	expect(sheet.fields).toBe(0);
	expect(sheet.navLinks).toBe(0);
	// The generated picture, and nothing else — no hero photograph, no eight mode cards.
	expect(sheet.images).toBe(1);
	expect(sheet.sheets).toBe(1);
	// There is a page, so the "nothing to print" sheet stays off the paper.
	expect(sheet.fallbackShown).toBe(false);
});

test('printing a screen with no coloring page says so instead of emitting blank paper', async ({
	page
}) => {
	await stub(page);
	await open(page, '/');

	await page.emulateMedia({ media: 'print' });
	const sheet = await onPaper(page);

	expect(sheet.sheets).toBe(0);
	expect(sheet.buttons).toBe(0);
	expect(sheet.navLinks).toBe(0);
	expect(sheet.fallbackShown).toBe(true);
	await expect(page.getByTestId('print-fallback')).toContainText(
		'No coloring page on this screen yet'
	);
});

test('a mode route prints its page through the shared studio', async ({ page }) => {
	await stub(page);
	await open(page, '/who-fucked-up');

	await page.getByTestId('who-situation-input').fill('He said he was asleep at 2am.');
	await page.getByTestId('who-submit').click();
	await expect(page.getByTestId('verdict-page-factory')).toBeVisible();

	// On this surface the print control lives in the finished-page action row beside the downloads
	// and the vault save, so before there is a page there is no row and no button — the same shape
	// those two already had. The home studio's action row is always on screen, so there the button
	// is present and disabled instead; both states are the same `describePrintJob` verdict.
	const print = page.getByTestId('verdict-page-print');
	await expect(print).toHaveCount(0);

	await page.getByTestId('verdict-page-generate').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();
	await expect(print).toBeEnabled();

	await page.emulateMedia({ media: 'print' });
	const sheet = await onPaper(page);

	expect(sheet.sheets).toBe(1);
	expect(sheet.images).toBe(1);
	expect(sheet.buttons).toBe(0);
	expect(sheet.fields).toBe(0);
	expect(sheet.fallbackShown).toBe(false);
});

test('the tools hub prints its page too', async ({ page }) => {
	await stub(page);
	await open(page, '/meechie');

	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-output')).toContainText('Fault: them');
	await page.getByTestId('meechie-tool-make-page').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();

	await expect(page.getByTestId('meechie-tool-print')).toBeEnabled();

	await page.emulateMedia({ media: 'print' });
	const sheet = await onPaper(page);

	expect(sheet.sheets).toBe(1);
	expect(sheet.images).toBe(1);
	expect(sheet.buttons).toBe(0);
	expect(sheet.fallbackShown).toBe(false);
});

test('one finished picture is one sheet of paper', async ({ page }) => {
	await stub(page);
	await makeHomePage(page);

	// The real paper, not an emulation of it: `page.pdf` runs the print stylesheet through
	// Chromium's own paged-media layout, which is the thing that decides how many sheets come out.
	const pdf = await page.pdf({ format: 'Letter', printBackground: false });
	const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
	// Was four on `main`: the nav, the hero, the mode cards and the panels.
	expect(pageCount).toBe(1);
});

test('the file the reader downloads has a printable margin on all four edges', async ({
	page
}) => {
	// The other tests in this file measure the *browser* print path, which Run 13 gave a 12mm
	// `@page` margin. This one measures the other path — the packaged PDF behind "Printable PDF ·
	// US Letter — ready to print", which is what a reader sends to a printer or forwards to someone
	// else. It is built by canvas and `pdf-lib` in the page, so only a real browser produces it, and
	// on `main` at `e6c450b` it came out with the artwork touching both edges of the sheet.
	await stub(page);
	await makeHomePage(page);

	const printLink = page.locator(
		'[data-testid="home-export-link"][data-export-kind="print"]'
	);
	await expect(printLink).toHaveCount(1);
	await expect(printLink).toContainText('Printable PDF');

	const href = await printLink.getAttribute('href');
	expect(href).toMatch(/^data:application\/pdf;base64,/);
	const pdf = Buffer.from((href ?? '').split(',')[1], 'base64');

	const rect = readPlacedRect(pdf);

	// US Letter, the default, at its true size.
	expect(rect.pageWidth).toBeCloseTo(8.5 * POINTS_PER_INCH, 1);
	expect(rect.pageHeight).toBeCloseTo(11 * POINTS_PER_INCH, 1);

	// 0.25in is the widest unprintable hardware border on common consumer printers. Stated here
	// rather than imported from the constant under test, so lowering that constant fails this.
	for (const edge of edgeMargins(rect)) {
		expect(edge).toBeGreaterThanOrEqual(0.25 * POINTS_PER_INCH);
	}

	// And it is still a page, not a stamp: the artwork uses the paper it is left.
	expect(rect.width).toBeGreaterThan(0.5 * rect.pageWidth);
});

test('the print job is named after the page, and a second print does not strand the tab name', async ({
	page
}) => {
	await stub(page);
	await makeHomePage(page);

	// Stand in for the printer: a real `print()` opens a dialog this test cannot dismiss, and what
	// is being measured is the title the job runs under, which is what the browser offers as the
	// filename for "Save as PDF".
	await page.evaluate(() => {
		(globalThis as unknown as { titlesSeen: string[] }).titlesSeen = [];
		globalThis.print = () => {
			(globalThis as unknown as { titlesSeen: string[] }).titlesSeen.push(document.title);
		};
	});

	const appTitle = await page.title();
	const print = page.getByTestId('home-print-page');

	// Twice, with no `afterprint` in between. `print()` resolves as soon as the preview opens in
	// several browsers, so this is reachable — and capturing the title per click would capture the
	// already-swapped one the second time and restore the wrong value for good.
	await print.click();
	await print.click();

	const seen = await page.evaluate(
		() => (globalThis as unknown as { titlesSeen: string[] }).titlesSeen
	);
	expect(seen).toEqual(['Receipt Energy', 'Receipt Energy']);

	await page.evaluate(() => globalThis.dispatchEvent(new Event('afterprint')));
	await expect.poll(() => page.title()).toBe(appTitle);
});
