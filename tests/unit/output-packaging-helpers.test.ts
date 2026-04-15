// Purpose: Unit tests for output-packaging adapter helper functions.
// Why: Ensure base64 conversion, SVG parsing, filename building, and format handling work correctly.
// Info flow: Helper inputs -> function logic -> verified outputs.
import { describe, expect, it } from 'vitest';
import { outputPackagingAdapter } from '../../src/lib/adapters/output-packaging.adapter';

describe('output-packaging adapter edge cases', () => {
	describe('empty images list', () => {
		it('returns NO_IMAGES error for empty image array', async () => {
			const result = await outputPackagingAdapter.package({
				images: [],
				outputFormat: 'pdf',
				pageSize: 'US_Letter',
				fileBaseName: 'test',
				variants: ['print']
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('NO_IMAGES');
			}
		});
	});

	describe('PNG passthrough for print variant', () => {
		it('passes through base64 PNG for png output format', async () => {
			const result = await outputPackagingAdapter.package({
				images: [
					{
						format: 'png',
						data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
						encoding: 'base64'
					}
				],
				outputFormat: 'png',
				pageSize: 'US_Letter',
				fileBaseName: 'test-page',
				variants: ['print']
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.files).toHaveLength(1);
				expect(result.value.files[0].filename).toBe('test-page.png');
				expect(result.value.files[0].mimeType).toBe('image/png');
			}
		});
	});

	describe('PDF generation for print variant', () => {
		it('creates PDF from base64 PNG', async () => {
			const result = await outputPackagingAdapter.package({
				images: [
					{
						format: 'png',
						data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
						encoding: 'base64'
					}
				],
				outputFormat: 'pdf',
				pageSize: 'US_Letter',
				fileBaseName: 'coloring-page',
				variants: ['print']
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.files).toHaveLength(1);
				expect(result.value.files[0].filename).toBe('coloring-page.pdf');
				expect(result.value.files[0].mimeType).toBe('application/pdf');
				expect(result.value.files[0].dataBase64.length).toBeGreaterThan(0);
			}
		});

		it('creates PDF with A4 page size', async () => {
			const result = await outputPackagingAdapter.package({
				images: [
					{
						format: 'png',
						data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
						encoding: 'base64'
					}
				],
				outputFormat: 'pdf',
				pageSize: 'A4',
				fileBaseName: 'a4-page',
				variants: ['print']
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.files[0].filename).toBe('a4-page.pdf');
				expect(result.value.files[0].mimeType).toBe('application/pdf');
			}
		});
	});

	describe('filename building', () => {
		it('adds index suffix for multiple images', async () => {
			const result = await outputPackagingAdapter.package({
				images: [
					{
						format: 'png',
						data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
						encoding: 'base64'
					},
					{
						format: 'png',
						data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
						encoding: 'base64'
					}
				],
				outputFormat: 'png',
				pageSize: 'US_Letter',
				fileBaseName: 'page',
				variants: ['print']
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.files).toHaveLength(2);
				expect(result.value.files[0].filename).toBe('page-1.png');
				expect(result.value.files[1].filename).toBe('page-2.png');
			}
		});
	});

	describe('default variants', () => {
		it('defaults to print variant when no variants specified', async () => {
			const result = await outputPackagingAdapter.package({
				images: [
					{
						format: 'png',
						data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
						encoding: 'base64'
					}
				],
				outputFormat: 'png',
				pageSize: 'US_Letter',
				fileBaseName: 'default-variant',
				variants: []
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.files).toHaveLength(1);
				expect(result.value.files[0].filename).toBe('default-variant.png');
			}
		});
	});

	describe('SVG conversion', () => {
		it('SVG conversion fails deterministically in non-browser environment', async () => {
			const result = await outputPackagingAdapter.package({
				images: [
					{
						format: 'svg',
						data: '<svg width="100" height="100"><rect width="100" height="100" fill="white"/></svg>',
						encoding: 'utf8'
					}
				],
				outputFormat: 'pdf',
				pageSize: 'US_Letter',
				fileBaseName: 'svg-test',
				variants: ['print']
			});
			// jsdom does not support canvas, so SVG-to-PNG conversion always fails
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(['BROWSER_REQUIRED', 'CANVAS_UNAVAILABLE', 'SVG_IMAGE_LOAD_FAILED', 'PNG_ENCODING_FAILED']).toContain(
					result.error.code
				);
			}
		});
	});

	describe('unsupported format', () => {
		it('returns error for unsupported image format', async () => {
			const result = await outputPackagingAdapter.package({
				images: [
					{
						format: 'jpeg' as 'png',
						data: 'some-data',
						encoding: 'base64'
					}
				],
				outputFormat: 'png',
				pageSize: 'US_Letter',
				fileBaseName: 'test',
				variants: ['print']
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('UNSUPPORTED_IMAGE_FORMAT');
			}
		});
	});

	describe('PNG encoding validation', () => {
		it('returns error for PNG with non-base64 encoding', async () => {
			const result = await outputPackagingAdapter.package({
				images: [
					{
						format: 'png',
						data: 'some-data',
						encoding: 'utf8' as 'base64'
					}
				],
				outputFormat: 'png',
				pageSize: 'US_Letter',
				fileBaseName: 'test',
				variants: ['print']
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('PNG_ENCODING_UNSUPPORTED');
			}
		});
	});
});
