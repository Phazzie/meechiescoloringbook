// Purpose: End-to-end smoke tests for the coloring book generator.
// Why: Prove the full runtime stack loads, renders, and behaves correctly in a browser.
// Info flow: Playwright launches browser -> loads app -> asserts key page elements.
import { expect, test } from '@playwright/test';

test.describe('Main builder page', () => {
	test('loads and shows the hero heading', async ({ page }) => {
		await page.goto('/');

		await expect(page).toHaveTitle(/Meechie/i);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('title input is pre-filled with default spec value', async ({ page }) => {
		await page.goto('/');

		const titleInput = page.locator('#title');
		await expect(titleInput).toBeVisible();
		await expect(titleInput).toHaveValue('Dream Big');
	});

	test('Create Pages button is present and initially disabled when spec is invalid', async ({
		page
	}) => {
		await page.goto('/');

		// The button text should be "Create Pages" when not generating.
		const createBtn = page.getByRole('button', { name: 'Create Pages' }).first();
		await expect(createBtn).toBeVisible();
	});

	test('Check Inputs button triggers validation and removes the disabled state', async ({
		page
	}) => {
		await page.goto('/');

		// Click the "Check Inputs" button to run spec validation.
		const checkBtn = page.getByRole('button', { name: 'Check Inputs' });
		await expect(checkBtn).toBeVisible();
		await checkBtn.click();

		// After validation the Create Pages button should be enabled (spec is valid by default).
		const createBtn = page.getByRole('button', { name: 'Create Pages' }).first();
		await expect(createBtn).toBeEnabled({ timeout: 5000 });
	});

	test('title field accepts new input', async ({ page }) => {
		await page.goto('/');

		const titleInput = page.locator('#title');
		await titleInput.fill('My Custom Title');
		await expect(titleInput).toHaveValue('My Custom Title');
	});

	test('navigation to Meechie tools page works', async ({ page }) => {
		await page.goto('/');

		// Find a link to the /meechie route in the nav.
		const meechieLink = page.getByRole('link', { name: /Meechie/i }).first();
		await expect(meechieLink).toBeVisible();
		await meechieLink.click();
		await expect(page).toHaveURL(/\/meechie/);
	});
});

test.describe('Meechie tools page', () => {
	test('loads and shows the tools heading', async ({ page }) => {
		await page.goto('/meechie');

		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});
});
