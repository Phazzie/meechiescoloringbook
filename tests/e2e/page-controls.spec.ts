// Purpose: End-to-end cover for the home studio's Page Controls panel.
// Why: The panel's whole job is telling the truth about the page — which theme is on, what each
//      value does, whether it is open. Those are rendering facts a unit test cannot see.
// Info flow: Home page -> Page Controls panel -> summary/affordance/help/pressed state.
// Critical invariant: every test here waits for `[data-hydrated="true"]` before touching the panel,
//      including the ones that do not go through `openPanel`. Clicking before that races the
//      browser's own <details> toggle against Svelte's, and the panel reads as broken when it is
//      only early — a failure that looks like the feature and is not. A test added below without
//      that wait is not testing this panel.
import { expect, test } from '@playwright/test';

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
		'Crown Energy · Receipts Out · Mild · sometimes in third person · US Letter · decorative border · small bubble lettering · balanced · standard lines'
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
		'Pretty & Petty · Receipts Out · Mild · sometimes in third person · US Letter · decorative border · small bubble lettering · balanced · standard lines'
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
						// Deliberately neither of the studio's own defaults (small at 50), so the
						// summary below proves these came off the record rather than coincidentally
						// matching what the controls already showed.
						whitespaceScale: 35,
						textSize: 'large',
						// Not the studio's own `rounded` either, for the same reason: the summary
						// below proves the letterform came off the record.
						fontStyle: 'block',
						// 7 is deliberately not one of the four steps the Line weight control
						// offers, for the same reason 35 is not one of the three blank-space steps:
						// it is the case where a `<select>` is set to a value no `<option>` carries
						// and browsers render it blank. `ChatInterpretationSeam` can return it.
						textStrokeWidth: 7,
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
		'Crown Energy · Receipts Out · Mild · sometimes in third person · US Letter · decorative border · small bubble lettering · balanced · standard lines'
	);

	await page.getByRole('button', { name: /A PAGE FROM BEFORE/ }).first().click();

	// Now the page on the paper is one whose style nobody recorded, and the shut panel says so
	// rather than presenting the reader's settings as that page's.
	// The paper half survives: page size and border are spec fields, so they *are* on file, and
	// the substitute sentence replaces only the half that is not. Lettering and room to colour are
	// spec fields too and survive for exactly the same reason — and they come back as the *record's*
	// values, large block at 35, not as the controls' small bubble at 50.
	await expect(panel.locator('summary strong')).toHaveText(
		"This page's style is not on file · US Letter · decorative border · large block lettering · 35% blank · 7px lines"
	);
	await panel.locator('summary').click();

	// The control itself, not only the summary. 35 is not one of the three steps the control offers,
	// and a `<select>` set to a value no `<option>` carries renders **blank** — so the reader
	// reopened a page and the control describing it showed nothing at all. This assertion is the one
	// the first version of this test was missing: it checked the summary text and never looked at
	// the select, so it passed while the control was empty. Caught in review of PR #350.
	await expect(panel.locator('#home-page-look-room')).toHaveValue('35');
	await expect(panel.locator('#home-page-look-room')).toContainText("35% blank — this page's own");
	await expect(panel.locator('#home-page-look-lettering')).toHaveValue('large');
	// And the same, for the control this run added. `LINE_WEIGHT_OPTIONS` deliberately contains both
	// weights this app itself builds, so the off-step case is rarer here than for blank space — which
	// is exactly why it needs pinning rather than trusting.
	await expect(panel.locator('#home-page-look-line-weight')).toHaveValue('7');
	await expect(panel.locator('#home-page-look-line-weight')).toContainText(
		"7px — this page's own"
	);
	// The letterform is an enum, so there is no off-step case to pin — every value a record can
	// carry is an option. What is pinned is that the reopened page's own value is what the control
	// shows, rather than the studio's `rounded` presented as that page's.
	await expect(panel.locator('#home-page-look-letter-shape')).toHaveValue('block');
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
	//
	// Lettering, Letter shape, Room to colour and Line weight are here for the same reason and not
	// as an afterthought: the panel holds eleven controls now, and this test is the one that fails
	// when a twelfth is added without being reported.
	const panel = await openPanel(page);
	const summary = panel.locator('summary strong');

	await panel.locator('#thirdPerson').selectOption('never');
	await expect(summary).toContainText('never in third person');

	await panel.locator('#pageSize').selectOption('A4');
	await expect(summary).toContainText('A4');

	await panel.locator('#border').selectOption('none');
	await expect(summary).toContainText('no border');

	await panel.locator('#home-page-look-lettering').selectOption('large');
	await expect(summary).toContainText('large bubble lettering');

	await panel.locator('#home-page-look-room').selectOption('75');
	await expect(summary).toContainText('roomy');

	await panel.locator('#home-page-look-line-weight').selectOption('12');
	await expect(summary).toContainText('chunky lines');

	await panel.locator('#home-page-look-letter-shape').selectOption('hand');
	await expect(summary).toContainText('large handwritten lettering');

	await expect(summary).toHaveText(
		'Crown Energy · Receipts Out · Mild · never in third person · A4 · no border · large handwritten lettering · roomy · chunky lines'
	);
});

test('the four controls that decide what a page looks like reach the page', async ({
	page
}) => {
	// `textSize` and `whitespaceScale` are `ColoringPageSpec` fields that reached no prompt at all
	// and that no surface in the app let a reader set. `textStrokeWidth` reached one — as a bare
	// number under a constant that demanded thick outlines whatever it said. `fontStyle` reached one
	// as a bare enum token, under a constant on the next line up that demanded bubble letters
	// whatever it said. This is the browser-level cover for all of that: the controls exist, they
	// say what they do, and what they say follows what is actually in effect.
	const panel = await openPanel(page);

	// The help line describes the value in effect, starting from the studio's own default.
	await expect(panel.locator('#home-page-look-lettering-help')).toContainText(
		'Leaves most of the sheet free to colour'
	);
	await expect(panel.locator('#home-page-look-room-help')).toContainText(
		'About half the sheet left blank'
	);

	await panel.locator('#home-page-look-lettering').selectOption('large');
	await expect(panel.locator('#home-page-look-lettering-help')).toContainText(
		'The words are most of the page'
	);

	await panel.locator('#home-page-look-room').selectOption('25');
	await expect(panel.locator('#home-page-look-room-help')).toContainText(
		'About a quarter of the sheet left blank'
	);

	// Line weight starts at the studio's own 6, which is a step the control offers — so "Page
	// default" and the named step agree and no phantom option appears.
	await expect(panel.locator('#home-page-look-line-weight-help')).toContainText(
		'Medium outlines'
	);
	await expect(panel.locator('#home-page-look-line-weight')).toHaveValue('');
	await expect(panel.locator('#home-page-look-line-weight')).toContainText(
		'Page default — Standard'
	);
	await expect(panel.locator('#home-page-look-line-weight')).not.toContainText("this page's own");

	// Each end of the range the contract allows, and each names its trade rather than only its
	// virtue — a help line that only sold the thickest option would be no help at all.
	await panel.locator('#home-page-look-line-weight').selectOption('4');
	await expect(panel.locator('#home-page-look-line-weight-help')).toContainText(
		'hard to stay inside with a crayon'
	);

	await panel.locator('#home-page-look-line-weight').selectOption('12');
	await expect(panel.locator('#home-page-look-line-weight-help')).toContainText(
		'the finest detail is lost'
	);

	// Letter shape. Unlike the two numeric controls this one offers the whole of its contract enum,
	// so no page can carry a value it has no option for and no "this page's own" entry can appear.
	await expect(panel.locator('#home-page-look-letter-shape')).toHaveValue('');
	await expect(panel.locator('#home-page-look-letter-shape')).toContainText(
		'Page default — Bubble'
	);
	await expect(panel.locator('#home-page-look-letter-shape')).not.toContainText("this page's own");
	await expect(panel.locator('#home-page-look-letter-shape-help')).toContainText(
		'Big open middles to colour in'
	);

	await panel.locator('#home-page-look-letter-shape').selectOption('block');
	await expect(panel.locator('#home-page-look-letter-shape-help')).toContainText(
		'the easiest to read'
	);

	await panel.locator('#home-page-look-letter-shape').selectOption('hand');
	await expect(panel.locator('#home-page-look-letter-shape-help')).toContainText(
		'rather than a printed page'
	);
});

/*
 * The "Page default" option must name what selecting it actually gets you.
 *
 * The defect this pins, found by a review of PR #352 and true of all three controls since the first
 * two shipped: every "Page default" option was labelled from `effective`, which already carries the
 * reader's override. Pick Chunky and the option relabelled itself "Page default — Chunky" while
 * selecting it cleared the override and returned the studio's own Standard. The option promised the
 * value the reader had just chosen and delivered a different one.
 *
 * Asserted on the option's own text rather than on the summary line, which is the lesson PR #350's
 * review left: a test that checks a derived string agrees with the state rather than with the reader.
 */
test('the Page default option keeps naming the default after an override is chosen', async ({
	page
}) => {
	const panel = await openPanel(page);

	const lineWeight = panel.locator('#home-page-look-line-weight');
	const lettering = panel.locator('#home-page-look-lettering');
	const room = panel.locator('#home-page-look-room');
	const letterShape = panel.locator('#home-page-look-letter-shape');

	await expect(lineWeight).toContainText('Page default — Standard');
	await expect(lettering).toContainText('Page default — Small');
	await expect(room).toContainText('Page default — Balanced');
	await expect(letterShape).toContainText('Page default — Bubble');

	// Move every one of them away from the studio's own values.
	await lineWeight.selectOption('12');
	await lettering.selectOption('large');
	await room.selectOption('75');
	await letterShape.selectOption('hand');

	// The summary follows the choice, because that is what the page will be made with.
	await expect(panel.locator('summary strong')).toContainText('chunky lines');

	// The default option does not, because that is not what selecting it would do.
	await expect(lineWeight).toContainText('Page default — Standard');
	await expect(lettering).toContainText('Page default — Small');
	await expect(room).toContainText('Page default — Balanced');
	await expect(letterShape).toContainText('Page default — Bubble');

	// And selecting it really does return the studio's own value, which is what the label promised.
	await lineWeight.selectOption('');
	await expect(panel.locator('#home-page-look-line-weight-help')).toContainText('Medium outlines');
	await expect(panel.locator('summary strong')).toContainText('standard lines');

	await letterShape.selectOption('');
	await expect(panel.locator('#home-page-look-letter-shape-help')).toContainText(
		'Big open middles to colour in'
	);
	await expect(panel.locator('summary strong')).toContainText('large bubble lettering');
});

test('glitter reaches the summary only when it is on', async ({ page }) => {
	const panel = await openPanel(page);

	await expect(panel.locator('summary strong')).not.toContainText('glitter');
	await panel.locator('.toggle input').check();
	await expect(panel.locator('summary strong')).toContainText('glitter');
	await panel.locator('.toggle input').uncheck();
	await expect(panel.locator('summary strong')).not.toContainText('glitter');
});
