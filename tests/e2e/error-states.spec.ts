import { expect, test } from '@playwright/test';

test.describe('Error states and resilience', () => {
	test('UI gracefully handles API timeouts and server errors', async ({ page }) => {
		// Mock the text endpoint to return a 504 Gateway Timeout
		await page.route('**/api/meechie-studio-text', async (route) => {
			await route.fulfill({
				status: 504,
				body: 'Gateway Timeout'
			});
		});

		await page.goto('/', { waitUntil: 'domcontentloaded' });
		await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
		await expect(page.getByTestId('studio-root')).toHaveAttribute('data-hydrated', 'true');
		
		await page.getByTestId('home-evidence').fill('He never called me back.');
		await page.getByTestId('home-generate-verdict').click();

		// The error should be displayed to the user
		await expect(page.getByTestId('home-text-error')).toBeVisible({ timeout: 15000 });
		await expect(page.getByTestId('home-text-error')).toContainText(/failed to parse JSON|504|could not reach/i);
	});
});
