// Purpose: Unit tests for Meechie studio metadata and budget helpers.
// Why: Keep AI cost guardrails deterministic before UI wiring.
// Info flow: Studio action/mode metadata -> helper results -> UI state.
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_REVISION_BUDGET,
	DEFAULT_STUDIO_TEXT_OUTPUT,
	buildColoringPageSpecFromMeechieText,
	buildStudioTextFromCreationRecord,
	buildStudioTextFromDraftRecord,
	canRunStudioAction,
	consumeStudioActionBudget,
	getStudioAction,
	getStudioTextAction,
	studioModes
} from '../../src/lib/core/meechie-studio';
import { meechieVoicePack } from '../../src/lib/seams/meechie-voice-seam/voice-pack';
import {
	MAX_LABEL_LENGTH,
	MAX_TITLE_LENGTH
} from '../../contracts/spec-validation.contract';

describe('Meechie studio controls', () => {
	// The default preview used to quote a line that was never in the voice pack. When ten
	// fabricated lines were removed by owner ruling on 2026-08-25, the default broke — it had
	// been showing invented Meechie to every visitor before they generated anything. This
	// binds the two together so a removed line can never silently become the shipped default.
	it('default preview quote is a real line from the voice pack', () => {
		const packLines = meechieVoicePack.responses.quotes.map((q) => q.text);
		expect(packLines).toContain(DEFAULT_STUDIO_TEXT_OUTPUT.quote);
	});

	it('starts the preview with owner-approved Meechie quote text and no battery placeholder', () => {
		const previewText = [
			DEFAULT_STUDIO_TEXT_OUTPUT.verdict,
			DEFAULT_STUDIO_TEXT_OUTPUT.quote,
			DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle,
			...DEFAULT_STUDIO_TEXT_OUTPUT.pageItems.map((item) => item.label)
		].join(' ');

		expect(DEFAULT_STUDIO_TEXT_OUTPUT.quote).toBe(
			'You should have fucked the landlord, not the dopeman.'
		);
		expect(DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle).toBe('THE LANDLORD');
		// The preview must never show wording that was ruled out of the voice.
		expect(meechieVoicePack.responses.quotes.map((quote) => quote.text)).toContain(
			DEFAULT_STUDIO_TEXT_OUTPUT.quote
		);
		expect(previewText.toLowerCase()).not.toContain('phone');
		expect(previewText.toLowerCase()).not.toContain('battery');
	});

	it('defines exactly eight visual modes', () => {
		expect(studioModes).toHaveLength(8);
		expect(new Set(studioModes.map((mode) => mode.id)).size).toBe(8);
		expect(studioModes.every((mode) => mode.image.startsWith('/meechie/'))).toBe(true);
	});

	it('keeps AI text action metadata separate from local controls', () => {
		expect(getStudioAction('generate_text').costClass).toBe('unclassified');
		expect(getStudioAction('generate_text').countsAgainstRevisionBudget).toBe(true);
		expect(getStudioTextAction('generate_text').aiAction).toBe('generate');
		expect(getStudioAction('copy_quote').costClass).toBe('free');
		expect(getStudioAction('copy_quote').countsAgainstRevisionBudget).toBe(false);
	});

	it('throws when text action metadata is requested for a non-AI action id', () => {
		const invalidActionId = 'copy_quote' as never;
		expect(() => getStudioTextAction(invalidActionId)).toThrow(
			'Studio action is missing aiAction metadata: copy_quote'
		);
	});

	it('only consumes revision budget for AI text actions', () => {
		expect(DEFAULT_REVISION_BUDGET).toBe(3);
		expect(consumeStudioActionBudget(3, 'make_prettier')).toBe(2);
		expect(consumeStudioActionBudget(3, 'copy_quote')).toBe(3);
		expect(canRunStudioAction('make_meaner', { remainingBudget: 0, isRunning: false })).toBe(false);
		expect(canRunStudioAction('export_png', { remainingBudget: 0, isRunning: false })).toBe(true);
		expect(canRunStudioAction('make_more_specific', { remainingBudget: 2, isRunning: true })).toBe(false);
	});

	it('connects Meechie output to coloring page text', () => {
		const spec = buildColoringPageSpecFromMeechieText({
			output: {
				verdict: 'The receipt is louder than the excuse.',
				quote: 'Color the proof before they revise the story.',
				pageTitle: 'COLOR THE PROOF',
				pageItems: [
					{ number: 1, label: 'CHECK THE CLOCK' },
					{ number: 2, label: 'READ THE POST' }
				],
				qualityState: 'ready'
			},
			pageSize: 'A4',
			border: 'plain',
			styleHint: 'receipt collage'
		});

		expect(spec.title).toBe('COLOR THE PROOF');
		expect(spec.items.map((item) => item.label)).toEqual(['CHECK THE CLOCK', 'READ THE POST']);
		expect(spec.footerItem?.label).toBe('COLOR THE PROOF');
		expect(spec.pageSize).toBe('A4');
		expect(spec.border).toBe('plain');
	});

	it('normalizes AI page text before creating a coloring-page spec', () => {
		const spec = buildColoringPageSpecFromMeechieText({
			output: {
				verdict: 'Meechie sees the whole thing.',
				quote: 'That ampersand was doing too much.',
				pageTitle: 'Receipt & emoji chaos that is way too long for the printable label field',
				pageItems: [
					{ number: 1, label: 'CALL & RESPONSE WITH GLITTER ✨ AND TOO MANY WORDS' },
					{ number: 2, label: 'Keep it cute!!!' }
				],
				qualityState: 'ready'
			},
			pageSize: 'US_Letter',
			border: 'decorative',
			styleHint: 'glam receipts'
		});

		expect(spec.title).toBe(
			'RECEIPT EMOJI CHAOS THAT IS WAY TOO LONG FOR THE PRINTABLE LABEL FIELD'
		);
		expect(spec.items[0].label).toBe('CALL RESPONSE WITH GLITTER AND TOO MANY');
		expect(spec.items[0].label.length).toBeLessThanOrEqual(MAX_LABEL_LENGTH);
		expect(spec.items[1].label).toBe('KEEP IT CUTE!!!');
		expect(spec.footerItem?.label).toBe('RECEIPT EMOJI CHAOS THAT IS WAY TOO LONG');
		expect(spec.footerItem?.label.length).toBeLessThanOrEqual(MAX_LABEL_LENGTH);
	});

	it('preserves 41-96 character titles while keeping item and footer labels at 40', () => {
		for (const titleLength of [MAX_LABEL_LENGTH + 1, MAX_TITLE_LENGTH]) {
			const pageTitle = 'T'.repeat(titleLength);
			const spec = buildColoringPageSpecFromMeechieText({
				output: {
					verdict: 'Meechie ruled.',
					quote: 'Long titles still belong on the page.',
					pageTitle,
					pageItems: [{ number: 1, label: 'I'.repeat(MAX_TITLE_LENGTH) }],
					qualityState: 'ready'
				},
				pageSize: 'US_Letter',
				border: 'plain',
				styleHint: 'simple'
			});

			expect(spec.title).toBe(pageTitle);
			expect(spec.title).toHaveLength(titleLength);
			expect(spec.items[0].label).toHaveLength(MAX_LABEL_LENGTH);
			expect(spec.footerItem?.label).toHaveLength(MAX_LABEL_LENGTH);
		}
	});

	it('caps titles above 96 characters without widening item or footer labels', () => {
		const spec = buildColoringPageSpecFromMeechieText({
			output: {
				verdict: 'Meechie ruled.',
				quote: 'The title has a hard ceiling.',
				pageTitle: 'T'.repeat(MAX_TITLE_LENGTH + 1),
				pageItems: [{ number: 1, label: 'I'.repeat(MAX_LABEL_LENGTH + 1) }],
				qualityState: 'ready'
			},
			pageSize: 'US_Letter',
			border: 'plain',
			styleHint: 'simple'
		});

		expect(spec.title).toHaveLength(MAX_TITLE_LENGTH);
		expect(spec.items[0].label).toHaveLength(MAX_LABEL_LENGTH);
		expect(spec.footerItem?.label).toHaveLength(MAX_LABEL_LENGTH);
	});

	it('rehydrates draft records from persisted studio text', () => {
		const storedPageTitle = 'S'.repeat(MAX_TITLE_LENGTH);
		const studioText = {
			verdict: 'Meechie already ruled.',
			quote: 'That excuse needs crayons.',
			pageTitle: storedPageTitle,
			pageItems: [
				{ number: 1, label: 'TRACE THE RECEIPT' },
				{ number: 2, label: 'COLOR THE ALIBI' }
			],
			qualityState: 'ready' as const
		};
		const restored = buildStudioTextFromDraftRecord({
			updatedAtISO: '2026-05-03T00:00:00.000Z',
			intent: buildColoringPageSpecFromMeechieText({
				output: studioText,
				pageSize: 'US_Letter',
				border: 'plain',
				styleHint: 'receipt'
			}),
			chatMessage: 'The group chat had proof.',
			studioText
		});

		expect(restored).toEqual(studioText);
		expect(restored.pageTitle).toHaveLength(MAX_TITLE_LENGTH);
	});

	it('rehydrates new vault records from studio text instead of the image prompt', () => {
		const studioText = {
			verdict: 'Meechie checked the record.',
			quote: 'The prompt is not the quote.',
			pageTitle: 'PROMPT IS NOT QUOTE',
			pageItems: [
				{ number: 1, label: 'SAVE THE QUOTE' },
				{ number: 2, label: 'KEEP THE PROMPT SEPARATE' }
			],
			qualityState: 'ready' as const
		};
		const intent = buildColoringPageSpecFromMeechieText({
			output: studioText,
			pageSize: 'US_Letter',
			border: 'plain',
			styleHint: 'receipt'
		});
		const restored = buildStudioTextFromCreationRecord({
			id: 'creation-1',
			createdAtISO: '2026-05-03T00:00:00.000Z',
			intent,
			assembledPrompt: 'Create a long image-generation prompt with composition details.',
			studioText,
			owner: { kind: 'anonymous', sessionId: 'session-123' }
		});

		expect(restored.quote).toBe('The prompt is not the quote.');
		expect(restored.quote).not.toContain('image-generation prompt');
	});

	it('rehydrates legacy drafts without studio text from their coloring-page spec', () => {
		const restored = buildStudioTextFromDraftRecord({
			updatedAtISO: '2026-05-03T00:00:00.000Z',
			intent: {
				title: 'LEGACY TITLE',
				items: [
					{ number: 1, label: 'LEGACY ITEM' },
					{ number: 2, label: 'SECOND ITEM' }
				],
				footerItem: { number: 97, label: 'LEGACY TITLE' },
				listMode: 'list',
				alignment: 'left',
				numberAlignment: 'strict',
				listGutter: 'normal',
				whitespaceScale: 50,
				textSize: 'small',
				fontStyle: 'rounded',
				textStrokeWidth: 6,
				colorMode: 'black_and_white_only',
				decorations: 'minimal',
				illustrations: 'simple',
				shading: 'none',
				border: 'plain',
				borderThickness: 8,
				variations: 1,
				outputFormat: 'pdf',
				pageSize: 'US_Letter'
			},
			chatMessage: 'Original evidence'
		});

		expect(restored.pageTitle).toBe('LEGACY TITLE');
		expect(restored.pageItems.map((item) => item.label)).toEqual(['LEGACY ITEM', 'SECOND ITEM']);
		expect(restored.quote).toBe('LEGACY TITLE');
	});

	it('preserves long titles in legacy draft and vault fallbacks', () => {
		const longTitle = 'L'.repeat(MAX_TITLE_LENGTH);
		const intent = {
			title: longTitle,
			items: [{ number: 1, label: 'LEGACY ITEM' }],
			footerItem: { number: 97, label: 'LEGACY FOOTER' },
			listMode: 'list' as const,
			alignment: 'left' as const,
			numberAlignment: 'strict' as const,
			listGutter: 'normal' as const,
			whitespaceScale: 50,
			textSize: 'small' as const,
			fontStyle: 'rounded' as const,
			textStrokeWidth: 6,
			colorMode: 'black_and_white_only' as const,
			decorations: 'minimal' as const,
			illustrations: 'simple' as const,
			shading: 'none' as const,
			border: 'plain' as const,
			borderThickness: 8,
			variations: 1,
			outputFormat: 'pdf' as const,
			pageSize: 'US_Letter' as const
		};

		const draftText = buildStudioTextFromDraftRecord({
			updatedAtISO: '2026-05-03T00:00:00.000Z',
			intent,
			chatMessage: 'Original evidence'
		});
		const vaultText = buildStudioTextFromCreationRecord({
			id: 'creation-long-title',
			createdAtISO: '2026-05-03T00:00:00.000Z',
			intent,
			assembledPrompt: 'Legacy assembled prompt.',
			owner: { kind: 'anonymous', sessionId: 'session-123' }
		});

		expect(draftText.pageTitle).toBe(longTitle);
		expect(vaultText.pageTitle).toBe(longTitle);
		expect(draftText.pageTitle).toHaveLength(MAX_TITLE_LENGTH);
		expect(vaultText.pageTitle).toHaveLength(MAX_TITLE_LENGTH);
	});
});

describe('decoration density follows the caller, not the builder', () => {
	it('derives it from the theme when none is supplied, and carries one that is', () => {
		// `decorations` is derived from the theme rather than chosen directly, so the builder cannot
		// decide on its own whether to keep a restored value: a reopened page's theme is not restored
		// with it, and the builder never learns whether the reader actually picked one. It therefore
		// honours what the caller passes and derives only in its absence. `studio-state` owns the
		// provenance, and its own test covers that decision.
		const derived = buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter',
			border: 'plain',
			styleHint: 'receipt ledger lines',
			presentation: { alignment: 'center', whitespaceScale: 35 }
		});
		expect(derived.decorations).toBe('dense');
		// The rest of the presentation is carried forward either way.
		expect(derived.alignment).toBe('center');
		expect(derived.whitespaceScale).toBe(35);

		const carried = buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter',
			border: 'plain',
			styleHint: 'gold crown ornaments',
			presentation: { alignment: 'center', decorations: 'dense' }
		});
		expect(carried.decorations).toBe('dense');

		const dropped = buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter',
			border: 'plain',
			styleHint: 'gold crown ornaments',
			presentation: { alignment: 'center', decorations: undefined }
		});
		expect(dropped.decorations).toBe('minimal');
		expect(dropped.alignment).toBe('center');
	});
});
