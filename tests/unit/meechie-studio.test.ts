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
	studioModes
} from '../../src/lib/core/meechie-studio';

describe('Meechie studio controls', () => {
	it('starts the preview with canon Meechie quote text and no battery placeholder', () => {
		const previewText = [
			DEFAULT_STUDIO_TEXT_OUTPUT.verdict,
			DEFAULT_STUDIO_TEXT_OUTPUT.quote,
			DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle,
			...DEFAULT_STUDIO_TEXT_OUTPUT.pageItems.map((item) => item.label)
		].join(' ');

		expect(DEFAULT_STUDIO_TEXT_OUTPUT.quote).toBe('You fumbled ME? In THIS economy?');
		expect(DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle).toBe('IN THIS ECONOMY');
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
		expect(getStudioAction('copy_quote').costClass).toBe('free');
		expect(getStudioAction('copy_quote').countsAgainstRevisionBudget).toBe(false);
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

		expect(spec.title).toBe('RECEIPT EMOJI CHAOS THAT IS WAY TOO LONG');
		expect(spec.title).toHaveLength(40);
		expect(spec.items[0].label).toBe('CALL RESPONSE WITH GLITTER AND TOO MANY');
		expect(spec.items[0].label.length).toBeLessThanOrEqual(40);
		expect(spec.items[1].label).toBe('KEEP IT CUTE!!!');
		expect(spec.footerItem?.label).toBe(spec.title);
	});

	it('rehydrates draft records from persisted studio text', () => {
		const studioText = {
			verdict: 'Meechie already ruled.',
			quote: 'That excuse needs crayons.',
			pageTitle: 'EXCUSE NEEDS CRAYONS',
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
});
