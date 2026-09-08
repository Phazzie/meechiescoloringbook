// Purpose: Browser end-to-end coverage for `/describe` — the surface that turns a sentence the
//          reader typed into a coloring page.
// Why: The whole point of this surface is the order it does things in: it shows what was
//      understood, and only then offers the button that pays for a picture. Two provider calls, two
//      buttons, and a panel between them — none of which a unit test can prove are actually wired
//      to each other in a rendered document.
// Info flow: Playwright route stubs for /api/chat-interpretation and /api/generate -> UI
//            interactions -> visible states.
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(120000);
test.describe.configure({ mode: 'parallel' });

const png1x1 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

const interpretedSpec = {
	title: 'Things I Am Not Doing Again',
	items: [
		{ number: 1, label: 'Explaining myself twice' },
		{ number: 2, label: 'Waiting on a text back' }
	],
	listMode: 'list',
	alignment: 'left',
	numberAlignment: 'strict',
	listGutter: 'normal',
	whitespaceScale: 50,
	textSize: 'small',
	fontStyle: 'rounded',
	textStrokeWidth: 6,
	colorMode: 'black_and_white_only',
	decorations: 'minimal',
	illustrations: 'simple',
	shading: 'none',
	border: 'plain',
	borderThickness: 8,
	variations: 1,
	outputFormat: 'pdf',
	pageSize: 'US_Letter'
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

const A_MESSAGE =
	'A page listing the things I am not doing again, plain border, room to colour';

/** Fulfil both provider calls this surface makes. `interpret` can be overridden per test. */
const stubApis = async (
	page: Page,
	interpret: (route: import('@playwright/test').Route) => Promise<void> = async (
		route
	) => {
		await route.fulfill({ json: { ok: true, value: { spec: interpretedSpec } } });
	}
): Promise<void> => {
	await page.route('**/api/chat-interpretation', interpret);
	await page.route('**/api/generate', async (route) => {
		await route.fulfill({ json: generatedPage });
	});
};

const gotoDescribe = async (page: Page): Promise<void> => {
	await page.goto('/describe', { waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
		// Some asset pipelines keep a request open; hydration still completes.
	});
	await expect(page.getByTestId('describe-message')).toBeVisible();
};

/** Type a description and get the read-back on screen — the opening of every test below. */
const readItBack = async (page: Page): Promise<void> => {
	await page.getByTestId('describe-message').fill(A_MESSAGE);
	await page.getByTestId('describe-interpret').click();
	await expect(page.getByTestId('describe-readback')).toBeVisible();
};

test('the nav reaches the surface that had no front door', async ({ page }) => {
	await stubApis(page);
	await page.goto('/', { waitUntil: 'domcontentloaded' });
	await page.getByRole('link', { name: 'Describe It' }).first().click();
	await expect(page).toHaveURL(/\/describe$/);
	await expect(page.getByTestId('describe-message')).toBeVisible();
});

test('the read-back appears before anything is generated', async ({ page }) => {
	let generateCalls = 0;
	await stubApis(page);
	await page.route('**/api/generate', async (route) => {
		generateCalls += 1;
		await route.fulfill({ json: generatedPage });
	});

	await gotoDescribe(page);
	await readItBack(page);

	// The exact words that will print, checkable before a picture is paid for.
	await expect(page.getByTestId('describe-readback-title')).toHaveText(
		'Things I Am Not Doing Again'
	);
	await expect(page.getByTestId('describe-readback-lines')).toContainText(
		'Explaining myself twice'
	);
	await expect(page.getByTestId('describe-readback-source')).toContainText(
		A_MESSAGE
	);
	expect(generateCalls).toBe(0);
});

test('the button will not spend a call on a message that is too short', async ({
	page
}) => {
	let interpretCalls = 0;
	await stubApis(page, async (route) => {
		interpretCalls += 1;
		await route.fulfill({ json: { ok: true, value: { spec: interpretedSpec } } });
	});

	await gotoDescribe(page);
	await page.getByTestId('describe-message').fill('hi');
	await expect(page.getByTestId('describe-message-problem')).toBeVisible();
	await expect(page.getByTestId('describe-interpret')).toBeDisabled();
	expect(interpretCalls).toBe(0);
});

test('an example fills the box without sending anything', async ({ page }) => {
	await stubApis(page);
	await gotoDescribe(page);

	const firstExample = page.locator('.example-chips button').first();
	const exampleText = (await firstExample.textContent())?.trim() ?? '';
	await firstExample.click();

	await expect(page.getByTestId('describe-message')).toHaveValue(exampleText);
	await expect(page.getByTestId('describe-readback')).toHaveCount(0);
});

test('the described page generates, previews and offers its downloads', async ({
	page
}) => {
	await stubApis(page);
	await gotoDescribe(page);
	await readItBack(page);

	await page.getByTestId('describe-generate').click();

	await expect(page.getByTestId('describe-preview').locator('img')).toBeVisible();
	await expect(page.getByTestId('describe-export-link').first()).toBeVisible();
	// Every download says what it is, rather than showing a bare filename.
	await expect(page.getByTestId('describe-export-list')).toContainText(
		'Printable PDF'
	);
	await expect(page.getByTestId('describe-print')).toBeVisible();
	await expect(page.getByTestId('describe-save-vault')).toBeEnabled();
});

test('a described page can be kept in the same vault every other surface writes to', async ({
	page
}) => {
	await stubApis(page);
	await gotoDescribe(page);
	await readItBack(page);
	await page.getByTestId('describe-generate').click();
	await expect(page.getByTestId('describe-preview').locator('img')).toBeVisible();

	await page.getByTestId('describe-save-vault').click();
	await expect(page.getByTestId('describe-vault-status')).toContainText(
		'vault',
		{ timeout: 15000 }
	);

	// The same vault, not a private one: the page opens at `/vault` on a cold navigation.
	await page.goto('/vault', { waitUntil: 'domcontentloaded' });
	await expect(page.getByText('Things I Am Not Doing Again').first()).toBeVisible(
		{ timeout: 15000 }
	);
});

test('a failed interpretation explains itself and leaves the page alone', async ({
	page
}) => {
	let calls = 0;
	await stubApis(page, async (route) => {
		calls += 1;
		if (calls === 1) {
			await route.fulfill({
				json: { ok: true, value: { spec: interpretedSpec } }
			});
			return;
		}
		await route.fulfill({
			status: 502,
			json: {
				ok: false,
				error: {
					code: 'CHAT_RESPONSE_INVALID',
					message: 'Chat response did not include JSON.'
				}
			}
		});
	});

	await gotoDescribe(page);
	await readItBack(page);
	await page.getByTestId('describe-generate').click();
	await expect(page.getByTestId('describe-preview').locator('img')).toBeVisible();

	await page.getByTestId('describe-interpret').click();
	await expect(page.getByTestId('describe-interpret-error')).toContainText(
		'not a page'
	);
	// The picture cost a generation. A failed re-read must not take it away.
	await expect(page.getByTestId('describe-preview').locator('img')).toBeVisible();
});
