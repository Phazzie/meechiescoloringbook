// Purpose: The stubbed endpoints and the load helper every end-to-end spec needs to get a finished
//          coloring page on screen without a provider.
// Why: `print.spec.ts` and `share.spec.ts` each carried their own byte-similar copy of this — 55
//      lines, which SonarCloud's duplication gate measured at 5.5% of new code against a 3% limit
//      and failed the pull request on. The copies are also the wrong shape for a different reason:
//      the three response fixtures encode contract constraints (`pageItems` is bounded at 2..6, a
//      tool reply must echo the `toolId` it was asked about), and a second copy is a second place
//      for those to fall out of date.
// Info flow: a Playwright page -> routed API stubs + a hydrated route -> the spec's own assertions.
// Invariant: nothing here asserts anything. A helper that fails a test is a helper that fails it in
//            every spec at once, for a reason none of their names mention.
//
// Not matched by Playwright's default `testMatch` (`**/*.@(spec|test).ts`), so it is a module these
// specs import rather than a test file with no tests in it.
import type { Page } from '@playwright/test';

/** The smallest valid PNG, which is all the packaging seam needs to produce real files. */
export const PNG_1X1 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

/** What the studio-text stub says, so a spec can assert against it without restating it. */
export const STUB_QUOTE = 'The story folded before the receipt opened.';
export const STUB_PAGE_TITLE = 'Receipt Energy';
export const STUB_TOOL_RESPONSE =
	'Fault: them. Consequence: access gets reduced until facts improve.';

/** Just enough of each endpoint to get a picture on screen. */
export const stubPageApis = async (page: Page): Promise<void> => {
	await page.route('**/api/meechie-studio-text', (route) =>
		route.fulfill({
			json: {
				ok: true,
				value: {
					verdict: 'Meechie clocked the timeline.',
					quote: STUB_QUOTE,
					pageTitle: STUB_PAGE_TITLE,
					// Two, not one: `MeechieStudioTextOutputSchema` bounds `pageItems` at 2..6, and a
					// one-item fixture is rejected client-side as an unreadable response.
					pageItems: [
						{ number: 1, label: 'CHECK THE TIMELINE' },
						{ number: 2, label: 'KEEP THE RECEIPT' }
					],
					rating: 2,
					qualityState: 'ready',
					revisionNote: 'End-to-end fixture.',
					modelMetadata: { provider: 'test', model: 'stub' }
				}
			}
		})
	);
	await page.route('**/api/generate', (route) =>
		route.fulfill({
			json: {
				ok: true,
				value: {
					prompt: 'Stub coloring page prompt.',
					templateVersion: 'v2',
					images: [
						{
							id: 'image-1',
							format: 'png',
							mimeType: 'image/png',
							data: PNG_1X1,
							encoding: 'base64'
						}
					],
					revisedPrompt: 'Stub revised prompt.',
					modelMetadata: { provider: 'test', model: 'stub-image' },
					violations: [],
					recommendedFixes: []
				}
			}
		})
	);
	// The verdict echoes the tool that was asked for: the hub and the mode routes each send their
	// own `toolId`, and a reply naming a different one is a reply to a question nobody asked.
	await page.route('**/api/tools', async (route) => {
		const body = route.request().postDataJSON() as { toolId?: string };
		await route.fulfill({
			json: {
				ok: true,
				value: {
					toolId: body.toolId ?? 'unknown',
					headline: 'Red flag',
					response: STUB_TOOL_RESPONSE
				}
			}
		});
	});
};

/**
 * Load a route and wait until it can be driven.
 *
 * The home page announces hydration; the others do not, so the wait there is on the control the
 * test is about to click actually being live. A fixed timeout races the hydration it is standing in
 * for, which is how a print or share test comes to fail for a reason that has nothing to do with
 * printing or sharing.
 */
export const openRoute = async (page: Page, path: string): Promise<void> => {
	await page.goto(path, { waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
		// Some asset pipelines keep a request open; hydration still completes.
	});
	// Asked of the document rather than matched against a list of paths. `/` and `/vault` both
	// render `data-hydrated="false"` server-side and flip it on mount; a hardcoded list of which
	// routes do that is a second copy of a fact, and the next route to announce hydration would
	// silently go back to racing it.
	if ((await page.locator('[data-hydrated]').count()) > 0) {
		await page.waitForSelector('[data-hydrated="true"]');
	}
};
