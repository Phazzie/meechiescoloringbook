// Purpose: End-to-end cover for taking a finished coloring page away — the labelled download row on
//          the surfaces that never had one, and the send control the app has been promising.
// Why: What a download row offers, and whether a share sheet is reachable at all, are rendering and
//      platform facts a unit test cannot see. Measured in this browser on `main` at `7fbb57d`,
//      `/who-fucked-up` offered two links whose text was `meechie-who-fucked-up-1788784316892.pdf`
//      and `…-square.png`, no original at all, and zero send controls — while `/` offered three
//      links reading "Printable PDF · US Letter — ready to print · 946 B".
// Info flow: stubbed APIs -> a generated page on screen -> the export row and the send control.
// Critical invariant: the Web Share API is genuinely ABSENT from this container's Chromium (1194 on
//      Linux) — measured, not assumed. So the share path is exercised against an injected stub and
//      the clipboard path is exercised against the real capability check with a recorded write. A
//      test here that asserts a real share sheet opened is asserting something no browser in this
//      project can do.
import { expect, test, type Page } from '@playwright/test';
// The stubbed endpoints and the load helper, shared with `print.spec.ts`.
import { openRoute as open, stubPageApis as stub, STUB_QUOTE } from './support/page-fixtures';

test.setTimeout(120000);
test.describe.configure({ mode: 'parallel' });

/** One recorded call to a share or clipboard API, flattened to what can cross into Node. */
type RecordedShare = {
	kind: 'share' | 'clipboard';
	title?: string;
	text?: string;
	files: { name: string; type: string; size: number }[];
};

declare global {
	interface Window {
		__shareCalls?: RecordedShare[];
		__shareRejectsWith?: string;
	}
}

/**
 * Install a Web Share API this browser does not have, and record what it is handed.
 *
 * `addInitScript` rather than `evaluate`, because the component reads the capability on mount and a
 * share sheet that appears afterwards is a share sheet the button never saw.
 */
const installShareStub = async (page: Page): Promise<void> => {
	await page.addInitScript(() => {
		window.__shareCalls = [];
		Object.defineProperty(navigator, 'canShare', {
			configurable: true,
			value: (data: { files?: File[] }) => Array.isArray(data?.files) && data.files.length > 0
		});
		Object.defineProperty(navigator, 'share', {
			configurable: true,
			value: async (data: { title?: string; text?: string; files?: File[] }) => {
				window.__shareCalls?.push({
					kind: 'share',
					title: data.title,
					text: data.text,
					files: (data.files ?? []).map((file) => ({
						name: file.name,
						type: file.type,
						size: file.size
					}))
				});
				if (window.__shareRejectsWith) {
					const error = new Error('stubbed');
					error.name = window.__shareRejectsWith;
					throw error;
				}
			}
		});
	});
};

/**
 * Record clipboard writes instead of performing them.
 *
 * A real `clipboard.write` needs a granted permission and a focused document, and gives back
 * nothing this test could read. What is worth asserting is what this app hands the API — that it is
 * one PNG of the page — and that is exactly what a recorded write shows.
 */
const installClipboardRecorder = async (page: Page): Promise<void> => {
	await page.addInitScript(() => {
		window.__shareCalls = window.__shareCalls ?? [];
		const originalWrite = navigator.clipboard?.write?.bind(navigator.clipboard);
		if (!originalWrite) return;
		Object.defineProperty(navigator.clipboard, 'write', {
			configurable: true,
			value: async (items: ClipboardItem[]) => {
				const files: RecordedShare['files'] = [];
				for (const item of items) {
					for (const type of item.types) {
						const blob = await item.getType(type);
						files.push({ name: type, type, size: blob.size });
					}
				}
				window.__shareCalls?.push({ kind: 'clipboard', files });
			}
		});
	});
};

/** Take `/who-fucked-up` from a cold load to a finished picture and its export row. */
const makeModePage = async (page: Page): Promise<void> => {
	await open(page, '/who-fucked-up');
	await page.getByTestId('who-situation-input').fill('He said he was asleep at 2am.');
	await page.getByTestId('who-submit').click();
	await expect(page.getByTestId('verdict-page-generate')).toBeEnabled({ timeout: 20000 });
	await page.getByTestId('verdict-page-generate').click();
	await expect(page.getByTestId('verdict-page-preview')).toBeVisible({ timeout: 20000 });
	await expect(page.getByTestId('verdict-page-export-link').first()).toBeVisible({
		timeout: 20000
	});
};

const recordedCalls = (page: Page): Promise<RecordedShare[]> =>
	page.evaluate(() => window.__shareCalls ?? []);

test('a mode route describes every download, and offers the original', async ({ page }) => {
	await stub(page);
	await makeModePage(page);

	const links = page.getByTestId('verdict-page-export-link');
	// Two before this run, both labelled with a raw filename, and no original among them.
	await expect(links).toHaveCount(3);
	await expect(links.nth(0)).toContainText('Printable PDF');
	await expect(links.nth(0)).toContainText('ready to print');
	await expect(links.nth(1)).toContainText('Square PNG');
	await expect(links.nth(2)).toContainText('Original PNG');

	// Every row carries a real size read off the file, not a constant. Read by splitting rather
	// than by a pattern: the row's text is "<label>\n<purpose> · <size>", and a regex over the whole
	// string is both harder to read and the shape SonarCloud's `super-linear-regex` flags.
	for (const text of await links.allInnerTexts()) {
		const [amount, unit] = (text.split('·').pop() ?? '').trim().split(' ');
		expect(Number(amount)).toBeGreaterThan(0);
		expect(['B', 'KB', 'MB']).toContain(unit);
	}

	// The download attribute is still the filename — it is the file's name, not its description.
	await expect(links.nth(2)).toHaveAttribute('download', /-original\.png$/);
});

test('the send control explains itself before there is a page', async ({ page }) => {
	// The home studio is the surface that renders the control from a cold load, and `/` is
	// prerendered — this is exactly the document the service worker replays offline. Nothing here
	// may depend on a capability decided while that document was being built.
	await stub(page);
	await installShareStub(page);
	await open(page, '/');

	const send = page.getByTestId('home-share-page');
	await expect(send).toBeDisabled();
	await expect(send).toHaveText('Send');
	// The disabled control carries its own reason, rather than reading as broken.
	await expect(send).toHaveAttribute('aria-label', /No coloring page on this screen yet/);
	// And it does not claim a send happened, or that one failed.
	await expect(page.getByTestId('home-share-page-status')).toHaveCount(0);
});

test('sending hands the share sheet the picture and the words that go with it', async ({ page }) => {
	await stub(page);
	await installShareStub(page);
	await makeModePage(page);

	const send = page.getByTestId('verdict-page-share');
	await expect(send).toBeEnabled();
	await expect(send).toHaveText('Send this page');
	await expect(send).toHaveAttribute('data-share-method', 'web-share');

	await send.click();
	await expect(page.getByTestId('verdict-page-share-status')).toHaveText('Sent.');

	const calls = await recordedCalls(page);
	expect(calls).toHaveLength(1);
	expect(calls[0].kind).toBe('share');
	// One file: the square PNG. Not the PDF, which no messenger previews, and not both.
	expect(calls[0].files).toHaveLength(1);
	expect(calls[0].files[0].type).toBe('image/png');
	expect(calls[0].files[0].name).toMatch(/-square\.png$/);
	// A real payload, not an empty file: the bytes came out of the same `data:` URL the download
	// link points at.
	expect(calls[0].files[0].size).toBeGreaterThan(0);
	expect(calls[0].text).toContain('Made in');
	expect(calls[0].title).toBeTruthy();
});

test('backing out of the share sheet is not an error', async ({ page }) => {
	await stub(page);
	await installShareStub(page);
	await page.addInitScript(() => {
		window.__shareRejectsWith = 'AbortError';
	});
	await makeModePage(page);

	await page.getByTestId('verdict-page-share').click();
	// The share was attempted and rejected, and the reader is told nothing — because nothing
	// happened. Reporting "could not send" here is the classic defect in share implementations.
	expect(await recordedCalls(page)).toHaveLength(1);
	await expect(page.getByTestId('verdict-page-share-status')).toHaveCount(0);
});

test('a browser with no share sheet copies the picture instead', async ({ page }) => {
	// No share stub: this container's Chromium genuinely has no `navigator.share`, which is the
	// state this fallback exists for and the one every end-to-end run here is actually in.
	await stub(page);
	await installClipboardRecorder(page);
	await makeModePage(page);

	const send = page.getByTestId('verdict-page-share');
	await expect(send).toHaveText('Copy the picture');
	await expect(send).toHaveAttribute('data-share-method', 'clipboard-image');

	await send.click();
	await expect(page.getByTestId('verdict-page-share-status')).toContainText('Paste it');

	const calls = await recordedCalls(page);
	expect(calls).toHaveLength(1);
	expect(calls[0].kind).toBe('clipboard');
	// One image, and a PNG — the only type every platform clipboard carries.
	expect(calls[0].files).toHaveLength(1);
	expect(calls[0].files[0].type).toBe('image/png');
	expect(calls[0].files[0].size).toBeGreaterThan(0);
});

test('the tools hub and the home studio get the same row and the same control', async ({ page }) => {
	await stub(page);
	await installShareStub(page);

	// The eleven-tool hub.
	await open(page, '/meechie');
	await page.getByTestId('meechie-tool-generate').click();
	await expect(page.getByTestId('meechie-tool-output')).toContainText('Fault: them', {
		timeout: 20000
	});
	await page.getByTestId('meechie-tool-make-page').click();
	await expect(page.getByTestId('meechie-tool-preview')).toBeVisible({ timeout: 20000 });
	await expect(page.getByTestId('meechie-tool-export-link')).toHaveCount(3);
	await expect(page.getByTestId('meechie-tool-share')).toBeEnabled();

	// The home studio, whose row this used to be the only copy of.
	await open(page, '/');
	await page.getByTestId('home-evidence').fill('He said he was asleep at 2am.');
	await page.getByTestId('home-generate-verdict').click();
	await expect(page.getByTestId('home-verdict-quote')).toContainText(STUB_QUOTE);
	await page.getByTestId('home-create-page').click();
	await expect(page.getByTestId('home-generated-image')).toBeVisible();
	await expect(page.getByTestId('home-export-link')).toHaveCount(3);
	await expect(page.getByTestId('home-export-link').first()).toContainText('Printable PDF');
	await expect(page.getByTestId('home-share-page')).toBeEnabled();
});

test('the send control never reaches the paper', async ({ page }) => {
	await stub(page);
	await installShareStub(page);
	await makeModePage(page);

	await page.emulateMedia({ media: 'print' });
	const onPaper = await page.evaluate(() => {
		const visible = (element: Element): boolean => {
			const rect = element.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0;
		};
		return {
			buttons: [...document.querySelectorAll('button')].filter(visible).length,
			downloads: [...document.querySelectorAll('a[download]')].filter(visible).length,
			images: [...document.querySelectorAll('img')].filter(visible).length
		};
	});
	// The sheet is the picture. A row of download links and a Send button are not a coloring page.
	expect(onPaper.buttons).toBe(0);
	expect(onPaper.downloads).toBe(0);
	expect(onPaper.images).toBe(1);
});
