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

	await page.getByTestId('home-create-page').click();
	await expect(page.getByTestId('home-generated-image')).toBeVisible();

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
	await expect(page.getByRole('link', { name: 'Download PDF' })).toBeVisible();
	// The export link hands the browser a filename, so its extension has to match the
	// bytes behind it. These are the stubbed JPEG portrait bytes, so the download is
	// `.jpg` and the label names the format the user actually receives.
	const exportLink = page.getByRole('link', { name: /^Export / });
	await expect(exportLink).toHaveAttribute(
		'download',
		'meechie-coloring-page.jpg'
	);
	await expect(exportLink).toHaveText('Export JPG');

	expect(providerRequests).toEqual([]);
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
	await page.getByTestId('home-vault-delete').click();
	await expect(page.getByTestId('home-vault-empty')).toBeVisible();
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

	await page.getByTestId('random-generate-page').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();
});

test('rate and who routes submit, reset, and generate pages', async ({
	page
}) => {
	await gotoHydrated(page, '/rate-his-excuse');
	await page.getByTestId('rate-excuse-input').fill('He forgot again.');
	await page.getByTestId('rate-submit').click();
	await expect(page.getByTestId('rate-result')).toContainText('Fault: them');
	await page.getByTestId('rate-generate-page').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();
	await page.getByTestId('rate-reset').click();
	await expect(page.getByTestId('rate-submit')).toBeVisible();

	await gotoHydrated(page, '/who-fucked-up');
	await page.getByTestId('who-situation-input').fill('Nobody owned the bug.');
	await page.getByTestId('who-submit').click();
	await expect(page.getByTestId('who-result')).toContainText('Fault: them');
	await page.getByTestId('who-generate-page').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();
	await page.getByTestId('who-reset').click();
	await expect(page.getByTestId('who-submit')).toBeVisible();
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
