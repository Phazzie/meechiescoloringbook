// Purpose: Probe MeechieToolSeam against the live xAI provider.
// Why: The voice pack is the system prompt for every Meechie tool call, so cutting it
//      to ten lines changes live provider behavior. Contract tests use mocks and
//      cannot observe that; this exercises the real adapter.
// Info flow: tool input -> live provider via the production adapter -> contract
//            validation + voice assertions.
import { describe, expect, it } from 'vitest';
// The self-contained adapter, which is what src/lib/core/tools-pipeline.ts imports
// and therefore what /api/tools actually runs. Probing the flat compatibility
// adapter instead would let this stay green while the deployed one diverged.
import { meechieToolAdapter } from '../../src/lib/adapters/meechie-tool-seam';
import { meechieVoicePack } from '../../src/lib/seams/meechie-voice-seam/voice-pack';
import { MeechieToolResultSchema } from '../../contracts/meechie-tool.contract';

const featureEnabled = process.env.FEATURE_INTEGRATION_TESTS === 'true';
const hasApiKey = Boolean(process.env.XAI_API_KEY);
// skipIf rather than an empty placeholder test: a bodyless it.skip has no assertion
// and reads as an ignored test rather than a conditional one.
const skipLive = !(featureEnabled && hasApiKey);

describe('MeechieToolSeam integration', () => {
	it.skipIf(skipLive)(
		'returns contract-valid output for every prompt-driven tool',
		async () => {
			const inputs = [
				{ toolId: 'random_meechie' } as const,
				{
					toolId: 'red_flag_or_run',
					situation:
						'He said he was working late but his location was live at her apartment.'
				} as const,
				{ toolId: 'rate_excuse', excuse: 'My alarm did not go off.' } as const
			];

			for (const input of inputs) {
				const result = await meechieToolAdapter.respond(input);
				expect(MeechieToolResultSchema.safeParse(result).success).toBe(true);
				expect(result.ok).toBe(true);
				if (!result.ok) continue;
				expect(result.value.response.length).toBeGreaterThan(0);
			}
		},
		120_000
	);

	it.skipIf(skipLive)(
		'does not echo a canon line back verbatim',
		async () => {
			// The prompt says to learn the voice from these lines, not copy them. With
			// only ten examples left the pull toward quoting them directly is stronger,
			// so this is worth asserting against the live provider rather than assuming.
			const result = await meechieToolAdapter.respond({
				toolId: 'random_meechie'
			});
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			const copied = meechieVoicePack.responses.quotes.filter((quote) =>
				result.value.response.includes(quote.text)
			);
			expect(copied.map((quote) => quote.id)).toEqual([]);
		},
		120_000
	);
});
