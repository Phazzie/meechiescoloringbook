// Purpose: Chaos/fault-tolerance E2E tests (Shaolin Resilience suite).
// Why: Verify graceful degradation when the text-generation API fails, and
//      confirm the UI recovers after a transient failure.
// Info flow: Playwright routes → mock API responses → UI assertions.
import { test, expect, type Page } from '@playwright/test';

test.setTimeout(120000);

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

const gotoHydrated = async (page: Page, path: string): Promise<void> => {
	await page.goto(path, { waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
	await page.waitForTimeout(250);
};

test.describe('Shaolin Resilience (Chaos/Fault Tolerance)', () => {
	test('shall fail gracefully and display an error message when text generation API fails', async ({ page }) => {
		await page.route('**/api/meechie-studio-text', async (route) => {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({
					ok: false,
					error: {
						code: 'PROVIDER_ERROR',
						message: 'Wu-Tang Financial network interrupted.'
					}
				})
			});
		});

		await gotoHydrated(page, '/');
		const promptInput = page.getByTestId('home-evidence');
		await promptInput.waitFor({ state: 'visible' });

		await promptInput.fill('A dog on a skateboard');
		await page.getByTestId('home-generate-verdict').click();

		await expect(page.getByTestId('home-generate-verdict')).toBeVisible();
		await expect(page.getByTestId('home-text-error')).toBeVisible();
	});

	test('shall recover after a failed verdict generation attempt', async ({ page }) => {
		let attempt = 0;
		await page.route('**/api/meechie-studio-text', async (route) => {
			attempt++;
			if (attempt === 1) {
				await route.fulfill({ status: 500 });
			} else {
				await route.fulfill({ json: { ok: true, value: textOutput } });
			}
		});

		await gotoHydrated(page, '/');
		const promptInput = page.getByTestId('home-evidence');
		await promptInput.waitFor({ state: 'visible' });

		await promptInput.fill('A ninja duck');
		await page.getByTestId('home-generate-verdict').click();
		// Wait for the error state to appear before retrying.
		await expect(page.getByTestId('home-text-error')).toBeVisible();

		await page.getByTestId('home-generate-verdict').click();
		await expect(page.getByTestId('home-verdict-quote')).toContainText(
			'The story folded before the receipt opened.'
		);
	});
});
