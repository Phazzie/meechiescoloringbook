// Purpose: Schema validation tests for the /api/generate wire-format contract.
// Why: Ensure the updated seam-sourced import paths in generate.contract.ts still produce
//      valid, parseable schemas for the orchestration endpoint.
// Info flow: contracts/generate.contract.ts schemas -> request/response validation.
import { describe, expect, it } from 'vitest';
import {
	GenerateRequestSchema,
	GenerateResponseValueSchema,
	GenerateResultSchema
} from '../../contracts/generate.contract';

const validSpec = {
	title: 'Dream Big',
	items: [
		{ number: 1, label: 'Shine' },
		{ number: 2, label: 'Grow' }
	],
	listMode: 'list',
	alignment: 'left',
	numberAlignment: 'strict',
	listGutter: 'normal',
	whitespaceScale: 50,
	textSize: 'small',
	fontStyle: 'rounded',
	textStrokeWidth: 6,
	colorMode: 'black_and_white_only',
	decorations: 'none',
	illustrations: 'none',
	shading: 'none',
	border: 'plain',
	borderThickness: 8,
	variations: 1,
	outputFormat: 'pdf',
	pageSize: 'US_Letter'
} as const;

const validImage = {
	id: 'img-001',
	format: 'png',
	mimeType: 'image/png',
	data: 'base64data',
	encoding: 'base64'
} as const;

describe('GenerateRequestSchema', () => {
	it('accepts a valid spec without styleHint', () => {
		const result = GenerateRequestSchema.safeParse({ spec: validSpec });
		expect(result.success).toBe(true);
	});

	it('accepts a valid spec with an optional styleHint', () => {
		const result = GenerateRequestSchema.safeParse({
			spec: validSpec,
			styleHint: 'glam sparkle icons'
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.styleHint).toBe('glam sparkle icons');
		}
	});

	it('rejects a missing spec', () => {
		const result = GenerateRequestSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it('rejects an empty object as spec', () => {
		const result = GenerateRequestSchema.safeParse({ spec: {} });
		expect(result.success).toBe(false);
	});

	it('rejects an empty string styleHint (NonEmptyString constraint)', () => {
		const result = GenerateRequestSchema.safeParse({
			spec: validSpec,
			styleHint: ''
		});
		expect(result.success).toBe(false);
	});

	it('rejects a spec with invalid colorMode', () => {
		const result = GenerateRequestSchema.safeParse({
			spec: { ...validSpec, colorMode: 'neon' }
		});
		expect(result.success).toBe(false);
	});

	it('rejects a spec with variations out of range', () => {
		const resultLow = GenerateRequestSchema.safeParse({
			spec: { ...validSpec, variations: 0 }
		});
		const resultHigh = GenerateRequestSchema.safeParse({
			spec: { ...validSpec, variations: 5 }
		});
		expect(resultLow.success).toBe(false);
		expect(resultHigh.success).toBe(false);
	});

	it('accepts a spec with A4 page size', () => {
		const result = GenerateRequestSchema.safeParse({
			spec: { ...validSpec, pageSize: 'A4' }
		});
		expect(result.success).toBe(true);
	});

	it('rejects a spec with an unknown pageSize', () => {
		const result = GenerateRequestSchema.safeParse({
			spec: { ...validSpec, pageSize: 'A3' }
		});
		expect(result.success).toBe(false);
	});
});

describe('GenerateResponseValueSchema', () => {
	const validResponse = {
		prompt: 'Black-and-white coloring book page.',
		templateVersion: '1.0.0',
		images: [validImage],
		violations: [],
		recommendedFixes: []
	};

	it('accepts a valid response with required fields', () => {
		const result = GenerateResponseValueSchema.safeParse(validResponse);
		expect(result.success).toBe(true);
	});

	it('accepts a response with optional revisedPrompt', () => {
		const result = GenerateResponseValueSchema.safeParse({
			...validResponse,
			revisedPrompt: 'Revised black-and-white coloring book page.'
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.revisedPrompt).toBeTruthy();
		}
	});

	it('accepts a response with optional modelMetadata', () => {
		const result = GenerateResponseValueSchema.safeParse({
			...validResponse,
			modelMetadata: { provider: 'xai', model: 'grok-imagine-image' }
		});
		expect(result.success).toBe(true);
	});

	it('accepts a response with violations and recommendedFixes', () => {
		const result = GenerateResponseValueSchema.safeParse({
			...validResponse,
			violations: [
				{ code: 'MISSING_ALIGNMENT_PHRASE', message: 'Alignment phrase missing.', severity: 'error' }
			],
			recommendedFixes: [
				{ code: 'ADD_ALIGNMENT_PHRASE', message: 'Add alignment phrase.' }
			]
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.violations).toHaveLength(1);
			expect(result.data.recommendedFixes).toHaveLength(1);
		}
	});

	it('rejects a response missing the prompt field', () => {
		const { prompt: _p, ...withoutPrompt } = validResponse;
		const result = GenerateResponseValueSchema.safeParse(withoutPrompt);
		expect(result.success).toBe(false);
	});

	it('rejects a response with an empty prompt string', () => {
		const result = GenerateResponseValueSchema.safeParse({
			...validResponse,
			prompt: ''
		});
		expect(result.success).toBe(false);
	});

	it('rejects a response with images containing invalid format', () => {
		const result = GenerateResponseValueSchema.safeParse({
			...validResponse,
			images: [{ ...validImage, format: 'gif' }]
		});
		expect(result.success).toBe(false);
	});

	it('accepts multiple images', () => {
		const result = GenerateResponseValueSchema.safeParse({
			...validResponse,
			images: [validImage, { ...validImage, id: 'img-002', format: 'svg', mimeType: 'image/svg+xml', encoding: 'utf8' }]
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.images).toHaveLength(2);
		}
	});
});

describe('GenerateResultSchema', () => {
	const validResponse = {
		prompt: 'Coloring page prompt.',
		templateVersion: '2.0',
		images: [validImage],
		violations: [],
		recommendedFixes: []
	};

	it('accepts an ok result', () => {
		const result = GenerateResultSchema.safeParse({ ok: true, value: validResponse });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.ok).toBe(true);
		}
	});

	it('accepts a fault result', () => {
		const result = GenerateResultSchema.safeParse({
			ok: false,
			error: { code: 'GENERATE_INPUT_INVALID', message: 'Input did not match schema.' }
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.ok).toBe(false);
		}
	});

	it('rejects a result with neither ok:true nor ok:false', () => {
		const result = GenerateResultSchema.safeParse({ ok: 'maybe', value: validResponse });
		expect(result.success).toBe(false);
	});

	it('rejects a fault result with empty error code', () => {
		const result = GenerateResultSchema.safeParse({
			ok: false,
			error: { code: '', message: 'Something went wrong.' }
		});
		expect(result.success).toBe(false);
	});
});