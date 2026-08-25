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

// The provider adapter allows 3 attempts at a 60s timeout plus backoff, so a single
// call can legitimately run past three minutes before returning
// (provider-adapter.adapter.ts CHAT_TIMEOUT_MS / RETRY_OPTIONS). A timeout below that
// turns valid retry behaviour into a false integration failure, so each tool gets its
// own case with its own budget rather than three calls sharing one.
const ADAPTER_WORST_CASE_MS = 200_000;

const TOOL_INPUTS = [
	{ toolId: 'random_meechie' },
	{
		toolId: 'red_flag_or_run',
		situation:
			'He said he was working late but his location was live at her apartment.'
	},
	{ toolId: 'rate_excuse', excuse: 'My alarm did not go off.' }
] as const;

describe('MeechieToolSeam integration', () => {
	it.each(TOOL_INPUTS.map((input) => [input.toolId, input] as const))(
		'returns contract-valid output for %s',
		async (_toolId, input) => {
			if (skipLive) return;
			const result = await meechieToolAdapter.respond(input);
			expect(MeechieToolResultSchema.safeParse(result).success).toBe(true);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value.response.length).toBeGreaterThan(0);
		},
		ADAPTER_WORST_CASE_MS
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
		ADAPTER_WORST_CASE_MS
	);
});
