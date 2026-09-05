/*
 * Purpose: Verify the Page Controls' style selection — its encoding, its comparison, and that every
 *          value the panel can display has words to display.
 * Why: The style hint is the page's whole art direction and the input the decoration density is
 *      derived from. An encoding change nothing notices restyles every page the studio makes.
 * Info flow: StyleSelection -> buildStyleHint -> `Vibe:` line; StyleSelection -> panel prose.
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
	buildStyleHint,
	isSameStyleSelection,
	summarizePageControls,
	summarizePaperSelection,
	summarizeStyleSelection,
	themeForSelection,
	type PaperSelection,
	type StyleSelection
} from '$lib/core/page-style';
import { derivesDenseDecorations, studioThemes } from '$lib/core/meechie-studio';
import { MeechieStudioVoiceSettingsSchema } from '$lib/seams/meechie-studio-text-seam/contract';
import { BorderStyleSchema, PageSizeSchema } from '$lib/seams/spec-validation-seam/contract';

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
		const base = summarizePageControls(summarizeStyleSelection(selection()), paper);
		const moved = [
			summarizePageControls(
				summarizeStyleSelection(
					selection({ voice: { ...DEFAULT_STYLE_SELECTION.voice, thirdPerson: 'always' } })
				),
				paper
			),
			summarizePageControls(summarizeStyleSelection(selection()), { ...paper, pageSize: 'A4' }),
			summarizePageControls(summarizeStyleSelection(selection()), { ...paper, border: 'none' })
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

	it('reads as one line: the style, then the paper', () => {
		expect(
			summarizePageControls(summarizeStyleSelection(selection()), {
				pageSize: 'US_Letter',
				border: 'decorative'
			})
		).toBe(
			'Crown Energy · Receipts Out · Mild · sometimes in third person · US Letter · decorative border'
		);
	});

	// A reopened page written before styles were stored has no style to name, and its paper is the
	// half that *is* on file — so the substitute sentence must not take the paper down with it.
	it('still names the paper when the style is not on file', () => {
		expect(
			summarizePageControls("This page's style is not on file", {
				pageSize: 'A4',
				border: 'none'
			})
		).toBe("This page's style is not on file · A4 · no border");
	});
});
