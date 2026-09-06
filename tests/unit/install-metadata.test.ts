// Purpose: Hold the three files that describe the installed app to an operating system in
//          agreement with each other and with what the app actually paints.
// Why: The manifest declares `display: standalone`, so a browser will offer to install this app
//      and then draw a splash screen, a window and a task-switcher entry from these values. On
//      `main` at `ad3bfe7` they disagreed with the app and with each other: `background_color` was
//      `#fffaf4`, a cream, on an app whose body has painted `#07070f` since it was written, so the
//      launch splash flashed white before a dark app; `theme_color` was `#1c1712`, a brown that
//      appears nowhere in the palette. Nothing could catch that, because the agreement was a
//      convention nobody had written down. A comment saying "must equal" is a second copy of a
//      truth and goes stale silently; this reads all three files and compares them.
// Info flow: static/manifest.webmanifest + src/app.html + src/routes/+layout.svelte -> parsed
//            values -> assertions.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Same shape `tests/unit/meechie-tools-parity.test.ts` uses to read source files. A template
// literal inside `new URL(..., import.meta.url)` does not survive the vitest transform here.
const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string): string =>
	readFileSync(resolve(here, '../..', relative), 'utf8');

const manifest = JSON.parse(read('static/manifest.webmanifest')) as Record<string, unknown>;
const appHtml = read('src/app.html');
const layout = read('src/routes/+layout.svelte');

/** The colour the app's own body is painted, read from where it is defined rather than retyped. */
const darkBase = layout.match(/--dark-base:\s*(#[0-9a-fA-F]{6})/)?.[1];
const themeColorMeta = appHtml.match(/<meta name="theme-color" content="(#[0-9a-fA-F]{6})"/)?.[1];

describe('install metadata', () => {
	it('paints the splash screen the colour the app is actually painted', () => {
		expect(darkBase).toBe('#07070f');
		expect(manifest.background_color).toBe(darkBase);
	});

	it('tints the browser chrome the same colour in the manifest and in the document', () => {
		expect(themeColorMeta).toBe(darkBase);
		expect(manifest.theme_color).toBe(darkBase);
	});

	it('declares an identity that does not move if the start URL ever does', () => {
		expect(manifest.id).toBe('/');
		expect(manifest.scope).toBe('/');
		expect(manifest.start_url).toBe('/');
	});

	it('describes itself, in the same words the document gives a search result', () => {
		const metaDescription = layout.match(/content="([^"]*printable coloring page\.)"/)?.[1];

		expect(metaDescription).toBeTruthy();
		expect(manifest.description).toBe(metaDescription);
	});

	// An SVG has no pixel size, and declaring one tells a browser to pick this file for a raster
	// slot it cannot fill well. `any` is what says "this one scales".
	it('does not claim a pixel size for the scalable icon', () => {
		const icons = manifest.icons as { src: string; sizes: string }[];
		const svg = icons.find((icon) => icon.src.endsWith('.svg'));

		expect(svg?.sizes).toBe('any');
	});

	it('ships a maskable icon, which is what an OS crops to its own shape', () => {
		const icons = manifest.icons as { src: string; purpose?: string }[];

		expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
	});

	// iOS ignores the manifest's icons when a reader adds the app to their home screen.
	it('gives iOS the icon it actually reads', () => {
		expect(layout).toContain('rel="apple-touch-icon"');
	});
});
