import { expect, test } from '@playwright/test';

// Only run if FEATURE_INTEGRATION_TESTS is true
const runIntegration = process.env.FEATURE_INTEGRATION_TESTS === 'true';

test.describe('Live API Smoke Tests', () => {
	test.skip(!runIntegration, 'Skipping live API integration tests. Set FEATURE_INTEGRATION_TESTS=true to run.');

	test('Complete generation flow with real endpoints', async ({ page }) => {
		test.setTimeout(120000); // Live APIs can take a while
		
		await page.goto('/', { waitUntil: 'domcontentloaded' });
		
		// Fill evidence
		await page.getByTestId('home-evidence').fill('He promised to do the dishes and went to sleep.');
		
		// Click generate and wait for it to finish
		await page.getByTestId('home-generate-verdict').click();
		
		// Wait for quote to appear, indicating text generation is done
		await expect(page.getByTestId('home-verdict-quote')).toBeVisible({ timeout: 45000 });
		
		// Now generate page
		await page.getByTestId('home-create-page').click();
		
		// Wait for the image to render
		await expect(page.getByTestId('home-generated-image')).toBeVisible({ timeout: 90000 });
		
		// Verify there's an actual src attribute
		const imgSrc = await page.getByTestId('home-generated-image').getAttribute('src');
		expect(imgSrc).toBeTruthy();
	});
});
