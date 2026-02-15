// Purpose: Adapter implementation for DriftDetectionSeam.
// Why: Enforce required phrases and detect prompt drift deterministically.
// Info flow: Prompt input -> violations/fixes -> enforcement output.
import type {
	DriftDetectionInput,
	DriftDetectionOutput,
	DriftDetectionSeam
} from '../../../contracts/drift-detection.contract';
import type { Result } from '../../../contracts/shared.contract';
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import {
	NEGATIVE_PROMPT_HEADING,
	PROMPT_FORBIDDEN_TOKENS,
	PROMPT_REQUIRED_HEADINGS,
	borderLine,
	colorModeLine,
	dedicationLine,
	decorationLine,
	fontStyleLine,
	listLineForSpec,
	negativeLinesForSpec,
	outputLine,
	pageSizeLine,
	shadingLine,
	illustrationLine,
	textStrokeLine
} from '$lib/core/prompt-template';
import { formatAlignmentLine } from '$lib/utils/alignment-line';

const REQUIRED_PHRASES = [...SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES];
const allowedHeadingSet = new Set(PROMPT_REQUIRED_HEADINGS);

const findMissingHeading = (prompt: string): string | null => {
	for (const heading of PROMPT_REQUIRED_HEADINGS) {
		if (!prompt.includes(heading)) {
			return heading;
		}
	}
	return null;
};

const detectExtraHeadings = (lines: string[]): string[] => {
	return lines
		.map((line) => line.trim())
		.filter((line) => /^[A-Z][A-Z ()-]*:$/.test(line))
		.filter((line) => !allowedHeadingSet.has(line));
};

const extractNegativeSectionLines = (lines: string[]): string[] => {
	const startIndex = lines.findIndex((line) => line.trim() === NEGATIVE_PROMPT_HEADING);
	if (startIndex === -1) {
		return [];
	}
	const sectionLines: string[] = [];
	for (let i = startIndex + 1; i < lines.length; i += 1) {
		const trimmed = lines[i].trim();
		if (/^[A-Z][A-Z ()-]*:$/.test(trimmed)) {
			break;
		}
		if (trimmed.length > 0) {
			sectionLines.push(trimmed);
		}
	}
	return sectionLines;
};

const detectMissingRequiredLines = (lines: string[], required: string[]): string[] =>
	required.filter((line) => !lines.includes(line));

const detectForbiddenTokens = (prompt: string): string[] => {
	const lines = prompt.split('\n');
	const sanitizedLines = lines.filter((line) => {
		const trimmed = line.trim().toLowerCase();
		if (trimmed === 'style:') {
			return false;
		}
		if (trimmed.startsWith('font style:')) {
			return false;
		}
		return true;
	});
	const lowered = sanitizedLines.join('\n').toLowerCase();
	return PROMPT_FORBIDDEN_TOKENS.filter((token) => lowered.includes(token));
};

export const driftDetectionAdapter: DriftDetectionSeam = {
	detect: async (input: DriftDetectionInput): Promise<Result<DriftDetectionOutput>> => {
		const prompt = input.revisedPrompt && input.revisedPrompt.length > 0 ? input.revisedPrompt : input.promptSent;
		const missingHeading = findMissingHeading(prompt);
		if (missingHeading) {
			return {
				ok: false,
				error: {
					code: 'MISSING_REQUIRED_SECTION',
					message: `Required section missing: ${missingHeading}`
				}
			};
		}

		const lines = prompt.split('\n');
		const violations: DriftDetectionOutput['violations'] = [];
		const recommendedFixes: DriftDetectionOutput['recommendedFixes'] = [];

		const alignmentPhrase = input.spec.alignment === 'center' ? 'Center the quote.' : 'Left-align the quote.';
		if (!prompt.includes(alignmentPhrase)) {
			violations.push({
				code: 'MISSING_ALIGNMENT_PHRASE',
				message: `Alignment phrase missing: ${alignmentPhrase}`,
				severity: 'error'
			});
			recommendedFixes.push({
				code: 'ADD_ALIGNMENT_PHRASE',
				message: `Add alignment phrase: ${alignmentPhrase}`
			});
		}

		const expectedPageSize = pageSizeLine(input.spec.pageSize);
		if (!prompt.includes(expectedPageSize)) {
			violations.push({
				code: 'MISSING_PAGE_SIZE',
				message: `Page size line missing: ${expectedPageSize}`,
				severity: 'error'
			});
			recommendedFixes.push({
				code: 'ADD_PAGE_SIZE',
				message: `Add page size line: ${expectedPageSize}`
			});
		}

		const alignmentLine = formatAlignmentLine(input.spec);
		if (!prompt.includes(alignmentLine)) {
			violations.push({
				code: 'MISSING_ALIGNMENT_LINE',
				message: `Alignment line missing: ${alignmentLine}`,
				severity: 'error'
			});
			recommendedFixes.push({
				code: 'ADD_ALIGNMENT_LINE',
				message: `Add alignment line: ${alignmentLine}`
			});
		}

		for (const phrase of REQUIRED_PHRASES) {
			if (!prompt.includes(phrase)) {
				violations.push({
					code: 'MISSING_REQUIRED_PHRASE',
					message: `Required phrase missing: ${phrase}`,
					severity: 'error'
				});
				recommendedFixes.push({
					code: 'ADD_REQUIRED_PHRASE',
					message: `Add required phrase: ${phrase}`
				});
			}
		}

		const expectedOptionLines = [
			colorModeLine(input.spec.colorMode),
			listLineForSpec(input.spec),
			fontStyleLine(input.spec.fontStyle),
			textStrokeLine(input.spec.textStrokeWidth),
			decorationLine(input.spec.decorations),
			illustrationLine(input.spec.illustrations),
			shadingLine(input.spec.shading),
			borderLine(input.spec.border, input.spec.borderThickness),
			outputLine(input.spec.colorMode),
			...(input.spec.dedication ? [dedicationLine(input.spec.dedication)] : [])
		];

		for (const line of expectedOptionLines) {
			if (!prompt.includes(line)) {
				violations.push({
					code: 'MISSING_OPTION_LINE',
					message: `Missing option line: ${line}`,
					severity: 'error'
				});
				recommendedFixes.push({
					code: 'ADD_OPTION_LINE',
					message: `Add option line: ${line}`
				});
			}
		}

		const negativeLines = extractNegativeSectionLines(lines);
		const missingNegativeLines = detectMissingRequiredLines(negativeLines, negativeLinesForSpec(input.spec));
		for (const line of missingNegativeLines) {
			violations.push({
				code: 'MISSING_NEGATIVE_LINE',
				message: `Missing negative line: ${line}`,
				severity: 'error'
			});
			recommendedFixes.push({
				code: 'ADD_NEGATIVE_LINE',
				message: `Add negative line: ${line}`
			});
		}

		const forbiddenTokens = detectForbiddenTokens(prompt);
		for (const token of forbiddenTokens) {
			violations.push({
				code: 'FORBIDDEN_TOKEN',
				message: `Forbidden token present: ${token}`,
				severity: 'error'
			});
			recommendedFixes.push({
				code: 'REMOVE_FORBIDDEN_TOKEN',
				message: `Remove forbidden token: ${token}`
			});
		}

		const extraHeadings = detectExtraHeadings(lines);
		for (const heading of extraHeadings) {
			violations.push({
				code: 'FORBIDDEN_HEADING',
				message: `Forbidden heading present: ${heading}`,
				severity: 'warning'
			});
			recommendedFixes.push({
				code: 'REMOVE_FORBIDDEN_HEADING',
				message: `Remove heading: ${heading}`
			});
		}

		const confidenceScore = Math.max(0, 1 - violations.length / 10);

		return {
			ok: true,
			value: {
				violations,
				confidenceScore,
				recommendedFixes
			}
		};
	}
};
