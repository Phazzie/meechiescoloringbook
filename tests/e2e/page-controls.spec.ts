// Purpose: End-to-end cover for the home studio's Page Controls panel.
// Why: The panel's whole job is telling the truth about the page — which theme is on, what each
//      value does, whether it is open. Those are rendering facts a unit test cannot see.
// Info flow: Home page -> Page Controls panel -> summary/affordance/help/pressed state.
import { expect, test } from '@playwright/test';

// Every assertion below is about hydrated behaviour, so each test waits for the studio to say it is
// hydrated. Clicking before that races the browser's own <details> toggle against Svelte's, and the
// panel reads as broken when it is only early.
const openPanel = async (page: import('@playwright/test').Page) => {
	await page.goto('/');
	await page.waitForSelector('[data-hydrated="true"]');
	const panel = page.locator('.settings-panel');
	await panel.locator('summary').click();
	return panel;
};

test('the shut panel names what it is set to, and its affordance tracks the panel', async ({
	page
}) => {
	await page.goto('/');
	await page.waitForSelector('[data-hydrated="true"]');
	const panel = page.locator('.settings-panel');
	const affordance = panel.locator('summary span[aria-hidden="true"]').last();

	// Was the constant "Page Controls" over the constant "Open".
	await expect(panel.locator('summary strong')).toHaveText('Crown Energy · Receipts Out · Mild');
	await expect(affordance).toHaveText('Open');

	await panel.locator('summary').click();
	await expect(affordance).toHaveText('Close');
	await panel.locator('summary').click();
	await expect(affordance).toHaveText('Open');
});

test('the selected theme is announced, not only tinted', async ({ page }) => {
	const panel = await openPanel(page);

	// Exactly one theme is pressed, and it is the one that is on.
	const pressed = panel.getByRole('button', { pressed: true });
	await expect(pressed).toHaveCount(1);
	await expect(pressed.first()).toContainText('Crown Energy');

	await panel.getByRole('button', { name: /Pretty & Petty/ }).click();

	await expect(panel.getByRole('button', { pressed: true })).toHaveCount(1);
	await expect(panel.getByRole('button', { pressed: true }).first()).toContainText('Pretty & Petty');
	await expect(panel.locator('summary strong')).toHaveText('Pretty & Petty · Receipts Out · Mild');
});

test('every control explains the value it is currently set to', async ({ page }) => {
	const panel = await openPanel(page);

	await expect(panel.locator('#intensity-help')).toHaveText(
		'Names what happened, with the details attached.'
	);
	await panel.locator('#intensity').selectOption('no_mercy');
	await expect(panel.locator('#intensity-help')).toHaveText('No cushioning. The shortest true version.');

	await expect(panel.locator('#page-size-help')).toContainText('8.5 × 11 in');
	await panel.locator('#pageSize').selectOption('A4');
	await expect(panel.locator('#page-size-help')).toContainText('210 × 297 mm');

	await expect(panel.locator('#border-help')).toContainText('A drawn frame');
	await panel.locator('#border').selectOption('none');
	await expect(panel.locator('#border-help')).toContainText('No frame');

	// And the panel says when the change takes effect, which nothing used to.
	await expect(panel.locator('.settings-lede')).toContainText('until you make it again');
});

test('glitter reaches the summary only when it is on', async ({ page }) => {
	const panel = await openPanel(page);

	await expect(panel.locator('summary strong')).not.toContainText('glitter');
	await panel.locator('.toggle input').check();
	await expect(panel.locator('summary strong')).toContainText('glitter');
	await panel.locator('.toggle input').uncheck();
	await expect(panel.locator('summary strong')).not.toContainText('glitter');
});
