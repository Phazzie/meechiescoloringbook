// Purpose: End-to-end coverage for the vault as a place — that it has an address, that every
//          surface can reach it, and that a page saved anywhere can be found and reopened from it.
// Why: Before this route the vault was a card on the home page. Thirteen surfaces could save into
//      it, one could show you what was in it, and the other twelve ended a successful save with
//      "find it on the home page" — a navigation instruction rather than a link. These tests fail
//      if any part of that comes back.
// Info flow: stubbed provider -> a real generated page -> saved -> found on `/vault` -> reopened in
//            the studio.
import { expect, test } from '@playwright/test';
import { STUB_PAGE_TITLE, openRoute, stubPageApis } from './support/page-fixtures';

test.beforeEach(async ({ page }) => {
	await stubPageApis(page);
});

/** Make a verdict on the home studio and put the page it produces in the vault. */
const saveAPageFromHome = async (page: import('@playwright/test').Page, shoutout: string) => {
	await openRoute(page, '/');
	await page.getByTestId('home-evidence').fill('He changed the story after the receipt appeared.');
	await page.locator('#dedication').fill(shoutout);
	await page.getByTestId('home-generate-verdict').click();
	await expect(page.getByTestId('home-verdict-quote')).not.toBeEmpty();
	await page.getByTestId('home-save-vault').click();
	await expect(page.getByTestId('home-status')).toContainText('Saved to the vault.');
};

test('the vault is reachable from the nav on every surface', async ({ page }) => {
	// The link the vault never had. Checked from a surface other than the home page, because the
	// home page is the one place the vault was already visible from.
	for (const route of ['/', '/who-fucked-up', '/meechie', '/m/receipt-check']) {
		await openRoute(page, route);
		const link = page.locator('header.site-nav nav.links a[href="/vault"]');
		await expect(link).toBeVisible();
	}
});

test('a save confirmation offers a way to the vault, and it goes there', async ({ page }) => {
	await saveAPageFromHome(page, 'Big Sis');

	// The whole defect in one assertion: the confirmation carries a link, not an instruction.
	const link = page.getByTestId('home-status-link');
	await expect(link).toBeVisible();
	await expect(page.getByTestId('home-status')).not.toContainText('home page');

	await link.click();
	await page.waitForSelector('[data-hydrated="true"]');
	await expect(page.getByTestId('vault-vault-load')).toContainText(STUB_PAGE_TITLE.toUpperCase());
});

test('the vault shows every saved page, and reopening one restores it in the studio', async ({
	page
}) => {
	await saveAPageFromHome(page, 'Big Sis');
	await saveAPageFromHome(page, 'Plumber Lou');

	await openRoute(page, '/vault');
	await expect(page.getByTestId('vault-vault-load')).toHaveCount(2);
	await expect(page.getByTestId('vault-vault-count')).toContainText('2 saved');

	// A link, not a button: reopening from here genuinely navigates to the studio, which is the
	// only surface that can rebuild a page.
	const firstRow = page.getByTestId('vault-vault-load').first();
	await expect(firstRow).toHaveAttribute('href', /^\/\?creation=/);
	await firstRow.click();

	await page.waitForSelector('[data-hydrated="true"]');
	await expect(page.getByTestId('home-verdict-quote')).toContainText(
		'The story folded before the receipt opened.'
	);
	await expect(page.getByTestId('home-status')).toContainText('Reopened');
});

test('the vault searches and reorders what it holds', async ({ page }) => {
	// The demo provider returns the same verdict for any evidence, so the two pages are told apart
	// by their shoutout — which the vault search covers along with the title and the quote.
	await saveAPageFromHome(page, 'Big Sis');
	await saveAPageFromHome(page, 'Plumber Lou');

	await openRoute(page, '/vault');
	await expect(page.getByTestId('vault-vault-load')).toHaveCount(2);

	await page.getByTestId('vault-vault-search').fill('Plumber Lou');
	await expect(page.getByTestId('vault-vault-load')).toHaveCount(1);
	// Two numbers, kept apart: what is in the vault, and what the search is showing.
	await expect(page.getByTestId('vault-vault-count')).toContainText('1 of 2 saved');

	await page.getByTestId('vault-vault-search').fill('a page nobody saved');
	await expect(page.getByTestId('vault-vault-no-matches')).toBeVisible();
	// It must not claim the vault is empty when a search simply matched nothing.
	await expect(page.getByTestId('vault-vault-empty')).toHaveCount(0);

	await page.getByTestId('vault-vault-search').fill('');
	await expect(page.getByTestId('vault-vault-load')).toHaveCount(2);

	const titlesInOrder = async () => page.getByTestId('vault-vault-load').allInnerTexts();
	const newestFirst = await titlesInOrder();
	await page.getByTestId('vault-sort').selectOption('oldest');
	await expect
		.poll(async () => (await titlesInOrder()).join('|'))
		.toBe([...newestFirst].reverse().join('|'));
});

test('a link to a page this device never saved says so rather than opening an empty studio', async ({
	page
}) => {
	// Saved pages live in the browser they were made in and are never uploaded, so a shared link
	// cannot work for anyone else. Silence there would look like a broken studio.
	await openRoute(page, '/?creation=a-page-from-another-phone');
	await expect(page.getByTestId('home-status')).toContainText('not on this device');
});
