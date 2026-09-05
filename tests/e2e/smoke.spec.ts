// Purpose: Browser smoke tests for release-critical user flows.
// Why: Catch broken buttons, selectors, and API error states before deployment.
// Info flow: Playwright route stubs -> UI interactions -> visible states.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { getWeeklyModes } from '../../src/lib/core/meechie-studio';

test.setTimeout(120000);
// Parallel, not serial: every test owns its own browser context (localStorage is the
// only persistence), so they are independent. Under `serial` a single failure marks the
// remaining tests "did not run", which hides the rest of the suite behind the first bug.
test.describe.configure({ mode: 'parallel' });

const png1x1 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const wigJpegPath = fileURLToPath(
	new URL(
		'../../static/wigs/wig-001-sleek-straight-goddess.jpg',
		import.meta.url
	)
);
const wigJpegBase64 = readFile(wigJpegPath, 'base64');

const textOutput = {
	verdict: 'Meechie clocked the timeline.',
	quote: 'The story folded before the receipt opened.',
	pageTitle: 'Receipt Energy',
	pageItems: [
		{ number: 1, label: 'CHECK THE TIMELINE' },
		{ number: 2, label: 'KEEP THE RECEIPT' }
	],
	rating: 2,
	qualityState: 'ready',
	revisionNote: 'Smoke fixture.',
	modelMetadata: { provider: 'test', model: 'stub' }
};

const generatedPage = {
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
};

const toolPayload = (toolId: string) => ({
	ok: true,
	value: {
		toolId,
		headline: toolId === 'rate_excuse' ? '2/10' : 'Red flag',
		response:
			toolId === 'random_meechie'
				? 'If the story keeps changing, the answer already arrived.'
				: 'Fault: them. Consequence: access gets reduced until facts improve.',
		rating: toolId === 'rate_excuse' ? 2 : undefined
	}
});

const stubApis = async (page: Page): Promise<void> => {
	await page.route('**/api/meechie-studio-text', async (route) => {
		await route.fulfill({ json: { ok: true, value: textOutput } });
	});

	await page.route('**/api/generate', async (route) => {
		await route.fulfill({ json: generatedPage });
	});

	await page.route('**/api/tools', async (route) => {
		const body = route.request().postDataJSON() as { toolId?: string };
		await route.fulfill({ json: toolPayload(body.toolId ?? 'unknown') });
	});

	await page.route('**/api/wig-try-on', async (route) => {
		await route.fulfill({
			headers: { 'x-e2e-stub': 'wig-try-on' },
			json: {
				ok: true,
				value: {
					portraitBase64: await wigJpegBase64,
					portraitMimeType: 'image/jpeg'
				}
			}
		});
	});
};

const gotoHydrated = async (page: Page, path: string): Promise<void> => {
	await page.goto(path, { waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
		// Some asset pipelines keep a request open; hydration still completes.
	});
	if (path === '/') {
		await expect(page.getByTestId('studio-root')).toHaveAttribute(
			'data-hydrated',
			'true'
		);
	} else {
		await page.waitForTimeout(250);
	}
};

/**
 * Take the toolkit from a cold load to a page on screen: verdict, then generation.
 *
 * Every page-lifecycle test needs this exact opening, and repeating it inline tripped
 * SonarCloud's duplication gate at 8.2% on new code.
 */
const makeToolkitPage = async (page: Page): Promise<void> => {
	await gotoHydrated(page, '/meechie');
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-output')).toContainText(
		'Fault: them'
	);
	await page.getByTestId('meechie-tool-make-page').click();
	await expectPageOnScreen(page);
};

/** The page, its preview and its download are all present. */
const expectPageOnScreen = async (page: Page): Promise<void> => {
	await expect(page.locator('.preview-grid img')).toBeVisible();
	await expect(page.getByTestId('meechie-tool-download').first()).toBeVisible();
};

/** Fulfil `/api/tools` normally, optionally holding the nth call open. */
const routeTools = async (
	page: Page,
	options: { holdCall?: number; held?: Promise<void> } = {}
): Promise<void> => {
	let calls = 0;
	await page.route('**/api/tools', async (route) => {
		calls += 1;
		const body = route.request().postDataJSON() as { toolId?: string };
		if (options.holdCall === calls && options.held) await options.held;
		await route.fulfill({ json: toolPayload(body.toolId ?? 'unknown') });
	});
};

/**
 * Take the verdict already on screen through to a page kept in the vault: dedicate it, generate
 * it, check the download exists, save it, then confirm it reached the same vault the home page
 * reads rather than a private one.
 *
 * Shared rather than repeated. This is the identical closing sequence of every "a page made here
 * can be kept" test, and repeating it inline tripped SonarCloud's duplication gate on new code —
 * the same way the toolkit's opening sequence did before `makeToolkitPage` was extracted above.
 */
const makePageAndKeepIt = async (page: Page): Promise<void> => {
	await page.getByTestId('verdict-page-dedication').fill('For the group chat');
	await page.getByTestId('verdict-page-generate').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();
	await expect(page.getByTestId('verdict-page-download').first()).toBeVisible();

	await page.getByTestId('verdict-page-save-vault').click();
	await expect(page.getByTestId('verdict-page-vault-status')).toContainText(
		'Saved to the vault'
	);

	await gotoHydrated(page, '/');
	await expect(page.getByTestId('home-vault-load')).toBeVisible();
};

test.beforeEach(async ({ page }) => {
	await stubApis(page);
});

test('home mode switching and generation controls work', async ({ page }) => {
	// The mode strip is rotated by calendar week/month, so the visible ids change over
	// time. Derive them from the same source the page renders from instead of hardcoding.
	const [initialMode, switchedMode] = getWeeklyModes();

	await gotoHydrated(page, '/');
	await expect(page.getByTestId(`home-mode-${switchedMode.id}`)).toBeVisible();

	await expect(page.getByTestId('home-active-mode-heading')).toHaveText(
		initialMode.label
	);
	await page.getByTestId(`home-mode-${switchedMode.id}`).click();
	await expect(page.getByTestId('home-active-mode-heading')).toHaveText(
		switchedMode.label
	);
	await expect(page.getByTestId('home-evidence')).toHaveAttribute(
		'placeholder',
		switchedMode.placeholder
	);

	await page
		.getByTestId('home-evidence')
		.fill('He said traffic made him late.');
	await page.getByTestId('home-generate-verdict').click();
	await expect(page.getByTestId('home-verdict-quote')).toContainText(
		'The story folded before the receipt opened.'
	);

	// Before a page exists the row says so, instead of showing buttons that are disabled for
	// a reason nobody states.
	await expect(page.getByTestId('home-export-empty')).toBeVisible();
	await expect(page.getByTestId('home-export-link')).toHaveCount(0);

	await page.getByTestId('home-create-page').click();
	await expect(page.getByTestId('home-generated-image')).toBeVisible();

	// The mainline path out of the studio: a printable file, a share image, and the bytes on
	// screen — each naming itself and its size, where there used to be one repeated label.
	const homeExports = page.getByTestId('home-export-link');
	await expect(homeExports).toHaveCount(3);
	await expect(homeExports.nth(0)).toContainText('Printable PDF');
	await expect(homeExports.nth(1)).toContainText('Square PNG');
	await expect(homeExports.nth(2)).toContainText('Original PNG');
	// Sizes are measured from the bytes behind each link, so none of them can read as empty.
	for (const kind of ['print', 'square', 'original']) {
		await expect(
			page.locator(`[data-testid="home-export-link"][data-export-kind="${kind}"]`)
		).toContainText(/\d+(\.\d+)? (B|KB|MB)/);
	}
	await expect(page.getByTestId('home-export-error')).toHaveCount(0);

	await page.getByTestId('home-copy-quote').click();
	await expect(page.getByTestId('home-status')).toContainText(
		/Quote copied|Copy unavailable/
	);
	await expect(page.getByTestId('home-vault-empty')).toBeVisible();
});

test('wig try-on demo works end to end without provider traffic', async ({
	page
}) => {
	const providerRequests: string[] = [];
	page.on('request', (request) => {
		const hostname = new URL(request.url()).hostname;
		if (
			hostname === 'api.x.ai' ||
			hostname === 'generativelanguage.googleapis.com'
		) {
			providerRequests.push(request.url());
		}
	});

	await gotoHydrated(page, '/');

	const wigCards = page.locator('.wig-carousel .wig-card');
	const wigImages = page.locator('.wig-carousel .wig-img');
	await expect(wigCards).toHaveCount(8);
	await expect(wigImages).toHaveCount(8);

	for (const image of await wigImages.all()) {
		await image.scrollIntoViewIfNeeded();
		await expect
			.poll(async () =>
				image.evaluate((node) => {
					const img = node as HTMLImageElement;
					return img.complete && img.naturalWidth > 0;
				})
			)
			.toBe(true);
		await expect(image).toHaveAttribute('src', /^\/wigs\/[a-z0-9-]+\.jpg$/);
	}

	const firstWig = page.getByRole('button', {
		name: 'Select Sleek Straight Goddess'
	});
	await firstWig.click();
	await expect(firstWig).toHaveAttribute('aria-pressed', 'true');

	await page.locator('#selfie-input').setInputFiles(wigJpegPath);
	await expect(page.getByAltText('Your selfie preview')).toBeVisible();
	await expect(page.getByTestId('home-try-on')).toBeEnabled();

	const [tryOnResponse] = await Promise.all([
		page.waitForResponse('**/api/wig-try-on'),
		page.getByTestId('home-try-on').click()
	]);
	await expect
		.poll(() => tryOnResponse.headerValue('x-e2e-stub'))
		.toBe('wig-try-on');

	const portrait = page.getByTestId('home-try-on-portrait');
	await expect(portrait).toBeVisible();
	await expect(portrait).toHaveAttribute(
		'src',
		/^data:image\/jpeg;base64,\/9j\//
	);
	await expect(
		page.getByRole('link', { name: 'Save Portrait' })
	).toHaveAttribute('download', 'meechie-try-on-wig-001.jpg');

	await page.getByRole('button', { name: 'Make It a Coloring Page' }).click();
	const coloringPage = page.getByTestId('home-generated-image');
	await expect(coloringPage).toBeVisible();
	// The preview data URI maps the 4-value `format` enum to registered IANA media
	// types (`IMAGE_MIME_TYPES` in src/routes/studio-state.svelte.ts), so JPEG's enum
	// member `jpg` emits `image/jpeg` — not the non-standard `image/jpg` this used to
	// pin. Prove the bytes really are the stubbed portrait and really decode.
	// The payload is compared inside the page so a failure logs a short object instead
	// of a 3 MB base64 string.
	const portraitBase64 = await wigJpegBase64;
	await expect
		.poll(() =>
			coloringPage.evaluate((node, expected) => {
				const img = node as HTMLImageElement;
				const [header, payload = ''] = img.src.split(',');
				return {
					header,
					isPortraitBytes: payload === expected,
					decoded: img.complete && img.naturalWidth > 0
				};
			}, portraitBase64)
		)
		.toEqual({
			header: 'data:image/jpeg;base64',
			isPortraitBytes: true,
			decoded: true
		});
	// Every download names itself: what it is, what it is for, and how big it is. This row
	// used to render one hardcoded "Download PDF" per packaged file, plus a second link
	// handing back the provider's raw bytes under a label derived from nothing.
	const exportLinks = page.getByTestId('home-export-link');
	await expect(exportLinks).toHaveCount(3);
	await expect(exportLinks.nth(0)).toContainText('Printable PDF');
	await expect(exportLinks.nth(0)).toContainText('US Letter');
	// The share image the studio could not produce at all before this: the app is about
	// receipts you show people, and its front door could print a page but not post one.
	await expect(exportLinks.nth(1)).toContainText('Square PNG');
	await expect(exportLinks.nth(2)).toContainText('Original JPG');
	// A download's filename has to match the bytes behind it. These are the stubbed JPEG
	// portrait bytes, so the original is `.jpg` — and every file is named after this page
	// rather than after a constant that collides with every other page ever downloaded.
	await expect(exportLinks.nth(2)).toHaveAttribute(
		'download',
		/^meechie-try-on-coloring-page-.+-original\.jpg$/
	);
	await expect(exportLinks.nth(0)).toHaveAttribute(
		'download',
		/^meechie-try-on-coloring-page-.+\.pdf$/
	);
	// Nothing failed, so nothing is claimed to have failed.
	await expect(page.getByTestId('home-export-error')).toHaveCount(0);

	// A try-on page has no verdict behind it, and used to be the one page in the app the vault
	// would not take — the Save button was disabled on the verdict alone, so the portrait died
	// with the tab while every other surface reached the vault.
	await page.getByTestId('home-save-vault').click();
	await expect(page.getByTestId('home-status')).toContainText(
		'Saved to the quote vault.'
	);
	await expect(page.getByTestId('home-vault-load')).toContainText(
		'Wig Try-On - Sleek Straight Goddess'
	);

	expect(providerRequests).toEqual([]);
});

test('the wig catalog can be searched and filtered, and its counts never promise an empty result', async ({
	page
}) => {
	await gotoHydrated(page, '/');

	const resultCount = page.getByTestId('wig-result-count');
	const wigCards = page.locator('.wig-carousel .wig-card');
	await expect(resultCount).toHaveText('8 wigs');
	await expect(wigCards).toHaveCount(8);

	// Two of the eight are synthetic, and both happen to be the blonde one and the gray one.
	await page
		.getByTestId('wig-facet-hair-type')
		.getByRole('button', { name: /^Synthetic/ })
		.click();
	await expect(resultCount).toHaveText('2 of 8 wigs');
	await expect(wigCards).toHaveCount(2);

	// Four wigs are black, but none of them is synthetic. Counting each colour against the whole
	// catalog would advertise "Black 4" here and hand back nothing when tapped; the count is
	// measured against the other facets instead, so the chip reads 0 and cannot be tapped at all.
	const blackChip = page
		.getByTestId('wig-facet-color')
		.getByRole('button', { name: /^Black/ });
	await expect(blackChip).toHaveText(/0/);
	await expect(blackChip).toBeDisabled();

	await page
		.getByTestId('wig-facet-color')
		.getByRole('button', { name: /^Blonde/ })
		.click();
	await expect(resultCount).toHaveText('1 of 8 wigs');
	await expect(wigCards).toHaveCount(1);
	await expect(wigCards.first()).toContainText('Honey Blonde Bombshell');
	// The metadata the card used to hide is now on it.
	await expect(wigCards.first()).toContainText('Medium · Synthetic · Honey Blonde');

	await page.getByTestId('wig-clear').click();
	await expect(resultCount).toHaveText('8 wigs');
	await expect(wigCards).toHaveCount(8);

	// Search reaches the tags and colour names, not just the wig name.
	await page.getByTestId('wig-search').fill('silver');
	await expect(resultCount).toHaveText('1 of 8 wigs');
	await expect(wigCards.first()).toContainText('Silver Fox');

	await page.getByTestId('wig-search').fill('nothing matches this');
	await expect(page.getByTestId('wig-no-matches')).toBeVisible();
	await expect(resultCount).toHaveText('0 of 8 wigs');

	// Sorting reorders the whole catalog, cheapest first.
	await page.getByTestId('wig-clear').click();
	await page.getByTestId('wig-sort').selectOption('price_low');
	await expect(wigCards.first()).toContainText('Short Cut Boss');
});

/**
 * The catalog used to be a module-scope `import wigs.json`, so its cards and affiliate links were
 * in the server-rendered markup. Moving the read onto the seam inside an `$effect` moved it after
 * hydration, which emptied the initial HTML — invisible in a browser, and total for a crawler, a
 * reader with JavaScript off, or a failed hydration. The read is in the page's `load` for that
 * reason, and this test asserts the markup itself rather than what the hydrated page shows.
 */
test('the wig catalog and its affiliate links are server-rendered', async ({
	page
}) => {
	const response = await page.goto('/');
	const html = await response!.text();

	expect(html).toContain('Sleek Straight Goddess');
	expect(html).toContain('Kinky Coily Naturalista');
	// The affiliate link is what this section exists to carry, so it is the one that must be there.
	expect(html).toContain('beautyforever.com');
	expect(html).toContain('utm_source=meechie');
	// The metadata line and the result count come from the same data, so they prove it is the real
	// catalog and not a placeholder.
	expect(html).toContain('Medium · Human hair · Natural Black');
	expect(html).toContain('8 wigs');
});

test('a filter invalidated by a later search can still be switched off', async ({
	page
}) => {
	await gotoHydrated(page, '/');

	const humanChip = page
		.getByTestId('wig-facet-hair-type')
		.getByRole('button', { name: /^Human hair/ });
	await humanChip.click();
	await expect(page.getByTestId('wig-result-count')).toHaveText('6 of 8 wigs');

	// The only wig matching "silver" is synthetic, so the chip the reader already picked drops to
	// a count of zero. Disabling a zero-count chip is right for one they have not picked — it is a
	// dead end — but here it would strand them: the control that undoes the filter is the only one
	// that could, and Clear would throw away their search as well.
	await page.getByTestId('wig-search').fill('silver');
	await expect(humanChip).toHaveText(/0/);
	await expect(humanChip).toBeEnabled();

	await humanChip.click();
	await expect(page.getByTestId('wig-result-count')).toHaveText('1 of 8 wigs');
	// The search survived, which is the point of not making them press Clear.
	await expect(page.getByTestId('wig-search')).toHaveValue('silver');
});

test('two wigs tried on the same selfie can both be kept and compared', async ({
	page
}) => {
	await gotoHydrated(page, '/');

	await page.getByRole('button', { name: 'Select Sleek Straight Goddess' }).click();
	await page.locator('#selfie-input').setInputFiles(wigJpegPath);
	await expect(page.getByTestId('home-try-on')).toBeEnabled();
	await page.getByTestId('home-try-on').click();
	await expect(page.getByTestId('home-try-on-portrait')).toBeVisible();

	// One look is not a comparison, so the strip stays away until there is a choice to make.
	await expect(page.getByTestId('home-try-on-compare')).toHaveCount(0);

	await page.getByRole('button', { name: 'Select Short Cut Boss' }).click();
	// Switching wigs clears the result panel for the new wig, which has not been tried on yet...
	await expect(page.getByTestId('home-try-on-result')).toHaveCount(0);
	await page.getByTestId('home-try-on').click();
	await expect(page.getByTestId('home-try-on-portrait')).toBeVisible();

	// ...and now both looks are on the strip, in the order they were tried.
	const compare = page.getByTestId('home-try-on-compare');
	await expect(compare).toBeVisible();
	const looks = compare.getByRole('button');
	await expect(looks).toHaveCount(2);
	await expect(looks.nth(0)).toContainText('Sleek Straight Goddess');
	await expect(looks.nth(1)).toContainText('Short Cut Boss');

	// Tapping the first look goes back to it — the portrait it destroyed before this change.
	await looks.nth(0).click();
	await expect(page.getByTestId('home-try-on-portrait')).toBeVisible();
	await expect(
		page.getByRole('link', { name: 'Save Portrait' })
	).toHaveAttribute('download', 'meechie-try-on-wig-001.jpg');

	// A new selfie invalidates every stored portrait, because they are all of the old face.
	await page.locator('#selfie-input').setInputFiles(wigJpegPath);
	await expect(page.getByTestId('home-try-on-compare')).toHaveCount(0);
	await expect(page.getByTestId('home-try-on-result')).toHaveCount(0);
});

test('home quote vault can save, load, pin, and delete creations', async ({
	page
}) => {
	await gotoHydrated(page, '/');
	await page
		.getByTestId('home-evidence')
		.fill('He changed the story after the receipt appeared.');
	await page.getByTestId('home-generate-verdict').click();
	await expect(page.getByTestId('home-verdict-quote')).toContainText(
		'The story folded before the receipt opened.'
	);
	await page.getByTestId('home-save-vault').click();
	await expect(page.getByTestId('home-status')).toContainText(
		'Saved to the quote vault.'
	);
	await expect(page.getByTestId('home-vault-load')).toContainText(
		'RECEIPT ENERGY'
	);
	await page.getByTestId('home-vault-load').click();
	await expect(page.getByTestId('home-verdict-quote')).toContainText(
		'The story folded before the receipt opened.'
	);

	await page.getByTestId('home-vault-pin').click();
	await expect(page.getByTestId('home-vault-pin')).toHaveText('Unpin');

	// Delete is armed first and only destroys the page on the second click.
	await page.getByTestId('home-vault-delete').click();
	await expect(page.getByTestId('home-vault-load')).toBeVisible();
	await page.getByTestId('home-vault-delete-cancel').click();
	await expect(page.getByTestId('home-vault-load')).toBeVisible();

	await page.getByTestId('home-vault-delete').click();
	await page.getByTestId('home-vault-delete-confirm').click();
	await expect(page.getByTestId('home-vault-empty')).toBeVisible();

	// ...and one click puts it back.
	await page.getByTestId('home-vault-undo-restore').click();
	await expect(page.getByTestId('home-vault-load')).toContainText(
		'RECEIPT ENERGY'
	);
});

test('home quote vault searches saved pages and reveals the ones past the preview', async ({
	page
}) => {
	await gotoHydrated(page, '/');

	// The demo provider returns the same verdict for any evidence, so the two saves are told
	// apart by their shoutout — which the vault search covers along with the title and quote.
	for (const shoutout of ['Big Sis', 'Plumber Lou']) {
		await page
			.getByTestId('home-evidence')
			.fill('He changed the story after the receipt appeared.');
		await page.getByTestId('home-generate-verdict').click();
		await expect(page.getByTestId('home-verdict-quote')).not.toBeEmpty();
		await page.getByLabel('Shoutout').fill(shoutout);
		await page.getByTestId('home-save-vault').click();
		await expect(page.getByTestId('home-status')).toContainText(
			'Saved to the quote vault.'
		);
	}

	await expect(page.getByTestId('home-vault-count')).toContainText('2 saved');
	await expect(page.getByTestId('home-vault-load')).toHaveCount(2);

	await page.getByTestId('home-vault-search').fill('plumber');
	await expect(page.getByTestId('home-vault-load')).toHaveCount(1);

	await page
		.getByTestId('home-vault-search')
		.fill('nothing matches this at all');
	await expect(page.getByTestId('home-vault-no-matches')).toBeVisible();

	await page.getByTestId('home-vault-search').fill('');
	await expect(page.getByTestId('home-vault-list')).toBeVisible();
});

test('home shoutout input debounces draft save and clears dedication', async ({
	page
}) => {
	await gotoHydrated(page, '/');
	await expect
		.poll(
			async () => page.evaluate(() => localStorage.getItem('cb_session_id_v1')),
			{
				timeout: 5000
			}
		)
		.not.toBeNull();
	await page.evaluate(() => {
		localStorage.removeItem('cb_drafts_v1');
	});

	const readDraft = (): Promise<{ intent?: { dedication?: string } } | null> =>
		page.evaluate(() =>
			JSON.parse(localStorage.getItem('cb_drafts_v1') ?? 'null')
		);

	const shoutout = page.getByLabel('Shoutout');
	await shoutout.fill('  Big Sis  ');
	expect(await readDraft()).toBeNull();
	await expect
		.poll(async () => (await readDraft())?.intent?.dedication, {
			timeout: 5000
		})
		.toBe('Big Sis');

	await shoutout.fill('   ');
	expect((await readDraft())?.intent?.dedication).toBe('Big Sis');
	await expect
		.poll(async () => (await readDraft())?.intent?.dedication, {
			timeout: 5000
		})
		.toBeUndefined();
});

test('random route tap and page generation work', async ({ page }) => {
	await gotoHydrated(page, '/random');
	await expect(page.getByTestId('random-tap')).toBeVisible();

	await Promise.all([
		page.waitForResponse('**/api/tools'),
		page.getByTestId('random-tap').click({ force: true })
	]);
	await expect(page.getByTestId('random-result')).toContainText(
		'story keeps changing'
	);

	await page.getByTestId('verdict-page-generate').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();
});

test('rate and who routes submit, reset, and generate pages', async ({
	page
}) => {
	await gotoHydrated(page, '/rate-his-excuse');
	await page.getByTestId('rate-excuse-input').fill('He forgot again.');
	await page.getByTestId('rate-submit').click();
	await expect(page.getByTestId('rate-result')).toContainText('Fault: them');
	await page.getByTestId('verdict-page-generate').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();
	await page.getByTestId('rate-reset').click();
	await expect(page.getByTestId('rate-submit')).toBeVisible();

	await gotoHydrated(page, '/who-fucked-up');
	await page.getByTestId('who-situation-input').fill('Nobody owned the bug.');
	await page.getByTestId('who-submit').click();
	await expect(page.getByTestId('who-result')).toContainText('Fault: them');
	await page.getByTestId('verdict-page-generate').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();
	await page.getByTestId('who-reset').click();
	await expect(page.getByTestId('who-submit')).toBeVisible();
});

test('the mode routes print the structure a verdict came back in', async ({
	page
}) => {
	// The three standalone mode routes used to send `listMode: 'title_only'` for every verdict,
	// throwing away the "Fault:"/"Consequence:" structure the tool prompts explicitly ask for and
	// capping the whole thing at a 96-character title. They now share the studio's page recipe.
	const specs: { listMode: string; items: unknown[] }[] = [];
	await page.route('**/api/generate', async (route) => {
		const body = route.request().postDataJSON() as {
			spec: { listMode: string; items: unknown[] };
		};
		specs.push(body.spec);
		await route.fulfill({ json: generatedPage });
	});

	await gotoHydrated(page, '/who-fucked-up');
	await page
		.getByTestId('who-situation-input')
		.fill('He went quiet for a week.');
	await page.getByTestId('who-submit').click();
	await expect(page.getByTestId('who-result')).toContainText('Fault: them');
	await page.getByTestId('verdict-page-generate').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();

	// Random Meechie's stubbed saying has no structure, so it stays a full-quote page.
	await gotoHydrated(page, '/random');
	await Promise.all([
		page.waitForResponse('**/api/tools'),
		page.getByTestId('random-tap').click()
	]);
	await page.getByTestId('verdict-page-generate').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();

	expect(specs).toHaveLength(2);
	expect(specs[0].listMode).toBe('list');
	expect(specs[0].items.length).toBeGreaterThanOrEqual(2);
	expect(specs[1].listMode).toBe('title_only');
	expect(specs[1].items).toEqual([]);
});

test('a page made on a mode route can be saved and found in the home vault', async ({
	page
}) => {
	// Before this, nothing outside the studio and the tools hub could write to the vault, so a page
	// generated on one of the app's three most prominent nav destinations survived exactly as long
	// as the tab did.
	await gotoHydrated(page, '/rate-his-excuse');
	await page.getByTestId('rate-excuse-input').fill('My alarm did not go off.');
	await page.getByTestId('rate-submit').click();
	await expect(page.getByTestId('rate-result')).toContainText('Fault: them');

	await makePageAndKeepIt(page);
});

test('editing the dedication drops the page it was not generated with', async ({
	page
}) => {
	// The dedication is baked into the spec at generation time. Leaving the page on screen after an
	// edit offers a download and a vault record carrying the previous value under the new one.
	await gotoHydrated(page, '/who-fucked-up');
	await page
		.getByTestId('who-situation-input')
		.fill('He read it and said nothing.');
	await page.getByTestId('who-submit').click();
	await expect(page.getByTestId('who-result')).toContainText('Fault: them');

	await page.getByTestId('verdict-page-generate').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();

	await page.getByTestId('verdict-page-dedication').fill('Second thoughts');
	await expect(page.locator('.preview-grid img')).toHaveCount(0);
	await expect(page.getByTestId('verdict-page-download')).toHaveCount(0);
});

test('Another one drops a dedication chosen for the previous saying', async ({
	page
}) => {
	// A new saying is a new subject. Carrying the previous dedication over means the next page is
	// generated, downloaded and saved for a recipient the user never chose it for.
	await gotoHydrated(page, '/random');
	await Promise.all([
		page.waitForResponse('**/api/tools'),
		page.getByTestId('random-tap').click()
	]);
	await page.getByTestId('verdict-page-dedication').fill('For Andre');
	await expect(page.getByTestId('verdict-page-dedication')).toHaveValue(
		'For Andre'
	);

	await Promise.all([
		page.waitForResponse('**/api/tools'),
		page.getByTestId('random-another').click()
	]);
	await expect(page.getByTestId('verdict-page-dedication')).toHaveValue('');
});

test('a failed re-ask on a mode route does not destroy the page already on screen', async ({
	page
}) => {
	// The same defect the tools hub was fixed for, on the routes that still had it: the old
	// `handleSubmit` cleared the verdict and the previews before the request went out, so a
	// timeout deleted a page the reader had already paid a generation for.
	let toolsCalls = 0;
	await page.route('**/api/tools', async (route) => {
		toolsCalls += 1;
		const body = route.request().postDataJSON() as { toolId?: string };
		if (toolsCalls === 1) {
			await route.fulfill({ json: toolPayload(body.toolId ?? 'unknown') });
			return;
		}
		await route.fulfill({
			status: 500,
			json: { message: 'provider exploded' }
		});
	});

	await gotoHydrated(page, '/who-fucked-up');
	await page.getByTestId('who-situation-input').fill('He said he was working.');
	await page.getByTestId('who-submit').click();
	await expect(page.getByTestId('who-result')).toContainText('Fault: them');

	await page.getByTestId('verdict-page-generate').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();

	await page.getByTestId('who-again').click();
	await expect(page.getByTestId('who-error')).toBeVisible();

	// The verdict and the page it produced are both still there.
	await expect(page.getByTestId('who-result')).toContainText('Fault: them');
	await expect(page.locator('.preview-grid img')).toBeVisible();
	await expect(page.getByTestId('verdict-page-download').first()).toBeVisible();
	await expect(page.getByTestId('who-again')).toBeEnabled();
});

test('meechie toolkit tabs and lineup controls work', async ({ page }) => {
	await gotoHydrated(page, '/meechie');
	await expect(page.getByTestId('meechie-tool-lineup')).toBeVisible();

	await page.getByTestId('meechie-tool-lineup').click();
	await expect(page.getByTestId('meechie-lineup-add')).toBeVisible();
	await expect(page.locator('.lineup-row input')).toHaveCount(3);
	await page.getByTestId('meechie-lineup-add').click();
	await expect(page.locator('.lineup-row input')).toHaveCount(4);
	await page.getByTestId('meechie-lineup-remove').first().click();
	await expect(page.locator('.lineup-row input')).toHaveCount(3);

	// Add up to the 6-item cap; the add button disables instead of silently no-op'ing.
	await page.getByTestId('meechie-lineup-add').click();
	await page.getByTestId('meechie-lineup-add').click();
	await page.getByTestId('meechie-lineup-add').click();
	await expect(page.locator('.lineup-row input')).toHaveCount(6);
	await expect(page.getByTestId('meechie-lineup-add')).toBeDisabled();

	// Remove down to the 1-item floor; every remove button disables instead of silently no-op'ing.
	for (let removed = 0; removed < 5; removed += 1) {
		await page.getByTestId('meechie-lineup-remove').first().click();
	}
	await expect(page.locator('.lineup-row input')).toHaveCount(1);
	await expect(page.getByTestId('meechie-lineup-remove')).toBeDisabled();
	await expect(page.getByTestId('meechie-lineup-add')).toBeEnabled();

	await page.getByTestId('meechie-tool-random_meechie').click();
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-output')).toContainText(
		'story keeps changing'
	);
});

test('every toolkit verdict becomes a coloring page that downloads and saves', async ({
	page
}) => {
	await gotoHydrated(page, '/meechie');

	// The toolkit opens on Apology Autopsy; the page factory only exists once a verdict does.
	await expect(page.getByTestId('meechie-tool-page-factory')).toBeHidden();
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-output')).toContainText(
		'Fault: them'
	);
	await expect(page.getByTestId('meechie-tool-page-factory')).toBeVisible();

	await page.getByTestId('meechie-tool-dedication').fill('For Ray');
	await page.getByTestId('meechie-tool-make-page').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();
	await expect(page.getByTestId('meechie-tool-download').first()).toBeVisible();

	await page.getByTestId('meechie-tool-save-vault').click();
	await expect(page.getByTestId('meechie-tool-vault-status')).toContainText(
		'Saved to the vault'
	);

	// Switching tools drops the page built from the previous verdict, so a stale download can
	// never be attributed to the tool now on screen.
	await page.getByTestId('meechie-tool-clapback').click();
	await expect(page.getByTestId('meechie-tool-page-factory')).toBeHidden();

	// The page saved from the toolkit is a real vault entry on the home page, not a local-only
	// preview: same session, same store the studio writes to.
	await gotoHydrated(page, '/');
	await expect(page.getByTestId('home-vault-load')).toBeVisible();
});

test('a slow page generation cannot land under a different verdict', async ({
	page
}) => {
	// Codex found this: `/api/generate` is slow enough to switch tools underneath, and the tool
	// switch sets `output` to null. A late response used to repopulate the page state beneath the
	// new verdict, and reading the old verdict's toolId after the await threw outright.
	// Definite-assignment, not `| null`: the executor runs synchronously, but control-flow
	// analysis cannot see that and narrows a nullable binding to `never` at the call site.
	let release!: () => void;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route('**/api/generate', async (route) => {
		await held;
		await route.fulfill({ json: generatedPage });
	});

	const pageErrors: string[] = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));

	await gotoHydrated(page, '/meechie');
	await page.getByTestId('meechie-tool-red_flag_or_run').click();
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-page-factory')).toBeVisible();

	// Start the generation, then switch tools while it is still in flight.
	await page.getByTestId('meechie-tool-make-page').click();
	await page.getByTestId('meechie-tool-clapback').click();
	await expect(page.getByTestId('meechie-tool-page-factory')).toBeHidden();

	// Take the new tool's own verdict, so the factory is on screen. This is what makes the stale
	// response observable: with the page hidden, a discarded response and a wrongly-applied one
	// look identical. The button being enabled here is already part of the fix — abandoning a
	// generation releases `isGenerating` rather than wedging it.
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-page-factory')).toBeVisible();
	await expect(page.getByTestId('meechie-tool-make-page')).toBeEnabled();
	await expect(page.locator('.preview-grid img')).toHaveCount(0);

	// Now let the abandoned response arrive.
	const abandoned = page.waitForResponse('**/api/generate');
	release();
	await abandoned;

	// Wait on an event rather than sleeping: this resolves only if the page raises an error, so a
	// timeout is the passing outcome and a late error still fails. It also gives the discarded
	// response a real window in which to paint — which is what the next assertion depends on.
	await expect(
		page.waitForEvent('pageerror', { timeout: 3000 })
	).rejects.toThrow();
	expect(pageErrors).toEqual([]);

	// The load-bearing assertion: tool A's page must not have appeared under tool B's verdict.
	await expect(page.locator('.preview-grid img')).toHaveCount(0);
	await expect(page.getByTestId('meechie-tool-download')).toHaveCount(0);
});

test('editing the dedication drops the page it was not generated with, and drift is surfaced', async ({
	page
}) => {
	// The dedication is baked into the spec at generation time, so a page left on screen after the
	// field changes carries the previous value while the form shows the new one.
	const drifted = {
		ok: true,
		value: {
			...generatedPage.value,
			violations: [
				{
					code: 'TEXT_DRIFT',
					message: 'The printed title lost a word.',
					severity: 'warning'
				}
			]
		}
	};
	await page.route('**/api/generate', async (route) => {
		await route.fulfill({ json: drifted });
	});

	await gotoHydrated(page, '/meechie');
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-page-factory')).toBeVisible();

	await page.getByTestId('meechie-tool-dedication').fill('For Alice');
	await page.getByTestId('meechie-tool-make-page').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();

	// Drift diagnostics are shown rather than discarded behind a page that looks clean.
	await expect(page.getByTestId('meechie-tool-violations')).toContainText(
		'The printed title lost a word.'
	);

	// Changing the dedication invalidates the page generated for the previous one, so there is no
	// download or save offering Alice's page under Bob's name.
	await page.getByTestId('meechie-tool-dedication').fill('For Bob');
	await expect(page.locator('.preview-grid img')).toHaveCount(0);
	await expect(page.getByTestId('meechie-tool-download')).toHaveCount(0);
	await expect(page.getByTestId('meechie-tool-save-vault')).toHaveCount(0);
	await expect(page.getByTestId('meechie-tool-violations')).toHaveCount(0);
});

test('switching tools during a pending verdict does not wedge the button', async ({
	page
}) => {
	// The staleness guards stop an abandoned request from clearing a newer request's flag — which
	// means the abandoned request clears nothing, so the tool switch has to release `isWorking`
	// itself. Without that, the verdict button stayed disabled until a page reload.
	let release!: () => void;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	let firstToolsCall = true;
	await page.route('**/api/tools', async (route) => {
		const body = route.request().postDataJSON() as { toolId?: string };
		if (firstToolsCall) {
			firstToolsCall = false;
			await held;
		}
		await route.fulfill({ json: toolPayload(body.toolId ?? 'unknown') });
	});

	await gotoHydrated(page, '/meechie');
	await page.getByTestId('meechie-tool-red_flag_or_run').click();
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-generate')).toBeDisabled();

	// Switch tools while the first verdict request is still in flight.
	await page.getByTestId('meechie-tool-clapback').click();
	await expect(page.getByTestId('meechie-tool-generate')).toBeEnabled();

	// The abandoned response must not re-disable it, and the new tool must still work.
	release();
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-output')).toBeVisible();
	await expect(page.getByTestId('meechie-tool-generate')).toBeEnabled();
});

test('a structured verdict prints as a numbered list page, an unstructured one as a quote', async ({
	page
}) => {
	const specs: Array<{ listMode: string; items: unknown[] }> = [];
	await page.route('**/api/generate', async (route) => {
		const body = route.request().postDataJSON() as {
			spec: { listMode: string; items: unknown[] };
		};
		specs.push({ listMode: body.spec.listMode, items: body.spec.items });
		await route.fulfill({ json: generatedPage });
	});

	await gotoHydrated(page, '/meechie');

	// Run Or Red Flag is prompted to answer in "Fault:"/"Consequence:" beats, and the stub does,
	// so its page carries that structure as numbered lines instead of flattening it into a title.
	await page.getByTestId('meechie-tool-red_flag_or_run').click();
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-page-factory')).toBeVisible();
	await page.getByTestId('meechie-tool-make-page').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();

	// Random Meechie's stubbed saying has no structure to print as a list.
	await page.getByTestId('meechie-tool-random_meechie').click();
	await page.getByTestId('meechie-tool-generate').click();
	await page.getByTestId('meechie-tool-make-page').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();

	expect(specs).toHaveLength(2);
	expect(specs[0].listMode).toBe('list');
	expect(specs[0].items.length).toBeGreaterThanOrEqual(2);
	expect(specs[1].listMode).toBe('title_only');
	expect(specs[1].items).toEqual([]);
});

test('a failed replacement verdict does not destroy the page already on screen', async ({
	page
}) => {
	// Codex found this: `handleGenerate` cleared the verdict, the previews, the downloads and the
	// save recipe before it had validated the input or heard back from `/api/tools`. A required
	// field left empty, a timeout, or a provider error therefore deleted a page the reader had
	// already paid to generate, with nothing left to restore it from.
	let toolsCalls = 0;
	await page.route('**/api/tools', async (route) => {
		toolsCalls += 1;
		const body = route.request().postDataJSON() as { toolId?: string };
		if (toolsCalls === 1) {
			await route.fulfill({ json: toolPayload(body.toolId ?? 'unknown') });
			return;
		}
		await route.fulfill({
			status: 500,
			json: { message: 'provider exploded' }
		});
	});

	await makeToolkitPage(page);

	// A second verdict request on the same tool, this time failing.
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-error')).toBeVisible();

	// The page the reader paid for is still there, and still downloadable.
	await expect(page.getByTestId('meechie-tool-output')).toContainText(
		'Fault: them'
	);
	await expectPageOnScreen(page);
	await expect(page.getByTestId('meechie-tool-generate')).toBeEnabled();
});

test('a failed regeneration does not destroy the page already on screen', async ({
	page
}) => {
	// The page path had the same defect the verdict path did: `handleMakePage` cleared the preview,
	// the downloads, the images and the save recipe before `/api/generate` had returned, so a
	// timeout or a provider error deleted a page the reader had already paid for.
	let generateCalls = 0;
	await page.route('**/api/generate', async (route) => {
		generateCalls += 1;
		if (generateCalls === 1) {
			await route.fulfill({ json: generatedPage });
			return;
		}
		await route.fulfill({
			status: 500,
			json: { message: 'provider exploded' }
		});
	});

	await makeToolkitPage(page);

	// Second attempt fails, and the paid page must survive it.
	await page.getByTestId('meechie-tool-make-page').click();
	await expect(page.getByTestId('meechie-tool-generate-error')).toBeVisible();
	await expectPageOnScreen(page);
	await expect(page.getByTestId('meechie-tool-make-page')).toBeEnabled();
});

test('making a page does not cancel a verdict request nobody cancelled', async ({
	page
}) => {
	// Verdicts and pages are separate requests. They shared one token, so pressing Make Page (or
	// editing the dedication) on the verdict already displayed advanced the token the pending
	// `/api/tools` request had captured, and the good verdict was thrown away as stale.
	let release!: () => void;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await routeTools(page, { holdCall: 2, held });

	// A page has to exist for the dedication handler to reset anything — that reset is what used to
	// advance the shared token out from under the pending verdict request.
	await makeToolkitPage(page);

	// A second verdict request, held open, with a page-only action running underneath it.
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-generate')).toBeDisabled();
	await page.getByTestId('meechie-tool-dedication').fill('For Ray');

	// The held verdict was never cancelled, so it must still land and re-enable the button.
	release();
	await expect(page.getByTestId('meechie-tool-output')).toContainText(
		'Fault: them'
	);
	await expect(page.getByTestId('meechie-tool-generate')).toBeEnabled();
});

test('an unreadable generated image does not replace the page already on screen', async ({
	page
}) => {
	// A contract-valid response is not a usable page. `GeneratedImageSchema` types `data` as
	// `NonEmptyStringSchema`, and `image-generation-pipeline.ts` labels bytes it cannot identify as
	// `png`, so a provider returning nonempty garbage arrives as a well-formed PNG. Installing the
	// page before packaging — the fix that stopped a packaging failure from discarding a finished
	// PDF — meant that garbage replaced a good page with a broken tile, left Save enabled, and let
	// the corrupt image reach the vault.
	//
	// The second payload is the sharper case: a real PNG signature followed by nothing. A
	// byte-signature check passes it, and `pdf-lib` still throws — which is what a connection
	// dropped mid-body actually produces. Only a real decode rejects both.
	const TRUNCATED_PNG = 'iVBORw0KGgo=';
	let generateCalls = 0;
	await page.route('**/api/generate', async (route) => {
		generateCalls += 1;
		if (generateCalls === 1) {
			await route.fulfill({ json: generatedPage });
			return;
		}
		const data = generateCalls === 2 ? 'bm90LWFuLWltYWdl' : TRUNCATED_PNG;
		await route.fulfill({
			json: {
				...generatedPage,
				value: {
					...generatedPage.value,
					images: [
						{
							...generatedPage.value.images[0],
							id: `image-${generateCalls}`,
							data
						}
					]
				}
			}
		});
	});

	await makeToolkitPage(page);

	// Nonempty garbage: 200, schema-valid, unreadable bytes. The paid page must survive.
	await page.getByTestId('meechie-tool-make-page').click();
	await expect(page.getByTestId('meechie-tool-generate-error')).toContainText(
		'could not be read'
	);
	await expectPageOnScreen(page);
	await expect(page.getByTestId('meechie-tool-make-page')).toBeEnabled();

	// A valid PNG signature with the image truncated away. Passes any signature test; still unusable.
	await page.getByTestId('meechie-tool-make-page').click();
	await expect(page.getByTestId('meechie-tool-generate-error')).toContainText(
		'could not be read'
	);
	await expectPageOnScreen(page);
	await expect(page.getByTestId('meechie-tool-make-page')).toBeEnabled();
});

test('a focused mode page turns its verdict into a coloring page', async ({
	page
}) => {
	// The whole reason this page was rebuilt. `/m/<slug>` is the only page five of the eight modes
	// have, and every focused-mode link on the home page lands here. It used to stop at the verdict:
	// no page, no download, no vault, in an app whose one purpose is printable coloring pages.
	await gotoHydrated(page, '/m/who-fucked-up');

	// The fields start empty and the button stays refused until the reader writes something. The
	// page used to ship every field pre-filled with invented drama, so this button was always live
	// and always returned a real verdict about a fiction nobody had written.
	await expect(page.getByTestId('mode-field-situation')).toHaveValue('');
	await expect(page.getByTestId('mode-submit')).toBeDisabled();

	await page.getByTestId('mode-field-situation').fill('He went quiet for a week.');
	await expect(page.getByTestId('mode-submit')).toBeEnabled();
	await page.getByTestId('mode-submit').click();
	await expect(page.getByTestId('mode-result')).toContainText('Fault: them');

	// Generate, download and keep it — the half of this page that did not exist at all before.
	await makePageAndKeepIt(page);
});

test('a mode with no input, and a mode with two, both reach a page', async ({
	page
}) => {
	// Random Meechie asks nothing, so its submit must be live on arrival; Receipt Check asks two
	// questions and must not be satisfied by one. Both are shapes the single-field path would pass
	// by accident.
	await gotoHydrated(page, '/m/random');
	await expect(page.getByTestId('mode-submit')).toBeEnabled();
	await Promise.all([
		page.waitForResponse('**/api/tools'),
		page.getByTestId('mode-submit').click()
	]);
	await expect(page.getByTestId('mode-result')).toContainText(
		'story keeps changing'
	);
	await page.getByTestId('verdict-page-generate').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();

	await gotoHydrated(page, '/m/receipt-check');
	await expect(page.getByTestId('mode-submit')).toBeDisabled();
	await page.getByTestId('mode-field-claim').fill('I never said that.');
	await expect(page.getByTestId('mode-submit')).toBeDisabled();
	await page.getByTestId('mode-field-reality').fill('Said it in the group chat.');
	await expect(page.getByTestId('mode-submit')).toBeEnabled();
	await page.getByTestId('mode-submit').click();
	await expect(page.getByTestId('mode-result')).toContainText('Fault: them');
});

test('walking from one mode to another does not carry the first verdict over', async ({
	page
}) => {
	// SvelteKit reuses one component instance across parameter changes on the same route, and the
	// mode page owns a `VerdictPageState` built once per instance. Without the `{#key}` in
	// `/m/[mode]/+page.svelte` the clapback verdict stays on screen under Receipt Check's title and
	// the page it made still downloads as `meechie-clapback-*.pdf`.
	//
	// The navigation has to be a *client-side* one for that reuse to happen at all: a fresh
	// `page.goto` builds a new document and would pass with or without the key. So this walks the
	// "Ask her something else" link, which is the real in-app route between two modes.
	await gotoHydrated(page, '/m/clapback');
	await page.getByTestId('mode-field-comment').fill("She said I'm doing too much.");
	await page.getByTestId('mode-submit').click();
	await expect(page.getByTestId('mode-result')).toContainText('Fault: them');

	// Mark the document. If the click turns out to be a full page load the mark is gone, and this
	// test would be proving nothing again — which is exactly how its first version passed with the
	// key deleted.
	await page.evaluate(() => {
		(window as unknown as { __sameDocument?: true }).__sameDocument = true;
	});

	await page.getByTestId('mode-link-receipt-check').click();
	await expect(page).toHaveURL(/\/m\/receipt-check$/);
	expect(
		await page.evaluate(
			() => (window as unknown as { __sameDocument?: true }).__sameDocument
		)
	).toBe(true);

	await expect(page.getByTestId('mode-result')).toHaveCount(0);
	await expect(page.getByTestId('mode-field-claim')).toHaveValue('');
	await expect(page.getByTestId('mode-submit')).toBeDisabled();
});

test('a slug that names no mode is a 404, not a different mode', async ({
	page
}) => {
	// Every unrecognised slug used to render Random Meechie and answer 200, so a typo served a
	// different mode's page under the requested URL with nothing on screen to say so.
	const response = await page.goto('/m/not-a-real-mode', {
		waitUntil: 'domcontentloaded'
	});
	expect(response?.status()).toBe(404);
	await expect(page.getByTestId('error-message')).toContainText('not-a-real-mode');
	// The error page offers the modes that do exist rather than dead-ending.
	await expect(page.locator('a[href="/m/who-fucked-up"]')).toBeVisible();

	// An older slug that used to work still works, and resolves to the canonical mode.
	await gotoHydrated(page, '/m/rate-his-excuse');
	await expect(page.getByTestId('mode-field-excuse')).toBeVisible();
});

test('a mode page does not pan sideways on a phone', async ({ page }) => {
	// The ambient decoration sits 2rem past the page's right edge. Below the 680px maximum the page
	// fills the viewport, so that overhang became 32px of real document width and the page could be
	// dragged sideways into blank space. Measured, not eyeballed: 422 against a 390 viewport before
	// `overflow-x: clip`, 390 after.
	await page.setViewportSize({ width: 390, height: 844 });
	for (const path of ['/m/who-fucked-up', '/m/random', '/who-fucked-up']) {
		await gotoHydrated(page, path);
		const overflow = await page.evaluate(
			() =>
				document.documentElement.scrollWidth -
				document.documentElement.clientWidth
		);
		expect(overflow, `${path} pans sideways by ${overflow}px`).toBe(0);
	}
});

test('a replacement saying drops a dedication chosen for the previous one', async ({
	page
}) => {
	// `/m/random` returns a different subject on every tap, so a dedication chosen for the previous
	// saying must not ride along onto the next one — the same rule `/random` already follows. A mode
	// that asks a question is re-asking about the same situation, so its dedication still belongs
	// and must survive; both halves are asserted here because the fix is a split, not a blanket
	// clear.
	await gotoHydrated(page, '/m/random');
	await page.getByTestId('mode-submit').click();
	await expect(page.getByTestId('mode-result')).toContainText(
		'story keeps changing'
	);

	await page.getByTestId('verdict-page-dedication').fill('For the group chat');
	await Promise.all([
		page.waitForResponse('**/api/tools'),
		page.getByTestId('mode-again').click()
	]);
	await expect(page.getByTestId('verdict-page-dedication')).toHaveValue('');

	// The question-asking modes keep theirs.
	await gotoHydrated(page, '/m/who-fucked-up');
	await page.getByTestId('mode-field-situation').fill('He went quiet for a week.');
	await page.getByTestId('mode-submit').click();
	await expect(page.getByTestId('mode-result')).toContainText('Fault: them');

	await page.getByTestId('verdict-page-dedication').fill('He had time.');
	await Promise.all([
		page.waitForResponse('**/api/tools'),
		page.getByTestId('mode-again').click()
	]);
	await expect(page.getByTestId('verdict-page-dedication')).toHaveValue(
		'He had time.'
	);
});

// The AI budget meter, in a browser. Its predecessor - an invented per-tab counter that called the
// first verdict a revision and never refilled - had no test of any kind, in any layer, which is how
// it survived six feature rebuilds. These drive the two numbers the panel now shows through the
// real DOM: the server's quota, read off response headers, and the per-verdict rewrite allowance.
test('the AI meter reports the server quota and refills rewrites on a new verdict', async ({
	page
}) => {
	// A quota the server states, rather than one the page invents: 14 units left of 20, at two
	// units an action, is seven more calls.
	await page.route('**/api/meechie-studio-text', async (route) => {
		await route.fulfill({
			headers: {
				'RateLimit-Limit': '20',
				'RateLimit-Remaining': '14',
				'RateLimit-Reset': '45'
			},
			json: { ok: true, value: textOutput }
		});
	});
	await page.route('**/api/generate', async (route) => {
		await route.fulfill({ json: generatedPage });
	});

	await gotoHydrated(page, '/');

	// Before any verdict, the panel offers no number for something that cannot be done yet, and
	// says nothing at all about a quota no server has reported.
	await expect(page.getByTestId('home-rewrites-left')).toContainText(
		'Rewrites unlock'
	);
	await expect(page.getByTestId('home-ai-quota')).toHaveCount(0);

	await page.getByTestId('home-evidence').fill('He said traffic made him late.');
	await page.getByTestId('home-generate-verdict').click();
	await expect(page.getByTestId('home-verdict-quote')).toBeVisible();

	// Asking is not a rewrite: the allowance is untouched, and the quota line is now the
	// server's own arithmetic.
	await expect(page.getByTestId('home-rewrites-left')).toContainText(
		'3 rewrites left for this verdict'
	);
	await expect(page.getByTestId('home-ai-quota')).toContainText('7 AI calls left');

	// Three rewrites spend the allowance, one each.
	await page.getByRole('button', { name: 'Make Meaner' }).click();
	await expect(page.getByTestId('home-rewrites-left')).toContainText(
		'2 rewrites left'
	);
	await page.getByRole('button', { name: 'Make Prettier' }).click();
	await page.getByRole('button', { name: 'Regenerate' }).click();
	await expect(page.getByTestId('home-rewrites-left')).toContainText(
		'0 rewrites left'
	);
	await expect(page.getByTestId('home-rewrites-spent')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Make Meaner' })).toBeDisabled();

	// The way out the message names is real: Generate Verdict is still available, and it refills.
	await expect(page.getByTestId('home-generate-verdict')).toBeEnabled();
	await page.getByTestId('home-generate-verdict').click();
	await expect(page.getByTestId('home-rewrites-left')).toContainText(
		'3 rewrites left'
	);
	await expect(page.getByRole('button', { name: 'Make Meaner' })).toBeEnabled();
});

test('switching mode after spending the rewrites does not strand the studio', async ({ page }) => {
	await stubApis(page);
	const [initialMode, switchedMode] = getWeeklyModes();

	await gotoHydrated(page, '/');
	await expect(page.getByTestId('home-active-mode-heading')).toHaveText(
		initialMode.label
	);
	await page.getByTestId('home-evidence').fill('He said traffic made him late.');
	await page.getByTestId('home-generate-verdict').click();
	await expect(page.getByTestId('home-verdict-quote')).toBeVisible();

	await page.getByRole('button', { name: 'Make Meaner' }).click();
	await page.getByRole('button', { name: 'Make Prettier' }).click();
	await page.getByRole('button', { name: 'Regenerate' }).click();
	await expect(page.getByTestId('home-rewrites-left')).toContainText(
		'0 rewrites left'
	);

	// The switch throws the verdict away. Keeping the spend here is what used to leave an empty
	// studio with every AI button disabled and no stated way forward but a page reload.
	await page.getByTestId(`home-mode-${switchedMode.id}`).click();
	await expect(page.getByTestId('home-active-mode-heading')).toHaveText(
		switchedMode.label
	);
	await expect(page.getByTestId('home-generate-verdict')).toBeEnabled();
	await page.getByTestId('home-evidence').fill('She said the club photo was old.');
	await page.getByTestId('home-generate-verdict').click();
	await expect(page.getByTestId('home-verdict-quote')).toBeVisible();
	await expect(page.getByTestId('home-rewrites-left')).toContainText(
		'3 rewrites left'
	);
});
