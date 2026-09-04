// Purpose: Prove the focused-mode catalog covers every mode the home page links to, and that every
//          mode builds a request `/api/tools` will actually accept.
// Why: The home page renders a `/m/<id>` link for every entry in `studioModes`, and the route used
//      to resolve those ids against a second hand-written map. If the two ever disagreed the link
//      silently served Random Meechie under the requested mode's URL, with a 200 and nothing on
//      screen to say so. Nothing checked that they agreed. These tests are that check.
// Info flow: studioModes -> resolveModeSlug -> ModeConfig.buildInput -> MeechieToolInputSchema.
import { describe, expect, it } from 'vitest';
import {
	emptyModeFieldValues,
	isModeInputComplete,
	modeCatalog,
	resolveModeSlug
} from '../../src/lib/core/mode-catalog';
import type { ModeConfig } from '../../src/lib/core/mode-catalog';
import { studioModes } from '../../src/lib/core/meechie-studio';
import { MeechieToolInputSchema } from '../../contracts/meechie-tool.contract';

/** Answer every question a mode asks, so `buildInput` sees a complete form. */
const filledFor = (config: ModeConfig): Record<string, string> => {
	const values = emptyModeFieldValues();
	for (const field of config.fields) {
		values[field.id] = `Answer for ${field.id}.`;
	}
	return values;
};

describe('mode catalog coverage', () => {
	it('resolves every mode the home page links to', () => {
		// `StudioHero.svelte` renders `<a href={`/m/${mode.id}`}>` for every weekly mode, and the
		// weekly rotation draws from all of `studioModes` over time. Every one of them must land on a
		// real page.
		for (const mode of studioModes) {
			expect(resolveModeSlug(mode.id), `no mode page for ${mode.id}`).not.toBeNull();
		}
	});

	it('lists one catalogue entry per studio mode, in the studio order', () => {
		expect(modeCatalog().map((config) => config.slug)).toEqual(
			studioModes.map((mode) => mode.id)
		);
	});

	it('takes its title, sub-head and button straight from the studio mode', () => {
		// The point of deriving the catalog is that these strings exist once. If a future edit
		// reintroduces a hand-written copy, this fails rather than drifting quietly.
		for (const mode of studioModes) {
			const config = resolveModeSlug(mode.id);
			expect(config).not.toBeNull();
			expect(config?.title).toBe(mode.label);
			expect(config?.subhead).toBe(mode.help);
			expect(config?.button).toBe(mode.cta);
		}
	});

	it('keeps every alias slug that worked before the catalog existed', () => {
		// These were in the route's previous hand-written map, so they may be bookmarked or linked
		// from outside the app. 404ing them would break a working link, which is not what the
		// not-found path is for.
		const aliases: Record<string, string> = {
			'rate-his-excuse': 'rate-excuse',
			'apology-translator': 'apology-autopsy',
			receipts: 'receipt-check',
			'caption-this': 'caption',
			'what-would-meechie-do': 'meechie-move'
		};
		for (const [alias, canonical] of Object.entries(aliases)) {
			expect(resolveModeSlug(alias)?.slug, `alias ${alias}`).toBe(canonical);
		}
	});

	it('resolves an alias to the canonical slug, not to the alias', () => {
		// The slug becomes the download filename stem, so an alias must not leak into it.
		expect(resolveModeSlug('rate-his-excuse')?.slug).toBe('rate-excuse');
		expect(resolveModeSlug('rate-his-excuse')?.slug).not.toBe('rate-his-excuse');
	});

	it('returns null for a slug that names no mode', () => {
		// The defect this replaces: every one of these used to render Random Meechie with a 200.
		for (const slug of ['', 'typo', 'random-meechie', 'who-fucked', '../admin']) {
			expect(resolveModeSlug(slug), `expected no mode for "${slug}"`).toBeNull();
		}
	});
});

describe('mode catalog requests', () => {
	it('builds a contract-valid tool input for every mode', () => {
		// A mode whose `buildInput` produced something `MeechieToolInputSchema` rejects would fail
		// after the reader had written their answer and pressed the button.
		for (const config of modeCatalog()) {
			const parsed = MeechieToolInputSchema.safeParse(
				config.buildInput(filledFor(config) as never)
			);
			expect(parsed.success, `${config.slug} built an invalid input`).toBe(true);
		}
	});

	it('sends the tool id the studio mode declares', () => {
		for (const mode of studioModes) {
			const config = resolveModeSlug(mode.id);
			expect(config).not.toBeNull();
			if (!config) continue;
			const input = config.buildInput(filledFor(config) as never);
			expect(input.toolId, `${mode.id} sent the wrong tool`).toBe(mode.toolId);
		}
	});

	it('trims the answers before sending them', () => {
		const config = resolveModeSlug('who-fucked-up');
		expect(config).not.toBeNull();
		const values = emptyModeFieldValues();
		values.situation = '   He went quiet for a week.   ';
		const input = config?.buildInput(values);
		expect(input).toMatchObject({
			toolId: 'red_flag_or_run',
			situation: 'He went quiet for a week.'
		});
	});

	it('carries both answers on the two-field mode', () => {
		// Receipt Check is the only mode that asks two questions; dropping one would silently ask
		// Meechie to compare a claim against nothing.
		const config = resolveModeSlug('receipt-check');
		expect(config?.fields.map((field) => field.id)).toEqual(['claim', 'reality']);
		const values = emptyModeFieldValues();
		values.claim = 'I never said that.';
		values.reality = 'Said it in the group chat.';
		expect(config?.buildInput(values)).toEqual({
			toolId: 'receipts',
			claim: 'I never said that.',
			reality: 'Said it in the group chat.'
		});
	});
});

describe('mode input completeness', () => {
	it('starts every field empty', () => {
		// The page used to ship every field pre-filled with invented drama, which meant the reader
		// could press the button without writing anything and get a real verdict about a fiction.
		// Nothing in the catalog may supply a value — only a placeholder.
		expect(Object.values(emptyModeFieldValues()).every((value) => value === '')).toBe(
			true
		);
		for (const config of modeCatalog()) {
			for (const field of config.fields) {
				expect(field.placeholder.length, `${config.slug}/${field.id}`).toBeGreaterThan(0);
			}
		}
	});

	it('is incomplete until every question is answered', () => {
		const config = resolveModeSlug('receipt-check');
		expect(config).not.toBeNull();
		if (!config) return;
		const values = emptyModeFieldValues();
		expect(isModeInputComplete(config, values)).toBe(false);
		values.claim = 'I never said that.';
		expect(isModeInputComplete(config, values)).toBe(false);
		values.reality = 'Said it in the group chat.';
		expect(isModeInputComplete(config, values)).toBe(true);
	});

	it('treats whitespace as unanswered', () => {
		const config = resolveModeSlug('clapback');
		expect(config).not.toBeNull();
		if (!config) return;
		const values = emptyModeFieldValues();
		values.comment = '   \n  ';
		expect(isModeInputComplete(config, values)).toBe(false);
	});

	it('is complete immediately for the mode that asks nothing', () => {
		// Random Meechie has no fields. "Every field is non-empty" is vacuously true there, and that
		// is the intended answer rather than a lucky one.
		const config = resolveModeSlug('random');
		expect(config?.fields).toEqual([]);
		if (!config) return;
		expect(isModeInputComplete(config, emptyModeFieldValues())).toBe(true);
		expect(config.buildInput(emptyModeFieldValues())).toEqual({
			toolId: 'random_meechie'
		});
	});
});
