// Purpose: Unit tests for the pure Quote Vault transforms.
// Why: Sorting, searching, labelling, and rebuilding a saved page's image from stored base64 are
//      the whole vault; proving them here keeps the UI free of logic that needs a browser to test.
// Info flow: CreationRecord fixtures -> vault-gallery helpers -> assertions.
import { describe, expect, it } from 'vitest';
import {
	buildVaultEntries,
	detectVaultImageKind,
	formatVaultSavedLabel,
	matchesVaultQuery,
	restoreCreationImages,
	sortVaultCreations,
	vaultImageExtension,
	vaultImageSource,
	vaultQuote,
	VAULT_CAPACITY
} from '../../src/lib/core/vault-gallery';
import { creationStoreAdapter } from '../../src/lib/adapters/creation-store.adapter';
import { buildColoringPageSpecFromMeechieText } from '../../src/lib/core/meechie-studio';
import type { CreationRecord } from '../../contracts/creation-store.contract';
import type { MeechieStudioTextOutput } from '../../contracts/meechie-studio-text.contract';

// Real byte signatures — the detector reads bytes, so a made-up string would prove nothing.
const PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// Complete files, not signature stubs: `vaultImageSource` refuses bytes that lack the terminator
// their own format requires, so a truncated fixture would prove the wrong thing.
const JPEG_BASE64 =
	'/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
// "RIFF" + a size field that really does match the payload + "WEBP" + a VP8 chunk.
const WEBP_BASE64 = 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAgA0JaQAA3AA/vv9UAA=';
const SVG_MARKUP = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"></svg>';
const SVG_BASE64 = btoa(SVG_MARKUP);
const SVG_WITH_XML_DECLARATION_BASE64 = btoa(
	`<?xml version="1.0" encoding="UTF-8"?>${SVG_MARKUP}`
);

const studioText = (quote: string): MeechieStudioTextOutput => ({
	verdict: 'Meechie already clocked it.',
	quote,
	pageTitle: 'SAVED',
	pageItems: [{ number: 1, label: 'ONE LINE' }],
	qualityState: 'ready'
});

const baseSpec = buildColoringPageSpecFromMeechieText({
	output: {
		verdict: 'Meechie already clocked it.',
		quote: 'A saved quote.',
		pageTitle: 'A SAVED PAGE',
		pageItems: [{ number: 1, label: 'FIRST LINE' }],
		qualityState: 'ready'
	},
	pageSize: 'US_Letter',
	border: 'decorative',
	styleHint: 'gold crown ornaments'
});

const makeRecord = (
	id: string,
	overrides: Partial<CreationRecord> = {}
): CreationRecord => ({
	id,
	createdAtISO: '2026-09-01T00:00:00.000Z',
	intent: baseSpec,
	assembledPrompt: `prompt for ${id}`,
	owner: { kind: 'anonymous', sessionId: 'session-1' },
	...overrides
});

describe('detectVaultImageKind', () => {
	it.each([
		['PNG', PNG_BASE64, 'image/png', 'png'],
		['JPEG', JPEG_BASE64, 'image/jpeg', 'jpg'],
		['WebP', WEBP_BASE64, 'image/webp', 'webp']
	])('identifies a stored %s from its bytes', (_label, base64, mimeType, format) => {
		expect(detectVaultImageKind(base64)).toEqual({
			kind: 'raster',
			mimeType,
			format
		});
	});

	it.each([
		['a bare <svg> root', SVG_BASE64],
		['an XML declaration first', SVG_WITH_XML_DECLARATION_BASE64]
	])('identifies a base64-encoded SVG with %s', (_label, base64) => {
		expect(detectVaultImageKind(base64)).toEqual({
			kind: 'svg',
			mimeType: 'image/svg+xml'
		});
	});

	it('tolerates whitespace inside stored base64', () => {
		const wrapped = PNG_BASE64.replace(/(.{16})/g, '$1\n');

		expect(detectVaultImageKind(wrapped)).toMatchObject({ mimeType: 'image/png' });
	});

	it.each([
		['an empty string', ''],
		['a string too short to carry a signature', 'AA=='],
		['bytes that match no known format', btoa('not an image at all')]
	])('returns null for %s', (_label, base64) => {
		expect(detectVaultImageKind(base64)).toBeNull();
	});
});

describe('vaultImageSource', () => {
	it('builds a data url with the media type the bytes actually are', () => {
		expect(vaultImageSource({ b64: JPEG_BASE64 })).toBe(
			`data:image/jpeg;base64,${JPEG_BASE64}`
		);
	});

	it('accepts a same-origin path', () => {
		expect(vaultImageSource({ url: '/saved/page.png' })).toBe('/saved/page.png');
	});

	it.each([
		['a javascript: url', 'javascript:alert(1)'],
		['a data: url smuggled in as a stored url', 'data:text/html,<script>alert(1)</script>'],
		['a protocol-relative url', '//evil.test/page.png'],
		['a vbscript: url', 'vbscript:msgbox(1)'],
		// svelte.config.js sets img-src 'self' data: blob:, so an off-origin url can only ever
		// render as a broken thumbnail with a dead download beside it.
		['an off-origin https url the CSP blocks', 'https://example.test/page.png'],
		['an off-origin http url the CSP blocks', 'http://example.test/page.png']
	])('refuses %s rather than turning it into a link', (_label, url) => {
		expect(vaultImageSource({ url }, 'https://meechie.test')).toBe('');
	});

	// A record written before the vault existed may carry a fully qualified URL on the app's own
	// host. `img-src 'self'` loads it, so blanking the thumbnail would be a regression.
	it('accepts an absolute url on the running origin', () => {
		expect(
			vaultImageSource({ url: 'https://meechie.test/saved/page.png' }, 'https://meechie.test')
		).toBe('https://meechie.test/saved/page.png');
	});

	it('refuses an absolute url on a different port of the same host', () => {
		expect(
			vaultImageSource({ url: 'https://meechie.test:8443/page.png' }, 'https://meechie.test')
		).toBe('');
	});

	it('refuses an absolute url when no origin is known, as in a server render', () => {
		expect(vaultImageSource({ url: 'https://meechie.test/page.png' })).toBe('');
	});

	it('accepts a same-origin path even when no origin is known', () => {
		expect(vaultImageSource({ url: '/saved/page.png' })).toBe('/saved/page.png');
	});

	it('prefers the stored bytes when a record carries both bytes and a url', () => {
		expect(vaultImageSource({ b64: PNG_BASE64, url: 'https://example.test/page.png' })).toBe(
			`data:image/png;base64,${PNG_BASE64}`
		);
	});

	// A truncated or corrupted blob can open with a perfectly good PNG header and still be
	// undecodable. Preferring it on the strength of the signature alone would hand the reader a
	// broken thumbnail and a dead download while a working url sat unused in the same record.
	it('falls back to a usable url when signature-valid bytes are not decodable', () => {
		const truncated = `${PNG_BASE64.slice(0, 20)}!!!`;

		expect(detectVaultImageKind(truncated)).not.toBeNull();
		expect(vaultImageSource({ b64: truncated, url: '/saved/page.png' })).toBe('/saved/page.png');
	});

	// The sharper case: a clean truncation is still valid base64 and still carries a valid PNG
	// signature, so a syntax check alone lets it through. Only the missing IEND trailer gives it
	// away.
	it.each([
		['PNG', PNG_BASE64, 20],
		['JPEG', JPEG_BASE64, 16],
		['WebP', WEBP_BASE64, 20],
		['SVG', SVG_BASE64, 24]
	])('falls back for a cleanly truncated %s that keeps its signature', (_label, base64, keep) => {
		const truncated = base64.slice(0, keep);

		expect(truncated.length % 4).toBe(0);
		expect(detectVaultImageKind(truncated)).not.toBeNull();
		expect(vaultImageSource({ b64: truncated, url: '/saved/page.png' })).toBe('/saved/page.png');
	});

	it.each([
		['PNG', PNG_BASE64, 'image/png'],
		['JPEG', JPEG_BASE64, 'image/jpeg'],
		['WebP', WEBP_BASE64, 'image/webp'],
		['SVG', SVG_BASE64, 'image/svg+xml']
	])('still prefers a complete %s over a usable url', (_label, base64, mimeType) => {
		expect(vaultImageSource({ b64: base64, url: '/saved/page.png' })).toBe(
			`data:${mimeType};base64,${base64}`
		);
	});

	it('falls back for an SVG whose closing tag was lost', () => {
		const truncated = btoa(SVG_MARKUP.replace('</svg>', ''));

		expect(vaultImageSource({ b64: truncated, url: '/saved/page.svg' })).toBe('/saved/page.svg');
	});

	// A self-closing root is a complete, renderable SVG with no closing tag at all. Demanding
	// `</svg>` would blank a perfectly good thumbnail.
	it('accepts a self-closing SVG root', () => {
		const selfClosing = btoa('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>');

		expect(vaultImageSource({ b64: selfClosing, url: '/saved/page.svg' })).toBe(
			`data:image/svg+xml;base64,${selfClosing}`
		);
	});

	it.each([
		['a trailing XML comment', `${SVG_MARKUP}<!-- exported by Meechie -->`],
		['trailing whitespace and a newline', `${SVG_MARKUP}\n  `],
		['a comment after a self-closing root', '<svg xmlns="http://www.w3.org/2000/svg"/><!-- x -->']
	])('accepts an SVG with %s after the root element', (_label, markup) => {
		const encoded = btoa(markup);

		expect(vaultImageSource({ b64: encoded, url: '/saved/page.svg' })).toBe(
			`data:image/svg+xml;base64,${encoded}`
		);
	});

	it('falls back for bytes whose length is not a whole number of base64 groups', () => {
		const misaligned = `${PNG_BASE64.slice(0, 21)}`;

		expect(vaultImageSource({ b64: misaligned, url: '/saved/page.png' })).toBe('/saved/page.png');
	});

	it('returns no source when signature-valid bytes are undecodable and there is no url', () => {
		expect(vaultImageSource({ b64: `${PNG_BASE64.slice(0, 20)}!!!` })).toBe('');
	});

	it('still prefers bytes that decode cleanly over a usable url', () => {
		expect(vaultImageSource({ b64: PNG_BASE64, url: '/saved/page.png' })).toBe(
			`data:image/png;base64,${PNG_BASE64}`
		);
	});

	it('returns an empty source rather than a broken image for unreadable bytes', () => {
		expect(vaultImageSource({ b64: btoa('still not an image') })).toBe('');
	});
});

describe('vaultImageExtension', () => {
	it.each([
		[`data:image/png;base64,${PNG_BASE64}`, 'png'],
		[`data:image/jpeg;base64,${JPEG_BASE64}`, 'jpg'],
		[`data:image/svg+xml;base64,${SVG_BASE64}`, 'svg'],
		['/saved/page.webp', 'webp'],
		['/saved/page.jpeg?v=2', 'jpg'],
		['/saved/no-extension', 'png']
	])('maps %s to .%s', (source, expected) => {
		expect(vaultImageExtension(source)).toBe(expected);
	});
});

describe('restoreCreationImages', () => {
	it('rebuilds a raster page as base64 so the preview and the PDF both work', () => {
		const record = makeRecord('with-png', { images: [{ b64: PNG_BASE64 }] });

		expect(restoreCreationImages(record)).toEqual([
			{
				id: 'with-png-saved-1',
				format: 'png',
				mimeType: 'image/png',
				data: PNG_BASE64,
				encoding: 'base64'
			}
		]);
	});

	it('rebuilds an SVG page as utf8 markup, the shape the packaging adapter expects', () => {
		const record = makeRecord('with-svg', { images: [{ b64: SVG_BASE64 }] });

		expect(restoreCreationImages(record)).toEqual([
			{
				id: 'with-svg-saved-1',
				format: 'svg',
				mimeType: 'image/svg+xml',
				data: SVG_MARKUP,
				encoding: 'utf8'
			}
		]);
	});

	it('skips images it cannot rebuild instead of producing a broken one', () => {
		const record = makeRecord('mixed', {
			images: [
				{ url: 'https://example.test/page.png' },
				{ b64: btoa('junk bytes here') },
				{ b64: PNG_BASE64 }
			]
		});

		const restored = restoreCreationImages(record);

		expect(restored).toHaveLength(1);
		expect(restored[0].id).toBe('mixed-saved-3');
	});

	it('returns nothing for a record that saved no images', () => {
		expect(restoreCreationImages(makeRecord('no-images'))).toEqual([]);
	});
});

describe('sortVaultCreations', () => {
	it('puts pinned pages first, then the newest', () => {
		const records = [
			makeRecord('old', { createdAtISO: '2026-08-01T00:00:00.000Z' }),
			makeRecord('new', { createdAtISO: '2026-09-01T00:00:00.000Z' }),
			makeRecord('old-pinned', {
				createdAtISO: '2026-07-01T00:00:00.000Z',
				favorite: true
			})
		];

		expect(sortVaultCreations(records).map((record) => record.id)).toEqual([
			'old-pinned',
			'new',
			'old'
		]);
	});

	it('breaks ties on id so the order never flickers between renders', () => {
		const records = [makeRecord('b'), makeRecord('a')];

		expect(sortVaultCreations(records).map((record) => record.id)).toEqual(['a', 'b']);
	});

	it('sorts an unparseable timestamp last rather than throwing', () => {
		const records = [
			makeRecord('broken-date', { createdAtISO: 'not a date' }),
			makeRecord('good-date')
		];

		expect(sortVaultCreations(records).map((record) => record.id)).toEqual([
			'good-date',
			'broken-date'
		]);
	});

	it('does not mutate the array it was given', () => {
		const records = [makeRecord('b'), makeRecord('a')];

		sortVaultCreations(records);

		expect(records.map((record) => record.id)).toEqual(['b', 'a']);
	});
});

describe('matchesVaultQuery', () => {
	const record = makeRecord('searchable', {
		intent: { ...baseSpec, title: 'THE LANDLORD PAGE', dedication: 'For Big Sis' },
		studioText: studioText('He had time to learn.')
	});

	it.each([
		['an empty query', ''],
		['whitespace only', '   '],
		['a title word in another case', 'landlord'],
		['a word from the quote', 'learn'],
		['a word from the dedication', 'big sis'],
		['two terms in either order', 'learn landlord']
	])('matches on %s', (_label, query) => {
		expect(matchesVaultQuery(record, query)).toBe(true);
	});

	it('rejects a query where only some terms appear', () => {
		expect(matchesVaultQuery(record, 'landlord plumber')).toBe(false);
	});
});

describe('formatVaultSavedLabel', () => {
	const now = Date.parse('2026-09-04T12:00:00.000Z');

	it.each([
		['2026-09-04T01:00:00.000Z', 'Saved today'],
		['2026-09-03T23:00:00.000Z', 'Saved yesterday'],
		['2026-09-01T00:00:00.000Z', 'Saved 3 days ago'],
		['2026-08-01T00:00:00.000Z', 'Saved Aug 1, 2026']
	])('labels %s as "%s"', (createdAtISO, expected) => {
		expect(formatVaultSavedLabel(createdAtISO, now)).toBe(expected);
	});

	it('reads a slightly future timestamp as today rather than negative days', () => {
		expect(formatVaultSavedLabel('2026-09-04T23:00:00.000Z', now)).toBe('Saved today');
	});

	it('says so plainly when the stored timestamp cannot be parsed', () => {
		expect(formatVaultSavedLabel('whenever', now)).toBe('Saved date unknown');
	});
});

describe('buildVaultEntries', () => {
	const now = Date.parse('2026-09-04T12:00:00.000Z');

	it('prepares everything one vault row renders', () => {
		const [entry] = buildVaultEntries(
			[
				makeRecord('full', {
					createdAtISO: '2026-09-04T00:00:00.000Z',
					intent: { ...baseSpec, title: 'THE LANDLORD PAGE' },
					studioText: studioText('He had time to learn.'),
					images: [{ b64: PNG_BASE64 }],
					favorite: true
				})
			],
			{ nowMs: now }
		);

		expect(entry).toMatchObject({
			id: 'full',
			title: 'THE LANDLORD PAGE',
			quote: 'He had time to learn.',
			savedLabel: 'Saved today',
			imageSource: `data:image/png;base64,${PNG_BASE64}`,
			downloadName: 'the-landlord-page.png',
			itemCount: baseSpec.items.length,
			favorite: true
		});
	});

	it('sorts and filters in one pass', () => {
		const entries = buildVaultEntries(
			[
				makeRecord('plumber', { intent: { ...baseSpec, title: 'THE PLUMBER PAGE' } }),
				makeRecord('landlord', {
					createdAtISO: '2026-08-01T00:00:00.000Z',
					intent: { ...baseSpec, title: 'THE LANDLORD PAGE' },
					favorite: true
				}),
				makeRecord('birthday', { intent: { ...baseSpec, title: 'THE BIRTHDAY PAGE' } })
			],
			{ query: 'the page', nowMs: now }
		);

		expect(entries.map((entry) => entry.id)).toEqual([
			'landlord',
			'birthday',
			'plumber'
		]);
	});

	it('falls back to a usable download name when a title has no word characters', () => {
		const [entry] = buildVaultEntries(
			[makeRecord('symbols', { intent: { ...baseSpec, title: '!!!' } })],
			{ nowMs: now }
		);

		expect(entry.downloadName).toBe('meechie-coloring-page.png');
	});
});

describe('buildVaultEntry image selection', () => {
	const now = Date.parse('2026-09-04T12:00:00.000Z');

	it('skips past a leading unusable image to the first one that renders', () => {
		const [entry] = buildVaultEntries(
			[
				makeRecord('later-image-wins', {
					images: [
						{ b64: btoa('not an image') },
						{ url: 'https://example.test/blocked-by-csp.png' },
						{ b64: PNG_BASE64 }
					]
				})
			],
			{ nowMs: now }
		);

		expect(entry.imageSource).toBe(`data:image/png;base64,${PNG_BASE64}`);
		expect(entry.downloadName.endsWith('.png')).toBe(true);
	});

	it('falls back to no image when every stored entry is unusable', () => {
		const [entry] = buildVaultEntries(
			[makeRecord('all-bad', { images: [{ b64: btoa('nope') }] })],
			{ nowMs: now }
		);

		expect(entry.imageSource).toBe('');
	});
});

describe('vaultQuote', () => {
	it('reads the saved quote when the record has one', () => {
		const record = makeRecord('modern', { studioText: studioText('He had time to learn.') });

		expect(vaultQuote(record)).toBe('He had time to learn.');
	});

	// On a generated page `assembledPrompt` holds the image-generation prompt `/api/generate`
	// returned, not anything Meechie said. Showing it in quotation marks, or letting its
	// boilerplate answer searches, is worse than showing no quote at all.
	it('shows no quote for a legacy record rather than quoting its generation prompt', () => {
		const legacy = makeRecord('legacy', {
			assembledPrompt:
				'Black and white line art coloring page, bold clean outlines, no shading,\n' +
				'no solid fills, white background, US Letter portrait, decorative border.'
		});

		expect(legacy.studioText).toBeUndefined();
		expect(vaultQuote(legacy)).toBe('');
	});

	it('does not answer a search with words that appear only in the generation prompt', () => {
		const legacy = makeRecord('legacy', {
			assembledPrompt: 'Black and white line art coloring page with a decorative border.'
		});

		expect(matchesVaultQuery(legacy, 'decorative')).toBe(false);
	});

	it('still finds a legacy record by the text it really stored', () => {
		const legacy = makeRecord('legacy', {
			assembledPrompt: 'Black and white line art coloring page.'
		});

		expect(matchesVaultQuery(legacy, legacy.intent.title)).toBe(true);
	});
});

describe('VAULT_CAPACITY', () => {
	// VAULT_CAPACITY mirrors the adapter's module-private MAX_CREATIONS. Drive the real store past
	// it so the mirror cannot drift: if the adapter's cap changes, this fails rather than letting
	// undoDelete's capacity guard quietly use a stale number.
	it('matches the number of records the real store actually keeps', async () => {
		const owner = { kind: 'anonymous', sessionId: 'capacity-probe' } as const;
		for (let index = 0; index <= VAULT_CAPACITY; index += 1) {
			await creationStoreAdapter.saveCreation({
				record: makeRecord(`capacity-${index}`, { owner })
			});
		}

		const listed = await creationStoreAdapter.listCreations({ owner });

		expect(listed.ok).toBe(true);
		if (listed.ok) expect(listed.value).toHaveLength(VAULT_CAPACITY);
	});
});
