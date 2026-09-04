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

	await gotoHydrated(page, '/meechie');
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-output')).toContainText(
		'Fault: them'
	);

	await page.getByTestId('meechie-tool-make-page').click();
	await expect(page.locator('.preview-grid img')).toBeVisible();
	await expect(page.getByTestId('meechie-tool-download').first()).toBeVisible();

	// A second verdict request on the same tool, this time failing.
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-error')).toBeVisible();

	// The page the reader paid for is still there, and still downloadable.
	await expect(page.getByTestId('meechie-tool-output')).toContainText(
		'Fault: them'
	);
	await expect(page.locator('.preview-grid img')).toBeVisible();
	await expect(page.getByTestId('meechie-tool-download').first()).toBeVisible();
	await expect(page.getByTestId('meechie-tool-generate')).toBeEnabled();
});
