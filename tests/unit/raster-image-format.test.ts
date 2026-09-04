// Purpose: Verify byte-signature detection for JPEG/PNG/WebP raster images.
// Why: A base64-string-prefix guess (the bug this module replaced) silently mislabels
//      anything it doesn't special-case; these tests pin the real byte-signature behavior.
// Info flow: base64 or raw bytes -> byte-signature match -> RasterMimeType or null.
import { describe, expect, it } from 'vitest';
import {
	detectRasterMimeTypeFromBase64,
	detectRasterMimeTypeFromBytes,
	isRenderableGeneratedImage
} from '../../src/lib/core/raster-image-format';
import type { GeneratedImage } from '../../contracts/image-generation.contract';

describe('detectRasterMimeTypeFromBytes', () => {
	it('detects a JPEG signature', () => {
		expect(detectRasterMimeTypeFromBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe(
			'image/jpeg'
		);
	});

	it('detects a PNG signature', () => {
		const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];
		expect(detectRasterMimeTypeFromBytes(Uint8Array.from(png))).toBe('image/png');
	});

	it('detects a WebP signature (RIFF....WEBP)', () => {
		const webp = [
			0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
		];
		expect(detectRasterMimeTypeFromBytes(Uint8Array.from(webp))).toBe('image/webp');
	});

	it('returns null for bytes matching none of the known signatures', () => {
		expect(detectRasterMimeTypeFromBytes(Uint8Array.from([0x00, 0x01, 0x02]))).toBeNull();
	});

	it('returns null for a RIFF file that is not WebP', () => {
		const riffOnly = [0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20];
		expect(detectRasterMimeTypeFromBytes(Uint8Array.from(riffOnly))).toBeNull();
	});
});

describe('detectRasterMimeTypeFromBase64', () => {
	it('decodes base64 and detects JPEG', () => {
		// '/9j/' is the real base64 encoding of the FF D8 FF JPEG marker.
		expect(detectRasterMimeTypeFromBase64('/9j/jpeg-data')).toBe('image/jpeg');
	});

	it('decodes base64 and detects PNG', () => {
		expect(detectRasterMimeTypeFromBase64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ')).toBe(
			'image/png'
		);
	});

	it('decodes base64 and detects WebP', () => {
		// RIFF....WEBP.... - a minimal, real WebP byte signature, base64-encoded.
		expect(detectRasterMimeTypeFromBase64('UklGRhAAAABXRUJQVlA4IA==')).toBe('image/webp');
	});

	it('returns null for unrecognized base64 content', () => {
		expect(detectRasterMimeTypeFromBase64('not-a-known-image-header')).toBeNull();
	});
});

describe('isRenderableGeneratedImage', () => {
	const base64 = (bytes: readonly number[]): string =>
		Buffer.from(Uint8Array.from(bytes)).toString('base64');
	const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];

	const image = (overrides: Partial<GeneratedImage>): GeneratedImage => ({
		id: 'image-1',
		format: 'png',
		mimeType: 'image/png',
		data: base64(PNG_BYTES),
		encoding: 'base64',
		...overrides
	});

	it('accepts a real PNG', () => {
		expect(isRenderableGeneratedImage(image({}))).toBe(true);
	});

	it('accepts a real JPEG that the pipeline happened to label png', () => {
		// The label is not the evidence — the bytes are.
		expect(
			isRenderableGeneratedImage(image({ data: base64([0xff, 0xd8, 0xff, 0x00]) }))
		).toBe(true);
	});

	it('rejects nonempty base64 whose bytes are not an image', () => {
		// This is the case the contract cannot catch: `data` is only `NonEmptyStringSchema`, and
		// `image-generation-pipeline.ts` labels unrecognized bytes `png`. Without this check a
		// provider returning garbage replaces a working page with a broken tile that `embedPng`
		// then throws on, and that can be saved to the vault in that state.
		expect(isRenderableGeneratedImage(image({ data: base64([0x00, 0x01, 0x02, 0x03]) }))).toBe(
			false
		);
	});

	it('rejects a string that is not base64 at all', () => {
		expect(isRenderableGeneratedImage(image({ data: 'not base64 !!!' }))).toBe(false);
	});

	it('accepts a utf8 SVG and rejects a blank one', () => {
		const svg = { format: 'svg' as const, encoding: 'utf8' as const, mimeType: 'image/svg+xml' };
		expect(isRenderableGeneratedImage(image({ ...svg, data: '<svg />' }))).toBe(true);
		expect(isRenderableGeneratedImage(image({ ...svg, data: '   ' }))).toBe(false);
	});

	it('rejects utf8 data that is not claimed to be svg', () => {
		expect(
			isRenderableGeneratedImage(image({ format: 'png', encoding: 'utf8', data: 'text' }))
		).toBe(false);
	});
});
