// Purpose: Probe MeechieStudioTextSeam against the live xAI provider.
// Why: meechie-studio-text-pipeline.ts builds VOICE_EXAMPLES from the voice pack, so
//      cutting the pack to ten lines changes the prompt for /api/meechie-studio-text —
//      the primary generate flow on the main page. The MeechieToolSeam probe covers a
//      different endpoint and is no evidence for this one.
// Info flow: studio text input -> live provider via the production adapter -> contract
//            validation + voice assertions.
import { describe, expect, it } from 'vitest';
import { meechieStudioTextAdapter } from '../../src/lib/adapters/meechie-studio-text.adapter';
import { meechieVoicePack } from '../../src/lib/seams/meechie-voice-seam/voice-pack';
import { MeechieStudioTextResultSchema } from '../../contracts/meechie-studio-text.contract';

const skipLive = !(
	process.env.FEATURE_INTEGRATION_TESTS === 'true' && Boolean(process.env.XAI_API_KEY)
);

// The provider adapter allows 3 attempts at a 60s timeout plus backoff, so one call
// can legitimately run past three minutes before returning. Timeouts below that turn
// valid retry behaviour into a false integration failure.
const ADAPTER_WORST_CASE_MS = 200_000;

const baseInput = {
	actionId: 'generate',
	modeId: 'who-fucked-up',
	modeLabel: 'Who Fucked Up?',
	themeLabel: 'Crown Energy',
	voice: { intensity: 'receipts_out', rawness: 'raw', thirdPerson: 'sometimes' }
} as const;

describe('MeechieStudioTextSeam integration', () => {
	it.skipIf(skipLive)(
		'returns contract-valid studio text from the ten-line prompt',
		async () => {
			const result = await meechieStudioTextAdapter.respond({
				...baseInput,
				evidence: 'He said he was working late but his location was live at her apartment.'
			});
			expect(MeechieStudioTextResultSchema.safeParse(result).success).toBe(true);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value.quote.length).toBeGreaterThan(0);
			expect(result.value.pageItems.length).toBeGreaterThanOrEqual(2);
			expect(result.value.pageItems.length).toBeLessThanOrEqual(6);
		},
		ADAPTER_WORST_CASE_MS
	);

	it.skipIf(skipLive)(
		'does not echo a canon line back verbatim',
		async () => {
			// The prompt says to learn the voice from these lines, not copy them. With
			// only ten examples the pull toward quoting them directly is stronger, so
			// this is worth asserting against the live provider rather than assuming.
			const result = await meechieStudioTextAdapter.respond({
				...baseInput,
				evidence: 'He forgot my birthday and posted about somebody else the same night.'
			});
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			const spoken = [result.value.quote, result.value.verdict].join(' ');
			const copied = meechieVoicePack.responses.quotes.filter((quote) =>
				spoken.includes(quote.text)
			);
			expect(copied.map((quote) => quote.id)).toEqual([]);
		},
		ADAPTER_WORST_CASE_MS
	);
});
