// Purpose: Schema validation tests for the contracts/image-generation.contract.ts wire format.
// Why: Verify the updated seam-sourced imports (ColoringPageSpecSchema, OutputFormatSchema
//      from spec-validation-seam) still produce correct wire-format schemas.
// Info flow: contracts/image-generation.contract.ts schemas -> API boundary validation.
import { describe, expect, it } from 'vitest';
import {
	GeneratedImageSchema,
	ImageDataEncodingSchema,
	ImageGenerationInputSchema,
	ImageGenerationOutputSchema,
	ImageGenerationResultSchema
} from '../../contracts/image-generation.contract';

const validSpec = {
	title: 'Fun Coloring',
	items: [
		{ number: 1, label: 'Stars' },
		{ number: 2, label: 'Moon' }
	],
	listMode: 'list',
	alignment: 'center',
	numberAlignment: 'loose',
	listGutter: 'tight',
	whitespaceScale: 30,
	textSize: 'medium',
	fontStyle: 'block',
	textStrokeWidth: 8,
	colorMode: 'grayscale',
	decorations: 'minimal',
	illustrations: 'simple',
	shading: 'hatch',
	border: 'decorative',
	borderThickness: 4,
	variations: 2,
	outputFormat: 'png',
	pageSize: 'A4'
} as const;

describe('ImageDataEncodingSchema', () => {
	it('accepts utf8', () => {
		expect(ImageDataEncodingSchema.safeParse('utf8').success).toBe(true);
	});

	it('accepts base64', () => {
		expect(ImageDataEncodingSchema.safeParse('base64').success).toBe(true);
	});

	it('rejects unknown encoding', () => {
		expect(ImageDataEncodingSchema.safeParse('hex').success).toBe(false);
	});
});

describe('GeneratedImageSchema', () => {
	const validImage = {
		id: 'img-001',
		format: 'png',
		mimeType: 'image/png',
		data: 'iVBORw0KGgo=',
		encoding: 'base64'
	};

	it('accepts a valid PNG image with base64 encoding', () => {
		const result = GeneratedImageSchema.safeParse(validImage);
		expect(result.success).toBe(true);
	});

	it('accepts a valid SVG image with utf8 encoding', () => {
		const result = GeneratedImageSchema.safeParse({
			id: 'img-002',
			format: 'svg',
			mimeType: 'image/svg+xml',
			data: '<svg xmlns="http://www.w3.org/2000/svg"/>',
			encoding: 'utf8'
		});
		expect(result.success).toBe(true);
	});

	it('accepts a valid JPG image', () => {
		const result = GeneratedImageSchema.safeParse({
			id: 'img-003',
			format: 'jpg',
			mimeType: 'image/jpeg',
			data: '/9j/4AAQ==',
			encoding: 'base64'
		});
		expect(result.success).toBe(true);
	});

	it('rejects an unknown image format', () => {
		const result = GeneratedImageSchema.safeParse({ ...validImage, format: 'gif' });
		expect(result.success).toBe(false);
	});

	it('rejects an unknown encoding type', () => {
		const result = GeneratedImageSchema.safeParse({ ...validImage, encoding: 'hex' });
		expect(result.success).toBe(false);
	});

	it('rejects an empty id (NonEmptyString constraint)', () => {
		const result = GeneratedImageSchema.safeParse({ ...validImage, id: '' });
		expect(result.success).toBe(false);
	});

	it('rejects an empty data string', () => {
		const result = GeneratedImageSchema.safeParse({ ...validImage, data: '' });
		expect(result.success).toBe(false);
	});

	it('rejects an empty mimeType', () => {
		const result = GeneratedImageSchema.safeParse({ ...validImage, mimeType: '' });
		expect(result.success).toBe(false);
	});

	it('rejects a missing id field', () => {
		const { id: _id, ...withoutId } = validImage;
		const result = GeneratedImageSchema.safeParse(withoutId);
		expect(result.success).toBe(false);
	});
});

describe('ImageGenerationInputSchema', () => {
	const validInput = {
		spec: validSpec,
		prompt: 'Black-and-white coloring page with stars and moon.',
		variations: 2,
		outputFormat: 'png'
	};

	it('accepts a valid input', () => {
		const result = ImageGenerationInputSchema.safeParse(validInput);
		expect(result.success).toBe(true);
	});

	it('rejects an empty prompt', () => {
		const result = ImageGenerationInputSchema.safeParse({ ...validInput, prompt: '' });
		expect(result.success).toBe(false);
	});

	it('accepts variations at the minimum boundary (1)', () => {
		const result = ImageGenerationInputSchema.safeParse({ ...validInput, variations: 1 });
		expect(result.success).toBe(true);
	});

	it('accepts variations at the maximum boundary (4)', () => {
		const result = ImageGenerationInputSchema.safeParse({ ...validInput, variations: 4 });
		expect(result.success).toBe(true);
	});

	it('rejects variations below minimum (0)', () => {
		const result = ImageGenerationInputSchema.safeParse({ ...validInput, variations: 0 });
		expect(result.success).toBe(false);
	});

	it('rejects variations above maximum (5)', () => {
		const result = ImageGenerationInputSchema.safeParse({ ...validInput, variations: 5 });
		expect(result.success).toBe(false);
	});

	it('rejects a non-integer variations value', () => {
		const result = ImageGenerationInputSchema.safeParse({ ...validInput, variations: 1.5 });
		expect(result.success).toBe(false);
	});

	it('rejects an invalid outputFormat', () => {
		const result = ImageGenerationInputSchema.safeParse({ ...validInput, outputFormat: 'svg' });
		expect(result.success).toBe(false);
	});

	it('accepts pdf as outputFormat', () => {
		const result = ImageGenerationInputSchema.safeParse({ ...validInput, outputFormat: 'pdf' });
		expect(result.success).toBe(true);
	});

	it('rejects a missing spec', () => {
		const { spec: _s, ...withoutSpec } = validInput;
		const result = ImageGenerationInputSchema.safeParse(withoutSpec);
		expect(result.success).toBe(false);
	});
});

describe('ImageGenerationOutputSchema', () => {
	const validOutput = {
		images: [
			{
				id: 'img-001',
				format: 'png',
				mimeType: 'image/png',
				data: 'abc123',
				encoding: 'base64'
			}
		]
	};

	it('accepts a valid output with required images', () => {
		const result = ImageGenerationOutputSchema.safeParse(validOutput);
		expect(result.success).toBe(true);
	});

	it('accepts an output with an empty images array', () => {
		const result = ImageGenerationOutputSchema.safeParse({ images: [] });
		expect(result.success).toBe(true);
	});

	it('accepts optional revisedPrompt', () => {
		const result = ImageGenerationOutputSchema.safeParse({
			...validOutput,
			revisedPrompt: 'Detailed black and white coloring page.'
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.revisedPrompt).toBeTruthy();
		}
	});

	it('rejects empty string revisedPrompt (NonEmptyString constraint)', () => {
		const result = ImageGenerationOutputSchema.safeParse({
			...validOutput,
			revisedPrompt: ''
		});
		expect(result.success).toBe(false);
	});

	it('accepts optional modelMetadata', () => {
		const result = ImageGenerationOutputSchema.safeParse({
			...validOutput,
			modelMetadata: { provider: 'xai', model: 'grok-imagine-image' }
		});
		expect(result.success).toBe(true);
	});

	it('rejects modelMetadata missing required provider field', () => {
		const result = ImageGenerationOutputSchema.safeParse({
			...validOutput,
			modelMetadata: { model: 'grok-imagine-image' }
		});
		expect(result.success).toBe(false);
	});

	it('accepts multiple images with different formats', () => {
		const result = ImageGenerationOutputSchema.safeParse({
			images: [
				{ id: 'img-1', format: 'png', mimeType: 'image/png', data: 'abc', encoding: 'base64' },
				{ id: 'img-2', format: 'svg', mimeType: 'image/svg+xml', data: '<svg/>', encoding: 'utf8' }
			]
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.images).toHaveLength(2);
		}
	});
});

describe('ImageGenerationResultSchema', () => {
	const validOutput = {
		images: [
			{
				id: 'img-001',
				format: 'png',
				mimeType: 'image/png',
				data: 'abc123',
				encoding: 'base64'
			}
		]
	};

	it('accepts an ok result', () => {
		const result = ImageGenerationResultSchema.safeParse({ ok: true, value: validOutput });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.ok).toBe(true);
		}
	});

	it('accepts a fault result', () => {
		const result = ImageGenerationResultSchema.safeParse({
			ok: false,
			error: { code: 'IMAGE_NETWORK_ERROR', message: 'Image request failed.' }
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.ok).toBe(false);
		}
	});

	it('accepts a fault result with optional details', () => {
		const result = ImageGenerationResultSchema.safeParse({
			ok: false,
			error: {
				code: 'IMAGE_HTTP_ERROR',
				message: 'HTTP 429: Too Many Requests',
				details: { status: '429', statusText: 'Too Many Requests' }
			}
		});
		expect(result.success).toBe(true);
	});

	it('rejects a result where ok is neither true nor false', () => {
		const result = ImageGenerationResultSchema.safeParse({ ok: null, value: validOutput });
		expect(result.success).toBe(false);
	});

	it('rejects an ok result missing the value field', () => {
		const result = ImageGenerationResultSchema.safeParse({ ok: true });
		expect(result.success).toBe(false);
	});

	it('rejects a fault result with empty error code', () => {
		const result = ImageGenerationResultSchema.safeParse({
			ok: false,
			error: { code: '', message: 'Something went wrong.' }
		});
		expect(result.success).toBe(false);
	});
});
