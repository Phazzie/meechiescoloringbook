// Purpose: Adapter implementation for DriftDetectionSeam.
// Why: Enforce required phrases and detect prompt drift deterministically.
// Info flow: Prompt input -> violations/fixes -> enforcement output.
import type {
	DriftDetectionInput,
	DriftDetectionOutput,
	DriftDetectionSeam
} from '../../../contracts/drift-detection.contract';
import type { Result } from '../../../contracts/shared.contract';
import { formatAlignmentLine } from '$lib/utils/alignment-line';

const REQUIRED_HEADINGS = [
	'STYLE:',
	'TEXT (exact):',
	'TYPOGRAPHY:',
	'LAYOUT:',
	'DECORATIONS:',
	'OUTPUT:',
	'NEGATIVE PROMPT:'
];

const REQUIRED_PHRASES = [
	'Black-and-white coloring book page',
	'outline-only',
	'easy to color',
	'Crisp vector-like linework',
	'NEGATIVE PROMPT:'
];

const FORBIDDEN_TOKENS = ['size:', 'quality:', 'style:'];

const allowedHeadingSet = new Set(REQUIRED_HEADINGS);

const findMissingHeading = (prompt: string): string | null => {
	for (const heading of REQUIRED_HEADINGS) {
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
	const startIndex = lines.findIndex((line) => line.trim() === 'NEGATIVE PROMPT:');
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
	return FORBIDDEN_TOKENS.filter((token) => lowered.includes(token));
};

const formatListItems = (items: Array<{ number: number; label: string }>): string => {
	const parts = items.map((item) => `${item.number}. ${item.label}`);
	return parts.join('; ');
};

const pageSizeLine = (pageSize: DriftDetectionInput['spec']['pageSize']): string =>
	pageSize === 'A4' ? 'A4 8.27x11.69 portrait.' : 'US Letter 8.5x11 portrait.';

const listLineForSpec = (spec: DriftDetectionInput['spec']): string =>
	spec.listMode === 'list'
		? `List items: ${formatListItems(spec.items)} (Gutter: ${spec.listGutter}).`
		: 'No list.';

const colorModeLine = (spec: DriftDetectionInput['spec']): string => {
	switch (spec.colorMode) {
		case 'grayscale':
			return 'Color: grayscale.';
		case 'color':
			return 'Color: color.';
		default:
			return 'Color: black and white only.';
	}
};

const fontStyleLine = (spec: DriftDetectionInput['spec']): string => `Font: ${spec.fontStyle}.`;

const textStrokeLine = (spec: DriftDetectionInput['spec']): string =>
	`Stroke: ${spec.textStrokeWidth}px.`;

const decorationLine = (spec: DriftDetectionInput['spec']): string => {
	switch (spec.decorations) {
		case 'minimal':
			return 'Decorations: minimal outline icons.';
		case 'dense':
			return 'Decorations: dense outline icons.';
		default:
			return 'Decorations: none.';
	}
};

const illustrationLine = (spec: DriftDetectionInput['spec']): string => {
	switch (spec.illustrations) {
		case 'simple':
			return 'Illustrations: simple outlines.';
		case 'scene':
			return 'Illustrations: scene outlines.';
		default:
			return 'Illustrations: none.';
	}
};

const shadingLine = (spec: DriftDetectionInput['spec']): string => {
	switch (spec.shading) {
		case 'hatch':
			return 'Shading: hatch.';
		case 'stippling':
			return 'Shading: stippling.';
		default:
			return 'Shading: none.';
	}
};

const borderLine = (spec: DriftDetectionInput['spec']): string => {
	switch (spec.border) {
		case 'decorative':
			return `Border: decorative ${spec.borderThickness}px.`;
		case 'none':
			return 'Border: none.';
		default:
			return `Border: plain ${spec.borderThickness}px.`;
	}
};

const outputLine = (spec: DriftDetectionInput['spec']): string => {
	switch (spec.colorMode) {
		case 'grayscale':
			return 'Crisp vector-like linework. Grayscale outlines on white. Printable.';
		case 'color':
			return 'Crisp vector-like linework. Colored outlines on white. Printable.';
		default:
			return 'Crisp vector-like linework. Black outlines on white. Printable.';
	}
};

const dedicationLine = (spec: DriftDetectionInput['spec']): string =>
	spec.dedication ? `Add dedication: "Dedicated to ${spec.dedication}".` : '';

const negativeLinesForSpec = (spec: DriftDetectionInput['spec']): string[] => {
	const lines: string[] = [];
	if (spec.colorMode !== 'color') {
		lines.push('no color');
	}
	if (spec.colorMode === 'black_and_white_only') {
		lines.push('no grayscale');
	}
	if (spec.shading === 'none') {
		lines.push('no shading');
	}
	return lines.concat(['no gradients', 'no filled shapes', 'no extra words']);
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
			colorModeLine(input.spec),
			listLineForSpec(input.spec),
			fontStyleLine(input.spec),
			textStrokeLine(input.spec),
			decorationLine(input.spec),
			illustrationLine(input.spec),
			shadingLine(input.spec),
			borderLine(input.spec),
			outputLine(input.spec),
			...(input.spec.dedication ? [dedicationLine(input.spec)] : [])
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
