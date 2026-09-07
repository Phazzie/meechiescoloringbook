// Purpose: Unit tests for resolving an autosaved draft's stored mode and describing the restore.
// Why: The mode is what makes the restored evidence mean anything; every way of not having it must
//      produce a different, honest sentence rather than a silent substitution.
// Info flow: stored modeId + catalogue -> restoreDraftMode -> describeDraftRestore -> assertions.
import { describe, expect, it } from 'vitest';
import {
	describeDraftRestore,
	restoreDraftMode,
	type DraftModeProvenance
} from '../../src/lib/core/draft-restore';
import {
	studioModes,
	type StudioModeCatalogue
} from '../../src/lib/core/meechie-studio';

// A real mode that is deliberately not `studioModes[0]`, so "restored the stored one" and "fell
// back to the default" can never both satisfy the same assertion.
const OTHER_MODE = studioModes.find((mode) => mode.id === 'rate-excuse');
if (!OTHER_MODE) throw new Error('rate-excuse is missing from the mode catalogue');

const DEFAULT_MODE = studioModes[0];

const SAVED_AT = '2026-09-05T00:00:00.000Z';
const SAME_DAY_MS = Date.parse('2026-09-05T18:00:00.000Z');

describe('restoreDraftMode', () => {
	it('returns the stored mode when this build still has it', () => {
		expect(restoreDraftMode(OTHER_MODE.id, studioModes)).toEqual({
			modeId: OTHER_MODE.id,
			provenance: 'recorded'
		});
	});

	it('resolves every mode in the catalogue to itself', () => {
		for (const mode of studioModes) {
			expect(restoreDraftMode(mode.id, studioModes)).toEqual({
				modeId: mode.id,
				provenance: 'recorded'
			});
		}
	});

	// A draft written before `DraftRecordSchema` had the field. There is no answer to recover, and
	// the important half is that the result says so rather than passing the fallback off as a choice.
	it('falls back to the first mode and reports an unrecorded one for a draft with no modeId', () => {
		expect(restoreDraftMode(undefined, studioModes)).toEqual({
			modeId: DEFAULT_MODE.id,
			provenance: 'unrecorded'
		});
	});

	// A draft naming a mode this build removed. Distinct from the case above: something is known
	// here, and it is that the reader's question is gone.
	it('falls back to the first mode and reports a retired one for a modeId nothing matches', () => {
		expect(restoreDraftMode('a-mode-that-was-retired', studioModes)).toEqual({
			modeId: DEFAULT_MODE.id,
			provenance: 'retired'
		});
	});

	// The two non-recorded cases resolve to the same mode. If they ever collapse into one
	// provenance, this is the test that stops it — they are told apart by the sentence, not the id.
	it('separates an unrecorded mode from a retired one even though both land on the default', () => {
		const unrecorded = restoreDraftMode(undefined, studioModes);
		const retired = restoreDraftMode('a-mode-that-was-retired', studioModes);

		expect(unrecorded.modeId).toBe(retired.modeId);
		expect(unrecorded.provenance).not.toBe(retired.provenance);
	});

	it('resolves against the catalogue it is handed, not the app-wide one', () => {
		const narrowed: StudioModeCatalogue = [OTHER_MODE];

		expect(restoreDraftMode(OTHER_MODE.id, narrowed).provenance).toBe('recorded');
		// A live mode of the real catalogue, absent from this one, is retired as far as this
		// catalogue is concerned — which is what makes the function testable without editing
		// `studioModes`.
		expect(restoreDraftMode(DEFAULT_MODE.id, narrowed)).toEqual({
			modeId: OTHER_MODE.id,
			provenance: 'retired'
		});
	});

	/**
	 * The empty catalogue, asserted where it can actually be asserted: at compile time.
	 *
	 * This function falls back to `modes[0]`, so an empty catalogue would return `undefined` as a
	 * declared `string` — `StudioState.init()` assigns that to `activeModeId` and then reads
	 * `activeMode.label` off it. A review found that hole while the parameter was
	 * `readonly StudioMode[]` and the non-empty requirement lived only in a doc comment.
	 *
	 * `StudioModeCatalogue` is `readonly [StudioMode, ...StudioMode[]]`, so the case is now
	 * unrepresentable rather than untested, and `@ts-expect-error` is the assertion that says so:
	 * `npm run check` fails if this line ever stops being an error, which is exactly what would
	 * happen if the parameter were widened back to a plain array. A runtime test could only reach
	 * this case through a cast, and would then be asserting the behaviour of a call the type system
	 * forbids.
	 */
	it('rejects an empty catalogue at the type level', () => {
		// @ts-expect-error an empty array is not a StudioModeCatalogue
		const rejected = () => restoreDraftMode('any-id', []);

		expect(rejected).toBeTypeOf('function');
	});
});

describe('describeDraftRestore', () => {
	const notice = (provenance: DraftModeProvenance) =>
		describeDraftRestore({
			provenance,
			modeLabel: DEFAULT_MODE.label,
			updatedAtISO: SAVED_AT,
			nowMs: SAME_DAY_MS
		});

	it('names the mode and raises no caution when the draft recorded its own question', () => {
		const result = describeDraftRestore({
			provenance: 'recorded',
			modeLabel: OTHER_MODE.label,
			updatedAtISO: SAVED_AT,
			nowMs: SAME_DAY_MS
		});

		expect(result.headline).toContain(OTHER_MODE.label);
		expect(result.caution).toBeNull();
	});

	// `caution === null` is the single thing the component branches on, so the two cases that need a
	// warning must both produce one and the case that does not must not.
	it.each([
		['unrecorded' as const, 'before the studio started remembering'],
		['retired' as const, 'not in the studio any more']
	])('cautions on a %s mode and says which kind it is', (provenance, phrase) => {
		const result = notice(provenance);

		expect(result.caution).not.toBeNull();
		expect(result.caution).toContain(phrase);
		// The mode now on screen is named in the caution itself, so the sentence is actionable
		// without the reader looking anywhere else.
		expect(result.caution).toContain(DEFAULT_MODE.label);
	});

	it('gives the two cautioned cases different wording', () => {
		expect(notice('unrecorded').caution).not.toBe(notice('retired').caution);
	});

	it('reports when the draft was saved, through the vault’s own label', () => {
		expect(notice('recorded').savedLabel).toBe('Saved today');
		expect(
			describeDraftRestore({
				provenance: 'recorded',
				modeLabel: DEFAULT_MODE.label,
				updatedAtISO: SAVED_AT,
				nowMs: Date.parse('2026-09-06T06:00:00.000Z')
			}).savedLabel
		).toBe('Saved yesterday');
	});

	// A draft whose stamp does not parse is still a draft worth restoring; the notice degrades to
	// not knowing when, rather than the studio declining to say anything at all.
	it('still announces a restore when the saved instant is unreadable', () => {
		const result = describeDraftRestore({
			provenance: 'recorded',
			modeLabel: OTHER_MODE.label,
			updatedAtISO: 'not a date',
			nowMs: SAME_DAY_MS
		});

		expect(result.headline).toContain(OTHER_MODE.label);
		expect(result.savedLabel).toBe('Saved date unknown');
	});
});
