// Purpose: Validate deterministic structured response generation for MeechieTool adapter paths.
// Why: Keep sharper commentary and fault/consequence framing in seam logic, not UI copy.
// Info flow: Tool input -> meechieToolAdapter -> deterministic output assertions.
import { describe, expect, it } from 'vitest';
import {
	createMeechieToolAdapter,
	meechieToolAdapter
} from '../../src/lib/adapters/meechie-tool.adapter';
import { meechieVoiceAdapter } from '../../src/lib/adapters/meechie-voice.adapter';

describe('meechieToolAdapter response shaping', () => {
	it('adds evidence-pattern commentary to rate_excuse', async () => {
		const output = await meechieToolAdapter.respond({
			toolId: 'rate_excuse',
			excuse: 'My phone died and I left you on read with no screenshot proof.'
		});

		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.response).toContain(
				'Evidence pattern: read-receipt trail.'
			);
		}
	});

	it('translates weak apology structures into Meechie logic', async () => {
		const output = await meechieToolAdapter.respond({
			toolId: 'apology_translator',
			apology: "I'm sorry you feel that way but I didn't mean it"
		});

		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.response).toContain('Translation:');
			expect(output.value.response).toContain('Meechie logic');
		}
	});

	it('uses social-role object place consequence structure in caption clapback and receipts', async () => {
		const caption = await meechieToolAdapter.respond({
			toolId: 'caption_this',
			moment: 'airport fit check'
		});
		const clapback = await meechieToolAdapter.respond({
			toolId: 'clapback',
			comment: 'she thinks she all that'
		});
		const receipts = await meechieToolAdapter.respond({
			toolId: 'receipts',
			claim: 'I was working late',
			reality: 'location shows VIP section'
		});

		for (const output of [caption, clapback, receipts]) {
			expect(output.ok).toBe(true);
			if (output.ok) {
				expect(output.value.response).toContain('Role:');
				expect(output.value.response).toContain('Object:');
				expect(output.value.response).toContain('Place:');
				expect(output.value.response).toContain('Consequence:');
			}
		}
	});

	it('frames wwmd and red_flag_or_run with fault and consequence', async () => {
		const wwmd = await meechieToolAdapter.respond({
			toolId: 'wwmd',
			dilemma: 'He left me on read again'
		});
		const redFlag = await meechieToolAdapter.respond({
			toolId: 'red_flag_or_run',
			situation: 'not ready for a relationship but wants to keep seeing me'
		});

		expect(wwmd.ok).toBe(true);
		if (wwmd.ok) {
			expect(wwmd.value.response).toMatch(/Fault:\s*them\b[\s\S]*Consequence:/);
		}
		expect(redFlag.ok).toBe(true);
		if (redFlag.ok) {
			expect(redFlag.value.response).toMatch(
				/Fault:\s*them\b[\s\S]*Consequence:/
			);
		}
	});

	it('generates random_meechie with the AI provider instead of shared module state', async () => {
		const calls: unknown[] = [];
		const adapter = createMeechieToolAdapter({
			getVoicePack: (input) => meechieVoiceAdapter.getVoicePack(input),
			createProvider: () => ({
				createChatCompletion: async (input) => {
					calls.push(input);
					return {
						ok: true,
						value: {
							model: 'test-model',
							content:
								'"He brought excuses to a receipt fight and still asked for mercy."'
						}
					};
				},
				createImageGeneration: async () => ({
					ok: false,
					error: { code: 'UNUSED', message: 'Unused in this test.' }
				})
			})
		});

		const output = await adapter.respond({ toolId: 'random_meechie' });

		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.response).toBe(
				'He brought excuses to a receipt fight and still asked for mercy.'
			);
		}
		expect(calls).toHaveLength(1);
	});
});
