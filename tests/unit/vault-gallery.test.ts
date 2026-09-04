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
	vaultImageSource
} from '../../src/lib/core/vault-gallery';
import { buildColoringPageSpecFromMeechieText } from '../../src/lib/core/meechie-studio';
import type { CreationRecord } from '../../contracts/creation-store.contract';
import type { MeechieStudioTextOutput } from '../../contracts/meechie-studio-text.contract';

// Real byte signatures — the detector reads bytes, so a made-up string would prove nothing.
const PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAg=';
// "RIFF" + 4 size bytes + "WEBP" + "VP8 ".
const WEBP_BASE64 = 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASo=';
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
	it('prefers a stored url over sniffing bytes', () => {
		expect(vaultImageSource({ url: 'https://example.test/page.png' })).toBe(
			'https://example.test/page.png'
		);
	});

	it('builds a data url with the media type the bytes actually are', () => {
		expect(vaultImageSource({ b64: JPEG_BASE64 })).toBe(
			`data:image/jpeg;base64,${JPEG_BASE64}`
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
		['https://example.test/saved.webp', 'webp'],
		['https://example.test/saved.jpeg?v=2', 'jpg'],
		['https://example.test/no-extension', 'png']
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
