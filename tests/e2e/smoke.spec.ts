// Purpose: Browser smoke tests for release-critical user flows.
// Why: Catch broken buttons, selectors, and API error states before deployment.
// Info flow: Playwright route stubs -> UI interactions -> visible states.
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(120000);
test.describe.configure({ mode: 'serial' });

const png1x1 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

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
};

const gotoHydrated = async (page: Page, path: string): Promise<void> => {
	await page.goto(path, { waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
		// Some asset pipelines keep a request open; hydration still completes.
	});
	await page.waitForTimeout(250);
};

test.beforeEach(async ({ page }) => {
	await stubApis(page);
});

test('home mode switching and generation controls work', async ({ page }) => {
	await gotoHydrated(page, '/');

	// Wait for modes to load and get the second mode card
	const modeCards = page.locator('.mode-card');
	await expect(modeCards.nth(0)).toBeVisible();

	// Get initial mode heading
	const initialModeHeading = await page.getByTestId('home-active-mode-heading').textContent();

	// Click second mode card
	await modeCards.nth(1).click();

	// Verify heading changed
	await expect(page.getByTestId('home-active-mode-heading')).not.toHaveText(
		initialModeHeading || ''
	);

	// Some modes don't have evidence input, so we generate with whatever is there (evidence or just generate)
	// We know the API is mocked, so we just trigger a generation if possible
	const generateButton = page.getByTestId('home-generate-verdict');
	const evidenceInput = page.getByTestId('home-evidence');

	if (await evidenceInput.isVisible()) {
		await evidenceInput.fill('He said traffic made him late.');
	}

	await generateButton.click();

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

test('home quote vault can save, load, pin, and delete creations', async ({
	page
}) => {
	await page.addInitScript(() => {
		const RealDate = Date;
		// January 2026 (monthKey = 24312). monthlyIndex = 0 ('who-fucked-up').
		const fixedTime = new Date('2026-01-01T12:00:00.000Z').getTime();

		// @ts-ignore
		globalThis.Date = class extends RealDate {
			constructor(...args: any[]) {
				if (args.length) {
					// @ts-ignore
					super(...args);
				} else {
					super(fixedTime);
				}
			}
			static now() {
				return fixedTime;
			}
		};
	});

	await gotoHydrated(page, '/');

	// Ensure we use a mode that has the evidence input (like "Who Fucked Up?")
	await page.getByTestId('home-mode-who-fucked-up').click();

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

test('random route tap and page generation work', async ({ page }) => {
	await page.addInitScript(() => {
		const RealDate = Date;
		const fixedTime = new Date('2026-01-01T12:00:00.000Z').getTime();

		// @ts-ignore
		globalThis.Date = class extends RealDate {
			constructor(...args: any[]) {
				if (args.length) {
					// @ts-ignore
					super(...args);
				} else {
					super(fixedTime);
				}
			}
			static now() {
				return fixedTime;
			}
		};
	});

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

	await page.getByTestId('meechie-tool-random_meechie').click();
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-output')).toContainText(
		'story keeps changing'
	);
});
