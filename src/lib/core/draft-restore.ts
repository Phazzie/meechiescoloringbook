/*
 * Purpose: Decide what an autosaved draft's stored mode means when the studio reopens, and what the
 *          reader is told about it.
 * Why: `chatMessage` is evidence, and evidence only means anything against a question. Restoring the
 *      words under whichever mode the studio happened to open on sent them to a different tool.
 * Info flow: DraftRecord.modeId + the live mode catalogue -> a resolved mode + a notice -> StudioState.
 * Invariants: Pure. Reads no clock, no storage, no catalogue of its own — the caller supplies the
 *             instant and the modes, so every rule here is drivable from a test.
 */
import type { StudioMode } from './meechie-studio';
import { formatVaultSavedLabel } from './vault-gallery';

/**
 * How a draft's stored mode related to the catalogue this build actually has.
 *
 * Three states rather than a boolean, because the two ways of *not* having the reader's mode are
 * different facts about different drafts and the reader is owed different sentences for them:
 *
 * - `recorded` — the draft names a mode this build still has. The studio can put the evidence back
 *   under the question it was typed against, which is the entire point of the field.
 * - `unrecorded` — the draft names no mode at all. Every draft written before `DraftRecordSchema`
 *   gained `modeId` is one of these, and there is no answer to recover: the question is genuinely
 *   unknown, not merely missing.
 * - `retired` — the draft names a mode this build no longer has. Here something *is* known, and it
 *   is bad news: the reader was working on a question this version of the studio cannot ask.
 *
 * Collapsing the last two into "no mode" is the tempting simplification and it loses the only fact
 * worth reporting. A reader whose draft is simply old should check the question; a reader whose mode
 * was retired should know it is gone, because no amount of checking will bring it back.
 */
export type DraftModeProvenance = 'recorded' | 'unrecorded' | 'retired';

export type DraftModeRestoration = {
	/** The mode the studio opens on. Always a mode that exists in the supplied catalogue. */
	modeId: string;
	provenance: DraftModeProvenance;
};

/**
 * Resolve a draft's stored mode against the modes this build has.
 *
 * Falls back to the first mode in the catalogue, which is what the studio did before this function
 * existed — the difference is not the fallback, it is that the fallback is now *reported*. The whole
 * defect being fixed here was a silent substitution, and a fix that substituted just as silently
 * under a wider set of conditions would be no fix at all.
 *
 * `modes` must be non-empty; a studio with no modes has nothing to restore into and the caller has a
 * bigger problem than this function can describe.
 */
export const restoreDraftMode = (
	storedModeId: string | undefined,
	modes: readonly StudioMode[]
): DraftModeRestoration => {
	const fallbackId = modes[0].id;
	if (storedModeId === undefined) {
		return { modeId: fallbackId, provenance: 'unrecorded' };
	}
	const found = modes.find((mode) => mode.id === storedModeId);
	return found
		? { modeId: found.id, provenance: 'recorded' }
		: { modeId: fallbackId, provenance: 'retired' };
};

/**
 * What the studio says about the work it just put back on screen.
 *
 * `caution` is the load-bearing half. It is `null` exactly when the studio is showing the reader's
 * own question, and a sentence exactly when it is not — so the component has one thing to branch on
 * and cannot render a warning tone over a restore that went right, or a calm one over a substitution.
 *
 * The headline is present in all three cases on purpose. Before this, a restore said nothing at all:
 * a reader came back to text they had not typed in this sitting, with no explanation of where it
 * came from and no hint that anything had been kept. Naming the restore is worth a line even when
 * every part of it succeeded.
 */
export type DraftRestoreNotice = {
	headline: string;
	/** From `formatVaultSavedLabel` — "Saved today", "Saved yesterday", "Saved Sep 3, 2026". */
	savedLabel: string;
	caution: string | null;
};

/**
 * Build the notice for a restored draft, or `null` when there is nothing to announce.
 *
 * `modeLabel` is the label of the mode the studio has actually opened on — the resolved one, not the
 * stored one. In the `retired` case those differ, and the sentence names the resolved mode because
 * that is the question now on screen; the retired mode's *label* is not recoverable from the draft,
 * which stores only its id, and inventing one from the id would be a guess dressed as a fact.
 */
export const describeDraftRestore = ({
	provenance,
	modeLabel,
	updatedAtISO,
	nowMs
}: {
	provenance: DraftModeProvenance;
	modeLabel: string;
	updatedAtISO: string;
	nowMs: number;
}): DraftRestoreNotice => {
	const savedLabel = formatVaultSavedLabel(updatedAtISO, nowMs);
	if (provenance === 'recorded') {
		return {
			headline: `Picked up where you left off: ${modeLabel}.`,
			savedLabel,
			caution: null
		};
	}
	if (provenance === 'unrecorded') {
		return {
			headline: 'Picked up where you left off.',
			savedLabel,
			caution: `This draft is from before the studio started remembering which question you asked, so it is open on ${modeLabel}. Check that is the one you meant before you generate.`
		};
	}
	return {
		headline: 'Picked up where you left off.',
		savedLabel,
		caution: `The question you were on is not in the studio any more, so it is open on ${modeLabel}. Check that is the one you meant before you generate.`
	};
};
