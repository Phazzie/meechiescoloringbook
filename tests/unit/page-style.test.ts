/*
 * Purpose: Verify the Page Controls' style selection — its encoding, its comparison, and that every
 *          value the panel can display has words to display.
 * Why: The style hint is the page's whole art direction and the input the decoration density is
 *      derived from. An encoding change nothing notices restyles every page the studio makes.
 * Info flow: StyleSelection -> buildStyleHint -> `Vibe:` line; StyleSelection -> panel prose.
 *
 * Critical invariants, both about not writing a test that agrees with itself:
 *
 *   1. Every expected `Vibe:` string below is written out literally. Rebuilding an expectation from
 *      the same pieces the subject assembles it from would make an encoding change pass, which is
 *      the one change this file exists to catch — it would restyle every page the studio makes and
 *      nothing else in the suite would notice.
 *   2. Option coverage is driven from the seam schemas (`MeechieStudioVoiceSettingsSchema`,
 *      `PageSizeSchema`, `BorderStyleSchema`) rather than from a list typed here. A value added to
 *      a contract must arrive in this file as a *failure* about missing prose, not as a silence.
 *      A hand-kept list would go stale on exactly the change that needs catching.
 */
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STYLE_SELECTION,
	INTENSITY_HELP,
	INTENSITY_LABELS,
	INTENSITY_OPTIONS,
	RAWNESS_HELP,
	RAWNESS_LABELS,
	RAWNESS_OPTIONS,
	THIRD_PERSON_HELP,
	THIRD_PERSON_LABELS,
	THIRD_PERSON_OPTIONS,
	ROOM_TO_COLOUR_HELP,
	ROOM_TO_COLOUR_LABELS,
	ROOM_TO_COLOUR_OPTIONS,
	LINE_WEIGHT_HELP,
	LINE_WEIGHT_LABELS,
	LINE_WEIGHT_OPTIONS,
	LETTER_SHAPE_HELP,
	LETTER_SHAPE_LABELS,
	LETTER_SHAPE_OPTIONS,
	TEXT_SIZE_HELP,
	TEXT_SIZE_LABELS,
	TEXT_SIZE_OPTIONS,
	DEFAULT_PAGE_LOOK,
	applyPageLook,
	describeLetterShape,
	describeLineWeight,
	describeRoomToColour,
	summarizePageLook,
	buildStyleHint,
	isSameStyleSelection,
	summarizePageControls,
	summarizePaperSelection,
	summarizeStyleSelection,
	themeForSelection,
	type PaperSelection,
	type StyleSelection
} from '$lib/core/page-style';
import {
	STUDIO_DEFAULT_PAGE_LOOK,
	derivesDenseDecorations,
	studioThemes
} from '$lib/core/meechie-studio';
import { TOOL_PAGE_FONT_STYLE, TOOL_PAGE_STROKE_WIDTH } from '$lib/core/tool-page-recipe';
import { MeechieStudioVoiceSettingsSchema } from '$lib/seams/meechie-studio-text-seam/contract';
import {
	BorderStyleSchema,
	ColoringPageSpecSchema,
	FontStyleSchema,
	PageSizeSchema,
	TextSizeSchema
} from '$lib/seams/spec-validation-seam/contract';

/**
 * A spec the contract accepts, so the look tests can prove a control's values build a real page and
 * that applying one touches nothing else. Written out here rather than imported from a fixture: the
 * point is to be a whole valid spec, and a fixture that changed shape would quietly weaken that.
 */
const VALID_SPEC = {
	title: 'Dream Big',
	items: [{ number: 1, label: 'Shine' }],
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

const selection = (overrides: Partial<StyleSelection> = {}): StyleSelection => ({
	...DEFAULT_STYLE_SELECTION,
	voice: { ...DEFAULT_STYLE_SELECTION.voice },
	...overrides
});

describe('buildStyleHint', () => {
	// Pinned literally rather than rebuilt from the same pieces the implementation uses. A test that
	// composes the expectation the way the subject does passes for any composition, including a
	// wrong one — it only ever proves the subject equals itself.
	it('emits the exact hint the studio has always sent', () => {
		expect(
			buildStyleHint({
				themeId: 'receipts',
				voice: { intensity: 'no_mercy', rawness: 'raw', thirdPerson: 'always' },
				glitter: false
			})
		).toBe(
			'receipt collage, timestamp details, message screenshots as line art; no_mercy; raw; always'
		);
	});

	it('appends glitter and the wig, in that order, only when each is present', () => {
		const base = {
			themeId: 'crown-energy',
			voice: DEFAULT_STYLE_SELECTION.voice,
			glitter: false
		};

		expect(buildStyleHint(base)).toBe(
			'gold crown ornaments, royal glam outlines; receipts_out; mild; sometimes'
		);
		expect(buildStyleHint({ ...base, glitter: true })).toBe(
			'gold crown ornaments, royal glam outlines; receipts_out; mild; sometimes removable glitter overlay accents'
		);
		expect(
			buildStyleHint({ ...base, glitter: true, wig: { name: 'Honey Drip', style: 'body wave' } })
		).toBe(
			'gold crown ornaments, royal glam outlines; receipts_out; mild; sometimes removable glitter overlay accents featuring Honey Drip (body wave)'
		);
		expect(buildStyleHint({ ...base, wig: { name: 'Honey Drip', style: 'body wave' } })).toBe(
			'gold crown ornaments, royal glam outlines; receipts_out; mild; sometimes featuring Honey Drip (body wave)'
		);
	});

	it('falls back to the first theme for an id that is not a theme', () => {
		// A record can name a theme that a later release removed. Falling back keeps the page
		// buildable rather than emitting `undefined` into the provider's art direction.
		expect(buildStyleHint(selection({ themeId: 'a-theme-that-was-deleted' }))).toBe(
			buildStyleHint(selection({ themeId: studioThemes[0].id }))
		);
		expect(themeForSelection(selection({ themeId: 'nope' }))).toBe(studioThemes[0]);
	});

	it('produces a distinct hint for every theme', () => {
		const hints = studioThemes.map((theme) => buildStyleHint(selection({ themeId: theme.id })));
		expect(new Set(hints).size).toBe(studioThemes.length);
	});

	// The density derivation reads this string back. These two are the reason the encoder lives
	// alone: whether a page comes out dense is decided by whether the word `receipt` survives into
	// the hint, and both the theme and the intensity can put it there.
	it('drives the decoration derivation through the theme and the intensity alike', () => {
		expect(
			derivesDenseDecorations(
				buildStyleHint(selection({ themeId: 'receipts', voice: { ...DEFAULT_STYLE_SELECTION.voice, intensity: 'no_mercy' } }))
			)
		).toBe(true);
		expect(
			derivesDenseDecorations(
				buildStyleHint(selection({ themeId: 'crown-energy' }))
			)
		).toBe(true);
		expect(
			derivesDenseDecorations(
				buildStyleHint(
					selection({
						themeId: 'crown-energy',
						voice: { ...DEFAULT_STYLE_SELECTION.voice, intensity: 'no_mercy' }
					})
				)
			)
		).toBe(false);
	});
});

describe('isSameStyleSelection', () => {
	it('is true for equal selections and false for any single field differing', () => {
		expect(isSameStyleSelection(selection(), selection())).toBe(true);
		expect(isSameStyleSelection(selection(), selection({ themeId: 'receipts' }))).toBe(false);
		expect(isSameStyleSelection(selection(), selection({ glitter: true }))).toBe(false);
		expect(
			isSameStyleSelection(
				selection(),
				selection({ voice: { ...DEFAULT_STYLE_SELECTION.voice, rawness: 'raw' } })
			)
		).toBe(false);
		expect(
			isSameStyleSelection(selection(), selection({ wig: { name: 'A', style: 'bob' } }))
		).toBe(false);
		expect(
			isSameStyleSelection(
				selection({ wig: { name: 'A', style: 'bob' } }),
				selection({ wig: { name: 'A', style: 'pixie' } })
			)
		).toBe(false);
	});

	it('separates two unknown theme ids that encode to the same hint', () => {
		// The reason this compares fields instead of comparing two built hints: both of these fall
		// back to the same theme, so their hints are identical while the choices are not — and the
		// panel displays the choice.
		const a = selection({ themeId: 'gone-one' });
		const b = selection({ themeId: 'gone-two' });
		expect(buildStyleHint(a)).toBe(buildStyleHint(b));
		expect(isSameStyleSelection(a, b)).toBe(false);
	});
});

describe('the panel prose is total over the seam enums', () => {
	// Driven off the schema rather than a restated list, so a value added to the voice contract
	// fails here instead of rendering a blank line under a dropdown.
	const cases = [
		['intensity', MeechieStudioVoiceSettingsSchema.shape.intensity.options, INTENSITY_OPTIONS, INTENSITY_LABELS, INTENSITY_HELP],
		['rawness', MeechieStudioVoiceSettingsSchema.shape.rawness.options, RAWNESS_OPTIONS, RAWNESS_LABELS, RAWNESS_HELP],
		['thirdPerson', MeechieStudioVoiceSettingsSchema.shape.thirdPerson.options, THIRD_PERSON_OPTIONS, THIRD_PERSON_LABELS, THIRD_PERSON_HELP]
	] as const;

	it.each(cases)('%s offers, labels and explains every value', (_field, schemaOptions, options, labels, help) => {
		expect([...options]).toEqual([...schemaOptions]);
		for (const value of schemaOptions) {
			expect(labels[value as keyof typeof labels]).toBeTruthy();
			expect(help[value as keyof typeof help]).toBeTruthy();
		}
		expect(Object.keys(labels).sort()).toEqual([...schemaOptions].sort());
		expect(Object.keys(help).sort()).toEqual([...schemaOptions].sort());
	});

	it('gives every theme a label and a hint', () => {
		for (const theme of studioThemes) {
			expect(theme.label.trim()).toBeTruthy();
			expect(theme.styleHint.trim()).toBeTruthy();
		}
	});
});

describe('summarizeStyleSelection', () => {
	it('names every voice control of the current selection', () => {
		expect(summarizeStyleSelection(selection())).toBe(
			'Crown Energy · Receipts Out · Mild · sometimes in third person'
		);
	});

	it('names glitter and the wig only when they are on', () => {
		expect(summarizeStyleSelection(selection({ glitter: true }))).toBe(
			'Crown Energy · Receipts Out · Mild · sometimes in third person · glitter'
		);
		expect(summarizeStyleSelection(selection())).not.toContain('glitter');
		expect(
			summarizeStyleSelection(selection({ wig: { name: 'Honey Drip', style: 'body wave' } }))
		).toBe('Crown Energy · Receipts Out · Mild · sometimes in third person · Honey Drip');
	});

	// The defect this pins: the summary named four of the panel's seven controls, so a reader who
	// changed Third Person and shut the panel watched the line they had just changed stay put.
	it('moves when any one control moves', () => {
		const paper: PaperSelection = { pageSize: 'US_Letter', border: 'decorative' };
		const look = {
			textSize: 'small',
			whitespaceScale: 50,
			textStrokeWidth: 6,
			fontStyle: 'rounded'
		} as const;
		const base = summarizePageControls(summarizeStyleSelection(selection()), paper, look);
		const moved = [
			summarizePageControls(
				summarizeStyleSelection(
					selection({ voice: { ...DEFAULT_STYLE_SELECTION.voice, thirdPerson: 'always' } })
				),
				paper,
				look
			),
			summarizePageControls(summarizeStyleSelection(selection()), { ...paper, pageSize: 'A4' }, look),
			summarizePageControls(summarizeStyleSelection(selection()), { ...paper, border: 'none' }, look),
			// The four controls the panel gained. Added to this test rather than tested apart,
			// because the defect it pins is a summary that does not follow a control the panel
			// holds, and it holds these now.
			summarizePageControls(summarizeStyleSelection(selection()), paper, {
				...look,
				textSize: 'large'
			}),
			summarizePageControls(summarizeStyleSelection(selection()), paper, {
				...look,
				whitespaceScale: 75
			}),
			summarizePageControls(summarizeStyleSelection(selection()), paper, {
				...look,
				textStrokeWidth: 12
			}),
			summarizePageControls(summarizeStyleSelection(selection()), paper, {
				...look,
				fontStyle: 'block'
			})
		];
		for (const summary of moved) {
			expect(summary).not.toBe(base);
		}
	});

	it('summarizes every selection the panel can hold without an empty segment', () => {
		for (const theme of studioThemes) {
			for (const intensity of INTENSITY_OPTIONS) {
				for (const rawness of RAWNESS_OPTIONS) {
					for (const thirdPerson of THIRD_PERSON_OPTIONS) {
						const summary = summarizeStyleSelection(
							selection({
								themeId: theme.id,
								voice: { intensity, rawness, thirdPerson }
							})
						);
						expect(summary.split(' · ').every((part) => part.trim().length > 0)).toBe(true);
					}
				}
			}
		}
	});
});

describe('summarizePageControls', () => {
	// Every paper the spec contract allows, driven off the schema rather than a list retyped here,
	// so a page size or border added to the contract fails this instead of rendering `undefined`
	// into the one line a shut panel shows.
	const pageSizes = PageSizeSchema.options;
	const borders = BorderStyleSchema.options;

	it('names both paper controls for every value the spec allows', () => {
		for (const pageSize of pageSizes) {
			for (const border of borders) {
				const summary = summarizePaperSelection({ pageSize, border });
				expect(summary.split(' · ')).toHaveLength(2);
				expect(summary).not.toContain('undefined');
				expect(summary.split(' · ').every((part) => part.trim().length > 0)).toBe(true);
			}
		}
	});

	it('reads as one line: the style, then the paper, then the look', () => {
		expect(
			summarizePageControls(
				summarizeStyleSelection(selection()),
				{ pageSize: 'US_Letter', border: 'decorative' },
				{ textSize: 'small', whitespaceScale: 50, textStrokeWidth: 6, fontStyle: 'rounded' }
			)
		).toBe(
			'Crown Energy · Receipts Out · Mild · sometimes in third person · US Letter · decorative border · small bubble lettering · balanced · standard lines'
		);
	});

	// A reopened page written before styles were stored has no style to name, and its paper is the
	// half that *is* on file — so the substitute sentence must not take the paper down with it.
	it('still names the paper and the look when the style is not on file', () => {
		expect(
			summarizePageControls(
				"This page's style is not on file",
				{ pageSize: 'A4', border: 'none' },
				{ textSize: 'large', whitespaceScale: 35, textStrokeWidth: 9, fontStyle: 'block' }
			)
		).toBe(
			"This page's style is not on file · A4 · no border · large block lettering · 35% blank · bold lines"
		);
	});
});

/*
 * The four controls that decide what a printed sheet's words look like and whether it can actually
 * be coloured.
 *
 * Option coverage is driven off `TextSizeSchema` for the same reason the voice tables are driven off
 * their schema: a value added to the contract must arrive here as a failure about missing prose,
 * never as a silence that renders a blank line under a dropdown.
 */
describe('the page-look controls', () => {
	it('has a label and a help line for every text size the contract allows', () => {
		for (const value of TextSizeSchema.options) {
			expect(TEXT_SIZE_LABELS[value]?.trim().length).toBeGreaterThan(0);
			expect(TEXT_SIZE_HELP[value]?.trim().length).toBeGreaterThan(0);
		}
		expect([...TEXT_SIZE_OPTIONS].sort()).toEqual([...TextSizeSchema.options].sort());
	});

	it('has a label and a help line for every blank-space step it offers', () => {
		for (const value of ROOM_TO_COLOUR_OPTIONS) {
			expect(ROOM_TO_COLOUR_LABELS[value]?.trim().length).toBeGreaterThan(0);
			expect(ROOM_TO_COLOUR_HELP[value]?.trim().length).toBeGreaterThan(0);
		}
	});

	// Every step must be a value the spec contract accepts, or the control offers a page that
	// cannot be built and the failure lands at the API boundary.
	it('offers only blank-space values the spec contract accepts', () => {
		for (const value of ROOM_TO_COLOUR_OPTIONS) {
			expect(
				ColoringPageSpecSchema.safeParse({
					...VALID_SPEC,
					whitespaceScale: value
				}).success
			).toBe(true);
		}
	});

	// A page built by the tools hub carries 35 or 45 and a reopened page can carry anything the
	// interpreter chose. Rounding those to the nearest step would report a page as something it is
	// not, so the percentage is named instead.
	it('names a blank-space value it does not offer rather than rounding it to one it does', () => {
		expect(describeRoomToColour(50)).toBe('Balanced');
		expect(describeRoomToColour(35)).toBe('35% blank');
		expect(describeRoomToColour(45)).toBe('45% blank');
		expect(describeRoomToColour(47.4)).toBe('47% blank');
	});

	it('has a label and a help line for every line weight it offers', () => {
		for (const value of LINE_WEIGHT_OPTIONS) {
			expect(LINE_WEIGHT_LABELS[value]?.trim().length).toBeGreaterThan(0);
			expect(LINE_WEIGHT_HELP[value]?.trim().length).toBeGreaterThan(0);
		}
	});

	it('offers only line weights the spec contract accepts', () => {
		for (const value of LINE_WEIGHT_OPTIONS) {
			expect(
				ColoringPageSpecSchema.safeParse({
					...VALID_SPEC,
					textStrokeWidth: value
				}).success
			).toBe(true);
		}
	});

	/*
	 * The two values this application itself builds must both be steps the control offers.
	 *
	 * Not a stylistic preference. `PageLookControls` renders a reader's own value as an extra
	 * "this page's own" option whenever it is not one of the steps, so if either of these drifted
	 * out of `LINE_WEIGHT_OPTIONS` every reader opening a page the app had just made would be shown
	 * a phantom option beside a "Page default" naming the identical number.
	 */
	it('offers both line weights this application actually builds', () => {
		expect(LINE_WEIGHT_OPTIONS).toContain(STUDIO_DEFAULT_PAGE_LOOK.textStrokeWidth);
		expect(LINE_WEIGHT_OPTIONS).toContain(TOOL_PAGE_STROKE_WIDTH);
	});

	// It spans the contract's whole range, so no legal spec value sits outside what a reader can ask
	// for at the ends.
	it('offers both ends of the range the contract allows', () => {
		expect(Math.min(...LINE_WEIGHT_OPTIONS)).toBe(4);
		expect(Math.max(...LINE_WEIGHT_OPTIONS)).toBe(12);
	});

	it('has a label and a help line for every letterform the contract allows', () => {
		for (const value of FontStyleSchema.options) {
			expect(LETTER_SHAPE_LABELS[value]?.trim().length).toBeGreaterThan(0);
			expect(LETTER_SHAPE_HELP[value]?.trim().length).toBeGreaterThan(0);
		}
		expect([...LETTER_SHAPE_OPTIONS].sort()).toEqual([...FontStyleSchema.options].sort());
	});

	/*
	 * The two letterforms this application itself builds must both be values the control offers.
	 *
	 * Trivially true while `LETTER_SHAPE_OPTIONS` is the whole enum, and that is the point: unlike
	 * line weight and blank space, which are steps across a numeric range, this control has no
	 * value it cannot offer. The assertion is here so that a letterform added to `FontStyleSchema`
	 * without a label fails as a missing option rather than as a `<select>` a reader finds blank.
	 */
	it('offers both letterforms this application actually builds', () => {
		expect(LETTER_SHAPE_OPTIONS).toContain(STUDIO_DEFAULT_PAGE_LOOK.fontStyle);
		expect(LETTER_SHAPE_OPTIONS).toContain(TOOL_PAGE_FONT_STYLE);
	});

	// `summarizePageLook` and `letterShapeFact` both append the word "letters", so a label carrying
	// it would render "block letters letters" — the defect Run 25 shipped once in
	// `describeLineWeight` and caught before merge.
	it('never carries the word "letters" into the letterform it names', () => {
		for (const value of FontStyleSchema.options) {
			expect(describeLetterShape(value).toLowerCase()).not.toContain('letters');
		}
	});

	// Same rule as `describeRoomToColour`: the interpreter can return 5, 7, 8, 10 or 11, and
	// snapping those to the nearest named step would report a page as something it is not.
	it('names a line weight it does not offer rather than rounding it to one it does', () => {
		expect(describeLineWeight(6)).toBe('Standard');
		expect(describeLineWeight(9)).toBe('Bold');
		expect(describeLineWeight(7)).toBe('7px');
		expect(describeLineWeight(11)).toBe('11px');
	});

	// `summarizePageLook` appends the word "lines", so a fallback carrying it would render
	// "7px lines lines" there.
	it('never carries the word "lines" into the value it names', () => {
		for (let width = 4; width <= 12; width += 1) {
			expect(describeLineWeight(width)).not.toContain('lines');
		}
	});

	describe('applyPageLook', () => {
		const spec = {
			textSize: 'large',
			whitespaceScale: 35,
			textStrokeWidth: 9,
			fontStyle: 'block'
		} as const;

		it('is the identity when no field is chosen', () => {
			expect(applyPageLook(spec, DEFAULT_PAGE_LOOK)).toEqual(spec);
		});

		it('applies each field independently', () => {
			expect(
				applyPageLook(spec, {
					...DEFAULT_PAGE_LOOK,
					textSize: 'small'
				})
			).toEqual({
				textSize: 'small',
				whitespaceScale: 35,
				textStrokeWidth: 9,
				fontStyle: 'block'
			});
			expect(
				applyPageLook(spec, { ...DEFAULT_PAGE_LOOK, whitespaceScale: 75 })
			).toEqual({
				textSize: 'large',
				whitespaceScale: 75,
				textStrokeWidth: 9,
				fontStyle: 'block'
			});
			expect(applyPageLook(spec, { ...DEFAULT_PAGE_LOOK, lineWeight: 4 })).toEqual({
				textSize: 'large',
				whitespaceScale: 35,
				textStrokeWidth: 4,
				fontStyle: 'block'
			});
			expect(applyPageLook(spec, { ...DEFAULT_PAGE_LOOK, letterShape: 'hand' })).toEqual({
				textSize: 'large',
				whitespaceScale: 35,
				textStrokeWidth: 9,
				fontStyle: 'hand'
			});
		});

		// A zero is a real choice — "leave none of it blank" — and `??` is what keeps it from being
		// read as absence the way `||` would.
		it('treats a zero scale as a choice, not as no choice', () => {
			expect(
				applyPageLook(spec, { ...DEFAULT_PAGE_LOOK, whitespaceScale: 0 }).whitespaceScale
			).toBe(0);
		});

		it('touches no other field of the spec it is given', () => {
			const whole = { ...VALID_SPEC };
			const applied = applyPageLook(whole, {
				textSize: 'medium',
				whitespaceScale: 25,
				lineWeight: 12,
				letterShape: 'hand'
			});
			expect({
				...applied,
				textSize: whole.textSize,
				whitespaceScale: whole.whitespaceScale,
				textStrokeWidth: whole.textStrokeWidth,
				fontStyle: whole.fontStyle
			}).toEqual(whole);
		});
	});

	describe('summarizePageLook', () => {
		// Three segments, four controls: lettering size and letter shape share the first one, because
		// "small bubble lettering" is one description of the letters and "small lettering · bubble
		// letters" is the same thing said twice. Each of the four still moves the line, which is the
		// property the panel's own summary test pins.
		it('names all four controls for every combination of the two enum fields', () => {
			for (const textSize of TextSizeSchema.options) {
				for (const fontStyle of FontStyleSchema.options) {
					const summary = summarizePageLook({
						textSize,
						whitespaceScale: 50,
						textStrokeWidth: 6,
						fontStyle
					});
					expect(summary.split(' · ')).toHaveLength(3);
					expect(summary).not.toContain('undefined');
					expect(summary).toContain(LETTER_SHAPE_LABELS[fontStyle].toLowerCase());
				}
			}
		});

		it('reads the effective value, so it says something before a control is ever touched', () => {
			expect(
				summarizePageLook({
					textSize: 'large',
					whitespaceScale: 35,
					textStrokeWidth: 9,
					fontStyle: 'block'
				})
			).toBe('large block lettering · 35% blank · bold lines');
		});

		// The fallback path, which is the live one for every weight the control has no word for.
		it('names an off-step weight by its number', () => {
			expect(
				summarizePageLook({
					textSize: 'small',
					whitespaceScale: 50,
					textStrokeWidth: 7,
					fontStyle: 'rounded'
				})
			).toBe('small bubble lettering · balanced · 7px lines');
		});
	});
});
