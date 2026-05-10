// Purpose: Validate deterministic Meechie quote scoring and curation decisions.
// Why: Ensure quote selection exposes exact machine-readable pass/fail reasons.
// Info flow: Quote fixtures -> scoring module -> asserted totals, penalties, and score bands.
import { describe, expect, it } from 'vitest';
import { scoreMeechieQuote, selectBestMeechieQuote } from '../../src/lib/core/meechie-quote-scoring';

describe('meechie quote scoring', () => {
	it('returns ten subscores totaling 100 max', () => {
		const details = scoreMeechieQuote('Your phone died but your location was live at her apartment. Interesting.');
		expect(details.subscores).toHaveLength(10);
		expect(details.subscores.reduce((sum, item) => sum + item.max, 0)).toBe(100);
	});

	it('applies banned phrase and empowerment penalties with explicit reasons', () => {
		const details = scoreMeechieQuote('Live laugh love, you got this on your healing journey.');
		expect(details.band).toBe('Reject');
		expect(details.penalties.map((p) => p.key)).toContain('banned_phrase');
		expect(details.penalties.map((p) => p.key)).toContain('generic_empowerment_drift');
		expect(details.reasons.join(' ')).toContain('banned_phrase');
	});

	it('selects the highest scoring quote deterministically', () => {
		const selected = selectBestMeechieQuote([
			'Be yourself and keep going.',
			'Your phone died but your location was live at her apartment. Interesting.',
			'Healing journey energy only.'
		]);
		expect(selected.quote).toBe('Your phone died but your location was live at her apartment. Interesting.');
		expect(selected.band).toMatch(/Approved|Revise|Rewrite|Reject/);
	});
});
