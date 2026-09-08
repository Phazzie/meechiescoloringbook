// Purpose: Unit tests for `describe-page.ts`, the pure policy behind `/describe`.
// Why: This module decides what the reader is told about a page *before* they pay for it, so every
//      sentence it produces is a claim the app has to keep. Each test below fails if a claim stops
//      matching the spec it is derived from — which is the only failure mode that matters here,
//      since a wrong read-back costs a generation and is invisible until the picture arrives.
// Info flow: hand-built ColoringPageSpec values -> describe-page functions -> asserted sentences.
import { describe, expect, it } from 'vitest';
import {
	DESCRIBE_EXAMPLES,
	DESCRIBE_FILE_BASE_SLUG,
	DESCRIBE_MAX_LINES,
	DESCRIBE_MESSAGE_MAX_LENGTH,
	DESCRIBE_MESSAGE_MIN_LENGTH,
	DESCRIBE_PATH,
	canInterpretMessage,
	describeMessageProblem,
	describeReadbackQuota,
	interpretFailureSentence,
	readBackInterpretedPage,
	styleHintForSpec,
	styleSubjectFromDescription,
	summariseReadback
} from '../../src/lib/core/describe-page';
import { PROMPT_FORBIDDEN_TOKENS } from '../../src/lib/core/prompt-template';
import { MAX_TOOL_PAGE_ITEMS } from '../../src/lib/core/tool-page-recipe';
import {
	ColoringPageSpecSchema,
	MAX_SPEC_ITEMS
} from '../../contracts/spec-validation.contract';
import { GenerateRequestSchema } from '../../contracts/generate.contract';
import type { ColoringPageSpec } from '../../contracts/spec-validation.contract';
import type { AiQuotaSnapshot } from '../../src/lib/core/ai-quota';

/**
 * A spec built through the contract's own parser rather than by hand.
 *
 * The read-back's whole promise is that it describes the object `/api/generate` is about to be
 * given, so a fixture that never passed `ColoringPageSpecSchema` would let a test assert about a
 * page this app would refuse to make.
 */
const spec = (overrides: Partial<ColoringPageSpec> = {}): ColoringPageSpec =>
	ColoringPageSpecSchema.parse({
		title: 'Things I Am Not Doing Again',
		items: [
			{ number: 1, label: 'Explaining myself twice' },
			{ number: 2, label: 'Waiting on a text back' }
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
		pageSize: 'US_Letter',
		...overrides
	});

describe('the surface constants', () => {
	it('names one path, which the nav imports rather than retypes', () => {
		expect(DESCRIBE_PATH).toBe('/describe');
		expect(DESCRIBE_FILE_BASE_SLUG).toBe('described');
	});

	it('restates the spec contract cap rather than a second number of its own', () => {
		expect(DESCRIBE_MAX_LINES).toBe(MAX_SPEC_ITEMS);
	});

	it('offers examples as suggestions, all of them within the limit it enforces', () => {
		expect(DESCRIBE_EXAMPLES.length).toBeGreaterThan(0);
		for (const example of DESCRIBE_EXAMPLES) {
			expect(canInterpretMessage(example)).toBe(true);
		}
	});
});

describe('describeMessageProblem', () => {
	it('says nothing about a field nobody has typed in yet', () => {
		expect(describeMessageProblem('')).toBe('');
		expect(describeMessageProblem('   ')).toBe('');
	});

	it('refuses a message too short to be worth a paid call', () => {
		const problem = describeMessageProblem('hi');
		expect(problem).not.toBe('');
		expect(canInterpretMessage('hi')).toBe(false);
	});

	it('accepts a message exactly at the minimum, which is the boundary the button uses', () => {
		const atMinimum = 'a'.repeat(DESCRIBE_MESSAGE_MIN_LENGTH);
		expect(describeMessageProblem(atMinimum)).toBe('');
		expect(canInterpretMessage(atMinimum)).toBe(true);
	});

	it('refuses a message past the cap, and says how long it actually is', () => {
		const tooLong = 'a'.repeat(DESCRIBE_MESSAGE_MAX_LENGTH + 1);
		expect(describeMessageProblem(tooLong)).toContain(
			String(DESCRIBE_MESSAGE_MAX_LENGTH + 1)
		);
		expect(canInterpretMessage(tooLong)).toBe(false);
	});

	it('measures the trimmed message, so trailing whitespace cannot fail a valid sentence', () => {
		const atCap = 'a'.repeat(DESCRIBE_MESSAGE_MAX_LENGTH);
		expect(canInterpretMessage(`  ${atCap}  `)).toBe(true);
	});

	it('never reports an empty field as sendable', () => {
		expect(canInterpretMessage('')).toBe(false);
		expect(canInterpretMessage('    ')).toBe(false);
	});
});

describe('interpretFailureSentence', () => {
	it('turns each contract error code into something the reader can act on', () => {
		expect(
			interpretFailureSentence({
				code: 'CHAT_INPUT_INVALID',
				message: 'Chat interpretation input is invalid.'
			})
		).toContain('sentence or two');
		expect(
			interpretFailureSentence({
				code: 'CHAT_RESPONSE_INVALID',
				message: 'Chat response did not include JSON.'
			})
		).toContain('not a page');
		expect(
			interpretFailureSentence({
				code: 'CHAT_ABORTED',
				message: 'cancelled'
			})
		).toContain('cancelled');
	});

	it('keeps the validation issue on CHAT_SPEC_INVALID, because it names the field', () => {
		expect(
			interpretFailureSentence({
				code: 'CHAT_SPEC_INVALID',
				message: 'Title exceeds the maximum length.'
			})
		).toContain('Title exceeds the maximum length.');
	});

	it('explains a quota refusal without repeating the log message', () => {
		expect(
			interpretFailureSentence({ code: 'RATE_LIMITED', message: 'Too many requests.' })
		).toContain("desk is full");
		expect(
			interpretFailureSentence({
				code: 'RATE_LIMIT_UNAVAILABLE',
				message: 'store unreachable'
			})
		).toContain('quota service');
	});

	it('repeats the server message for a code it has not been taught', () => {
		// A generic apology here would hide a real, new failure. Preferring the server's own words
		// is the honest default, and this test is what stops that from being "improved" away.
		expect(
			interpretFailureSentence({
				code: 'SOMETHING_NEW',
				message: 'The provider is on fire.'
			})
		).toBe('The provider is on fire.');
	});
});

describe('readBackInterpretedPage', () => {
	it('reads back the exact words that will print, in order', () => {
		const readback = readBackInterpretedPage(spec());
		expect(readback.title).toBe('Things I Am Not Doing Again');
		expect(readback.lines.map((line) => line.label)).toEqual([
			'Explaining myself twice',
			'Waiting on a text back'
		]);
		expect(readback.lines.every((line) => !line.isSecondLine)).toBe(true);
	});

	it('shows the footer item where the prompt actually draws it: second, unnumbered', () => {
		// `prompt-assembly-seam` L55 and L83-85 use `footerItem.label` as the unnumbered second line
		// directly under the headline, and never use `footerItem.number` at all. Showing it numbered
		// at the bottom would have the reader approve a layout the paid generation never draws.
		const readback = readBackInterpretedPage(
			spec({ footerItem: { number: 97, label: 'You' } })
		);
		expect(readback.lines).toHaveLength(3);
		expect(readback.lines[0]).toEqual({
			number: null,
			label: 'You',
			isSecondLine: true
		});
		expect(readback.lines.slice(1).map((line) => line.label)).toEqual([
			'Explaining myself twice',
			'Waiting on a text back'
		]);
	});

	it('never shows a number the prompt does not print', () => {
		const readback = readBackInterpretedPage(
			spec({ footerItem: { number: 97, label: 'You' } })
		);
		expect(readback.lines.filter((line) => line.number === 97)).toEqual([]);
	});

	it('counts the footer in the summary, because the reader is checking the sheet', () => {
		// `spec.items.length` is 2 here and the sheet carries 3 lines. Summarising from the former
		// would undercount exactly the line a reader is most likely to have not asked for.
		expect(
			summariseReadback(
				readBackInterpretedPage(spec({ footerItem: { number: 97, label: 'You' } }))
			)
		).toContain('3 lines');
	});

	it('says so when the page is the headline and nothing else', () => {
		const readback = readBackInterpretedPage(
			spec({ listMode: 'title_only', items: [] })
		);
		expect(readback.lines).toHaveLength(0);
		expect(summariseReadback(readback)).toContain('just the headline');
		expect(readback.cautions.join(' ')).toContain('title-only');
	});

	it('names the paper, the border and the lettering', () => {
		const facts = readBackInterpretedPage(
			spec({ pageSize: 'A4', border: 'decorative', textSize: 'large' })
		).facts;
		expect(facts.join(' ')).toContain('A4');
		expect(facts.join(' ')).toContain('decorative border');
		expect(facts.join(' ')).toContain('Large lettering');
	});

	it('drops the decoration fact rather than printing an empty one', () => {
		const facts = readBackInterpretedPage(spec({ decorations: 'none' })).facts;
		expect(facts.every((fact) => fact.length > 0)).toBe(true);
	});

	it('warns when the list is longer than the rest of the app will put on a sheet', () => {
		const many = Array.from({ length: MAX_TOOL_PAGE_ITEMS + 2 }, (_, index) => ({
			number: index + 1,
			label: `Line ${index + 1}`
		}));
		const readback = readBackInterpretedPage(spec({ items: many }));
		expect(readback.cautions.join(' ')).toContain(String(many.length));
		// A caution, never a refusal: the page is still offered.
		expect(readback.lines).toHaveLength(many.length);
	});

	it('does not warn about a list the app would print anyway', () => {
		const exactly = Array.from({ length: MAX_TOOL_PAGE_ITEMS }, (_, index) => ({
			number: index + 1,
			label: `Line ${index + 1}`
		}));
		expect(readBackInterpretedPage(spec({ items: exactly })).cautions).toEqual([]);
	});

	it('warns when the page asked for is not one you colour in', () => {
		expect(
			readBackInterpretedPage(spec({ colorMode: 'color' })).cautions.join(' ')
		).toContain('already coloured in');
	});

	it('says how many pictures will be made and charged for', () => {
		const readback = readBackInterpretedPage(spec({ variations: 3 }));
		expect(readback.pictureCount).toBe(3);
		expect(readback.cautions.join(' ')).toContain('3 pictures');
	});

	it('says nothing about picture count for the ordinary single-picture page', () => {
		expect(readBackInterpretedPage(spec()).cautions).toEqual([]);
	});
});

describe('styleSubjectFromDescription', () => {
	it('strips every colon, which is what makes a forbidden token impossible', () => {
		// `PROMPT_FORBIDDEN_TOKENS` is ['size:', 'quality:', 'style:'] and every reserved heading
		// ends in a colon, so "no colon" proves "no forbidden token" without a blocklist a new
		// token could slip past. A reader who writes "style: gothic" would otherwise fail their own
		// generation at the assembly seam.
		const subject = styleSubjectFromDescription('style: gothic, size: big, quality: high');
		expect(subject).not.toContain(':');
		for (const token of PROMPT_FORBIDDEN_TOKENS) {
			expect(subject.toLowerCase()).not.toContain(token);
		}
	});

	it('turns structural characters into spaces rather than deleting them', () => {
		expect(styleSubjectFromDescription('roses/thorns\nand\tcrowns')).toBe(
			'roses thorns and crowns'
		);
	});

	it('caps the length, so one field cannot dominate the prompt', () => {
		expect(styleSubjectFromDescription('a'.repeat(500)).length).toBeLessThanOrEqual(160);
	});

	it('returns nothing for a description with nothing usable in it', () => {
		expect(styleSubjectFromDescription('　::: ')).toBe('');
	});
});

describe('styleHintForSpec', () => {
	it('carries the subject the reader asked for, which the spec has no field for', () => {
		// The finding this answers: `ColoringPageSpec` can hold `illustrations: 'simple'` and
		// nothing that says "roses", so a hint built from the spec alone silently drops the one
		// thing the reader actually asked for.
		const hint = styleHintForSpec(
			spec({ illustrations: 'simple' }),
			'a page that says no more, with roses around the edge'
		);
		expect(hint).toContain('roses around the edge');
		expect(hint).toContain('without lettering any of these words');
	});

	it('leaves the derived hint standing when there is no usable description', () => {
		const derived = styleHintForSpec(spec());
		expect(styleHintForSpec(spec(), '   ')).toBe(derived);
		expect(derived).not.toContain('without lettering');
	});

	it('never emits a colon, whatever the reader typed', () => {
		const hint = styleHintForSpec(spec(), 'style: gothic and quality: high');
		expect(hint).not.toContain(':');
	});

	it('always returns a hint the generate contract will accept', () => {
		// `styleHint` is an optional *non-empty* string, so an empty hint would have to be omitted
		// rather than sent. Every combination must clear that bar.
		for (const illustrations of ['none', 'simple', 'scene'] as const) {
			for (const decorations of ['none', 'minimal', 'dense'] as const) {
				const hint = styleHintForSpec(spec({ illustrations, decorations }));
				expect(
					GenerateRequestSchema.safeParse({
						spec: spec({ illustrations, decorations }),
						styleHint: hint
					}).success
				).toBe(true);
			}
		}
	});

	it('reads the interpreted drawing fields rather than the reader’s sentence', () => {
		const hint = styleHintForSpec(
			spec({ illustrations: 'scene', decorations: 'dense', border: 'decorative' })
		);
		expect(hint).toContain('full drawn scene');
		expect(hint).toContain('dense decoration');
		expect(hint).toContain('ornate drawn border');
	});

	it('names shading only when the spec asks for it', () => {
		expect(styleHintForSpec(spec())).not.toContain('shading');
		expect(
			styleHintForSpec(spec({ shading: 'hatch', decorations: 'minimal' }))
		).toContain('hatched shading');
	});
});

describe('describeReadbackQuota', () => {
	const at = (remaining: number): AiQuotaSnapshot => ({
		limit: 20,
		remaining,
		resetAtMs: 1_000,
		exhausted: false
	});
	const formatTime = (): string => '14:32';

	it('says nothing before the server has reported a quota', () => {
		expect(describeReadbackQuota(null, formatTime)).toBe('');
	});

	it('prices a read-back at one unit, not at the studio rewrite cost', () => {
		// The bug this guards: dividing by the studio's two-unit cost would have told a reader with
		// five units left that they had two read-backs, when they have five.
		expect(describeReadbackQuota(at(5), formatTime)).toContain('5 read-backs');
	});

	it('names what it is counting, so two surfaces reading one bucket cannot look contradictory', () => {
		expect(describeReadbackQuota(at(1), formatTime)).toContain('1 read-back left');
	});

	it('reports an empty bucket as full desk rather than as zero read-backs', () => {
		expect(describeReadbackQuota(at(0), formatTime)).toContain('desk is full');
	});
});
