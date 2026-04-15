// Purpose: Unit tests for drift-detection adapter helper functions and edge cases.
// Why: Ensure heading detection, negative section extraction, and forbidden tokens work correctly.
// Info flow: Prompt strings -> adapter detect -> violation arrays.
import { describe, expect, it } from 'vitest';
import { driftDetectionAdapter } from '../../src/lib/adapters/drift-detection.adapter';
import { SYSTEM_CONSTANTS } from '../../src/lib/core/constants';
import {
	PROMPT_REQUIRED_HEADINGS,
	borderLine,
	colorModeLine,
	decorationLine,
	fontStyleLine,
	illustrationLine,
	negativeLinesForSpec,
	outputLine,
	pageSizeLine,
	shadingLine,
	textStrokeLine
} from '../../src/lib/core/prompt-template';
import { formatAlignmentLine } from '../../src/lib/utils/alignment-line';

const baseSpec = {
	title: 'Test Title',
	items: [
		{ number: 1, label: 'Item One' },
		{ number: 2, label: 'Item Two' }
	],
	listMode: 'list' as const,
	alignment: 'left' as const,
	numberAlignment: 'strict' as const,
	listGutter: 'normal' as const,
	whitespaceScale: 50,
	textSize: 'small' as const,
	fontStyle: 'rounded' as const,
	textStrokeWidth: 6,
	colorMode: 'black_and_white_only' as const,
	decorations: 'none' as const,
	illustrations: 'none' as const,
	shading: 'none' as const,
	border: 'plain' as const,
	borderThickness: 8,
	variations: 1,
	outputFormat: 'pdf' as const,
	pageSize: 'US_Letter' as const
};

const buildValidPrompt = (spec: typeof baseSpec): string => {
	const lines = [
		...PROMPT_REQUIRED_HEADINGS,
		...SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES,
		pageSizeLine(spec.pageSize),
		'Left-align the quote.',
		formatAlignmentLine(spec),
		colorModeLine(spec.colorMode),
		`1. Item One\n2. Item Two`,
		fontStyleLine(spec.fontStyle),
		textStrokeLine(spec.textStrokeWidth),
		decorationLine(spec.decorations),
		illustrationLine(spec.illustrations),
		shadingLine(spec.shading),
		borderLine(spec.border, spec.borderThickness),
		outputLine(spec.colorMode),
		...negativeLinesForSpec(spec)
	];
	return lines.join('\n');
};

describe('drift-detection adapter edge cases', () => {
	describe('missing required section', () => {
		it('returns MISSING_REQUIRED_SECTION when a heading is absent', async () => {
			const prompt = 'Some random prompt without required headings';
			const result = await driftDetectionAdapter.detect({
				spec: baseSpec,
				promptSent: prompt,
				revisedPrompt: undefined
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('MISSING_REQUIRED_SECTION');
			}
		});
	});

	describe('revisedPrompt preference', () => {
		it('uses revisedPrompt when non-empty instead of invalid promptSent', async () => {
			const validPrompt = buildValidPrompt(baseSpec);
			const result = await driftDetectionAdapter.detect({
				spec: baseSpec,
				promptSent: 'invalid prompt',
				revisedPrompt: validPrompt
			});
			// revisedPrompt is valid so detection should succeed rather than
			// failing on the invalid promptSent
			expect(result.ok).toBe(true);
		});

		it('falls back to promptSent when revisedPrompt is empty', async () => {
			const validPrompt = buildValidPrompt(baseSpec);
			const result = await driftDetectionAdapter.detect({
				spec: baseSpec,
				promptSent: validPrompt,
				revisedPrompt: ''
			});
			// promptSent is valid so detection should succeed
			expect(result.ok).toBe(true);
		});
	});

	describe('extra headings detection', () => {
		it('detects unauthorized headings as FORBIDDEN_HEADING', async () => {
			const validPrompt = buildValidPrompt(baseSpec);
			const promptWithExtra = validPrompt + '\nCUSTOM HEADING:\nSome content here.';
			const result = await driftDetectionAdapter.detect({
				spec: baseSpec,
				promptSent: promptWithExtra
			});
			if (result.ok) {
				const forbiddenHeadings = result.value.violations.filter(
					(v) => v.code === 'FORBIDDEN_HEADING'
				);
				expect(forbiddenHeadings.length).toBeGreaterThan(0);
			}
		});
	});

	describe('forbidden token detection', () => {
		it('detects forbidden tokens and reports them', async () => {
			const validPrompt = buildValidPrompt(baseSpec);
			// Add a forbidden token (e.g., "quality:") somewhere in a non-heading line
			const withForbidden = validPrompt + '\nquality: high resolution please';
			const result = await driftDetectionAdapter.detect({
				spec: baseSpec,
				promptSent: withForbidden
			});
			if (result.ok) {
				const tokenViolations = result.value.violations.filter(
					(v) => v.code === 'FORBIDDEN_TOKEN'
				);
				expect(tokenViolations.length).toBeGreaterThan(0);
			}
		});

		it('does not flag STYLE: heading as forbidden', async () => {
			// The STYLE: heading appears in standard prompts and the sanitization
			// should not treat that heading as a forbidden token.
			const validPrompt = buildValidPrompt(baseSpec);
			expect(validPrompt.toLowerCase()).toContain('style:');

			const result = await driftDetectionAdapter.detect({
				spec: baseSpec,
				promptSent: validPrompt
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const styleTokenViolations = result.value.violations.filter(
					(v) =>
						v.code === 'FORBIDDEN_TOKEN' &&
						JSON.stringify(v).toLowerCase().includes('style:')
				);
				expect(styleTokenViolations).toHaveLength(0);
			}
		});
	});

	describe('alignment phrase detection', () => {
		it('detects missing center alignment phrase', async () => {
			const centerSpec = { ...baseSpec, alignment: 'center' as const };
			const prompt = buildValidPrompt(baseSpec); // Uses left-align
			const result = await driftDetectionAdapter.detect({
				spec: centerSpec,
				promptSent: prompt
			});
			if (result.ok) {
				const alignmentViolations = result.value.violations.filter(
					(v) => v.code === 'MISSING_ALIGNMENT_PHRASE'
				);
				expect(alignmentViolations.length).toBeGreaterThan(0);
			}
		});
	});

	describe('confidence score', () => {
		it('returns confidence score between 0 and 1', async () => {
			const validPrompt = buildValidPrompt(baseSpec);
			const result = await driftDetectionAdapter.detect({
				spec: baseSpec,
				promptSent: validPrompt
			});
			if (result.ok) {
				expect(result.value.confidenceScore).toBeGreaterThanOrEqual(0);
				expect(result.value.confidenceScore).toBeLessThanOrEqual(1);
			}
		});

		it('decreases confidence with more violations', async () => {
			const sparsePrompt = PROMPT_REQUIRED_HEADINGS.join('\n');
			const result = await driftDetectionAdapter.detect({
				spec: baseSpec,
				promptSent: sparsePrompt
			});
			if (result.ok) {
				expect(result.value.confidenceScore).toBeLessThan(1);
				expect(result.value.violations.length).toBeGreaterThan(0);
			}
		});
	});

	describe('recommended fixes', () => {
		it('includes one fix for each violation', async () => {
			const sparsePrompt = PROMPT_REQUIRED_HEADINGS.join('\n');
			const result = await driftDetectionAdapter.detect({
				spec: baseSpec,
				promptSent: sparsePrompt
			});
			if (result.ok) {
				expect(result.value.recommendedFixes.length).toBe(result.value.violations.length);
			}
		});
	});

	describe('dedication line detection', () => {
		it('detects missing dedication line when spec has dedication', async () => {
			const specWithDedication = { ...baseSpec, dedication: 'For my daughter' };
			const prompt = buildValidPrompt(baseSpec); // No dedication line
			const result = await driftDetectionAdapter.detect({
				spec: specWithDedication,
				promptSent: prompt
			});
			if (result.ok) {
				const dedicationViolations = result.value.violations.filter(
					(v) => v.code === 'MISSING_OPTION_LINE' && v.message.toLowerCase().includes('dedicat')
				);
				expect(dedicationViolations.length).toBeGreaterThan(0);
			}
		});
	});

	describe('page size detection', () => {
		it('detects missing page size for A4', async () => {
			const a4Spec = { ...baseSpec, pageSize: 'A4' as const };
			const prompt = buildValidPrompt(baseSpec); // Has US_Letter page size
			const result = await driftDetectionAdapter.detect({
				spec: a4Spec,
				promptSent: prompt
			});
			if (result.ok) {
				const pageSizeViolations = result.value.violations.filter(
					(v) => v.code === 'MISSING_PAGE_SIZE'
				);
				expect(pageSizeViolations.length).toBeGreaterThan(0);
			}
		});
	});
});
