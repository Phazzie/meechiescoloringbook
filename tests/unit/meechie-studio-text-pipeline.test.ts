// Purpose: Unit tests for Meechie studio AI text pipeline.
// Why: Prove provider-backed JSON text is parsed into the contract shape.
// Info flow: Request body -> fake provider -> parsed pipeline response.
import { describe, expect, it } from 'vitest';
import { runMeechieStudioTextPipeline } from '../../src/lib/core/meechie-studio-text-pipeline';

describe('Meechie studio text pipeline', () => {
	it('parses provider JSON into a structured Meechie studio response', async () => {
		const calls: unknown[] = [];
		const response = await runMeechieStudioTextPipeline(
			{
				actionId: 'make_meaner',
				modeId: 'who-fucked-up',
				modeLabel: 'Who Fucked Up?',
				themeLabel: 'Receipts',
				evidence: 'He said his phone died, then posted from the party.',
				voice: {
					intensity: 'receipts_out',
					rawness: 'mild',
					thirdPerson: 'sometimes'
				},
				currentText: {
					verdict: 'That story is weak.',
					quote: 'The phone was not the problem.',
					pageTitle: 'PHONE STORY',
					pageItems: ['CHECK THE STORY', 'COLOR THE TRUTH']
				}
			},
			{
				createProvider: () => ({
					createChatCompletion: async (input) => {
						calls.push(input);
						return {
							ok: true,
							value: {
								model: 'test-model',
								content: JSON.stringify({
									verdict: 'The phone died exactly when accountability showed up.',
									quote: 'A dead battery cannot explain a live post.',
									pageTitle: 'THE POST HAD POWER',
									pageItems: [
										{ number: 1, label: 'CHECK THE POST' },
										{ number: 2, label: 'COLOR THE RECEIPT' }
									],
									rating: 9,
									qualityState: 'ready',
									revisionNote: 'Made meaner.'
								})
							}
						};
					},
					createImageGeneration: async () => ({
						ok: false,
						error: { code: 'UNUSED', message: 'Unused in this pipeline.' }
					})
				})
			}
		);

		expect(response.status).toBe(200);
		expect(response.body.ok).toBe(true);
		if (response.body.ok) {
			expect(response.body.value.verdict).toContain('accountability');
			expect(response.body.value.modelMetadata).toEqual({
				provider: 'xai',
				model: 'test-model'
			});
		}
		expect(calls).toHaveLength(1);
	});
});
