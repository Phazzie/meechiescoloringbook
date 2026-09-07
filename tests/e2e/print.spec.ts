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

test.setTimeout(120000);
test.describe.configure({ mode: 'parallel' });

const png1x1 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

/** Just enough of each endpoint to get a picture on screen. */
const stub = async (page: Page): Promise<void> => {
	await page.route('**/api/meechie-studio-text', (route) =>
		route.fulfill({
			json: {
				ok: true,
				value: {
					verdict: 'Meechie clocked the timeline.',
					quote: 'The story folded before the receipt opened.',
					pageTitle: 'Receipt Energy',
					// Two, not one: `MeechieStudioTextOutputSchema` bounds `pageItems` at 2..6, and a
					// one-item fixture is rejected client-side as an unreadable response.
					pageItems: [
						{ number: 1, label: 'CHECK THE TIMELINE' },
						{ number: 2, label: 'KEEP THE RECEIPT' }
					],
					rating: 2,
					qualityState: 'ready',
					revisionNote: 'Print fixture.',
					modelMetadata: { provider: 'test', model: 'stub' }
				}
			}
		})
	);
	await page.route('**/api/generate', (route) =>
		route.fulfill({
			json: {
				ok: true,
				value: {
					prompt: 'Stub coloring page prompt.',
					templateVersion: 'v2',
					images: [
						{
							id: 'image-1',
							format: 'png',
							mimeType: 'image/png',
							data: png1x1,
							encoding: 'base64'
						}
					],
					revisedPrompt: 'Stub revised prompt.',
					modelMetadata: { provider: 'test', model: 'stub-image' },
					violations: [],
					recommendedFixes: []
				}
			}
		})
	);
	// The verdict echoes the tool that was asked for: the hub and the mode routes each send their
	// own `toolId`, and a reply naming a different one is a reply to a question nobody asked.
	await page.route('**/api/tools', async (route) => {
		const body = route.request().postDataJSON() as { toolId?: string };
		await route.fulfill({
			json: {
				ok: true,
				value: {
					toolId: body.toolId ?? 'unknown',
					headline: 'Red flag',
					response: 'Fault: them. Consequence: access gets reduced until facts improve.'
				}
			}
		});
	});
};

/**
 * Load a route and wait until it can be driven.
 *
 * The home page announces hydration; the others do not, so the wait there is on the control the
 * test is about to click actually being live. A fixed timeout races the hydration it is standing
 * in for, which is how a print test comes to fail for a reason that has nothing to do with print.
 */
const open = async (page: Page, path: string): Promise<void> => {
	await page.goto(path, { waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
		// Some asset pipelines keep a request open; hydration still completes.
	});
	if (path === '/') await page.waitForSelector('[data-hydrated="true"]');
};

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
		'The story folded before the receipt opened.'
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
		'The story folded before the receipt opened.'
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
