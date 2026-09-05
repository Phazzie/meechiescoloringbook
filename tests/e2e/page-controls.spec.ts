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
	await expect(panel.locator('summary strong')).toHaveText(
		'Crown Energy · Receipts Out · Mild · sometimes in third person · US Letter · decorative border'
	);
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
	await expect(panel.locator('summary strong')).toHaveText(
		'Pretty & Petty · Receipts Out · Mild · sometimes in third person · US Letter · decorative border'
	);
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

test('the closed panel says so when a page carries no style of its own', async ({ page }) => {
	// A record written before styles were stored restores a page whose look is not on file. The
	// panel ships shut, so the summary is where the reader has to be told — a notice only visible
	// after they choose to expand it states the false provenance for as long as it stays closed.
	//
	// Seeded through localStorage because the point is a record that predates the field: there is
	// no way to produce one through the UI any more.
	await page.goto('/');
	await page.waitForSelector('[data-hydrated="true"]');
	await page.evaluate(() => {
		const sessionId = localStorage.getItem('cb_session_id_v1');
		localStorage.setItem(
			'cb_creations_v1',
			JSON.stringify([
				{
					id: 'legacy-page',
					createdAtISO: '2026-09-01T00:00:00.000Z',
					intent: {
						title: 'A PAGE FROM BEFORE',
						items: [{ number: 1, label: 'ONE LINE' }],
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
						illustrations: 'none',
						shading: 'none',
						border: 'decorative',
						borderThickness: 8,
						variations: 1,
						outputFormat: 'png',
						pageSize: 'US_Letter'
					},
					assembledPrompt: 'a prompt from before styles were stored',
					owner: { kind: 'anonymous', sessionId }
				}
			])
		);
	});
	await page.reload();
	await page.waitForSelector('[data-hydrated="true"]');

	const panel = page.locator('.settings-panel');
	// Before reopening it, the panel describes the reader's own controls, as it should.
	await expect(panel.locator('summary strong')).toHaveText(
		'Crown Energy · Receipts Out · Mild · sometimes in third person · US Letter · decorative border'
	);

	await page.getByRole('button', { name: /A PAGE FROM BEFORE/ }).first().click();

	// Now the page on the paper is one whose style nobody recorded, and the shut panel says so
	// rather than presenting the reader's settings as that page's.
	// The paper half survives: page size and border are spec fields, so they *are* on file, and
	// the substitute sentence replaces only the half that is not.
	await expect(panel.locator('summary strong')).toHaveText(
		"This page's style is not on file · US Letter · decorative border"
	);
	await panel.locator('summary').click();
	// The notice's own wording matters, not just its presence: it used to end "changing any of them
	// will restyle the page", which the artifact snapshot later made false and which contradicted the
	// lede directly beneath it.
	await expect(panel.getByTestId('home-style-unknown')).toBeVisible();
	await expect(panel.getByTestId('home-style-unknown')).toContainText(
		'they describe the next page you make, not this one'
	);
	await expect(panel.getByTestId('home-style-unknown')).not.toContainText('will restyle the page');
});

test('every control the panel holds reaches the shut summary', async ({ page }) => {
	// The summary named four of the seven. So a reader who came in to change Third Person, Page
	// Size or Border and then shut the panel watched the one line the panel shows stay exactly as
	// it was — the "reports nothing" the whole rebuild is against, in the control it is easiest to
	// miss.
	const panel = await openPanel(page);
	const summary = panel.locator('summary strong');

	await panel.locator('#thirdPerson').selectOption('never');
	await expect(summary).toContainText('never in third person');

	await panel.locator('#pageSize').selectOption('A4');
	await expect(summary).toContainText('A4');

	await panel.locator('#border').selectOption('none');
	await expect(summary).toContainText('no border');

	await expect(summary).toHaveText(
		'Crown Energy · Receipts Out · Mild · never in third person · A4 · no border'
	);
});

test('glitter reaches the summary only when it is on', async ({ page }) => {
	const panel = await openPanel(page);

	await expect(panel.locator('summary strong')).not.toContainText('glitter');
	await panel.locator('.toggle input').check();
	await expect(panel.locator('summary strong')).toContainText('glitter');
	await panel.locator('.toggle input').uncheck();
	await expect(panel.locator('summary strong')).not.toContainText('glitter');
});
