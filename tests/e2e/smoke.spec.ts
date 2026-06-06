// Purpose: Browser smoke tests for release-critical user flows.
// Why: Catch broken buttons, selectors, and API error states before deployment.
// Info flow: Playwright route stubs -> UI interactions -> visible states.
import { expect, test, type Page } from '@playwright/test';
import { getWeeklyModes } from '../../src/lib/core/meechie-studio';

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
	await expect(page.getByTestId('home-mode-rate-excuse')).toBeVisible();

	const initialMode = getWeeklyModes()[0];
	await expect(page.getByTestId('home-active-mode-heading')).toHaveText(
		initialMode.label
	);
	await page.getByTestId('home-mode-rate-excuse').click();
	await expect(page.getByTestId('home-active-mode-heading')).toHaveText(
		'Rate His Excuse'
	);
	await expect(page.getByTestId('home-evidence')).toHaveAttribute(
		'placeholder',
		/traffic made him/
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
		.poll(async () => page.evaluate(() => localStorage.getItem('cb_session_id_v1')), {
			timeout: 5000
		})
		.not.toBeNull();
	await page.evaluate(() => {
		localStorage.removeItem('cb_drafts_v1');
	});

	const readDraft = (): Promise<{ intent?: { dedication?: string } } | null> =>
		page.evaluate(() => JSON.parse(localStorage.getItem('cb_drafts_v1') ?? 'null'));

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

	await page.getByTestId('meechie-tool-random_meechie').click();
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-output')).toContainText(
		'story keeps changing'
	);
});
