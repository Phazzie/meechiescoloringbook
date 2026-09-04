// Purpose: Unit tests for the shared GeneratedImage -> data URL / base64 conversions.
// Why: Four components used to carry private copies of this conversion, and the SVG and non-ASCII
//      cases are exactly the ones a copy gets wrong. Pin them here once.
// Info flow: GeneratedImage fixtures -> conversion helpers -> assertions.
import { describe, expect, it } from 'vitest';
import {
	GENERATED_IMAGE_MIME_TYPES,
	generatedImageBase64,
	generatedImageDataUrl
} from '../../src/lib/core/generated-image-preview';
import type { GeneratedImage } from '../../contracts/image-generation.contract';

const image = (overrides: Partial<GeneratedImage>): GeneratedImage => ({
	id: 'img-1',
	format: 'png',
	mimeType: 'image/png',
	data: 'AAAA',
	encoding: 'base64',
	...overrides
});

describe('GENERATED_IMAGE_MIME_TYPES', () => {
	it('uses the registered media type names, not the enum members', () => {
		// `image/jpg` and `image/svg` are not registered types; interpolating the enum produced both.
		expect(GENERATED_IMAGE_MIME_TYPES.jpg).toBe('image/jpeg');
		expect(GENERATED_IMAGE_MIME_TYPES.svg).toBe('image/svg+xml');
		expect(GENERATED_IMAGE_MIME_TYPES.png).toBe('image/png');
		expect(GENERATED_IMAGE_MIME_TYPES.webp).toBe('image/webp');
	});
});

describe('generatedImageDataUrl', () => {
	it('percent-encodes utf8 SVG markup rather than base64-ing it', () => {
		const url = generatedImageDataUrl(
			image({
				format: 'svg',
				mimeType: 'image/svg+xml',
				data: '<svg id="a"/>',
				encoding: 'utf8'
			})
		);
		expect(url).toBe(
			`data:image/svg+xml;utf8,${encodeURIComponent('<svg id="a"/>')}`
		);
	});

	it.each(['png', 'jpg', 'webp'] as const)(
		'builds a base64 data URL for %s',
		(format) => {
			expect(generatedImageDataUrl(image({ format, data: 'QUJD' }))).toBe(
				`data:${GENERATED_IMAGE_MIME_TYPES[format]};base64,QUJD`
			);
		}
	);

	it('returns null for a raster image that arrived as utf8, instead of a broken <img>', () => {
		expect(
			generatedImageDataUrl(image({ format: 'png', encoding: 'utf8' }))
		).toBeNull();
	});
});

describe('generatedImageBase64', () => {
	it('passes base64 payloads through untouched', () => {
		expect(generatedImageBase64(image({ data: 'QUJD' }))).toBe('QUJD');
	});

	it('encodes utf8 markup so the vault stores real bytes', () => {
		const markup = '<svg><text>OK</text></svg>';
		const encoded = generatedImageBase64(
			image({
				format: 'svg',
				mimeType: 'image/svg+xml',
				data: markup,
				encoding: 'utf8'
			})
		);
		expect(Buffer.from(encoded, 'base64').toString('utf8')).toBe(markup);
	});

	it('survives code points above 0xFF, which bare btoa throws on', () => {
		// A curly apostrophe is not exotic here: Meechie's page titles are full of them, and
		// `btoa(markup)` alone raises InvalidCharacterError on the first one.
		const markup = '<svg><text>He’s late — again</text></svg>';
		const encoded = generatedImageBase64(
			image({
				format: 'svg',
				mimeType: 'image/svg+xml',
				data: markup,
				encoding: 'utf8'
			})
		);
		expect(Buffer.from(encoded, 'base64').toString('utf8')).toBe(markup);
	});
});
